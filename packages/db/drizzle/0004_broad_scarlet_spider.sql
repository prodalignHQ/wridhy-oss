CREATE TABLE "net_worth_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"asset_breakdown" jsonb,
	"liability_breakdown" jsonb,
	"saved_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "net_worth_drafts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "net_worth_drafts" ADD CONSTRAINT "net_worth_drafts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;