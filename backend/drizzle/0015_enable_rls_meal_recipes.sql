-- Row Level Security for `meal_recipes`.
--
-- Same contract as every RLS migration before it: the backend connects as the
-- table owner and bypasses RLS, so its own queries are unaffected. This
-- constrains the `anon` / `authenticated` roles Supabase's data APIs use, so a
-- recipe reached directly with a user's JWT can only ever be one of their own.
--
-- A recipe carries no `user_id` of its own — ownership runs through two hops,
-- from the recipe to its meal and from the meal to the plan that holds the
-- owner. The policy proves both in one EXISTS rather than trusting the middle
-- row, and applies to WITH CHECK as well as USING so nothing can be inserted
-- under somebody else's meal.
ALTER TABLE "meal_recipes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  -- Supabase's `auth.uid()` helper and the `authenticated` role are absent on a
  -- plain Postgres (local docker-compose), so policy creation is skipped there.
  -- RLS stays enabled, which denies all access to non-owner roles by default —
  -- the safe outcome.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     AND EXISTS (
       SELECT 1 FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'auth' AND p.proname = 'uid'
     )
  THEN
    EXECUTE 'DROP POLICY IF EXISTS meal_recipes_self_access ON "meal_recipes"';
    EXECUTE 'CREATE POLICY meal_recipes_self_access ON "meal_recipes" FOR ALL TO authenticated '
         || 'USING (EXISTS (SELECT 1 FROM "meal_plan_items" i '
         || '  JOIN "meal_plans" p ON p.id = i.meal_plan_id '
         || '  WHERE i.id = meal_recipes.meal_plan_item_id AND p.user_id = (SELECT auth.uid()))) '
         || 'WITH CHECK (EXISTS (SELECT 1 FROM "meal_plan_items" i '
         || '  JOIN "meal_plans" p ON p.id = i.meal_plan_id '
         || '  WHERE i.id = meal_recipes.meal_plan_item_id AND p.user_id = (SELECT auth.uid())))';
  END IF;
END
$$;
