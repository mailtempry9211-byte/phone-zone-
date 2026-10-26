# PhoneZone: Antigravity ka MASTER BRIEF

## Aapke liye (sirf 5 steps)

1. Apne PhoneZone folder ka **copy** banao (Ctrl+C, Ctrl+V). Kaam us copy me hoga.
2. In 3 files ko us copy ke **sabse upar wale folder** (jahan `package.json` hai) me daalo:
   `PhoneZone_Audit_and_Plan.md`, `PhoneZone_MASTER_PROMPT.md`, `PhoneZone_STAGE3A_PROMPTS.md`
3. Antigravity ko us copy folder me kholo.
4. Neeche **"BRIEF" wale box ka poora text** copy karke Antigravity me paste karo. Bas, wo khud sab files banayega aur kaam shuru kar dega.
5. Jab wo bole "ALL STAGES DONE" (ya kahin atak ke `HANDOFF.md` likhe), mujhe ye do:
   `REPORT.md`, `VERIFY_OUTPUT.txt`, `BUILD_OUTPUT.txt` aur `deliverables\` folder ki sabse nayi zip.

**Teen baatein yaad rakho:**
- Antigravity powerful hai, par ye brief usse **har stage ke baad apna test khud chalane** aur **bina output ke "done" na bolne** ko majboor karta hai. Isi se main bhi check kar paunga.
- Aapne bola purana data bekaar hai, to brief me use hatane ki ijazat hai. Maine ye kaam **sabse aakhri step** me rakha hai (taaki beech me kuch tute to nuksan na ho), aur agent ko customer ka private data (Aadhaar wagairah) kahin print karne se mana kiya hai. Agar kisi customer ka data kabhi kaam aaye, to hatane se pehle `data` folder ka ek copy pen drive pe rakh lo.
- Agent ko asli ngrok token kabhi mat dena. Wo nakli token se test karta hai. Asli token aap sirf EXE ke andar daaloge.

---

## BRIEF (ye poora box copy karo)

```
=====================================================================
PHONEZONE: MASTER BRIEF FOR THE AUTONOMOUS ENGINEER
=====================================================================
You are the lead engineer for "PhoneZone". Read this entire brief before touching anything. It contains the product context, the verified current state, the owner's decisions, the full plan, the rules, the test registry, and the first actions. Your job: create the context files (Section 6), then execute the stages (Section 8) in order until everything is delivered, verifying each stage with real command output. The owner is a NON-PROGRAMMER who only types on a keyboard and clicks with a mouse. Everything you deliver must work by DOUBLE-CLICK on Windows 10/11.

Talk to the owner in short, simple Hinglish (Roman script) in chat; write all code, comments, UI text and documents in simple English.

=====================================================================
1. MISSION AND DEFINITION OF DONE
=====================================================================
Turn PhoneZone into a fully working, secure Windows ERP delivered as an installable EXE for a mobile-phone shop: buying phones from sellers, selling to customers, returns, invoices, accounting, a private Repairs section with job sheets and IMEI history, a public website catalog, optional remote access through an embedded ngrok tunnel, backup/restore, business setup/edit, company switching, later a second shop over Tailscale, and WhatsApp marketing through a Chrome extension.

DONE means ALL of these are true and proven by evidence:
 D1. The backend starts, all assertions in the registry (Section 10) for the delivered stages PASS in scripts/verify-all.mjs on temp data directories, `npx tsc --noEmit -p tsconfig.app.json` and `npm run build` exit 0.
 D2. BUILD-EXE.bat produces a Windows installer that installs per-user, opens a window, hides to tray, quits cleanly, and works offline on the PC.
 D3. Remote access through the embedded ngrok tunnel works only when the owner switches it ON, is fully refused when OFF, and exposes only what Section 5 allows.
 D4. Repairs, cross-checks, backup/restore, company switch, business profile edit, multi-shop, Tailscale and WhatsApp exist as specified, or are explicitly marked NOT DONE in REMAINING.md with the reason.
 D5. The context files (Section 6) are complete and current, a clean zip of the project exists in deliverables/, and REPORT.md tells the truth.

=====================================================================
2. PRODUCT CONTEXT
=====================================================================
PhoneZone is an offline-first ERP for a used/new mobile-phone shop in India.
 - INVENTORY / PURCHASE: the shop buys phones from SELLERS (name, phone, address, ID proof type+number, Aadhaar/ID photo, payment proof, bill/box/charger flags). IMEI is mandatory, 15 digits with Luhn check, unique among unsold phones. TAC lookup (first 8 IMEI digits) fills brand/model from a local TAC database; modes ask / auto / off decide whether an online API (Hicelltek) is queried. A purchase creates a purchase invoice.
 - SALES: phones are sold to CUSTOMERS (separate table from sellers) with a sale invoice (financial-year numbering e.g. SAL-2026-27-0001). Sold tab, customer history.
 - RETURNS: purchase_return (back to seller) and sales_return (customer returns); states must be enforced (no double return, no selling a purchase-returned phone).
 - ACCOUNTING: dashboard revenue/profit, financial years (April to March), invoices.
 - PUBLIC WEBSITE (homepage): a catalog of unsold phones with photos, contact info, store hours, Google business badge, contact messages. It must NEVER expose purchase prices, IMEI, sellers, Aadhaar, repairs or bank details.
 - MESSAGES: visitor messages from the homepage (staff read them in the admin).
 - SETTINGS: business profile (name, address, phones, email, GST/Udyam, bank details, prefixes, terms, WhatsApp number, logo, signature), TAC/Hicelltek settings, shops.
 - BACKUP/RESTORE, STORAGE tab (all files), DATABASE tab.
 - PLANNED: private Repairs section; embedded ngrok remote access; company switch; second shop over Tailscale; WhatsApp marketing extension.
