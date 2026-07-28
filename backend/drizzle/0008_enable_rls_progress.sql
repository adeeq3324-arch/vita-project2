-- Row Level Security for the Phase 4 (Progress & Engagement) tables.
--
-- Same contract as 0001, 0003 and 0005: the backend connects as the table owner
-- and so bypasses RLS, leaving its own queries unaffected. RLS constrains the
-- `anon` / `authenticated` roles that Supabase's data APIs use, so if any of these
-- tables is ever reached directly (supabase-js with a user's JWT, an edge
-- function) a user can only ever touch their own rows.
--
-- Every table here carries `user_id` directly, so each policy is the same
-- ownership check — there are no child tables inheriting ownership in this phase.
ALTER TABLE "workout_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "progress_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "achievements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "device_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
    EXECUTE 'DROP POLICY IF EXISTS workout_logs_self_access ON "workout_logs"';
    EXECUTE 'CREATE POLICY workout_logs_self_access ON "workout_logs" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS progress_snapshots_self_access ON "progress_snapshots"';
    EXECUTE 'CREATE POLICY progress_snapshots_self_access ON "progress_snapshots" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';

    -- Achievements are awarded by the backend, never by the client. Read-only for
    -- `authenticated` so a user can see their standing but cannot grant themselves
    -- a badge, or move an unlock date, by talking to the data API directly.
    EXECUTE 'DROP POLICY IF EXISTS achievements_self_read ON "achievements"';
    EXECUTE 'CREATE POLICY achievements_self_read ON "achievements" FOR SELECT TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS reminders_self_access ON "reminders"';
    EXECUTE 'CREATE POLICY reminders_self_access ON "reminders" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS device_tokens_self_access ON "device_tokens"';
    EXECUTE 'CREATE POLICY device_tokens_self_access ON "device_tokens" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';
  END IF;
END
$$;
