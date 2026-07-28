CREATE TYPE "public"."accent_color" AS ENUM('violet', 'orange', 'cyan', 'green', 'pink', 'red', 'neutral');--> statement-breakpoint
CREATE TYPE "public"."food_category" AS ENUM('fruits', 'vegetables', 'grains', 'protein', 'seafood', 'dairy', 'nuts_and_seeds', 'fats_and_oils', 'beverages', 'snacks', 'sweets', 'prepared_meals', 'condiments');--> statement-breakpoint
CREATE TYPE "public"."meal_type" AS ENUM('breakfast', 'lunch', 'dinner', 'snack');--> statement-breakpoint
CREATE TYPE "public"."nutrition_target_source" AS ENUM('derived', 'custom');--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"category" "food_category" NOT NULL,
	"serving_label" text NOT NULL,
	"serving_size_g" numeric(8, 2) NOT NULL,
	"calories" numeric(8, 2) NOT NULL,
	"protein_g" numeric(7, 2) NOT NULL,
	"carbs_g" numeric(7, 2) NOT NULL,
	"fat_g" numeric(7, 2) NOT NULL,
	"fiber_g" numeric(7, 2) DEFAULT '0' NOT NULL,
	"sugar_g" numeric(7, 2) DEFAULT '0' NOT NULL,
	"saturated_fat_g" numeric(7, 2) DEFAULT '0' NOT NULL,
	"sodium_mg" numeric(8, 2) DEFAULT '0' NOT NULL,
	"icon" text DEFAULT 'silverware-fork-knife' NOT NULL,
	"accent" "accent_color" DEFAULT 'neutral' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce("foods"."name", '') || ' ' || coalesce("foods"."brand", ''))) STORED
);
--> statement-breakpoint
CREATE TABLE "meal_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"food_id" uuid,
	"name" text NOT NULL,
	"meal_type" "meal_type" NOT NULL,
	"servings" numeric(6, 2) DEFAULT '1' NOT NULL,
	"calories" numeric(8, 2) NOT NULL,
	"protein_g" numeric(7, 2) NOT NULL,
	"carbs_g" numeric(7, 2) NOT NULL,
	"fat_g" numeric(7, 2) NOT NULL,
	"fiber_g" numeric(7, 2) DEFAULT '0' NOT NULL,
	"icon" text DEFAULT 'silverware-fork-knife' NOT NULL,
	"accent" "accent_color" DEFAULT 'violet' NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	"logged_on" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "nutrition_target_source" DEFAULT 'derived' NOT NULL,
	"calories" integer NOT NULL,
	"protein_g" integer NOT NULL,
	"carbs_g" integer NOT NULL,
	"fat_g" integer NOT NULL,
	"fiber_g" integer NOT NULL,
	"water_ml" integer NOT NULL,
	"meals_per_day" integer DEFAULT 4 NOT NULL,
	"bmr" numeric(7, 2) NOT NULL,
	"tdee" numeric(7, 2) NOT NULL,
	"inputs_fingerprint" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"steps" integer DEFAULT 0 NOT NULL,
	"water_ml" integer DEFAULT 0 NOT NULL,
	"active_calories" integer DEFAULT 0 NOT NULL,
	"weight_kg" numeric(5, 2),
	"workout_completed" boolean DEFAULT false NOT NULL,
	"workout_minutes" integer DEFAULT 0 NOT NULL,
	"health_score" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_logs" ADD CONSTRAINT "meal_logs_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_targets" ADD CONSTRAINT "nutrition_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_slug_key" ON "foods" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "foods_category_idx" ON "foods" USING btree ("category");--> statement-breakpoint
CREATE INDEX "foods_name_idx" ON "foods" USING btree ("name");--> statement-breakpoint
CREATE INDEX "foods_search_idx" ON "foods" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "meal_logs_user_day_idx" ON "meal_logs" USING btree ("user_id","logged_on");--> statement-breakpoint
CREATE INDEX "meal_logs_user_logged_at_idx" ON "meal_logs" USING btree ("user_id","logged_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "meal_logs_food_id_idx" ON "meal_logs" USING btree ("food_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_targets_user_id_key" ON "nutrition_targets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_metrics_user_date_key" ON "daily_metrics" USING btree ("user_id","date");