# PhoneZone MASTER PROMPT (Freebuff / Cline / Kilo ke liye)

## Aapko kya karna hai (bilkul simple steps)

1. Apne **chalte hue PhoneZone folder ka ek COPY banao** (Ctrl+C, Ctrl+V). Kaam us copy pe hoga. Original safe rahega.
2. Meri di hui file `PhoneZone_Audit_and_Plan.md` ko us copy ke **sabse upar wale folder (root)** me paste karo, jahan `package.json` hai.
3. Apna AI agent (Freebuff / Cline / Kilo) us **copy folder** me kholo.
4. Neeche **"MASTER PROMPT" wale box ke andar ka poora text** copy karke agent me paste karo. Line 1 me `STAGE_TO_RUN_NOW = 1` likha hai. Pehli baar 1 hi rehne do.
5. Agent jab bole "done", to folder me **`VERIFY.bat` pe double-click** karo. Ek window khulegi, apne aap band hogi, aur `VERIFY_OUTPUT.txt` ban jayegi.
6. Phir **`MAKE-ZIP.bat` pe double-click** karo. Ek saaf zip banegi (bina node_modules, bina .git, bina asli data).
7. Mujhe ye 3 cheezein do: `REPORT.md`, `VERIFY_OUTPUT.txt`, aur wo zip. Main check karunga ki sach me kaam hua ya nahi.
8. Meri "OK" ke baad hi `STAGE_TO_RUN_NOW = 2` karke dobara chalao. Isi tarah 3, phir 4.

**Zaroori:** ek baar me sirf ek stage. Credits bachenge aur galti pakadna aasan hoga.

| Stage | Kya hoga |
|---|---|
| 1 | App ko chalu karo + security fix + phone purchase server-side validation (Prompts 0, 1, 2) |
| 2 | Repairs module: backend, UI, cross-check (Prompts 3, 4, 5) |
| 3 | Electron EXE + multi-shop + Tailscale (Prompts 6, 8, 7) |
| 4 | WhatsApp marketing extension (Prompt 9) |

---

## MASTER PROMPT (ye poora box copy karo)

```
STAGE_TO_RUN_NOW = 1

You are the lead engineer for "PhoneZone", a Windows desktop shop-management app for a mobile phone business: React + Vite frontend, Express + SQLite (better-sqlite3) backend, planned Electron EXE. The owner is a non-programmer who will run .bat files, so everything you create must work by double-click on Windows 10/11 and must never leave a console window flashing or hanging.

=====================================================================
SECTION 0: HARD RULES (read first, obey always)
=====================================================================
R1. EVIDENCE RULE. Never write "fixed", "done", "works" or "verified" unless you ran the command and have its real output. Put the real output (last 40 lines minimum) in REPORT.md. If a command cannot run in your environment (for example bash.exe is missing, or a tool is blocked), write "NOT RUN: <reason>" instead. Do not guess. An honest "NOT RUN" is acceptable; a false "PASS" is not.
R2. FILE RE-CHECK. After every file edit, re-open the file and confirm the change is really there. If an edit tool says "No changes" or fails, say so and retry with exact text. Never assume it applied.
R3. NO DATA TOUCHING. Never read, modify, copy, print or delete anything inside the folders `data/`, `data11/` or any `*.db`, `*.db-wal`, `*.db-shm`, `*.tar.gz`, `.env`. They contain real customer data (Aadhaar photos, names, phones). All tests must use a TEMP data directory via the environment variable PHONEZONE_DATA_DIR pointing to a fresh temp folder, and fake demo data only.
R4. NO SECRETS IN OUTPUT. Never print API keys, passwords, tokens, Aadhaar numbers or IMEIs of real customers into the report or chat.
R5. BACKUP BEFORE EDITING. Before the first edit of a stage, copy these folders and files into `_backup_stage<N>_<YYYYMMDD-HHMM>/` (one level inside the project): src, backend (without node_modules), database, config, scripts, package.json, vite.config.ts. Never delete the backup. Add `_backup_*` to .gitignore.
R6. STAY IN SCOPE. Edit only files named in the stage's prompt (plus the new files it asks for). If you think another file must change, STOP and list it in REPORT.md under "NEEDS DECISION" instead of editing it.
R7. NO DESTRUCTIVE COMMANDS. No `git reset --hard`, `git clean`, `rm -rf` outside your own temp folders and `_backup_*`, no dropping or truncating real databases, no `npm audit fix --force`.
R8. SQLITE SYNTAX ONLY in migrations. SQLite does NOT support `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Use plain `ALTER TABLE ... ADD COLUMN` (one per statement) only for columns that do not exist yet, and `CREATE TABLE/INDEX IF NOT EXISTS` for tables/indexes. Before adding any column, search all earlier migrations to make sure it does not already exist. Test every new migration on (a) a brand-new empty database and (b) a copy of a database that already has migrations 001-007 applied (build that copy from the migrations, do NOT use the real data file).
R9. BACKEND IS PLAIN ESM JAVASCRIPT. No TypeScript syntax (type annotations, `as`, interfaces) in any .js/.mjs/.cjs file. Run `node --check` on every backend .js file after editing.
R10. WINDOWS FIRST. Use `path.join`, no hard-coded slashes, no bash-only commands inside scripts. Any helper you create must be a Node script (.mjs) launched by a .bat file that ends with `pause` (so the window stays open until the owner reads it) unless it is a background service. If your own shell cannot spawn bash, use cmd/PowerShell or `node -e` instead and say which you used.
R11. ONE STAGE ONLY. Do only the stage in STAGE_TO_RUN_NOW. When finished, STOP. Do not start the next stage.
R12. If you are unsure, ask in REPORT.md under "NEEDS DECISION" and continue with the safest choice. Never invent data, columns, endpoints or results.

