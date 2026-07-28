-- Row Level Security for the Phase 1 tables.
--
-- Enabling RLS is safe on any Postgres: the backend connects as the table
-- owner, which bypasses RLS, so its own queries are unaffected. RLS instead
-- constrains the `anon` / `authenticated` roles that Supabase's data APIs use,
-- guaranteeing that if a table is ever reached directly (e.g. via supabase-js
-- with a user's JWT) a user can only read/write their own rows.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "health_conditions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  -- Ownership policies depend on Supabase's `auth.uid()` helper and the
  -- `authenticated` role. On a plain Postgres (e.g. local docker-compose) these
  -- are absent, so policy creation is skipped there; RLS remains enabled, which
  -- denies all access to non-owner roles by default — the safe outcome.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND EXISTS (
       SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'auth' AND p.proname = 'uid'
     )
  THEN
    EXECUTE 'DROP POLICY IF EXISTS users_self_access ON "users"';
    EXECUTE 'CREATE POLICY users_self_access ON "users" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id)';

    EXECUTE 'DROP POLICY IF EXISTS profiles_self_access ON "profiles"';
    EXECUTE 'CREATE POLICY profiles_self_access ON "profiles" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS goals_self_access ON "goals"';
    EXECUTE 'CREATE POLICY goals_self_access ON "goals" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS health_conditions_self_access ON "health_conditions"';
    EXECUTE 'CREATE POLICY health_conditions_self_access ON "health_conditions" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';
  END IF;
END
$$;
