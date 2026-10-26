# PhoneZone Offline Architecture

```
                     PhoneZone.exe (Electron)
                              |
              +---------------+---------------+
              |                               |
    Frontend (React + Vite)        Local backend (Express)
    served from /dist              127.0.0.1:47713, no public network
              |                               |
              +-------- fetch /api/* ---------+
                                              |
                                       Service layer
                        auth | people | inventory | repair
                        invoice | storage | backup | report
                                              |
                                      Repository / SQL layer
                                       (better-sqlite3)
                                              |
                      +-----------------------+-----------------------+
                      |                                               |
              SQLite phonezone.db                          Local file storage
        <APP_DATA_DIR>/database/                     <APP_DATA_DIR>/storage/
```

## Two runtime modes, one UI

| | Web (Lovable / phonezonestp.lovable.app) | Desktop EXE (offline) |
| --- | --- | --- |
| Data | Supabase Postgres | SQLite `phonezone.db` |
| Files | Supabase Storage bucket | local `storage/` tree |
| Auth | Supabase Auth + RLS | local `users`/`sessions`, scrypt hashes, role checks in the API |
| Network | required | never required |

The React UI is shared. The offline build talks to `/api/*` instead of the
Supabase client; the live site keeps its existing Supabase code paths untouched
so nothing that works today stops working.

## Layer rules

- The frontend never touches SQLite. It only calls HTTP endpoints.
- Only `backend/src/db/index.js` opens the database file.
- Only `backend/src/config/paths.js` produces filesystem paths, and
  `resolveStoragePath()` blocks path traversal on every file access.
- Business rules live in `backend/src/services/*`, never in components.
- Multi-step operations (purchase, sale, return, restore) run inside a single
  SQLite transaction.

## Data directory (never the install folder)

| OS | Location |
| --- | --- |
| Windows | `%APPDATA%\PhoneZone` |
| macOS | `~/Library/Application Support/PhoneZone` |
| Linux/Termux | `~/.local/share/PhoneZone` |

Override with `PHONEZONE_DATA_DIR`. Electron passes `app.getPath('userData')`.

```
<APP_DATA_DIR>/
  database/phonezone.db     backups/  exports/  logs/  config/
  storage/{sellers,customers,phones,purchases,repairs,invoices}/
```

## Startup sequence

```
launch -> resolve data dir -> create folders -> open SQLite (WAL, FK on)
-> create schema_migrations -> apply pending migrations -> run seed.sql
-> create first-run admin if no user exists -> listen on 127.0.0.1 -> open window
```

## Security

Admin auth with scrypt hashing and opaque session tokens (httpOnly cookie,
12 h expiry); every `/api` route except `/api/public/*`, `/api/config` and
`/api/health` requires a session; admin-only routes for backups and audit logs.
Uploads are type- and size-checked and filenames sanitized. The storage root is
never mounted as static files — private documents are only reachable through
`/api/files/:id` behind auth, while `/api/public/files/:id` serves product
photos only. `/api/public/inventory` returns no IMEI, purchase price, profit or
seller data.

## Offline mode toggle (frontend)

The same React build runs online and offline. `src/lib/data/` decides which
backend to talk to:

| Layer | File | Purpose |
| --- | --- | --- |
| Toggle | `src/lib/data/config.ts` | Resolves offline mode |
| Contract | `src/lib/data/types.ts` | Driver interface shared by both modes |
| Online | `src/lib/data/supabaseDriver.ts` | Supabase (live site + Lovable preview) |
| Offline | `src/lib/data/localDriver.ts` | Local Express + SQLite on 127.0.0.1 |
| Entry | `src/lib/data/index.ts` | `import { data } from "@/lib/data"` |

Resolution order: `localStorage["phonezone.offline"]` -> `VITE_PHONEZONE_OFFLINE=true`
-> `window.__PHONEZONE_OFFLINE__` -> auto-detect (loopback host on port 47713).
Default in the browser is **online**, so the hosted site is unaffected.

Migrated so far: featured phones, contact info, contact form, dashboard stats.
Remaining admin tabs still call Supabase directly and are migrated next.

## Offline test suite

`cd backend && npm run test:offline` boots the backend on a throwaway data dir
and runs 47 end-to-end checks: auth and session expiry, RBAC on protected
routes, public-vs-admin field masking, purchase/sale/return workflows, IMEI
validation and duplicate blocking, repairs, file storage and deletion,
messages, dashboard metrics, CSV export, invoice numbering uniqueness, audit
trail, and backup/restore.
