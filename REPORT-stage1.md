# REPORT stage 1

Date/time: 2026-10-16 07:43 UTC+5:30 · Agent: Buffy (Freebuff, deepseek-v4-flash) · OS: Windows 10.0.26200 (win32 x64) · Node: v24.21.0

## 0. Summary

* **Requested:** Stage 1 only = spec Prompts 0, 1, 2 (app must start, be safe to expose, and validate phone purchases on the server), plus helper tools H1-H4 and this report.
* **DONE:** All 10 Step-0 blockers were PRESENT in this folder; 9 of them are fixed (B5 `electron/` deliberately deferred to Stage 3). App now starts, migrations apply, every P0 is closed, security hardening (Prompts 1) and server-side purchase validation (Prompt 2) are in. Helpers created: `VERIFY.bat`, `MAKE-ZIP.bat`, `SEED-DEMO.bat` + their scripts, `.gitignore`, `.env.example`.
* **PARTIAL:** none.
* **FAILED:** A20 (`npx tsc --noEmit` exits 2 — 15 pre-existing type errors in 6 unmodified frontend files; `npm run build` exits 0). See §3 and §7.
* **NOT RUN:** Electron/tray (Stage 3), repairs UI (Stage 2), WhatsApp (Stage 4), Tailscale (Stage 3). Nothing else was skipped.
* **Evidence:** 23 assertions PASS, 1 FAIL, 0 SKIPPED. Backend suites: 128 + 32 checks, 0 failures.

## 1. STEP 0 reconciliation (B1-B10)

Every item was checked in **this** folder (file + line, or command output). Nothing was assumed from the audit.

| # | Item | Verdict | Evidence in this folder |
|---|---|---|---|
| B1 | `backend/src/routes/index.js` has TypeScript in a plain `.js` file | **PRESENT** | `grep -n ": string"` → lines 33 `checkLoginRateLimit(email: string)`, 48 `recordFailedLogin(email: string)`, 59 `resetLoginAttempts(email: string)`. `node src/server.js` died with `SyntaxError: Unexpected token ':'` |
| B2 | `database/migrations/008_admin_settings_flags.sql` exists with `ADD COLUMN IF NOT EXISTS` | **PRESENT** | File existed; lines 7-8 used `ADD COLUMN IF NOT EXISTS` twice. Both columns already exist in `003` and in `database/schema.sql:35-36` |
| B3 | `compat.js` calls `table(` with no such function/const | **PRESENT** | `grep -n "function table\|const table" compat.js` → "no table def"; call sites lines 133, 191, 233, 245 |
| B4 | Login rate limiter exists but is never called inside `POST /auth/login` | **PRESENT** | All three limiter functions defined at lines 33/48/59; the only other occurrence of those names in the file was the definitions themselves |
| B5 | `electron/` missing while `package.json main` = `electron/main.cjs` | **PRESENT** | `ls -la electron` → "electron MISSING"; root `package.json` `"main": "electron/main.cjs"` |
| B6 | `GET /api/config` returns bank fields | **PRESENT** | Route returned `settings.getSettings()` verbatim, which includes `bankName`, `accountHolderName`, `accountNumber`, `ifscCode` (plus `tacFetchMode`, `messageTemplates`) |
| B7 | `GET /pg/storage/object/:bucket/*` has no auth middleware | **PRESENT** | `compat.js` route was registered as `r.get("/storage/object/:bucket/*", wrap(...))` — no `staff` |
| B8 | `ensureBootstrapAdmin` creates an admin at startup when no users exist | **PRESENT** | `authService.js` created `admin@phonezone.local` with `newToken().slice(0,16)` when `PHONEZONE_ADMIN_PASSWORD` was unset, and `server.js` printed it |
| B9 | `/pg/:table/delete` calls `buildWhere` without the table and allows empty filters | **PRESENT** | `const where = buildWhere(req.body?.filters \|\| []);` — the table argument was omitted, so `buildWhere`'s whitelist was bypassed (`if (tableName && ...)`); no empty-filter guard |
| B10 | `AddPhoneDialog.tsx` inserts phones via `supabase.from('phones').insert` in offline mode | **PRESENT** | `AddPhoneDialog.tsx:356` (sellers insert) and `:373-374` (`from('phones').insert`), no offline branch |

**B5 is the only PRESENT item not fixed in this stage.** Creating `electron/` is Prompt 6 / Stage 3 work and rule R11 ("do only the stage in `STAGE_TO_RUN_NOW`") forbids starting it now. It is the single reason the EXE cannot be built yet, and it is Stage 3's first task.

