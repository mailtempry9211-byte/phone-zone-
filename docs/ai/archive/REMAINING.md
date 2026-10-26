# REMAINING.md — what is still missing or unverified (honest list)

## Currently blocked

* **Stage 3A (EXE + ngrok + backup/restore + settings + company switch): NOT STARTED** — the gate failed on undefined assertions A38-A43; stopped by design. See `REPORT.md` §1-§3.
* **A38-A43:** undefined anywhere in the folder; owner must supply them or waive them in writing.

## From earlier stages — still not built / not run

* **Stage 2 — Repairs module:** no repair UI, no repair backend routes (the `repairService.js`/`tac.js` files present are leftovers, unverified by any assertion).
* **Stage 3 — Electron/Tailscale/tray:** not built (Stage 3A is the first part of it and is blocked as above).
* **Stage 4 — WhatsApp messaging / browser extension:** not built; MessagesTab is backend-only today.
* **Packaged EXE:** none exists; no installer, no icon, no code signing (SmartScreen "Unknown publisher" will show when it is eventually built).
* **ngrok tunnel:** not implemented; no token handling exists anywhere yet.

## Unverified / known gaps in what DOES exist

* ESLint: ~188 pre-existing `no-explicit-any` style errors (build unaffected; not an assertion in any stage).
* `package.json` `main` points at `electron/main.cjs` which does not exist — electron tooling will fail until Stage 3A Part A lands.
* The Database-tab JSON restore re-uploads images via `/api/files/upload`-style flow; bulk restores with hundreds of images are slow (no parallelism) — acceptable but untested at scale.
* Backup archives do not include company switching state (per-company folders arrive with Stage 3A Part E).
* The stage-1 report is preserved at `REPORT-stage1.md` (the current `REPORT.md` is the stage-3A gate report).
* A20 harness runs `npm run build` and `tsc` but the harness itself always exits 0 — humans must read `VERIFY_OUTPUT.txt` SUMMARY.
