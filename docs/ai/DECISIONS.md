# PhoneZone: Architecture Decision Records (docs/ai/DECISIONS.md)

## ADR-001: Offline-First SQLite Architecture
- **Date:** 2026-10-20
- **Status:** Accepted (O1-O12)
- **Context:** The mobile shop operates in areas with intermittent connectivity. Business operations (buying, selling, repairs, invoices) must never stall due to internet outages.
- **Decision:** Utilize SQLite via `better-sqlite3` with Write-Ahead Logging (`WAL`) and `synchronous = FULL` on local storage.

## ADR-002: Dedicated Private Repairs Module
- **Date:** 2026-10-20
- **Status:** Accepted (O5, O6, O7)
- **Context:** Mobile repair services involve distinct customer data, parts inventory, and warranty lifecycle which should not mix directly with general store inventory or public catalog.
- **Decision:** Construct independent private tables (`repair_customers`, `repair_jobs`, `repair_job_items`, `repair_status_log`). Cross-reference with inventory via read-only matching hooks.

## ADR-003: Pure In-Process Archive Management
- **Date:** 2026-10-20
- **Status:** Accepted
- **Context:** Windows installations frequently lack GNU `tar` or have inconsistent path handling.
- **Decision:** Use npm `tar` library directly in Node.js for zero external dependency backup/restore operations.

## ADR-004: Web-First Verification Before Packaging
- **Date:** 2026-10-20
- **Status:** Accepted (User Directive)
- **Context:** User requested: "EXE MAT BANAN EXE BANNE SE PHJLE LOCALLY RUN KRKE WEB PR VERIFUY KRUNGA FULL USAGE USKE BAAD EXEBNAYENGE , APK BANAYENNGE OR HIOSTING VERSION BHI BNAAYENGE OK"
- **Decision:** Prioritize full local web functionality (`npm run dev:all` / Express backend on 47713 + Vite on 8080) and complete feature delivery first. Defer Electron installer generation until the user verifies full usage in the browser.

