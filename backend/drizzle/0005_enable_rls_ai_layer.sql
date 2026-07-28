-- Row Level Security for the Phase 3 (AI Layer) tables.
--
-- Same contract as 0001 and 0003: the backend connects as the table owner and so
-- bypasses RLS, leaving its own queries unaffected. RLS constrains the `anon` /
-- `authenticated` roles that Supabase's data APIs use, so if any of these tables
-- is ever reached directly (supabase-js with a user's JWT, a future edge
-- function) a user can only ever touch their own rows.
ALTER TABLE "meal_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "supplement_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "scan_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coach_conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coach_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
    -- Tables that carry the owner directly.
    EXECUTE 'DROP POLICY IF EXISTS meal_plans_self_access ON "meal_plans"';
    EXECUTE 'CREATE POLICY meal_plans_self_access ON "meal_plans" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS supplement_plans_self_access ON "supplement_plans"';
    EXECUTE 'CREATE POLICY supplement_plans_self_access ON "supplement_plans" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS scan_results_self_access ON "scan_results"';
    EXECUTE 'CREATE POLICY scan_results_self_access ON "scan_results" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS coach_conversations_self_access ON "coach_conversations"';
    EXECUTE 'CREATE POLICY coach_conversations_self_access ON "coach_conversations" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';

    EXECUTE 'DROP POLICY IF EXISTS ai_jobs_self_access ON "ai_jobs"';
    EXECUTE 'CREATE POLICY ai_jobs_self_access ON "ai_jobs" FOR ALL TO authenticated '
         || 'USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)';

    -- Child tables have no `user_id` of their own: ownership is inherited from
    -- the parent row, so the policy proves it with an EXISTS over the parent.
    -- Both USING and WITH CHECK are needed — the first governs reading and
    -- deleting an existing child, the second stops a row being inserted under
    -- somebody else's parent.
    EXECUTE 'DROP POLICY IF EXISTS meal_plan_items_self_access ON "meal_plan_items"';
    EXECUTE 'CREATE POLICY meal_plan_items_self_access ON "meal_plan_items" FOR ALL TO authenticated '
         || 'USING (EXISTS (SELECT 1 FROM "meal_plans" p '
         || '  WHERE p.id = meal_plan_items.meal_plan_id AND p.user_id = (SELECT auth.uid()))) '
         || 'WITH CHECK (EXISTS (SELECT 1 FROM "meal_plans" p '
         || '  WHERE p.id = meal_plan_items.meal_plan_id AND p.user_id = (SELECT auth.uid())))';

    EXECUTE 'DROP POLICY IF EXISTS supplement_plan_items_self_access ON "supplement_plan_items"';
    EXECUTE 'CREATE POLICY supplement_plan_items_self_access ON "supplement_plan_items" FOR ALL TO authenticated '
         || 'USING (EXISTS (SELECT 1 FROM "supplement_plans" p '
         || '  WHERE p.id = supplement_plan_items.supplement_plan_id AND p.user_id = (SELECT auth.uid()))) '
         || 'WITH CHECK (EXISTS (SELECT 1 FROM "supplement_plans" p '
         || '  WHERE p.id = supplement_plan_items.supplement_plan_id AND p.user_id = (SELECT auth.uid())))';

    EXECUTE 'DROP POLICY IF EXISTS coach_messages_self_access ON "coach_messages"';
    EXECUTE 'CREATE POLICY coach_messages_self_access ON "coach_messages" FOR ALL TO authenticated '
         || 'USING (EXISTS (SELECT 1 FROM "coach_conversations" c '
         || '  WHERE c.id = coach_messages.conversation_id AND c.user_id = (SELECT auth.uid()))) '
         || 'WITH CHECK (EXISTS (SELECT 1 FROM "coach_conversations" c '
         || '  WHERE c.id = coach_messages.conversation_id AND c.user_id = (SELECT auth.uid())))';

    -- `products` is a shared barcode cache rather than user data — the same
    -- treatment `foods` gets: every signed-in user may read all of it, and
    -- nobody may write it. Populating it is the scanner's job, and the scanner
    -- connects as the owner.
    EXECUTE 'DROP POLICY IF EXISTS products_read_all ON "products"';
    EXECUTE 'CREATE POLICY products_read_all ON "products" FOR SELECT TO authenticated '
         || 'USING (true)';
  END IF;
END
$$;
