-- Supplement facts, and the recommendation that has to travel with them.
--
-- A supplement item described how to take the substance but never said what the
-- substance is. `serving_size` and `ingredients` answer that: what one serving
-- is, and every compound in it with its amount — the panel a person can check
-- against a label in their hand, including the energy and macronutrients where
-- the form has any.
--
-- `ingredients` is jsonb rather than two text[] columns because a name and its
-- amount are one fact. Parallel arrays can fall out of step, and a panel showing
-- "25 g" against the wrong compound is worse than showing nothing at all.
--
-- `recommendation` is the closing advice, and it exists as its own column so it
-- cannot be dropped by a surface that only wants the facts. Its content is
-- always the same in substance — take this to a healthcare provider and agree an
-- amount with them before starting — and code guarantees the standing disclaimer
-- is present regardless of what the model returned.
--
-- All three default, so rows written before this migration stay valid and read
-- as what they are: an item with no facts panel recorded yet.
ALTER TABLE "supplement_plan_items" ADD COLUMN "serving_size" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD COLUMN "ingredients" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD COLUMN "recommendation" text DEFAULT '' NOT NULL;
