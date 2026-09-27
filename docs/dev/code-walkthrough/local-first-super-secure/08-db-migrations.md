# 08 — DB migrations (`packages/db`)

`vault_blobs` and `vault_wraps` exist in all three schema files per the repo's CRITICAL RULE (`schema.ts` ↔ `schema.sqlite.ts` ↔ `sqlite-init.ts`, plus the `index.ts` export and relations).

## `0006_same_the_renegades.sql`

`vault_blobs` (one row/user: `cipher/nonce/salt/opslimit/memlimit/wrapped_dek_password/wrapped_dek_recovery/version`, no PRF columns after 0007) plus the release's other deltas. Amended with drift fixes the committed chain was missing: `owners.notes`, `assets.metadata`, drop of stale `owners.type` + `owner_type` enum (the old migrations had drifted from `schema.ts` — found via old-vs-new `information_schema` diff).

## `0007_crazy_northstar.sql`

`vault_wraps` (composite PK `(user_id, credential_id)`, cascade FK) with **data preservation first**: existing single-device PRF wraps are copied over before the old columns drop.

## Workflow note (in CLAUDE.md)

`drizzle-kit push` is interactive and hangs under pipes — use `generate` + apply SQL via `docker exec … psql -f` (strip `--> statement-breakpoint`). Fresh DBs apply `0000→NNNN` in order. The new `momoney_db_secure` database was built exactly this way and diffed clean against `schema.ts` (superset of the legacy DB by exactly the intended columns).
