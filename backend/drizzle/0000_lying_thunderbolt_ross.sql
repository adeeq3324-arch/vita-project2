CREATE TYPE "public"."activity_level" AS ENUM('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active');--> statement-breakpoint
CREATE TYPE "public"."auth_provider" AS ENUM('email', 'google', 'apple');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('male', 'female', 'other', 'prefer_not_to_say');--> statement-breakpoint
CREATE TYPE "public"."health_condition" AS ENUM('diabetes', 'high_blood_pressure', 'heart_conditions', 'asthma', 'thyroid_problems', 'high_cholesterol', 'kidney_problems', 'arthritis', 'pregnancy');--> statement-breakpoint
CREATE TYPE "public"."primary_goal" AS ENUM('muscle_gain', 'weight_loss', 'healthy_lifestyle');--> statement-breakpoint
CREATE TYPE "public"."unit_system" AS ENUM('metric', 'imperial');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"provider" "auth_provider" DEFAULT 'email' NOT NULL,
	"provider_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"age" integer NOT NULL,
	"gender" "gender" NOT NULL,
	"height_cm" numeric(5, 2) NOT NULL,
	"weight_kg" numeric(5, 2) NOT NULL,
	"activity_level" "activity_level" NOT NULL,
	"unit_system" "unit_system" DEFAULT 'metric' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"primary_goal" "primary_goal" NOT NULL,
	"target_weight_kg" numeric(5, 2),
	"start_date" date,
	"target_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_conditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"condition" "health_condition" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_conditions" ADD CONSTRAINT "health_conditions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_provider_idx" ON "users" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_user_id_key" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "health_conditions_user_condition_key" ON "health_conditions" USING btree ("user_id","condition");--> statement-breakpoint
CREATE INDEX "health_conditions_user_id_idx" ON "health_conditions" USING btree ("user_id");