**Does the folder start at all?** Before this stage: **no** (B1 syntax error, then B2 migration error, then B3 broke every admin read). After: yes — `node src/server.js` prints `listening on http://127.0.0.1:47713` (real output in §4).

## 2. Files changed

Backup folder: **`_backup_stage1_20261016-1242/`** (181 files, `src`, `backend` without `node_modules`, `database`, `config`, `scripts`, `package.json`, `vite.config.ts`; `_backup_*/` added to `.gitignore`).

| path | change | reason | lines |
|---|---|---|---|
| `backend/src/routes/index.js` | edited | remove TS syntax, wire the login rate limiter, public `/config` projection, loopback-only setup lock, file headers, message rate limit, 500 MB restore upload | +120 |
| `backend/src/routes/compat.js` | edited | add the missing `table()` guard + `badRequest` import; filterless/injection-proof soft delete; hide archived rows; require a session for private objects | +92 |
| `backend/src/services/authService.js` | edited | no startup admin without an explicit env password, never generate/print one; store `sha256(token)` for sessions | +8 |
| `backend/src/services/storageService.js` | edited | reject `text/html`; decide the type from magic bytes; public flag from the bucket folder | +45 |
| `backend/src/services/inventoryService.js` | edited | seller created inside the purchase transaction (no orphan), duplicate-IMEI rule, sale guard for `purchase_returned`, `processed_by` = signed-in user, return guards | +78 |
| `backend/src/services/invoiceService.js` | edited | invoice counter keyed by **financial year** instead of calendar year | +6 |
| `backend/src/services/backupService.js` | edited | **relative tar paths (backups were failing),** archive listing/symlink validation, real rollback of the parked folders | +103 |
| `backend/src/lib/validation.js` | edited | Luhn checksum for 15-digit IMEIs + a message that says what to do | +31 |
| `backend/src/server.js` | edited | `helmet` (CSP + friends), never print a password, clearer first-run message | +31 |
| `backend/package.json` / `backend/package-lock.json` | edited | add `helmet` ^8.3.0 | +1 / lockfile |
| `backend/test/offline-suite.mjs` | edited | bootstrap-admin login → setup wizard; real PNG upload; +30 new stage-1 checks | +191 |
| `backend/test/first-setup-suite.mjs` | edited | setup-before-login, Luhn-valid IMEI, relative tar listing | +15 |
| `src/components/admin/AddPhoneDialog.tsx` | edited | offline mode goes through `POST /api/purchases`; the Supabase path is unchanged for online mode | +48 |
| `src/lib/data/offlineSupabase.ts` | edited | `getPublicUrl` returns the login-free public route for server-flagged public files, the credentialed object route for documents | +22 |
| `database/migrations/008_admin_settings_flags.sql` | **deleted** | invalid SQLite syntax; both columns already created by `003` and present in `schema.sql` | −13 |
| `database/migrations/009_hashed_sessions.sql` | new | invalidate legacy raw-token sessions after the sha256 change | 16 |
| `database/migrations/010_public_product_photos.sql` | new | backfill `files.is_public` for existing product photos so the public catalogue keeps working | 26 |
| `supabase/migrations/20261016_private_storage.sql` | new | (online mode) make the uploads bucket private, drop the four "Allow public ..." policies, authenticated-only policies. **Not executed** | 47 |
| `.gitignore` | edited | the full hygiene list (`data/`, `data11/`, `*.db*`, `.env`, `*.tar.gz`, `_backup_*`, …) | 63 |
| `.env.example` | new | placeholder names only, empty values | 26 |
| `VERIFY.bat` / `scripts/verify-all.mjs` | new | H1 helper, writes `VERIFY_OUTPUT.txt` | 37 / 838 |
| `MAKE-ZIP.bat` / `scripts/make-clean-zip.mjs` | new | H2 helper, safety-scanned clean zip + `ZIP_MANIFEST.txt` | 37 / 296 |
| `SEED-DEMO.bat` / `scripts/seed-demo.mjs` | new | H3 helper, fake demo DB in a temp folder | 29 / 230 |
| `scratch/` | moved | 29 debug leftovers moved out of the root (`tmp-*.mjs`, `.tmp-*`, `back-*.png`, `ngrok-*`, `eng.traineddata`, logs) — nothing deleted | — |

`backend/src/services/settingsService.js` was read but **not** changed: the public projection is applied in the route, so the authenticated `GET /api/settings` still returns the full object.

