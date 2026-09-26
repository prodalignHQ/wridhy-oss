CREATE TYPE "public"."category_type" AS ENUM('expense', 'investment', 'income', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."equity_debt_tag" AS ENUM('equity', 'debt', 'mixed', 'cash');--> statement-breakpoint
CREATE TABLE "vault_blobs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"cipher" text NOT NULL,
	"nonce" text NOT NULL,
	"salt" text NOT NULL,
	"opslimit" integer NOT NULL,
	"memlimit" integer NOT NULL,
	"wrapped_dek_password" text,
	"wrapped_dek_prf" text,
	"prf_credential_id" text,
	"wrapped_dek_recovery" text,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "equity_debt_tag" "equity_debt_tag";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "type" "category_type" DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "is_one_time" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD COLUMN "category_type" text DEFAULT 'expense' NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "is_one_time" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_blobs" ADD CONSTRAINT "vault_blobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "owners" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "owners" DROP COLUMN "type";--> statement-breakpoint
DROP TYPE IF EXISTS "owner_type";--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "metadata" jsonb DEFAULT '{}' NOT NULL;
