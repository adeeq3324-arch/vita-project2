-- Phase 6 — Planning detail.
--
-- The planning surface previously stored the minimum a week of meals needs to
-- add up: a dish name and four macros. That is enough to validate a plan and not
-- enough to follow one. This migration widens both plan item tables to carry
-- what the plan screens actually show — fibre and the reason a dish was chosen,
-- and for supplements the core/optional split, the benefits and the cautions.
--
-- Every added column has a default, so existing rows stay valid and no backfill
-- is required: a plan generated before this migration reads as one with no fibre
-- recorded and no reasoning attached, which is exactly what it is.
--
-- `brand`, `rating` and `rating_count` are nullable and never written by the
-- generator. They exist so a real product catalogue can populate them later
-- without another migration; until then the client renders the fields it has and
-- omits the ones it does not, rather than showing an invented endorsement.
--
-- The three added `supplement_time` values are timings, not times of day:
-- "post-workout" is the whole instruction for creatine or whey, and the previous
-- four-value enum could only express it by discarding it. Adding values is safe
-- inside the migrator's transaction — PostgreSQL 12+ permits ADD VALUE in a
-- transaction block provided the new value is not used before it commits, and
-- nothing below writes one.
CREATE TYPE "public"."supplement_tier" AS ENUM('core', 'optional');--> statement-breakpoint
ALTER TYPE "public"."supplement_time" ADD VALUE 'preWorkout';--> statement-breakpoint
ALTER TYPE "public"."supplement_time" ADD VALUE 'postWorkout';--> statement-breakpoint
ALTER TYPE "public"."supplement_time" ADD VALUE 'beforeBed';--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD COLUMN "fiber_g" numeric(7, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD COLUMN "reasoning" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD COLUMN "tier" "supplement_tier" DEFAULT 'core' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD COLUMN "category" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD COLUMN "headline" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD COLUMN "benefits" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD COLUMN "safety" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD COLUMN "duration_days" integer;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD COLUMN "brand" text;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD COLUMN "rating" numeric(2, 1);--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD COLUMN "rating_count" integer;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD COLUMN "image_url" text;