## 3. Assertions (Section 5, stage 1 = A01-A20)

| ID | Verdict | Command / test | Evidence |
|---|---|---|---|
| A01 | **PASS** | `scripts/verify-all.mjs` step 2 (`node --check` on backend/src, backend/test, scripts) | `32 files checked, 0 failed` |
| A02 | **PASS** | migrations 001-010 into a brand-new temp DB | `9/9 migrations applied to a brand-new database` (008 deleted, so 9 files remain) |
| A03 | **PASS** | DB pre-stamped with 001-007, then the real server opens it | `7 pre-stamped, 9/9 after startup` |
| A04 | **PASS** | boot with `PHONEZONE_DATA_DIR` = temp dir, then `GET /api/health` | `200`, `{"ok":true,"offline":true,...}` |
| A05 | **PASS** | users table read straight after boot; start-up log scanned; then `POST /api/setup` | `users at startup = 0, password printed = false`; `setup -> 200, admin accounts = 1`; `admin@phonezone.local` login → 401 |
| A06 | **PASS** | 10 wrong passwords, correct password, then a 3 s window run | `10 wrong = 401, 11th = 429, blocked correct = 429, after window = 200`; message: "Too many failed attempts. Please try again in 1 minute." |
| A07 | **PASS** | `POST /api/pg/phones/select` with a session | `200`, JSON array (was a hard 500 `table is not defined`) |
| A08 | **PASS** | `POST /api/pg/phones/delete` `{filters:[]}` | `400`, `phones = 0` afterwards |
| A09 | **PASS** | same route, `col: 'id" OR 1=1 --'` | `400`, `phones = 0` afterwards |
| A10 | **PASS** | soft-delete a phone and a seller through the compat layer | read straight from the temp DB: `phone row kept = true, deleted_at set = true, hidden from select = true` |
| A11 | **PASS** | anonymous `GET /api/config` | `no private fields` (none of bankName/accountHolderName/accountNumber/ifscCode/tacFetchMode/messageTemplates present) |
| A12 | **PASS** | anonymous `GET /api/pg/storage/object/phonezone-uploads/purchase-documents/x.jpg` | `401` |
| A13 | **PASS** | HTML renamed `.jpg`, then a real 1×1 PNG | `html-as-jpg 400, real png 201, nosniff = nosniff` |
| A14 | **PASS** | `POST /api/setup`, `/setup/upload`, `/setup/restore` with `X-Forwarded-For` on a fresh DB | `/setup 403, /setup/upload 403, /setup/restore 403, users 0` |
| A15 | **PASS** | `POST /api/purchases` with IMEI `111111111111118` (15 digits, Luhn-invalid) | `400` — "That IMEI is not valid. Please check the 15 digits printed on the phone box or dial *#06# …" |
| A16 | **PASS** | same IMEI bought twice while unsold | `first 201, duplicate 400` |
| A17 | **PASS** | purchase with a `seller` object and an invalid IMEI | `rejected = 400 …, orphan seller rows = 0` |
| A18 | **PASS** | sell a `purchase_returned` phone; repeat a `purchase_return`; repeat a `sales_return` | `purchase_returned sale 400, 2nd purchase_return 400, 2nd sales_return 400` |
| A19 | **PASS** | 20 rapid `POST /api/invoices` | `FY 2026-27, format ok = true, unique 20/20, sample SAL-2026-27-0002` |
| A20 | **FAIL** | `npx tsc --noEmit -p tsconfig.app.json` + `npm run build` | `tsc 2` (15 error lines in 6 files), `build 0` |
| SUITE1 | **PASS** | `backend/test/offline-suite.mjs` | `128 passed, 0 failed` |
| SUITE2 | **PASS** | `backend/test/first-setup-suite.mjs` | `32 passed, 0 failed` |

