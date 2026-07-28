CREATE TYPE "public"."achievement_category" AS ENUM('streak', 'nutrition', 'hydration', 'fitness', 'body', 'consistency');--> statement-breakpoint
CREATE TYPE "public"."achievement_surface" AS ENUM('badge', 'milestone');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."reminder_category" AS ENUM('meal', 'water', 'workout', 'supplement', 'weighIn', 'sleep', 'custom');--> statement-breakpoint
CREATE TYPE "public"."snapshot_period" AS ENUM('week', 'month');--> statement-breakpoint
CREATE TYPE "public"."workout_intensity" AS ENUM('low', 'moderate', 'high');--> statement-breakpoint
CREATE TYPE "public"."workout_type" AS ENUM('strength', 'cardio', 'hiit', 'running', 'cycling', 'swimming', 'walking', 'yoga', 'pilates', 'crossfit', 'sports', 'stretching', 'other');--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "workout_type" NOT NULL,
	"name" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"calories_burned" integer DEFAULT 0 NOT NULL,
	"intensity" "workout_intensity" DEFAULT 'moderate' NOT NULL,
	"performed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"performed_on" date NOT NULL,
	"icon" text DEFAULT 'dumbbell' NOT NULL,
	"accent" "accent_color" DEFAULT 'violet' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"period" "snapshot_period" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"weight_start_kg" numeric(5, 2),
	"weight_end_kg" numeric(5, 2),
	"weight_delta_kg" numeric(5, 2),
	"bmi" numeric(4, 1),
	"body_fat_percent" numeric(4, 1),
	"muscle_mass_percent" numeric(4, 1),
	"waist_cm" numeric(5, 1),
	"chest_cm" numeric(5, 1),
	"hips_cm" numeric(5, 1),
	"arm_cm" numeric(5, 1),
	"thigh_cm" numeric(5, 1),
	"avg_calories" numeric(8, 2) DEFAULT '0' NOT NULL,
	"avg_protein_g" numeric(7, 2) DEFAULT '0' NOT NULL,
	"avg_carbs_g" numeric(7, 2) DEFAULT '0' NOT NULL,
	"avg_fat_g" numeric(7, 2) DEFAULT '0' NOT NULL,
	"avg_fiber_g" numeric(7, 2) DEFAULT '0' NOT NULL,
	"avg_water_ml" integer DEFAULT 0 NOT NULL,
	"avg_steps" integer DEFAULT 0 NOT NULL,
	"workout_count" integer DEFAULT 0 NOT NULL,
	"workout_minutes" integer DEFAULT 0 NOT NULL,
	"workout_calories_burned" integer DEFAULT 0 NOT NULL,
	"avg_health_score" smallint,
	"days_logged" integer DEFAULT 0 NOT NULL,
	"streak_days" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"category" "achievement_category" NOT NULL,
	"surface" "achievement_surface" DEFAULT 'badge' NOT NULL,
	"progress" numeric(12, 2) DEFAULT '0' NOT NULL,
	"target" numeric(12, 2) NOT NULL,
	"unlocked_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "reminder_category" DEFAULT 'custom' NOT NULL,
	"message" text,
	"time_of_day" time NOT NULL,
	"days_of_week" smallint[] DEFAULT '{}' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"icon" text DEFAULT 'bell-ring' NOT NULL,
	"accent" "accent_color" DEFAULT 'violet' NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"device_name" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_logs_user_day_idx" ON "workout_logs" USING btree ("user_id","performed_on");--> statement-breakpoint
CREATE INDEX "workout_logs_user_performed_at_idx" ON "workout_logs" USING btree ("user_id","performed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workout_logs_user_type_idx" ON "workout_logs" USING btree ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "progress_snapshots_user_period_key" ON "progress_snapshots" USING btree ("user_id","period","period_start");--> statement-breakpoint
CREATE INDEX "progress_snapshots_user_period_start_idx" ON "progress_snapshots" USING btree ("user_id","period","period_start" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "achievements_user_key_key" ON "achievements" USING btree ("user_id","key");--> statement-breakpoint
CREATE INDEX "achievements_user_unlocked_idx" ON "achievements" USING btree ("user_id","unlocked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "reminders_user_time_idx" ON "reminders" USING btree ("user_id","time_of_day");--> statement-breakpoint
CREATE UNIQUE INDEX "device_tokens_token_key" ON "device_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "device_tokens_user_idx" ON "device_tokens" USING btree ("user_id");