Language of staff UI: simple English. Currency INR. Dates dd-mm-yyyy in UI, ISO in DB.

=====================================================================
3. TECH STACK AND REPO MAP (verify by reading, do not assume)
=====================================================================
 Frontend: React + Vite + TypeScript + Tailwind + shadcn/ui, src/ (components/admin/*, components/*, pages/Index.tsx, hooks/, lib/, lib/data/offlineSupabase.ts = shim that makes supabase-js style calls hit the local backend, integrations/supabase/).
 Backend: Node (ESM, plain JavaScript, NO TypeScript syntax), Express, better-sqlite3 (WAL, synchronous FULL), backend/src/{server.js, routes/index.js, routes/compat.js (/api/pg/* table-style API), routes/tac.js, services/*, lib/*, config/*, db/*}, backend/test/{offline-suite.mjs, first-setup-suite.mjs}.
 Database: SQLite via database/migrations/NNN_*.sql applied in order at startup (schema.sql is documentation only). Current migrations: 001-007, 009, 010 (no 008: it was deleted because it was invalid SQLite).
 Config: config/ (TAC data etc.), public/ocr (tesseract assets), supabase/ (online-mode migrations and edge functions, kept for the optional online mode).
 Tooling that already exists and MUST keep working: VERIFY.bat -> scripts/verify-all.mjs (writes VERIFY_OUTPUT.txt, uses temp dirs, always exits 0, read the SUMMARY line), MAKE-ZIP.bat -> scripts/make-clean-zip.mjs (clean zip + safety scan + ZIP_MANIFEST.txt), SEED-DEMO.bat -> scripts/seed-demo.mjs (fake data), PHONEZONE-CONTROL.bat (old launcher, keep for troubleshooting), _backup_stage*/ (do not delete until Stage 6).
 Windows notes: Node v24 on the owner's PC; project path contains dots/spaces; the previous agent's shell could not spawn bash.exe: use PowerShell/cmd or node scripts, never rely on bash; use path.join; .bat helpers end with `pause`.

=====================================================================
4. VERIFIED CURRENT STATE (an independent reviewer checked these on 2026-10-20)
=====================================================================
DONE AND VERIFIED:
 - Stage 1 (P0 fixes, security, purchase validation): backend starts; TypeScript syntax removed from routes/index.js; invalid migration 008 removed; compat `table()` helper restored; login rate limit wired (10 failures then 429); no bootstrap admin (the first admin is created only by the setup wizard); /api/config no longer leaks bank fields; /pg/storage/object requires login; uploads: magic-byte check, no text/html, nosniff; setup routes loopback-only (403 if X-Forwarded-For present); hashed sessions (migration 009); public product photos (migration 010); helmet; purchase created server-side with Luhn IMEI + duplicate check + atomic seller; return/sale state checks; financial-year invoice numbers.
 - Stage 1.1: compat update/select/delete guards (empty or bogus filters -> 400), exact column match, audit_logs read-only, files table not writable via compat, 15 TypeScript errors fixed, DatabaseTab legacy JSON import removed, plus extras: rateLimit.js (setup/restore/backup limiters), Storage tab lists real files via GET /api/files, numberToWords fixed, footer year dynamic, per-tab ErrorBoundary.
 - Baseline: VERIFY SUMMARY `PASSED 36 / FAILED 0 / SKIPPED 0` (A01-A20, A38-A43, R01-R06, SUITE1 138/138, SUITE2 32/32, tsc 0, build 0).
NOT DONE (everything below is your work): Electron EXE (electron/ folder is missing; package.json main points to electron/main.cjs), embedded ngrok, backup/restore without external tar, business profile snapshot guarantee, company switch, Repairs module, cross-checks, multi-shop scoping, Tailscale, WhatsApp extension, hardening backlog (Section 9).
KNOWN SMALL ISSUES: forged-path file read returns 500 instead of 404 (fix in 3A-1); compat `.or()` with a comma in free text yields 400; ~188 ESLint no-explicit-any warnings (ignore); public-message limiter will be shared per IP until trust proxy is set (3A-2); 007_shops seeds a real shop row (remove for fresh installs in Stage 3B, never delete rows in existing DBs); src/integrations/supabase/client.ts contains the Supabase ANON key (public by design, move to env in Stage 6, the offline app must build and run without it).

=====================================================================
5. OWNER DECISIONS (binding)
=====================================================================
 O1. EXE with embedded ngrok. The owner enters ngrok AUTHTOKEN + DOMAIN in the app and presses Go ONLINE; OFFLINE means reachable only on the PC. Use the official in-process SDK @ngrok/ngrok (no ngrok.exe, no CLI, no console window).
 O2. Tunnel controls exist ONLY inside the PC's own window (Electron IPC). Remote browsers see no tunnel UI and have no HTTP route to it. The authtoken is stored with Electron safeStorage (DPAPI), never in SQLite, backups, logs, reports or the renderer.
 O3. While remote mode is ON, remote requests (any request carrying X-Forwarded-For/Forwarded) are blocked from: setup, all backup/restore/export/import, system routes, user management, storage-usage, and compat deletes. While remote mode is OFF every remote request is refused (403).
 O4. ONE server computer and ONE database for two shops (no database sync, no merge conflicts). The second shop connects over Tailscale (tailnet-only HTTPS via `tailscale serve`). NEVER put the admin app on Tailscale Funnel. A public website, if wanted, is a separate minimal server on another port (Stage 3B).
 O5. Repairs are PRIVATE and separate from sale/purchase people: own tables (repair_customers, repair_jobs, ...). They never appear on the homepage or in any /api/public route. Soft delete only, history is never destroyed.
 O6. IMEI is mandatory everywhere (repairs too), Luhn-validated, TAC auto-fill; if the TAC is not in the local DB use the existing ask/auto/off online-fetch behaviour (ask = show an "Fetch from online API?" button).
 O7. Cross-checks: (a) entering a phone number in an inventory/sale form that matches a repair customer offers a dialog "fetch which details?" (checkboxes; copies only, never deletes repair data) plus "View repair history"; (b) entering an IMEI at purchase that matches a repair job shows a red warning "repaired at our shop on <date>", what was repaired, and if a board/motherboard was replaced a red flag plus a required "I have seen the history" tick that is written to the audit log.
 O8. WhatsApp marketing = Chrome MV3 extension driven by the PhoneZone server, opt-in customers only, with server-enforced daily cap, random gaps and a dry-run mode; warn the owner that automating WhatsApp Web can get a number banned and mention the official WhatsApp Business Cloud API as the safe alternative.
 O9. "Company change" = (a) edit all business details in Settings any time, old invoices keep the details they were issued with (snapshot), (b) Company Switch: separate data folders per company inside <userData>/companies/<id>/, switch/add/rename/remove-from-list (never deletes files).
 O10. DATA POLICY: the owner declared ALL existing data in data/ and data11/ (and old backups, logs, scratch files) disposable test data. Deleting it is ALLOWED, but only in Stage 6 as one logged step (list paths and counts in REPORT, never print names, phone numbers, IMEIs or Aadhaar numbers). All tests always use temp data directories (PHONEZONE_DATA_DIR) and FAKE demo data, never the real folders. Do not delete .env, the _backup_stage* folders, or anything outside the data/log/scratch categories above until Stage 6.
 O11. No auto-update, no code signing (mention SmartScreen "Unknown publisher": More info -> Run anyway).
 O12. Never ask the owner for a real ngrok token. Use a fake token in tests and a fake SDK adapter.

=====================================================================
6. FIRST ACTION: CREATE THE CONTEXT FILES (Phase 0)
=====================================================================
Before any code change, read the whole repository structure and these existing documents: PhoneZone_Audit_and_Plan.md, PhoneZone_MASTER_PROMPT.md, PhoneZone_STAGE3A_PROMPTS.md, REPORT.md, REPORT-stage1.md (if present), FIXES.md, AUDIT_REPORT.md, CONTEXT.EXE.MD, PROGRESS.md, TODO.md, REMAINING.md, docs/ARCHITECTURE.md, package.json, backend/package.json, database/migrations/*.sql, backend/src/server.js, backend/src/routes/index.js, backend/src/routes/compat.js, src/lib/data/*.ts.
Some of these were written by earlier agents and may contain wrong claims: treat them as hints, trust only the code and your own command output.

Create these files in docs/ai/ (create the folder). If an older file with the same purpose exists in the project root, move the old one into docs/ai/archive/ (do not delete), then write a fresh consolidated file:
 1. docs/ai/CONTEXT.md  - the permanent memory. Product summary, stack, repo map, Windows notes, owner profile and constraints, the owner decisions O1-O12, the verified state, how to run VERIFY/MAKE-ZIP/BUILD-EXE, glossary (IMEI, TAC, Luhn, compat layer, remote mode, tunnel, company, shop, tailnet), and "READ THIS FIRST after any restart". Keep it under ~400 lines and update it at every stage end.
 2. docs/ai/PRD.md - the Product Requirements Document: personas (owner, shop staff, viewer, public visitor, second-shop staff), per-module user stories with acceptance criteria (Inventory/Purchase, Sales, Returns, Accounting, Public website, Messages, Settings/Business profile, Backup/Restore, Storage, Repairs, Cross-checks, Remote access, Company switch, Multi-shop, WhatsApp marketing), non-functional requirements (offline-first, security, performance with 10k+ phones, simple English, mobile-friendly screens, data safety), out-of-scope list. Every user story must map to registry assertion IDs (Section 10) or a manual test.
 3. docs/ai/ARCHITECTURE.md - diagrams in text/mermaid: process model (Electron main = backend + tray + tunnel manager; renderer = React app), request flow (local window vs remote request through ngrok/tailscale), remote guard rules, data layout (<userData>/companies/<id>/{database,storage,backups}, secure/ngrok.bin, logs), file storage owner types and public/private trees, migration policy (SQLite syntax rules), backup format, tunnel/secure-store design, multi-shop scoping, public server vs admin server, WhatsApp queue flow.
 4. docs/ai/DECISIONS.md - an ADR log: every owner decision O1-O12 and every technical decision you take (date, context, decision, consequences). Append only.
 5. docs/ai/TODO.md - the full task list with IDs (T-001...), grouped by stage, each with status [ ] / [~] / [x] / [!] and the assertion IDs that prove it. This is the source of truth for "what is left".
 6. docs/ai/PROGRESS.md - dated log: what was done, evidence file/line, what failed and how it was fixed. Append at the end of every work session and stage.
 7. docs/ai/REMAINING.md - only what is NOT done, ordered by priority, with blockers and owner decisions needed. Regenerate from TODO.md at every stage end.
 8. docs/ai/SECURITY_STATUS.md - table of findings S1-S12 and the hardening backlog with status (FIXED/OPEN/ACCEPTED), evidence (assertion ID or file+line), and residual risk.
 9. docs/ai/TEST_PLAN.md - the assertion registry (Section 10) with columns [ID | stage | what it proves | how | automated/manual | last result], plus the manual checklist for the owner for every stage.
 10. docs/ai/HANDOFF.md - written only when you must stop early: exact state, what to do next, commands, blockers, the next prompt the owner should paste.
 11. docs/ai/CHANGELOG.md - user-visible changes per stage.
Also update the root README (create README.md if missing) with a 1-page beginner guide: install, first run, backup, going online, troubleshooting. Then write the Phase 0 entry in PROGRESS.md and start Stage 3A-1.

=====================================================================
7. NON-NEGOTIABLE RULES
=====================================================================
R1 EVIDENCE: never write "fixed/done/works/verified" without the real command output. Put the last 40+ lines of output in the stage report. If something cannot run in your environment, write "NOT RUN: <reason>" and add it to the owner's manual checklist. A false PASS is the worst possible outcome; an honest NOT RUN is fine.
R2 RECHECK EDITS: after each edit re-open the file and confirm the change is there. If an edit tool reports no change, redo it.
R3 TESTS USE TEMP DIRS ONLY (PHONEZONE_DATA_DIR and Electron userData overrides) and fake data (SEED-DEMO / test fixtures). Real data folders are touched only by the Stage 6 deletion step (O10). Never print personal data (names, phones, IMEIs, Aadhaar, addresses) from any real file.
R4 NO SECRETS in logs, reports, zips or chat: no tokens, passwords, API keys, authtokens. Keys in code are only the public Supabase anon key.
R5 SNAPSHOT BEFORE EACH STAGE: copy src, backend (without node_modules), database, config, scripts, electron, package.json, vite.config.ts into _backup_stage<ID>_<YYYYMMDD-HHMM>/ . Keep them until Stage 6.
R6 SCOPE PER STAGE: edit only files that the stage needs, and list every changed file in the report. If you change something outside the stage's list, justify it in the report.
R7 NO DESTRUCTIVE COMMANDS outside this brief's allowances: no git reset --hard / git clean, no npm audit fix --force, no deleting anything outside _backup_* cleanup and the O10 data step.
R8 SQLITE MIGRATIONS: SQLite has NO `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Use CREATE TABLE/INDEX IF NOT EXISTS; use plain `ALTER TABLE ... ADD COLUMN` (one per statement) only after checking that no earlier migration already added the column. Test every migration on (a) a brand-new DB and (b) a DB built from the earlier migrations only. Never edit an already-applied migration to change existing installs; add a new numbered file.
R9 BACKEND = PLAIN ESM JAVASCRIPT: no TypeScript syntax in .js/.mjs/.cjs. Run `node --check` on every backend/electron/scripts JS file after edits.
R10 WINDOWS FIRST: path.join, no bash-only scripts, helper .bat files end with `pause`, no console window flashes (windowsHide:true for any spawn), long operations print progress in plain English.
R11 ONE STAGE AT A TIME with a GREEN GATE (Section 8): never start the next stage while the previous gate is red.
R12 ASK ONLY WHEN BLOCKED: if an owner decision is needed, write it under NEEDS DECISION in the stage report AND REMAINING.md, take the safest default, and continue. Never invent data, columns, endpoints, library options or test results; look up current library docs (for @ngrok/ngrok, electron, electron-builder, tar, better-sqlite3) and cite the page in the report.
R13 SIMPLE UI: every message a shop employee can see must be plain English, tell what happened and what to do next. No stack traces in the UI.
R14 NO HARD-CODED BUSINESS DATA (business name, phone numbers, address, bank details, shop names): read from settings. Remove the hard-coded WhatsApp number in src/components/RepairServices.tsx.
R15 ESCAPE ALL USER TEXT in generated HTML (invoices, job sheets): reuse esc() from src/lib/invoiceTemplates.ts.
R16 CONTEXT DISCIPLINE: at the end of every stage update CONTEXT.md, TODO.md, PROGRESS.md, REMAINING.md, SECURITY_STATUS.md, TEST_PLAN.md, CHANGELOG.md. If your own context is getting long, write HANDOFF.md and continue from the files.

=====================================================================
8. THE STAGES (execute in this order)
=====================================================================
PROTOCOL for every stage:
  a) Re-read CONTEXT.md and TODO.md. Take the snapshot (R5). Write the stage plan (files to touch) into PROGRESS.md.
  b) Implement. Re-open files (R2). Add tests for every assertion the stage owns; add them to BOTH backend/test/* suites and scripts/verify-all.mjs (set the STAGE constant inside verify-all.mjs to the stage id; verify-all must be cumulative: it runs all earlier assertions too).
  c) GATE: run scripts/verify-all.mjs (equivalent to VERIFY.bat), `npx tsc --noEmit -p tsconfig.app.json`, `npm run build`, both backend suites. All must PASS. If anything fails: fix and rerun (max 3 attempts per issue). Still red -> write HANDOFF.md, STOP.
  d) Write REPORT-stage-<ID>.md using the report format below and copy it to REPORT.md. Run MAKE-ZIP (scripts/make-clean-zip.mjs) and move the produced zip to deliverables/PhoneZone_<ID>_<timestamp>.zip. Update the context files (R16). Then continue automatically to the next stage.
  e) For stages that build the EXE (3A-1, 3A-2, 3A-3, 3B, 4, 6) also run scripts/build-exe.mjs (BUILD-EXE.bat logic), save BUILD_OUTPUT.txt, and record installer path/size/sha256. If the environment cannot build or launch the EXE, write NOT RUN with the reason and list it in the owner's manual checklist; this does NOT block the gate for logic-only assertions, but the final Stage 6 must state clearly whether an installer was actually produced.
REPORT FORMAT (REPORT-stage-<ID>.md): 0 Summary (max 8 lines: requested / done / partial / failed / not run); 1 Files changed table [path | new/edited/deleted | reason | lines +/-]; 2 Assertions table [ID | PASS/FAIL/NOT RUN | command/test | evidence]; 3 Raw evidence per command (command, exit code, last 40 lines, no secrets); 4 sha256 of key files; 5 NOT VERIFIED / limitations; 6 NEEDS DECISION; 7 New risks introduced; 8 Manual checklist for the owner (exact click steps for a non-technical person).

----- STAGE 3A-1: Electron shell, packaging, runtime config -----
Follow PhoneZone_STAGE3A_PROMPTS.md, section "PROMPT 3A-1", to the letter. Key points: backend runs inside Electron main (no child node, host 127.0.0.1 always, port 47713 or a free one); data dir <userData>/companies/default/; resources via extraResources + PHONEZONE_RESOURCES_DIR; single instance; sandboxed window with contextBridge preload; X hides to tray; tray menu (Open, status, Start with Windows, Quit); graceful quit (wait in-flight, wal_checkpoint(TRUNCATE), close DB, no leftover process); crash log to <userData>/logs/main.log without secrets; GET /runtime-config.js sets window.__PHONEZONE_OFFLINE__ = true and index.html loads it, config.ts honours it (critical: otherwise a non-localhost address would use Supabase); forged file path returns 404; electron-builder NSIS per-user installer with better-sqlite3 unpacked and rebuilt for Electron's ABI; BUILD-EXE.bat/scripts/build-exe.mjs; smoke test of win-unpacked if possible. Assertions: A47, A56, A57, A58, A54, A29/A30 (manual allowed), A55.

----- STAGE 3A-2: embedded ngrok + remote safety -----
Follow PhoneZone_STAGE3A_PROMPTS.md, "PROMPT 3A-2", to the letter. Key points: electron/tunnel.cjs with an injectable SDK adapter; tunnel states offline/connecting/online/error; credentials via safeStorage; default OFFLINE at every start (opt-in auto-online); human error messages; OnlineAccessCard only in the desktop window; trust proxy "loopback"; remoteGuard (remote = X-Forwarded-For/Forwarded present); remote OFF -> 403 for everything; remote ON -> blocked routes per O3; remote login 5 failures/15 min and 8 h sessions; Secure cookie behind https; logout-all. Assertions: A44, A45, A46, A48, A49, A50, A59, A55.

----- STAGE 3A-3: backup/restore, business profile, company switch -----
Follow PhoneZone_STAGE3A_PROMPTS.md, "PROMPT 3A-3", to the letter. Key points: before changing code create the OLD-format backup fixture with the current code; replace the external tar program with the `tar` npm package keeping the layout (manifest.json, database/phonezone.db, storage/**); db.backup() consistent copy; sha256 manifest; restore validation (paths, symlinks, sizes, hashes, integrity_check), automatic pre-restore backup, atomic swap with REAL rollback; backup UI (Backup now, list, save copy to folder/pen drive, open folder, daily 11:30 PM auto-backup keep 14, backup on Quit if older than 24 h); business profile fully editable with per-invoice snapshot so old invoices never change; company switch (companies.json, add/switch/rename/remove-from-list without deleting files, tunnel goes OFFLINE on switch). Assertions: A51, A60, A52, A53, A55.

----- STAGE 2: Repairs module (private) -----
Follow PhoneZone_Audit_and_Plan.md Part 4 and Prompts 3, 4, 5; assertions A21-A28 from PhoneZone_MASTER_PROMPT.md section 5. Essentials:
 - Migration `NNN_repairs.sql` (next free number): repair_customers, repair_jobs, repair_job_items, repair_status_log (+ indexes on repair_jobs(imei), (status), (repair_customer_id), repair_customers(phone)), updated_at triggers like existing tables, files owner types 'repair' and 'repair_customer' as PRIVATE trees in storageService LAYOUT. Columns as in the audit file (job_no unique "RJ-<shopcode>-<FY>-<0000>" from a transactional counter; status enum received/diagnosing/waiting_parts/in_progress/ready/delivered/cancelled; board_replaced auto-set when an item has is_board=1; payment_status; estimate/advance/parts/labour/final; warranty_days; accessories_received; passcode_note).
 - Backend: services + routes under /api/repair behind the staff middleware: customers CRUD + by-phone + history; jobs CRUD + status endpoint (writes repair_status_log and sets ready_at/delivered_at) + items; by-imei cross-check; soft delete only; Luhn IMEI mandatory; TAC derived from IMEI. NOTHING under /api/public, /api/config or the public inventory may contain repair data (test by grepping the JSON).
 - Admin UI: new Repairs tab (status filter chips, search by customer/phone/IMEI/job no, table), AddRepairDialog (customer by phone search or new with Aadhaar scan via the existing AadhaarScanButton/useAadhaarOcr or manual typing, IMEI scan + TAC auto-fill with ask/auto/off online fetch, problem dropdown from settings.repairServices + free text, accessories checkboxes, estimate/advance/warranty/technician, before-photos), RepairDetailDialog (timeline, move status, add parts/labour with a Board/Motherboard checkbox, record payment, after-photos, print Job Sheet, print Invoice, WhatsApp wa.me update using the settings template), repairTemplates.ts (Job Sheet: customer copy + shop copy on one A4 with job number and QR, customer, device, IMEI, problem, accessories, estimate, advance, expected date, terms, signature lines; Repair Invoice: parts/labour table, total, advance, balance, warranty, bank/UPI from authenticated settings), mobile friendly, all text escaped (R15).
 - Cross-checks (O7) in AddPhoneDialog, ProcessSaleDialog, SellerSelectDialog/PartyPicker via RepairMatchDialog and RepairHistoryPanel (read-only history). board_replaced=1 requires the "I have seen the repair history" tick and writes an audit entry through a small authenticated audit-note endpoint. Keep the existing financial-year IMEI history check working and show both warnings when both exist.
 - seed-demo.mjs gains 2 fake repair customers and 3 fake repair jobs with Luhn-valid fake IMEIs.
 Assertions: A21 migration fresh+existing, no IF NOT EXISTS ADD COLUMN; A22 IMEI missing/invalid rejected by the server; A23 status log + timestamps; A24 board flag; A25 by-imei incl. after soft delete; A26 by-phone and separation from customers; A27 no repair data in any public output; A28 HTML escaping test with a customer named <img src=x onerror=alert(1)>; plus cross-check assertions A61 (by-phone match returns the repair customer only in /api/repair), A62 (board_replaced acknowledgment is written to the audit log).

----- STAGE 3B: multi-shop + Tailscale + public server -----
Follow PhoneZone_Audit_and_Plan.md Prompts 8 and 7 and assertions A31-A33. Essentials:
 - Migration: users.shop_id (plain ALTER), shop_code on shops if missing; seed existing users to the first shop; remove the real-shop seed from 007_shops FOR FRESH INSTALLS ONLY via a new migration or a guarded insert (never delete shop rows in existing DBs). Staff see only their shop (phones, returns, invoices, repairs); admin sees all with ?shop=all; cross-shop ids -> 403; enforce in routes AND in compat select/insert/update/delete; sellers/customers stay shared with a created_shop badge; invoice/job numbers carry the shop code with per-shop counters; admin can create staff/viewer users bound to a shop; staff cannot open Database/Backup/Settings (frontend hides AND backend requireRole('admin')); audit log records shop_id; admin shop switcher in AdminDashboard.
 - Tailscale (client of the CLI only): electron/tailscale.cjs with detect() (tailscale status --json), enableServe() = `tailscale serve --bg --https=443 http://127.0.0.1:<port>`, disableServe(), status polling every 30 s for the tray, all through a hidden-window runner; graceful messages when Tailscale is not installed/not logged in with a button to open https://tailscale.com/download. NEVER use `tailscale funnel` for the admin port. Client mode: first-run chooser "This is the MAIN computer / a SECOND computer"; client mode loads the server URL in the window and does not start a backend or DB. RemoteAccessCard in Settings (desktop only) with a beginner step list. Treat requests from the tailnet like remote requests for the O3 restrictions (backup/restore/setup only on the shop computer).
 - Optional public catalog server (backend/src/publicServer.js) on its own port serving ONLY the built homepage, GET /api/public/inventory, /api/public/files/:id, POST /api/public/messages (own rate limit, field caps), GET /api/public-config; no auth routes, no /api/pg, /api/setup, /api/settings, /api/repair. If the owner wants it online, it is the only thing that may be published to the internet.
 Assertions: A31, A32, A33 plus A63 (staff of shop 2 cannot update a shop-1 phone through compat), A64 (invoice numbers never collide across shops under concurrent creation).

----- STAGE 4: WhatsApp marketing (Chrome extension + server) -----
Follow PhoneZone_Audit_and_Plan.md Part 5 and Prompt 9; assertions A34-A37. Essentials: migration for wa_templates, wa_campaigns, wa_queue, wa_message_log, wa_tokens (token hashes only), whatsapp_opt_in + wa_opted_out_at on customers and repair_customers; audiences only from opted-in rows (repair customers by status/warranty-ending, buyers by recency, manual list); server-rendered templates with variables {name} {device} {job_no} {status} {price} {shop} {offer} (max 1000 chars); extension API with revocable bearer tokens: GET /api/wa/next enforces daily cap, active hours 10:00-20:00, random 25-70 s gap, 5-10 min pause every 10 messages; POST /api/wa/result; opt-out endpoint; dry-run campaigns; MarketingTab UI (templates with preview, audience picker with counts, campaign start/pause, queue/log tables, opt-in management, token management) with a permanent warning banner about ban risk and the official Cloud API alternative; extension/ (MV3: manifest.json, background.js, content.js, popup.html/js, README.md for beginners) limited to https://web.whatsapp.com/* plus the server URL granted at runtime, opens https://web.whatsapp.com/send?phone=91XXXXXXXXXX&text=..., sends, detects "not on WhatsApp", reports results; no scraping of other chats; all limits come from the server. Remote-mode rule: the extension API token routes are the ONLY /api/wa routes reachable remotely besides logged-in staff UI routes.

----- STAGE 5: hardening backlog -----
 H1 Encrypt Aadhaar/ID numbers and Hicelltek API keys at rest (desktop: key protected by safeStorage; keep search by last 4 digits via a separate indexed column), migration with one-time re-encryption and a restore-compatible backup path.
 H2 Optional password-protected backups (AES) selectable in Settings; default stays unencrypted-but-local.
 H3 Mask Aadhaar in lists/prints (last 4 only) unless the staff opens the detail; log views of full Aadhaar in the audit log.
 H4 Role review: viewer is read-only everywhere (enforce in backend), staff cannot delete, admin-only for user management, settings, backups.
 H5 Session management screen (active sessions, log out one/all), password change forces logout of other sessions, password policy (min 10 chars for admin when remote mode is enabled).
 H6 Compat layer: replace the free-form /api/pg write surface with explicit routes for the tables the UI writes, or an allow-list per table AND per column AND per role; keep read-only compat for lists.
 H7 Supabase online mode: verify the migration that makes the phonezone-uploads bucket private and removes the public write/delete policies exists in supabase/migrations (create it if missing, do NOT run it) with a comment for the owner; or mark online mode unsupported in the README.
 H8 Dependency audit: `npm audit` (no --force), upgrade only safe patch/minor versions, record the rest.
 H9 Performance: pagination for large lists, indexes (imei, status, created_at), VACUUM/ANALYZE after restore, list endpoints capped.
 H10 Accessibility/UX pass for the non-technical staff: consistent buttons, confirmation dialogs for destructive actions in plain words, empty states, loading states, offline error banners.
 Assertions: one per item where automatable (A65-A74; define them in TEST_PLAN.md and verify-all.mjs).

----- STAGE 6: clean release -----
 1. Final full VERIFY + tsc + build + both suites + BUILD-EXE; produce the installer; record path/size/sha256.
 2. Move the ngrok-independent public Supabase anon key out of src/integrations/supabase/client.ts into env (.env.example documents it); the offline EXE must build and run with all VITE_SUPABASE_* empty. Ensure no hard-coded business data remains (grep and list).
 3. Owner's data policy O10: delete data/, data11/, old *.tar.gz backups, *.log, ngrok-run.log/ngrok-domain.txt/err.txt/out.txt, tmp-*/ .tmp-*/ back-*.png/scratch/ leftovers and the _backup_stage* folders OLDER than the final stage snapshot. Keep .env, deliverables/, docs/ai/. Log in REPORT only paths and counts, never contents. Before deleting, verify MAKE-ZIP's safety scan would have excluded them anyway.
 4. Final documents: README.md (beginner guide: install, setup wizard, backup, restore, go online with ngrok, second shop with Tailscale, WhatsApp extension install, troubleshooting, what to do if Windows SmartScreen appears), docs/ai/* complete, a one-page OWNER_CHECKLIST.md (click-by-click acceptance test), and PhoneZone_FINAL_<timestamp>.zip in deliverables/.
 5. Final REPORT.md with the complete assertion table A01-A74, every NOT RUN item, every known limitation and every NEEDS DECISION. Final chat message: "ALL STAGES DONE" + 8-line Hinglish summary + the exact files the owner must send for review: REPORT.md, VERIFY_OUTPUT.txt, BUILD_OUTPUT.txt, deliverables/<latest>.zip.

AUTONOMY AND STOP RULES: proceed from stage to stage automatically while each gate is GREEN. STOP and write HANDOFF.md when: a gate stays red after 3 attempts on the same issue; an owner decision blocks all safe progress; a step needs credentials or hardware you do not have (use fakes and manual-checklist items instead whenever possible); you detect that earlier verified behaviour regressed and cannot restore it.

=====================================================================
9. SECURITY REQUIREMENTS (summary; track in SECURITY_STATUS.md)
=====================================================================
 Closed and must stay closed (regression-tested): S1 anonymous private-file access; S2 public config leak; S3 compat SQL/guards; S4 setup takeover (loopback-only, rate-limited); S5 bootstrap admin; S7 upload safety (magic bytes, no html, nosniff, CSP none); S8 login limits, hashed sessions; S9 restore validation and rollback; S11 headers and public message limits.
 Open and owned by later stages: S6 Supabase public bucket (H7); S10 plaintext Aadhaar/keys/unencrypted backups (H1, H2); S12 shop scoping (3B).
 Always: remote requests are identified by X-Forwarded-For/Forwarded and obey O3; the admin app is never published through Tailscale Funnel; the public server exposes nothing private; tokens never leave the secure store; users see simple errors while details go to logs without secrets.

=====================================================================
10. ASSERTION REGISTRY (keep in TEST_PLAN.md and scripts/verify-all.mjs; cumulative)
=====================================================================
Stage 1 (DONE, keep green):
 A01 node --check all backend/scripts files | A02 fresh DB applies all migrations | A03 DB with 001-007 applies the rest | A04 /api/health 200 | A05 no admin/user at startup, exactly one admin after setup | A06 login: 10 wrong = 401, 11th = 429, correct while blocked = 429, works after window | A07 compat select works | A08 compat delete empty filters = 400 | A09 injection filter rejected | A10 compat delete soft-deletes | A11 /api/config has no private fields | A12 anonymous object fetch 401 | A13 html-as-jpg rejected, png accepted, nosniff | A14 setup routes 403 with X-Forwarded-For | A15 Luhn-invalid IMEI 400 | A16 duplicate unsold IMEI 400 | A17 failed purchase leaves no orphan seller | A18 purchase_returned sale 400, double returns 400 | A19 FY invoice numbers unique | A20 tsc and build exit 0
 A38 update empty filters 400 unchanged | A39 update bogus column 400 unchanged | A40 audit_logs insert/update/delete 403 | A41 files not writable via compat, forged path never served | A42 select bogus column 400 | A43 column-name injection rejected | R01-R06 storage listing, restore rate limit, Returns-tab compat filters, accounting figures | SUITE1 offline-suite | SUITE2 first-setup-suite
Stage 3A: A47 runtime-config + CSP | A54 packaged smoke (NOT RUN allowed) | A56 forged path 404 | A57 packaged resource layout works | A58 startServer/close releases port and DB | A29/A30 tray, single instance, no console (manual allowed) | A44 remote ON blocks per O3 | A45 remote OFF refuses all remote | A46 remote login limits, XFF rotation harmless | A48 tunnel manager with fake SDK | A49 token hygiene (fake token appears nowhere) | A50 no HTTP route controls the tunnel | A59 logout-all | A51 backup/restore round trip, old fixture, corrupt/malicious archives rejected, no external tar | A60 restore rollback | A52 business edit does not change old invoices | A53 company switch isolation | A55 build/tsc/all earlier PASS
Stage 2: A21-A28 as in Stage 2 above, A61, A62
Stage 3B: A31 shop isolation | A32 public server exposes only the public routes | A33 Tailscale module handles "not installed", never uses funnel on the admin port | A63 | A64
Stage 4: A34 queue only opted-in | A35 server enforces cap and gap | A36 revoked token 401 | A37 extension loads (manual allowed)
Stage 5: A65-A74 defined by you for H1-H10 where automatable.

=====================================================================
11. UX AND QUALITY BARS
=====================================================================
 - Every screen must work for a non-technical shop employee: big clear buttons, plain-English labels, confirmation dialogs for destructive actions, helpful empty states, visible loading and error states, no jargon.
 - Mobile-friendly layouts for all admin screens (the owner will use them remotely from a phone).
 - Lists are paginated or capped (10k+ phones must stay fast); searches debounced.
 - Printing: invoices, job sheets and returns print cleanly on A4 with the business logo and signature from settings; amounts in words follow Indian numbering.
 - Accessibility basics: labels on inputs, keyboard focus order, sufficient contrast.
 - Logs: <userData>/logs, rotated, no personal data or secrets.

=====================================================================
12. BEGIN NOW
=====================================================================
Step 1: Phase 0 (Section 6): read everything, create docs/ai/* and README.md, write PROGRESS.md entry 0 with the verified baseline you reproduce yourself by running scripts/verify-all.mjs (expect PASSED 36 / FAILED 0; if it differs, record the real numbers and fix regressions first).
Step 2: Stage 3A-1, then 3A-2, then 3A-3, then Stage 2, Stage 3B, Stage 4, Stage 5, Stage 6, following the protocol in Section 8.
Report progress to the owner only at stage ends (short Hinglish message with the SUMMARY line and what is next). Do not stop between stages while gates are green.
```

---

## Jab kaam khatam ho

Mujhe ye 4 cheezein bhejna: `REPORT.md`, `VERIFY_OUTPUT.txt`, `BUILD_OUTPUT.txt`, aur `deliverables\` folder ki sabse nayi zip. Main zip khol ke backend khud chala ke attacks dobara chalaunga, jaise pehle kiya tha.

**Aapko khud test karna hoga (agent nahi kar sakta):**
- EXE install karke click-through (`OWNER_CHECKLIST.md` me list hogi)
- Asli ngrok token se Go ONLINE
- Mobile se remote link kholna
- Tailscale dono computer pe
- WhatsApp extension Chrome me load karna
