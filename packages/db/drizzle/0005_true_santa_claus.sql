ALTER TABLE "net_worth_drafts" DROP CONSTRAINT "net_worth_drafts_user_id_unique";--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "liabilities" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "net_worth_drafts" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "net_worth_snapshots" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "liabilities" ADD CONSTRAINT "liabilities_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "net_worth_drafts" ADD CONSTRAINT "net_worth_drafts_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "net_worth_snapshots" ADD CONSTRAINT "net_worth_snapshots_owner_id_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."owners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "net_worth_drafts" ADD CONSTRAINT "net_worth_drafts_owner_id_unique" UNIQUE("owner_id");