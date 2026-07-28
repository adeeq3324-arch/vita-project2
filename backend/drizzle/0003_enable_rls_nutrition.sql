-- Row Level Security for the Phase 2 (Nutrition Core) tables.
--
-- Same contract as 0001: the backend connects as the table owner and so
-- bypasses RLS, leaving its own queries unaffected. RLS constrains the `anon` /
-- `authenticated` roles that Supabase's data APIs use, so if any of these tables
-- is ever reached directly (supabase-js with a user's JWT, a future edge
-- function) a user can only ever touch their own rows.
ALTER TABLE "foods" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meal_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "nutrition_targets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_metrics" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
    -- `foods` is a shared, curated catalogue rather than user data: every
    -- signed-in user may read all of it, and nobody may write it. Loading the
    -- catalogue is the seeder's job, and the seeder connects as the owner.
    EXECUTE 'DROP POLICY IF EXISTS foods_read_all ON "foods"';
    EXECUTE 'CREATE POLICY foods_read_all ON "foods" FOR SELECT TO authenticated '
         || 'USING (true)';

    EXECUTE 'DROP POLICY IF EXISTS meal_logs_self_access ON "meal_logs"';
    EXECUTE 'CREATE POLICY meal_logs_self_access ON "meal_logs" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS nutrition_targets_self_access ON "nutrition_targets"';
    EXECUTE 'CREATE POLICY nutrition_targets_self_access ON "nutrition_targets" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS daily_metrics_self_access ON "daily_metrics"';
    EXECUTE 'CREATE POLICY daily_metrics_self_access ON "daily_metrics" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';
  END IF;
END
$$;
