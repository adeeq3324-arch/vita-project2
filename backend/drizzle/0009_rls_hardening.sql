-- Phase 5 — Row Level Security hardening.
--
-- Migrations 0001, 0003, 0005 and 0008 enabled RLS and wrote an ownership policy
-- for every table as each phase landed. This migration closes the two gaps a
-- full audit of that surface turned up. It creates no tables and changes no
-- policy semantics: after it runs, exactly the same rows are visible to exactly
-- the same roles.
--
-- Verified continuously by `npm run db:verify-rls`, which fails if any table in
-- `public` is ever left without RLS or without a policy.

-- ── 1. Deny the data API a SECURITY DEFINER function ────────────────────────
--
-- Supabase installs `public.rls_auto_enable()`, an event-trigger function that
-- enables RLS on newly created tables. Because it lives in `public`, PostgREST
-- exposes it at `/rest/v1/rpc/rls_auto_enable`, and Postgres grants EXECUTE to
-- PUBLIC by default — so `anon` and `authenticated` can both reach a
-- SECURITY DEFINER function that runs as its owner.
--
-- Calling it cannot actually do damage (an `event_trigger`-returning function
-- has no meaningful direct invocation), but a definer-rights function reachable
-- by an unauthenticated caller is not something to leave standing on the
-- assumption that it is harmless today. Revoking EXECUTE does not affect the
-- event trigger itself: a trigger fires as its owner regardless of who holds
-- EXECUTE, so RLS continues to be auto-enabled on new tables exactly as before.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC';

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated';
    END IF;
  END IF;
END
$$;--> statement-breakpoint

-- ── 2. Make the write ban on shared catalogues explicit ─────────────────────
--
-- `foods` and `products` are shared reference data: every signed-in user may
-- read all of it, nobody may write it, and both are populated by the backend
-- connecting as the table owner (which bypasses RLS).
--
-- That was already the effect — a `FOR SELECT` policy grants nothing else, and
-- RLS denies whatever no policy permits — but it held only as long as nobody
-- later added a permissive `FOR ALL` policy to either table without thinking
-- about writes. These restrictive policies make the ban structural rather than
-- incidental: a restrictive policy is ANDed with every permissive one, so a
-- future `FOR ALL` policy still cannot grant an INSERT, UPDATE or DELETE here.
--
-- One policy per write command rather than a single `FOR ALL`. That form would
-- leave DELETE open: a restrictive `FOR ALL` supplies `WITH CHECK` to INSERT and
-- UPDATE, but DELETE is governed by `USING`, which such a policy has to leave
-- permissive for reads to keep working. Naming each command avoids that trap.
-- SELECT is deliberately absent, so the existing read policies are untouched.
DO $$
DECLARE
  shared_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    FOREACH shared_table IN ARRAY ARRAY['foods', 'products']
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', shared_table || '_no_client_insert', shared_table);
      EXECUTE format(
        'CREATE POLICY %I ON %I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false)',
        shared_table || '_no_client_insert', shared_table);

      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', shared_table || '_no_client_update', shared_table);
      EXECUTE format(
        'CREATE POLICY %I ON %I AS RESTRICTIVE FOR UPDATE TO authenticated USING (false)',
        shared_table || '_no_client_update', shared_table);

      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', shared_table || '_no_client_delete', shared_table);
      EXECUTE format(
        'CREATE POLICY %I ON %I AS RESTRICTIVE FOR DELETE TO authenticated USING (false)',
        shared_table || '_no_client_delete', shared_table);
    END LOOP;
  END IF;
END
$$;