**A20 in detail (why FAIL, and why it is not a regression from this stage):**
* `npm run build` (the actual EXE input) **exits 0** — 3025 modules transformed, `✓ built in 15.00s`.
* `npx tsc --noEmit` reports 15 errors in 6 files: `InventoryTab.tsx` (4), `ShopManagementDialog.tsx` (3), `MessagesTab.tsx` (3), `SettingsTab.tsx` (2), `AddPhoneDialog.tsx` (2), `SoldTab.tsx` (1). Four of those six files were not edited in this stage at all.
* The two `AddPhoneDialog.tsx` errors are on lines this stage did not write — `:106` `supabase.from('shops')` and the `setFormData({...})` reset block — both byte-identical to `_backup_stage1_20261016-1242/src/components/admin/AddPhoneDialog.tsx`.
* The underlying cause is type-shape drift in the generated `src/integrations/supabase/types.ts` (`shops` not in the schema, `setup_completed: number` vs `boolean`, no `shop_id` on the phones row). Fixing it means editing files outside this stage's list, which R6 tells me to report instead of doing (§7).
* Note: `tsc` was failing **before** this stage too — it aborted after 543 parse errors from a corrupt `node_modules/embla-carousel/esm/components/Axis.d.ts` (a 543-byte file of NUL bytes from a broken install). I repaired that package so the real errors became visible; the parse errors themselves were not caused by this stage.

## 4. Raw evidence

All raw output is in **`VERIFY_OUTPUT.txt`** (project root, written by `VERIFY.bat`). Key excerpts:

**The folder did not start before this stage** (`node src/server.js`, backend, before the fix):
```
SyntaxError: Unexpected token ':'
    at backend/src/routes/index.js:33
```
Migration 008 abort (before the fix):
```
{"level":"error","message":"Migration failed - startup aborted", ... "near \"EXISTS\": syntax error"}
```

**After the fix — backend boots, no account created, no password printed:**
```
{"ts":"2026-10-16T07:16:37.414Z","level":"info","message":"PhoneZone backend listening on http://127.0.0.1:47902"}
Data directory: C:\Users\Kohinoor\AppData\Local\Temp\tmp.tWjzBtt1bV
No accounts exist yet - finish the first-run setup screen to create the owner account.
```
(exit code 0)

**`node --check` on every backend .js (A01):**
```
node --check done, fail=0
```

**Clean zip (H2):**
```
  Clean zip created:
    ...\PhoneZone_clean_2026-10-16-07-35.zip
    size      : 24.42 MB
    files     : 431
    manifest  : ZIP_MANIFEST.txt inside the zip (431 entries)

  WARNINGS (public keys only, listed in the manifest as well):
    - public "anon" key (by design, not a secret) in src/integrations/supabase/client.ts
```

**Demo seeder (H3):**
```
  Demo data created:
    sellers          : 5
    customers        : 5
    phones           : 6
    sales            : 2
    repair customers : 0
    repair jobs      : 0
    Repairs module not installed yet - skipped 2 repair customers and 3 jobs.
  Your real data in data\ and data11\ was NOT touched.
```

**Backup bug found and fixed while verifying Prompt 1 step 7.** `createBackup()` passed an absolute Windows path to `tar`; GNU tar (Git for Windows) reads `C:/...` as a *remote host* spec and failed, so **no backup file was ever written**:
```
node: GNU tar 1.35
backslash abs FAIL  Command failed: tar -czf C:Users...a.tar.gz a.txt
forward abs   FAIL  Command failed: tar -czf C:/Users/.../b.tar.gz a.txt
relative      OK
```
Fix: `tarPath()` runs tar with `cwd = data dir` and a relative output/archive path. After the fix the suite asserts the file exists on disk and lists its contents (`database/phonezone.db`, `storage` present).

**`npm run build`:**
```
vite v5.4.10 building for production...
✓ 3025 modules transformed.
✓ built in 15.00s
EXIT=0
```

**`npx tsc --noEmit -p tsconfig.app.json`:** exit 2, 15 errors, all in the 6 files listed in §3.

## 5. File hashes (sha256, after the final edit)

