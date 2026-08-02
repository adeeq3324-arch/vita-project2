-- Meal timing, and the food knowledge base behind each dish.
--
-- Two things a plan was missing.
--
-- **When.** A plan that says what to eat but not when is only half a plan: the
-- user's own question is "what does my day look like", and the answer needs a
-- clock. `scheduled_time` is a local wall-clock time the generator sets per
-- meal — 24-hour "HH:MM", no zone, because it means "07:30 wherever you are"
-- and not an instant. Empty on plans generated before this existed, which the
-- client renders as a meal with no time rather than as a meal at midnight.
--
-- **What it really is.** The model names dishes and estimates their macros; it
-- has never weighed one. These columns record what a real food database says
-- about the dish it matched: which published recipe it is, where that recipe
-- came from, and the measured figures the model can only guess at — saturated
-- fat, sugar, sodium — which are precisely what a user with high blood
-- pressure or diabetes was told to watch.
--
-- `nutrition_source` is the honesty marker over all of it. `estimated` means
-- the numbers on the row are the model's; `verified` means they came from a
-- matched published recipe, scaled to this user's portion. The client labels
-- the two differently, so a figure is never presented as measured when it was
-- guessed.
CREATE TYPE "public"."nutrition_source" AS ENUM('estimated', 'verified');--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD COLUMN "scheduled_time" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD COLUMN "nutrition_source" "nutrition_source" DEFAULT 'estimated' NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD COLUMN "nutrition_facts" jsonb;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD COLUMN "source_recipe_id" integer;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD COLUMN "source_name" text;--> statement-breakpoint
-- Attribution for a method that was published rather than generated. Null on a
-- recipe the model wrote, which is what the screen keys its credit line off.
ALTER TABLE "meal_recipes" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "meal_recipes" ADD COLUMN "source_name" text;
