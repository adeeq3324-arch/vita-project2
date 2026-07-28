CREATE TYPE "public"."ai_job_status" AS ENUM('queued', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_job_type" AS ENUM('mealPlan', 'supplementPlan', 'foodScan', 'colorScan', 'barcodeScan', 'coachChat');--> statement-breakpoint
CREATE TYPE "public"."coach_personality" AS ENUM('scientist', 'motivator', 'zenMaster');--> statement-breakpoint
CREATE TYPE "public"."coach_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('idle', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scan_type" AS ENUM('food', 'colorQuality', 'barcode');--> statement-breakpoint
CREATE TYPE "public"."supplement_time" AS ENUM('morning', 'afternoon', 'evening', 'withMeal');--> statement-breakpoint
CREATE TABLE "meal_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_plan_id" uuid NOT NULL,
	"day_of_week" smallint NOT NULL,
	"meal_type" "meal_type" NOT NULL,
	"name" text NOT NULL,
	"calories" numeric(8, 2) NOT NULL,
	"protein_g" numeric(7, 2) NOT NULL,
	"carbs_g" numeric(7, 2) NOT NULL,
	"fat_g" numeric(7, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start_date" date NOT NULL,
	"status" "generation_status" DEFAULT 'idle' NOT NULL,
	"calorie_target" integer NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplement_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplement_plan_id" uuid NOT NULL,
	"supplement_name" text NOT NULL,
	"best_time" "supplement_time" NOT NULL,
	"guidance" text NOT NULL,
	"purpose" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplement_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"month_start_date" date NOT NULL,
	"status" "generation_status" DEFAULT 'idle' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barcode" text NOT NULL,
	"brand" text NOT NULL,
	"name" text NOT NULL,
	"ingredients" text[] DEFAULT '{}' NOT NULL,
	"rating" smallint NOT NULL,
	"ai_alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "scan_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "scan_type" NOT NULL,
	"image_url" text,
	"barcode_value" text,
	"product_id" uuid,
	"food_name" text NOT NULL,
	"calories" numeric(8, 2) NOT NULL,
	"protein_g" numeric(7, 2) NOT NULL,
	"carbs_g" numeric(7, 2) NOT NULL,
	"fat_g" numeric(7, 2) NOT NULL,
	"health_score" smallint NOT NULL,
	"ai_insight" text NOT NULL,
	"freshness_score" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"personality" "coach_personality" DEFAULT 'motivator' NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coach_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "coach_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "ai_job_type" NOT NULL,
	"status" "ai_job_status" DEFAULT 'queued' NOT NULL,
	"result_ref_id" uuid,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_plan_items" ADD CONSTRAINT "meal_plan_items_meal_plan_id_meal_plans_id_fk" FOREIGN KEY ("meal_plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplement_plan_items" ADD CONSTRAINT "supplement_plan_items_supplement_plan_id_supplement_plans_id_fk" FOREIGN KEY ("supplement_plan_id") REFERENCES "public"."supplement_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplement_plans" ADD CONSTRAINT "supplement_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_results" ADD CONSTRAINT "scan_results_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_conversations" ADD CONSTRAINT "coach_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_messages" ADD CONSTRAINT "coach_messages_conversation_id_coach_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."coach_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_plan_items_plan_day_idx" ON "meal_plan_items" USING btree ("meal_plan_id","day_of_week");--> statement-breakpoint
CREATE UNIQUE INDEX "meal_plans_user_week_key" ON "meal_plans" USING btree ("user_id","week_start_date");--> statement-breakpoint
CREATE INDEX "meal_plans_user_created_idx" ON "meal_plans" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "supplement_plan_items_plan_idx" ON "supplement_plan_items" USING btree ("supplement_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplement_plans_user_month_key" ON "supplement_plans" USING btree ("user_id","month_start_date");--> statement-breakpoint
CREATE INDEX "supplement_plans_user_created_idx" ON "supplement_plans" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "scan_results_user_created_idx" ON "scan_results" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "scan_results_user_type_idx" ON "scan_results" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "coach_conversations_user_updated_idx" ON "coach_conversations" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "coach_messages_conversation_created_idx" ON "coach_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_jobs_user_created_idx" ON "ai_jobs" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "ai_jobs_result_ref_idx" ON "ai_jobs" USING btree ("result_ref_id");--> statement-breakpoint
CREATE INDEX "ai_jobs_status_idx" ON "ai_jobs" USING btree ("status");