```
65c39940553d758265ecf9b53e3ac96489b504c87150162eac5611e6993247d8  backend/src/routes/index.js
5841830da4faf769aa15e072dfd6608bdf18b183413ec20b84faba810e22d545  backend/src/routes/compat.js
2614c41ca22e49ddaea06221da1c2aa60c30f71a43d244d56863f9212ac53cb6  backend/src/services/inventoryService.js
36a79d2c68a89c269720c7f28cf44dc45bdc6feecee7edbfd0fbc74157c7b9f2  backend/src/services/storageService.js
d2e17cf93fcf55693a0a55deb0f2d54b8e037cbf24843bf5c0d5feb37fe86288  backend/src/services/authService.js
643a685401ad5ae37f89be1d55806f02bf4f4c6e5b816a7d686b0debc589a72b  backend/src/services/backupService.js
3dcce168ad897a75790af69e922fc168e761ab1c43e942f99d88606647b4412c  package.json
802c0161880cd94e4b736df7d63bce48f472a2b14888d0c55d734a953d516dd9  database/migrations/001_initial_schema.sql
37490d92c93dea76f10125acffe8795cd3c49658797a2f5bd95dcff8ab77c915  database/migrations/002_business_settings.sql
c45040ef1e5a24eadae21f0444152d07b2ae8aff05ed399fef72b3f02fa202f7  database/migrations/003_add_bank_verification_and_separate_terms.sql
300cb7949ca2ed413e6377f62cb1913ff21a84613fbd6a6d443e09cbe23ac875  database/migrations/004_tac_and_hicelltek.sql
297d45ad82af676f76c12803f158b50600ea41fb8fd203ddfb05d246798e97f4  database/migrations/005_phone_variant_colour.sql
95bcad44bdaaca73b41ab3e1e88a9dc5c4e62e90d5b2102579f4f398569b0029  database/migrations/006_financial_years.sql
f1f3d3d5ba157d9c4e19ef1f11ef328bbeb384d55264e3b13c185120b3d463ac  database/migrations/007_shops.sql
9e1be90d2c3b2ec957f75a5c9c017d85c5ea2a78438e4935e6da2ade615367d0  database/migrations/009_hashed_sessions.sql
fa12f7a0569b3da80e6cd3dbf2a5bb5a4d533993a08f788a17fe2ad32f563405  database/migrations/010_public_product_photos.sql
```
The authoritative copy of these hashes is printed at the top of `VERIFY_OUTPUT.txt`, and `ZIP_MANIFEST.txt` inside the clean zip carries a sha256 for every packaged file.

## 6. NOT VERIFIED / LIMITATIONS

1. **A20 `tsc`** — fails on pre-existing type drift in files outside this stage (§3, §7). Not fixed, by design, per R6.
2. **`supabase/migrations/20261016_private_storage.sql` was NOT executed.** It is for the hosted Supabase project only; the spec says "Do NOT run it yourself". Online-mode storage therefore still uses the old public bucket until the owner runs it.
3. **Electron / tray / single-instance / no-console-window (A29-A33) — NOT RUN.** `electron/` does not exist; it is Stage 3 (Prompt 6).
4. **Repairs module (A21-A28) — NOT RUN.** Stage 2.
5. **WhatsApp extension (A34-A37) — NOT RUN.** Stage 4.
6. **Tailscale (A33) — NOT RUN.** Stage 3.
7. **Frontend click-through testing was NOT done.** I verified `npm run build` and the API contract the components call, but I did not drive the admin UI in a browser. `AddPhoneDialog`'s offline purchase path was verified at the API level (the same body the dialog now posts) — see the manual list in Stage 2's prompt.
8. **A06's 15-minute window is exercised with a shortened window** (`PHONEZONE_LOGIN_WINDOW_MS=3000`) so the assertion can complete. Production default (15 min, 10 attempts) is unchanged and is what `MAX_LOGIN_ATTEMPTS`/`LOGIN_WINDOW_MS` compute.
9. **`php`-style "real customer data" checks were not performed** — per R3 I never opened `data/`, `data11/`, `.env` or any real `*.db`. All tests used fresh temp directories.
10. **First-run wizard step of the *Electron* app** (`electron/config.cjs`, `app.getPath('userData')`) — Stage 3.

## 7. NEEDS DECISION

1. **A20 — the 15 pre-existing TypeScript errors (R6 blocked me from fixing them).** All are type-shape drift against `src/integrations/supabase/types.ts`:
   * `shops` is not in the generated schema → `AddPhoneDialog.tsx:106`, `InventoryTab.tsx:93`, `ShopManagementDialog.tsx` (3 errors). Fix: add the `shops` table to the generated types (or cast).
   * `InvoiceSettingsLike.setup_completed` expects `boolean`, the row has `number` → `InventoryTab.tsx:224`, `SoldTab.tsx:155`, plus the related one. Fix: `setup_completed?: boolean | number` in `src/lib/invoiceTemplates.ts`.
   * `shop_id` missing on the phones row type → `InventoryTab.tsx:123`. Fix: add the column to the generated types.
   * `AddPhoneDialog.tsx` reset block omits `shop_id` → add `shop_id: "shop_1"`.
   * `MessagesTab.tsx` nitpicks, `SettingsTab.tsx` (2).
   **Question: may I fix these in a small follow-up?** They are outside Stage 1's file list, which is why I did not touch them. Nothing here blocks the EXE build, because `npm run build` passes.
