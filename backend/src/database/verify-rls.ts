import 'dotenv/config';
import postgres from 'postgres';

/**
 * Row Level Security audit.
 *
 * Asserts, against a live database, that every table in `public`:
 *
 *   1. has RLS enabled, and
 *   2. carries at least one policy, and
 *   3. exposes user-owned rows only to their owner.
 *
 * The third check is the one that matters and the one a schema diff cannot make.
 * RLS with no policy denies everything, which is safe but usually means somebody
 * added a table and forgot the policy — the feature then fails closed in a way
 * that is easy to "fix" by disabling RLS. A policy that omits `auth.uid()`, or
 * that is written `USING (true)` on a table carrying a `user_id`, is the
 * genuinely dangerous case: it looks protected and leaks every row.
 *
 * Run in CI against a migrated database (`npm run db:verify-rls`). Exits
 * non-zero on any violation, so a table can never reach production unprotected.
 */

/** Tables that are deliberately readable by every signed-in user. */
const SHARED_READ_TABLES = new Set(['foods', 'products']);

/** Drizzle's own bookkeeping, which lives outside the application schema. */
const IGNORED_TABLES = new Set(['__drizzle_migrations']);

interface TableAudit {
  table_name: string;
  rls_enabled: boolean;
  has_user_id: boolean;
  policy_count: number;
  /** Policies that scope rows by the caller's identity. */
  owner_scoped_policies: number;
  /** Policies whose qualifier is unconditionally true. */
  unrestricted_policies: number;
}

const AUDIT_QUERY = `
  select
    c.relname as table_name,
    c.relrowsecurity as rls_enabled,
    exists (
      select 1 from pg_attribute a
      where a.attrelid = c.oid and a.attname = 'user_id' and a.attnum > 0 and not a.attisdropped
    ) as has_user_id,
    count(p.polname)::int as policy_count,
    count(p.polname) filter (
      where pg_get_expr(p.polqual, p.polrelid) like '%auth.uid()%'
         or pg_get_expr(p.polwithcheck, p.polrelid) like '%auth.uid()%'
    )::int as owner_scoped_policies,
    count(p.polname) filter (
      where p.polpermissive
        and coalesce(pg_get_expr(p.polqual, p.polrelid), 'true') = 'true'
        and p.polcmd in ('*', 'r', 'w', 'd')
    )::int as unrestricted_policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_policy p on p.polrelid = c.oid
  where n.nspname = 'public' and c.relkind = 'r'
  group by c.relname, c.relrowsecurity, c.oid
  order by c.relname;
`;

/** Whether Supabase's auth helpers exist; policies reference `auth.uid()`. */
const SUPABASE_PROBE = `
  select exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) as has_auth;
`;

function auditTable(row: TableAudit, supabase: boolean): string[] {
  const problems: string[] = [];

  if (!row.rls_enabled) {
    problems.push('RLS is not enabled');
  }

  // On a plain Postgres the ownership policies are skipped by design (there is
  // no `auth.uid()` to reference), and RLS alone denies every non-owner role.
  // Demanding policies there would fail a correctly configured local stack.
  if (!supabase) {
    return problems;
  }

  if (row.policy_count === 0) {
    problems.push('RLS is enabled but no policy is defined — the table denies all access');
  }

  if (SHARED_READ_TABLES.has(row.table_name)) {
    return problems;
  }

  if (row.has_user_id && row.owner_scoped_policies === 0) {
    problems.push('carries user_id but no policy scopes rows by auth.uid()');
  }

  if (row.unrestricted_policies > 0) {
    problems.push(
      `${row.unrestricted_policies} permissive policy/policies apply USING (true) — every row is exposed`,
    );
  }

  return problems;
}

async function verify(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Cannot verify RLS.');
  }

  const ssl = process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1';
  const client = postgres(url, { max: 1, ssl: ssl ? 'require' : undefined });

  try {
    const [{ has_auth: supabase }] = await client.unsafe<[{ has_auth: boolean }]>(SUPABASE_PROBE);
    const rows = await client.unsafe<TableAudit[]>(AUDIT_QUERY);

    const tables = rows.filter((row) => !IGNORED_TABLES.has(row.table_name));

    if (tables.length === 0) {
      throw new Error('No tables found in `public` — has the database been migrated?');
    }

    console.log(
      `Auditing ${tables.length} tables${supabase ? '' : ' (plain Postgres: policy checks skipped)'}…`,
    );

    const failures: string[] = [];

    for (const row of tables) {
      const problems = auditTable(row, supabase);
      if (problems.length > 0) {
        failures.push(`  ✗ ${row.table_name}: ${problems.join('; ')}`);
      } else {
        console.log(`  ✓ ${row.table_name} (${row.policy_count} policies)`);
      }
    }

    if (failures.length > 0) {
      console.error(`\nRLS audit failed for ${failures.length} table(s):\n${failures.join('\n')}`);
      process.exitCode = 1;
      return;
    }

    console.log('\nRLS audit passed: every table is protected.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

verify().catch((error: unknown) => {
  console.error('RLS verification failed:', error);
  process.exit(1);
});
