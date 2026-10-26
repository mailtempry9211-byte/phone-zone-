# CONTEXT.EXE.MD — full handoff context for the next AI / session

Purpose: any agent (or human) resuming work on this project reads **only this file** plus `REPORT.md` and knows exactly what exists, what is verified, and what to do next. Update this file together with `REPORT.md`, `PROGRESS.md`, `TODO.md`, `REMAINING.md` after every small step (owner's standing instruction).

Last updated: 2026-10-19 17:15 UTC+5:30, by the session that ran the **Stage 3A gate** (result: STOP, see below).

## 0. What this project is

PhoneZone = a phone-shop ERP (inventory, sold, returns, customers, sellers, messages, accounting, storage, database, settings) that runs **fully offline** on Windows:

* React + Vite + TypeScript frontend (`src/`), served in production by the backend.
* Express + better-sqlite3 backend (`backend/src/`), port **47713**, host **127.0.0.1** only.
* Everything the owner types lives in `data/` (SQLite database + `storage/` files). Never modify `data/` or `.env` (rule R2).
* Verification = `node scripts/verify-all.mjs` → `VERIFY_OUTPUT.txt` (harness always exits 0; read the SUMMARY line).

## 1. Current state (verified facts, this session)

* `A01-A20` **ALL PASS**, plus `SUITE1 128/128`, `SUITE2 32/32`, plus `R01-R06` (audit-repair checks). `tsc exit 0`, `npm run build exit 0`. Source: `VERIFY_OUTPUT.txt` (2026-10-19T11:35:02Z) and `scratch/gate-run.txt`.
* **Stage 3A was REQUESTED but STOPPED at its gate**: the gate demands `A38-A43` PASS, and those assertion IDs **do not exist anywhere in this folder** (no definition in `PhoneZone_MASTER_PROMPT.md`, which only defines A01-A37; not in `PhoneZone_Audit_and_Plan.md`; `verify-all.mjs` never records them). Evidence: `REPORT.md` §3. **Owner must either send the A38-A43 list or waive them in writing.**
* **No Stage 3A artifact exists yet**: no `electron/` folder, no `BUILD-EXE.bat`, no `scripts/build-exe.mjs`, no `build/icon.ico`, no `OnlineAccessCard.tsx` / `CompanySwitchCard.tsx`, no `src/lib/desktopBridge.ts`, no `backend/test/stage3a-suite.mjs`, no `tar` dep, `verify-all.mjs` still `const STAGE = 1`.
* Known pre-existing blocker for Electron packaging (B5 of the plan): root `package.json` has `"main": "electron/main.cjs"` but the folder does not exist — any electron command will fail until Part A is built.
* The audit-repair round (previous instruction) IS on disk and green: rate-limits on setup/backup/storage-write endpoints, real `/api/files` listing, ErrorBoundary per admin tab, AlertDialog `asChild` fix (Radix single-child), StorageTab on real backend files, logo/signature upload via backend, dashboard/Accounting single source of truth, invoice numberToWords fix, shops types, DB tab image remap on restore, footer year, login-email fix. Full file list: `REPORT.md` §4.
* The stage-1 `REPORT.md` was overwritten in place by the stage-3A-gate report; its full content is preserved at **`REPORT-stage1.md`** (verified this session).

## 2. Hard rules (from `PhoneZone_MASTER_PROMPT.md`, still binding)

R1 evidence-or-write-NOT-RUN · R2 never touch `data/` or `.env` · R3 temp data dirs only · R4 `node --check` every .js/.cjs/.mjs · R5 `tsc --noEmit` + `npm run build` · R6 every edit → `verify-all.mjs` assertion · R7 SQLite = single source of truth, browser never authoritative · R8 no secrets (incl. ngrok authtoken) in logs/reports/code · R9 one stage at a time, STOP at end · R10 previous-stage failures → STOP and report · R11 build only what is asked · R12 Windows 10/11 first, owner only double-clicks .bat/.exe.

## 3. Stage 3A spec (what the next session will build once the gate clears)

From the owner's instruction (summarised; the full text is in the thread):

* **Part A** Electron shell: backend inside main process (ESM dynamic import, `startServer/stopServer` export), data dir `<userData>/companies/<companyId>`, extraResources for `database/ config/ dist/` via `PHONEZONE_RESOURCES_DIR`, single-instance lock, contextIsolation+sandbox, preload whitelist `window.phonezoneDesktop`, tray (open/status/online/backup/start-with-Windows/quit), graceful quit with WAL checkpoint, log rotation in `<userData>/logs/main.log`, no console window, no auto-update.
* **Part B** embedded ngrok via official `@ngrok/ngrok` SDK (pinned; platform pkg `@ngrok/ngrok-win32-x64-msvc` in asarUnpack): `electron/tunnel.cjs` with getState/saveCredentials/clearCredentials/start/stop/testCredentials/setAutoStart, token in safeStorage DPAPI `<userData>/secure/ngrok.bin`, renderer sees only tokenLast4, default OFFLINE, `OnlineAccessCard` in Settings desktop-only (IPC only, no HTTP route), ONLINE banner, error-message mapping.
* **Part C** backend: `trust proxy loopback`, remoteGuard (X-Forwarded-For ⇒ remote), remote mode OFF ⇒ 403 for all remote, ON ⇒ 403 for setup/backups/system/users/exports/storage-usage/compat-delete, email+IP login limiters, 8h remote sessions, `POST /api/auth/logout-all` + Settings button, runtime config flag.
* **Part D** backup/restore with `tar` npm package (no spawn), schedule, pre-restore safety backup, corrupt/malicious archive rejection.
* **Part E** company switch (folders, add/switch/remove-from-list keeps folder) + business profile edit (new invoice uses new name, reprint keeps old).
* **Part F** NSIS per-user installer, `build/icon.ico`, `BUILD-EXE.bat` → `scripts/build-exe.mjs` (npm install, frontend build, electron-builder with better-sql3 rebuild, BUILD_OUTPUT.txt with path/size/sha256, `pause`), no signing (SmartScreen note).
* **Assertions A44-A55** to add to `verify-all.mjs` + `backend/test/stage3a-suite.mjs`, `STAGE` constant = "3A".

## 4. How to verify (exact commands, all safe)

```
node scripts/verify-all.mjs        # full harness -> VERIFY_OUTPUT.txt + scratch/gate-run.txt
npx tsc --noEmit -p tsconfig.app.json
npm run build
node backend/test/offline-suite.mjs
node backend/test/first-setup-suite.mjs
```

All use throwaway temp data dirs (`.demo-data`, `.stage*`, `scratch/`); the real `data/` is never touched.

## 5. Where things live

| Area | Path |
|---|---|
| Verification harness | `scripts/verify-all.mjs` (STAGE constant, A01-A20 + R01-R06) |
| Gate evidence | `scratch/gate-run.txt`, `VERIFY_OUTPUT.txt` |
| Backend routes | `backend/src/routes/index.js` (setup/auth/settings/files/storage/backup/users), `compat.js` (SQLite-over-Supabase API + soft-delete + limits) |
| Backend services | `backend/src/services/*.js` (settings, backup, storage, invoice, financialYear, audit, …) |
| Paths / data dir | `backend/src/config/paths.js` (`PHONEZONE_DATA_DIR`, `PHONEZONE_RESOURCES_DIR`) |
| Frontend data layer | `src/lib/data/` (localDriver/offlineSupabase = offline path, supabaseDriver = online path) |
| Admin tabs | `src/components/admin/*.tsx`, mounted in `AdminDashboard.tsx` (each tab ErrorBoundary-wrapped) |
| Reports | `REPORT.md` (current), `PROGRESS.md`, `TODO.md`, `REMAINING.md`, this file |

## 6. Next action (single, unambiguous)

1. Ask the owner for the **A38-A43** list (or a written waiver). Nothing else may be built first — the gate says STOP (rules R10/R11).
2. On the answer: add A38-A43 (or proceed), then Stage 3A Part A, updating all five tracking files after each small step.