2. **`messages` delete stays a HARD delete.** Prompt 0 step 4 says "soft delete … otherwise reject", but the `messages` table has no `deleted_at` column and the admin UI explicitly offers per-message and "delete all". Rejecting it would have broken a working screen. Contact-form messages are not accounting history. **Question: confirm this exception, or should messages become soft-deleted (needs a new column + migration)?**
3. **`DatabaseTab`'s legacy JSON re-import path** (`supabase.from('phones').delete().neq('id','')` then re-insert the exported rows) relied on those deletes being hard. With soft deletes the old rows stay and the re-insert hits **primary-key conflicts**. That path also has its own known bug (F5: photo URLs are not remapped). **Question: delete that legacy path in favour of the backend backup (`/api/backups` + `restore-upload`), or add an admin-only purge endpoint?** I did not change it; it is stage-2+ work.
4. **`src/integrations/supabase/client.ts` still contains the project URL and the publishable ("anon") key**, so `MAKE-ZIP.bat` reports it as a warning (§4). It is not a secret (it ships in the browser bundle by design) and Prompt 1 handles the real risk by making storage private. **Question: leave the key in source, or move it to env vars (`VITE_SUPABASE_*` already exist in `.env.example`)?**
5. **`database/migrations/007_shops.sql` seeds a real shop** (`'MOBILE WORLD'`, `'sitapur'`, `'8418944572'`, a real e-mail) on every fresh install. That contradicts "never hard-code business name / phone / shop names". It is Stage 3 (multi-shop) territory. **Question: may I strip that seed row in Stage 3?**
6. **Login rate limiting is in-memory** (resets on restart) and keyed by email+IP. Fine for one desktop, weak if the admin port is ever exposed. Stage 3 (tailnet-only) is the real fix.

## 8. Known risks introduced by this stage

1. **Everyone is logged out once** by `009_hashed_sessions.sql` (it deletes `sessions` rows). Intended — the old rows were raw tokens. The owner must sign in again after updating.
2. **`files.is_public` semantics changed.** Before, the compat bucket stored every upload as private; now the top-level folder decides (`product-photos`/`images`/`logo`/`signature` are public). Migration `010` backfills existing product photos to public. If an owner's folder naming differs from those four names, their homepage photos become login-only. Mitigation: the compat object route still serves public rows to anyone, and private rows to any signed-in session, so no image is lost.
3. **`AddPhoneDialog` now posts to `/api/purchases` in offline mode.** Behaviour is stricter on purpose (Luhn IMEI, duplicate check, seller dedupe by phone). A previously-accepted typo IMEI will now be refused. Online (Supabase) mode is untouched.
4. **Invoice numbering restarted per financial year.** When the FY rolls over on 1 April, sale invoices begin at `SAL-<FY>-0001` again. Old numbers are unchanged and can never collide (the FY is part of the string).
5. **`InvoiceSettingsLike`/types were not touched**, so A20 stays red until decision §7.1 is made.
6. **`helmet`'s CSP is new.** It allows `'self'` scripts/styles (plus `'unsafe-inline'` styles for the React/Tailwind UI) and `data:`/`blob:` images for the photo viewer. If any screen loads a remote script or font, it would now be blocked; `npm run build` passes and nothing in `src/` loads remote assets, but I did not click through every screen (see §6.7).
7. **`node_modules/embla-carousel` was reinstalled** on this machine to repair a NUL-byte-corrupt `.d.ts` (also `@typescript-eslint/utils/dist/ts-eslint/index.js.map`, left as is — source map, unused). The old copy is preserved at `scratch/broken-embla-carousel/`. This is an environment repair, not a source change.
8. **`scratch/` now holds 29 moved debug files** (including `ngrok-run.log` / `ngrok-domain.txt`, which are evidence that the app was previously exposed publicly). Nothing was deleted. They are excluded from the zip and from git.

## 9. How to continue

1. Double-click **`VERIFY.bat`** → it writes `VERIFY_OUTPUT.txt` (takes a few minutes).
2. Double-click **`MAKE-ZIP.bat`** → creates `PhoneZone_clean_<date-time>.zip` (refuses to build if it finds data or a secret).
3. Send: **`REPORT.md`**, **`VERIFY_OUTPUT.txt`**, and the **`PhoneZone_clean_*.zip`**.
4. Answer the six questions in §7 (especially §7.1: may I fix the 15 type errors?).
5. Only after an "OK": set `STAGE_TO_RUN_NOW = 2` (repairs module — Prompts 3, 4, 5). Before that, Stage 1's assertions must be re-run and must still pass.
