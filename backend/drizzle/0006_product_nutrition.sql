ALTER TABLE "products" ADD COLUMN "calories" numeric(8, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "protein_g" numeric(7, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "carbs_g" numeric(7, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "fat_g" numeric(7, 2) DEFAULT '0' NOT NULL;