# PhoneZone Database (offline / SQLite)

This folder is the **single source of truth** for the offline database. No table
is created anywhere else in the codebase.

```
database/
  schema.sql                     full current schema (generated: copy of all migrations applied in order)
  seed.sql                       idempotent default rows (settings, invoice counters)
  migrations/
    001_initial_schema.sql       initial schema, mirrored from the live Supabase/Postgres schema
    002_business_settings.sql    first-run wizard fields + setup_completed
    003_..._separate_terms.sql   bank details, verification flags, per-kind terms
    004_tac_and_hicelltek.sql    local TAC database + API fallback cache
    005_phone_variant_colour.sql variant (RAM/Storage) and colour
    006_financial_years.sql      financial_years table + financial_year stamps
  README.md
```

## How initialization works

On every backend start (`backend/src/db/index.js`):

1. Resolve the data directory (see `docs/STORAGE.md`) — never the install folder.
2. Open/create `<APP_DATA_DIR>/database/phonezone.db`.
3. `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`
4. Create `schema_migrations` if missing.
5. Apply every `migrations/*.sql` not yet listed in `schema_migrations`, each
   inside a transaction. A failed migration rolls back and aborts startup.
6. Run `seed.sql`.

The user never creates a table manually and an EXE update never wipes data —
an update only adds new migration files, which are applied on next launch.

## Adding a migration

1. Create `migrations/00N_short_description.sql` (never edit an applied file).
2. Use `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN` only —
   SQLite cannot drop or retype columns in place.
3. Run `node scripts/build-schema.mjs` to regenerate `schema.sql`.

## Mapping from the Supabase/Postgres schema

| Postgres | SQLite |
| --- | --- |
| `uuid DEFAULT gen_random_uuid()` | `TEXT PRIMARY KEY`, value from `crypto.randomUUID()` |
| enum types (`app_role`, `id_proof_type`, `payment_method`, `phone_condition`) | `TEXT` + `CHECK (... IN (...))` |
| `text[]` (`features`, `product_photos`, ...) | `TEXT` holding a JSON array |
| `boolean` | `INTEGER` 0/1 |
| `timestamptz` / `date` | `TEXT` ISO-8601 (UTC) |
| `numeric` | `REAL` |
| RLS policies | enforced in the API layer (`requireAuth` / `requireRole`) |
| `BEFORE UPDATE` trigger functions | `AFTER UPDATE` triggers setting `updated_at` |
| `auth.users` | local `users` table + scrypt hashes |
| Storage buckets | local filesystem + `files` metadata table |

New tables that do not exist in Supabase: `users`, `sessions`, `invoices`,
`invoice_counters`, `repairs`, `files`, `audit_logs`, `schema_migrations`.
