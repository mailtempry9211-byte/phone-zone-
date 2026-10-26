# PhoneZone: Permanent Context & Memory (docs/ai/CONTEXT.md)

> READ THIS FIRST AFTER ANY RESTART OR CONTEXT COMPACTION

## 1. Product Summary
PhoneZone is an offline-first Windows ERP for mobile-phone shops in India.
- **Inventory/Purchase:** Buying used/new phones from sellers (KYC/Aadhaar, Luhn-valid 15-digit IMEI mandatory, TAC auto-lookup, purchase invoice).
- **Sales:** Selling phones to customers with financial-year invoices (e.g. `SAL-2026-27-0001`).
- **Returns:** Purchase return to seller, sales return from customer (strict state transitions).
- **Accounting:** Revenue & profit dashboard, FY tracking, invoice generation.
- **Repairs (Private):** Job sheets, diagnosis, parts/labour items (motherboard tracking), IMEI & phone cross-checks, A4 job sheet/invoice printing with QR. Never exposed publicly.
- **Public Website:** Catalog of unsold phones, contact messages, store details. Never exposes cost, IMEIs, customer data, or repairs.
- **Multi-Shop & Tailscale:** One server computer, one SQLite DB for multiple shops, second shop connects over Tailscale (tailnet HTTPS).
- **Remote Access (ngrok):** Embedded in-process SDK, activated only by owner, strict remoteGuard blocking admin/backup/destructive operations.
- **WhatsApp Marketing:** Chrome MV3 extension with server-controlled queue, daily cap, active hours, random gaps, opt-in enforcement.

## 2. Tech Stack & Repository Map
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui.
  - Located in `src/` (`components/admin/`, `components/`, `pages/Index.tsx`, `hooks/`, `lib/`).
- **Backend:** Node.js (ESM plain JavaScript, NO TypeScript syntax), Express, better-sqlite3 (WAL mode, synchronous FULL).
  - Located in `backend/src/` (`server.js`, `routes/index.js`, `routes/compat.js`, `routes/repairs.js`, `services/`, `lib/`, `config/`, `db/`).
- **Database:** SQLite via numbered migrations in `database/migrations/` (applied sequentially at boot).
- **Tooling:**
  - `scripts/verify-all.mjs` (`VERIFY.bat`): cumulative test harness.
  - `scripts/make-clean-zip.mjs` (`MAKE-ZIP.bat`): clean distribution packaging.
  - `scripts/seed-demo.mjs` (`SEED-DEMO.bat`): fake demo data generator.
  - `scripts/dev.mjs` (`npm run dev:all`): starts backend (47713) & Vite (8080) for local web testing.

## 3. Owner Profile & Critical Constraints
- **Owner Profile:** Non-programmer, mouse & keyboard user. Everything must run reliably and have clear plain-English UI.
- **Current Directive:**
  - **EXE MAT BANANA PEHLE**: Run locally on the WEB so the user can verify full usage in their browser.
  - No features broken; keep all baseline tests green.
  - After user verification: build EXE, then APK, then Hosting version.
  - Language: Simple Hinglish in chat, clear English in UI and code.

## 4. Binding Owner Decisions (O1–O12)
- **O1:** Embedded ngrok using official in-process SDK (`@ngrok/ngrok`), no CLI, offline by default.
- **O2:** Tunnel controls only in local window (IPC), credentials in Electron `safeStorage`.
- **O3:** Remote guard blocks setup, backup/restore, user management, and compat deletes when accessed remotely.
- **O4:** Single server + single DB for 2 shops. Tailscale serve (tailnet HTTPS) for second shop. Never Tailscale Funnel for admin.
- **O5:** Repairs are strictly private, own tables, never appear in public routes or homepage.
- **O6:** IMEI mandatory everywhere, Luhn validated, TAC local lookup with ask/auto/off online fallback.
- **O7:** Cross-checks: Phone number match in sales/purchase prompts to import repair customer KYC; IMEI match shows repair history and requires checkbox if motherboard was replaced.
- **O8:** WhatsApp marketing Chrome MV3 extension driven by server queue with rate limiting and opt-in rules.
- **O9:** Company change: editable profile with invoice snapshots + multi-company data folder switching.
- **O10:** Real customer data in `data/` is disposable test data, but only deleted in Stage 6. All tests use temp directories.
- **O11:** No auto-update, no code signing (inform user about SmartScreen).
- **O12:** Fake ngrok token in automated tests; never ask user for real tokens.

## 5. Verified Baseline Status (2026-10-20)
- `scripts/verify-all.mjs`: **PASSED 36 / FAILED 0 / SKIPPED 0** (A01-A20, A38-A43, R01-R06, SUITE1 138/138, SUITE2 32/32, tsc 0, build 0).
- Baseline snapshot: `_backup_baseline_20261020-1901/`.

