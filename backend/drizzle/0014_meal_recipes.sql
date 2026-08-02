-- Recipes for planned meals.
--
-- A plan named dishes and never said how to make one. This table is where that
-- lives: the shopping list, the method, the timings and the advice a cook needs
-- to actually put the plan on a plate.
--
-- It is its own table rather than more columns on `meal_plan_items` because the
-- two are written at different times. A week is up to fifty-six dishes and a
-- user cooks a handful; generating every method during plan generation would
-- multiply the cost and the wait of every plan for work almost all of which is
-- discarded. A row appears here the first time someone opens a dish, and is read
-- from then on.
--
-- The unique index over `meal_plan_item_id` is what makes that safe under two
-- simultaneous taps: both may generate, only one row lands, and the loser reads
-- back the winner instead of giving the same dish a second, different method.
-- `ON DELETE cascade` covers a deleted meal; a *swapped* meal keeps its row id,
-- so the swap path deletes the recipe explicitly.
CREATE TYPE "public"."recipe_difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TABLE "meal_recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_plan_item_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"cuisine" text DEFAULT '' NOT NULL,
	"difficulty" "recipe_difficulty" DEFAULT 'easy' NOT NULL,
	"servings" integer DEFAULT 1 NOT NULL,
	"prep_minutes" integer DEFAULT 0 NOT NULL,
	"cook_minutes" integer DEFAULT 0 NOT NULL,
	"ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tips" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_recipes" ADD CONSTRAINT "meal_recipes_meal_plan_item_id_meal_plan_items_id_fk" FOREIGN KEY ("meal_plan_item_id") REFERENCES "public"."meal_plan_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "meal_recipes_item_key" ON "meal_recipes" USING btree ("meal_plan_item_id");