=====================================================================
SECTION 1: READ THE SPEC FILES (before any edit)
=====================================================================
1. Open `PhoneZone_Audit_and_Plan.md` in the project root. It contains: Part 1 (verified blockers), Part 2 (security findings S1-S12, bugs F1-F8), Part 3 (EXE + Tailscale + two-shop architecture), Part 4 (Repair module design), Part 5 (WhatsApp extension), Part 7 (Prompts 0-9 = the detailed specs).
2. Also read: `FIXES.md`, `AUDIT_REPORT.md`, `docs/ARCHITECTURE.md`, `package.json`, `backend/package.json`, `database/migrations/*.sql` (list order), `backend/src/server.js`, `backend/src/routes/index.js`, `backend/src/routes/compat.js`, `src/lib/data/offlineSupabase.ts`.
3. The spec file's prompts are the source of truth for WHAT to build. Where this master prompt and a spec prompt conflict, THIS master prompt wins.

=====================================================================
SECTION 2: STEP 0 (ALWAYS FIRST): VERSION RECONCILIATION
=====================================================================
The owner's running folder may differ from the version that was audited. Before changing anything, check each item below against THIS folder and record PRESENT or ABSENT with the exact evidence (file + line number or command output):

 B1. `backend/src/routes/index.js` contains TypeScript syntax such as `(email: string)`.
 B2. `database/migrations/008_admin_settings_flags.sql` exists and contains `ADD COLUMN IF NOT EXISTS`.
 B3. `backend/src/routes/compat.js` calls `table(` but has no function or const named `table`.
 B4. The login rate limiter functions exist but are never called inside `POST /auth/login`.
 B5. Folder `electron/` is missing while package.json `main` points to `electron/main.cjs`.
 B6. `GET /api/config` returns bank fields (bankName, accountNumber, ifscCode, accountHolderName).
 B7. `GET /pg/storage/object/:bucket/*` route has no auth middleware.
 B8. `ensureBootstrapAdmin` creates an admin at startup when no users exist.
 B9. `/pg/:table/delete` calls `buildWhere` without the table argument, and allows empty filters.
 B10. AddPhoneDialog.tsx inserts phones via `supabase.from('phones').insert` instead of POST /api/purchases in offline mode.

Rules for the result:
 - Apply a fix ONLY if the item is PRESENT in this folder. If ABSENT, write "ABSENT, no change needed" and move on.
 - Run `node --check` on all backend .js files and try `node backend/src/server.js` with a temp PHONEZONE_DATA_DIR (stop it after it prints "listening"). Record the real result. This tells us whether the folder starts at all.
 - Put this table at the top of REPORT.md under "STEP 0".

=====================================================================
SECTION 3: THE STAGES
=====================================================================
STAGE 1 = Spec Prompts 0, 1, 2 (in that order). Goal: the app starts, is safe to expose, and phone purchases are validated on the server.
STAGE 2 = Spec Prompts 3, 4, 5 (in that order). Goal: private Repairs module + job sheet/invoice + phone-number and IMEI cross-check.
STAGE 3 = Spec Prompts 6, 8, 7 (in that order). Goal: Electron EXE with tray and hidden background services, multi-shop scoping, Tailscale remote access.
STAGE 4 = Spec Prompt 9. Goal: WhatsApp marketing extension + server side.

