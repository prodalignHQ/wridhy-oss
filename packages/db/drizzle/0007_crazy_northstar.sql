CREATE TABLE "vault_wraps" (
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"wrapped_dek" text NOT NULL,
	"label" text DEFAULT 'Passkey' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vault_wraps_user_id_credential_id_pk" PRIMARY KEY("user_id","credential_id")
);
--> statement-breakpoint
ALTER TABLE "vault_wraps" ADD CONSTRAINT "vault_wraps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Preserve any existing single-device PRF wraps before dropping the columns.
INSERT INTO "vault_wraps" ("user_id", "credential_id", "wrapped_dek", "label")
SELECT "user_id", "prf_credential_id", "wrapped_dek_prf", 'Passkey'
FROM "vault_blobs"
WHERE "wrapped_dek_prf" IS NOT NULL AND "prf_credential_id" IS NOT NULL
ON CONFLICT ("user_id", "credential_id") DO NOTHING;
--> statement-breakpoint
ALTER TABLE "vault_blobs" DROP COLUMN "wrapped_dek_prf";--> statement-breakpoint
ALTER TABLE "vault_blobs" DROP COLUMN "prf_credential_id";