Only do the prompts of the stage in STAGE_TO_RUN_NOW. For stages 2-4, first confirm the previous stage's tests still pass (run VERIFY) and say so in the report. If the previous stage's checks fail, STOP and report; do not build on top of a broken base.

Execution loop for each prompt inside the stage:
  a) State in REPORT.md what you will change (file list).
  b) Make the change. Re-open files to confirm (R2).
  c) Run that prompt's VERIFY commands for real. Save output.
  d) If something fails, fix and re-run (max 3 attempts per issue). If still failing, mark FAIL with the error text and continue to the next independent item, or stop if the rest depends on it.

Extra requirements that apply to every stage:
 - Keep the existing backend test suite (`backend/test/offline-suite.mjs`, `backend/test/first-setup-suite.mjs`) passing, and ADD tests for every new behavior (one test per assertion in Section 5 that belongs to the stage). If the suites cannot run, say why.
 - Every new user-visible text must be simple English (the owner's staff are not technical). Error messages must tell what to do next.
 - Never hard-code business name, phone numbers, bank details or shop names. Read from settings.
 - Escape all user-provided text in generated HTML (invoices, job sheets): reuse the `esc()` helper from `src/lib/invoiceTemplates.ts`.

=====================================================================
SECTION 4: HELPER TOOLS YOU MUST CREATE (Stage 1 creates them; later stages extend them)
=====================================================================
These exist so the owner (who only double-clicks) can produce evidence without typing commands.

H1. `scripts/verify-all.mjs` + `VERIFY.bat` (in project root; the .bat runs `node scripts/verify-all.mjs`, then `pause`).
    The script must, in order, and never touch real data (create a temp dir with os.tmpdir(), set PHONEZONE_DATA_DIR to it, delete it at the end):
     1. Print Node version, OS, date, and the sha256 of: backend/src/routes/index.js, backend/src/routes/compat.js, backend/src/services/inventoryService.js, package.json, and every file in database/migrations.
     2. `node --check` every .js/.mjs/.cjs file under backend/src and scripts. Report each failure.
     3. Apply all migrations to a fresh temp DB, then to a DB prepared with only the first 7 migrations (build it by running those files only). Report pass/fail for each.
     4. Start the backend on a free port with a temp data dir and PHONEZONE_ADMIN_PASSWORD set to a random value created by the script. Wait for /api/health.
     5. Run the assertion list from Section 5 that belongs to stages <= STAGE_TO_RUN_NOW (read STAGE from a constant at the top of the file that you update each stage). Use plain fetch(). Print one line per assertion: `A07 PASS` or `A07 FAIL <reason>`.
     6. If node_modules and a root package.json exist: run `npx tsc --noEmit -p tsconfig.app.json` and `npm run build` and report exit codes with the last 20 lines of output. If node_modules is missing, print "SKIPPED: run npm install first".
     7. Stop the server, delete the temp dir, write everything printed to `VERIFY_OUTPUT.txt` in the project root, print a one-line summary: `PASSED x / FAILED y / SKIPPED z`.
    The script must never print passwords/tokens. It must exit with code 0 even when assertions fail (the pause must be reached), and write the summary at the top of VERIFY_OUTPUT.txt.

H2. `scripts/make-clean-zip.mjs` + `MAKE-ZIP.bat` (root; .bat runs the script then `pause`).
    Creates `PhoneZone_clean_<YYYYMMDD-HHMM>.zip` in the project root, using only Node built-ins or a dependency that is already in package.json (check; if you need one, use `jszip`, which is already a dependency). It must:
     INCLUDE: `src/`, `public/` (including `public/ocr/` assets), `backend/` (source, `package.json`, `package-lock.json`, `ensure-native.cjs`, `test/`, `scripts/`), `database/`, `config/`, `scripts/`, `electron/` (when it exists), `docs/`, `supabase/` (migrations + config.toml + functions), `index.html`, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig*.json`, `tailwind.config.ts`, `postcss.config.js`, `eslint.config.js`, `components.json`, `icon.ico`, `*.bat`, `*.ps1`, `*.md` in root (including REPORT.md, PhoneZone_Audit_and_Plan.md, FIXES.md, AUDIT_REPORT.md), `VERIFY_OUTPUT.txt` if present, `.gitignore`, `.env.example`.
     EXCLUDE: `node_modules/` (any level), `.git/`, `.kilo/`, `.cline/`, `.client/`, `.vscode/`, `.idea/`, `data/`, `data11/`, `dist/`, `release/`, `_backup_*/`, `*.db`, `*.db-wal`, `*.db-shm`, `*.log`, `*.tar.gz`, `*.zip`, `.env` (real), `ngrok-*`, `tmp-*`, `.tmp-*`, `err.txt`, `out.txt`, `*.traineddata` in the project root (the OCR copy under public/ocr is kept), `back-*.png`, `vite-out.log`.
     SAFETY SCAN (must run before writing the zip and again on the finished zip): fail loudly, and do NOT leave the zip behind, if any path inside matches `.env` (exact), `*.db*`, `data/`, `data11/`, `node_modules/`, `*.tar.gz`; also fail if any text file contains a string that looks like a JWT (`eyJ` followed by 30+ base64url characters) or the Supabase service-role pattern. Report what matched (path only, never the secret).
     Also write `ZIP_MANIFEST.txt` inside the zip: every file with size and sha256, and the totals.
     Print the zip path and its size, and the manifest total file count.
    Create `.env.example` containing only placeholder names and empty values (VITE_SUPABASE_URL=, VITE_SUPABASE_PUBLISHABLE_KEY=, VITE_SUPABASE_PROJECT_ID=). Make sure the OFFLINE build and run do not crash when these variables are empty (check `src/integrations/supabase/client.ts`; if it throws on missing values in offline mode, make a minimal guarded fix and list it in REPORT.md).

H3. `scripts/seed-demo.mjs` + `SEED-DEMO.bat` (optional helper): creates a TEMP-folder demo database with FAKE data only (5 sellers, 5 customers, 6 phones with Luhn-valid fake IMEIs such as 490154203237518, 2 repair customers and 3 repair jobs once Stage 2 exists), so testing never needs real customer data. Never writes into `data/`. Prints the temp path.

H4. `.gitignore` as described in spec Prompt 1 step 9 (plus `_backup_*`, `PhoneZone_clean_*.zip`, `VERIFY_OUTPUT.txt` NOT ignored).

=====================================================================
SECTION 5: ASSERTION LIST (the report must show PASS/FAIL/NOT RUN for each)
=====================================================================
A01 Every backend .js passes `node --check`.
A02 A brand-new DB applies all migrations without error.
A03 A DB that already has migrations 001-007 applies the rest without error.
A04 Backend starts on a fresh temp data dir and /api/health returns ok.
A05 Startup prints NO temporary admin password and creates NO user until the setup wizard (POST /api/setup) runs. After setup exactly ONE admin exists.
A06 Wrong-password login: attempt 11 (or the configured limit) returns HTTP 429 with a readable message; a correct login after the window still works.
A07 After login, POST /api/pg/phones/select returns 200 and a JSON array.
A08 POST /api/pg/phones/delete with empty filters returns 400 and deletes nothing.
A09 POST /api/pg/phones/delete with a filter column containing a quote (SQL injection attempt) is rejected and deletes nothing.
A10 DELETE on phones/sellers/customers via the compat layer soft-deletes (row still present with deleted_at set).
A11 GET /api/config (no login) contains NO bankName, accountHolderName, accountNumber, ifscCode.
A12 GET /api/pg/storage/object/<bucket>/<path> without login returns 401.
A13 Uploading an HTML file renamed .jpg is rejected; a real tiny PNG upload succeeds; the served file has `X-Content-Type-Options: nosniff`.
A14 POST /api/setup (and /setup/upload, /setup/restore) with header X-Forwarded-For set is rejected (403) even on a fresh DB.
A15 Add phone with a Luhn-invalid IMEI is rejected by the SERVER (call POST /api/purchases directly).
A16 Add the same IMEI twice while the first is unsold: second is rejected.
A17 A purchase failing validation leaves NO orphan seller row.
A18 Selling a phone whose return_status is purchase_returned is rejected; a second sales_return of the same phone is rejected.
A19 Invoice numbers follow the financial-year format and do not repeat under 20 rapid creations.
A20 `npx tsc --noEmit` exits 0 and `npm run build` exits 0 (or SKIPPED with reason).
-- Stage 2 --
A21 Repair migration applies on fresh and on existing DB; no `ADD COLUMN IF NOT EXISTS` anywhere in database/migrations.
A22 Repair job without IMEI or with Luhn-invalid IMEI is rejected by the server.
A23 Repair job status change writes a row in repair_status_log and sets ready_at/delivered_at.
A24 Adding a job item flagged is_board sets board_replaced=1.
A25 GET /api/repair/by-imei/<imei> returns the job; after soft-deleting the job it is hidden from /jobs but history by IMEI still returns it.
A26 GET /api/repair/customers/by-phone/<phone> returns the repair customer; it is a SEPARATE table from customers (a sale customer with the same phone is not returned).
A27 No endpoint under /api/public and no field of /api/config or /api/public/inventory contains any repair data (grep the JSON).
A28 Job sheet and invoice HTML escape a customer named `<img src=x onerror=alert(1)>` (assert the raw string is absent and the escaped form is present).
-- Stage 3 --
A29 Electron: app starts, X hides to tray, Quit exits all processes, a second launch focuses the first (manual checklist in REPORT, mark NOT RUN if not testable).
A30 No console window appears (state how checked, else NOT RUN).
A31 Non-admin user of shop 2 cannot read or modify shop 1 phones/repairs (403 or empty), admin with ?shop=all can.
A32 publicServer on its own port returns 404 for /api/pg/*, /api/setup, /api/settings, /api/repair/*.
A33 Tailscale module handles "not installed" without crashing (unit test with a fake path) and never uses `funnel` on the admin port.
-- Stage 4 --
A34 Campaign queue never contains customers without whatsapp_opt_in=1.
A35 Two quick GET /api/wa/next calls: the second returns a wait time (daily cap/gap enforced by the server).
A36 Revoked extension token returns 401.
A37 Extension loads as unpacked MV3 without manifest errors (manual, NOT RUN allowed).

=====================================================================
SECTION 6: REPORT.md (mandatory deliverable, written LAST, in the project root)
=====================================================================
Overwrite `REPORT.md` with exactly this structure so an external reviewer can judge quickly. Keep it factual and compact; no marketing words.

# REPORT stage <N>  (date/time, agent name+model if known, OS, Node version)
## 0. Summary (max 8 lines): what was requested, what is DONE, what is PARTIAL, what FAILED, what was NOT RUN.
## 1. STEP 0 reconciliation table (B1-B10: PRESENT/ABSENT + evidence).
## 2. Files changed: table with columns [path | new/edited/deleted | one-line reason | lines +/-]. Include the backup folder name.
## 3. Assertions: table [ID | PASS/FAIL/NOT RUN | command or test used | key evidence (1-2 lines)]. Every assertion of the stages up to the current one.
## 4. Raw evidence: for each command you ran: the command, exit code, and the LAST 40 lines of real output, in code blocks. (No secrets.)
## 5. File hashes: sha256 of the files listed in H1 step 1 after your final edit.
## 6. NOT VERIFIED / LIMITATIONS: everything you could not run and why.
## 7. NEEDS DECISION: questions for the owner (R6, R12).
## 8. Known risks introduced by this stage (honest).
## 9. How to continue: the exact next step for the owner (VERIFY.bat, MAKE-ZIP.bat, then send REPORT.md + VERIFY_OUTPUT.txt + the zip for review).

=====================================================================
SECTION 7: FINISH PROCEDURE (do this at the end of the stage)
=====================================================================
1. Update the STAGE constant in scripts/verify-all.mjs.
2. Make sure VERIFY.bat and MAKE-ZIP.bat exist and run (run them yourself if your shell allows; if not, say "NOT RUN").
3. Write REPORT.md.
4. In your final chat message, output ONLY: (a) a 5-line summary, (b) the list of NEEDS DECISION items, (c) the exact instruction: "Double-click VERIFY.bat, then MAKE-ZIP.bat, and send REPORT.md, VERIFY_OUTPUT.txt and the PhoneZone_clean zip for review."
5. STOP. Do not start the next stage.

BEGIN NOW with Section 1, then Section 2 (Step 0).
```

---

## Reviewer ke liye (mere liye notes, aap ignore kar sakte ho)

Jab aap mujhe REPORT.md + VERIFY_OUTPUT.txt + zip doge, main ye check karunga:
- zip ke andar sha256 `ZIP_MANIFEST.txt` se milte hain ya nahi, aur REPORT ke hashes se bhi
- REPORT me jo PASS likha hai uska evidence asli output se match karta hai ya nahi
- zip me koi `.env`, `.db`, `data/` to nahi gaya
- main apni scratch copy me backend ko khud chala ke A01 se aage ki assertions dobara run karunga
- Frontend build, Electron aur Tailscale ka asli test aapko Windows pe karna hoga

## Agar agent beech me atak jaye

- **"bash.exe not found" error:** agent ko likho: `Do not use bash. Use cmd/PowerShell or node scripts only, as per rule R10.`
- **Agent ne kuch edit kiya par REPORT me "NOT RUN" likha:** ye theek hai, VERIFY.bat double-click karke asli output le aao.
- **Agent bole "STOP, NEEDS DECISION":** wo sawal mujhe bhej do.
- **Credits khatam hone wale ho:** stage beech me chhod ke bhi REPORT.md likhwa lo (agent ko bolo: `Write REPORT.md now with what is done so far, mark the rest NOT DONE`).
