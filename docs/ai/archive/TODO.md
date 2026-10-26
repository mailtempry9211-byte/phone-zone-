# TODO.md — next actions, in order

## Blocked on the owner (do first)

1. **Get the A38-A43 list from the owner** — they chose "Send the A38-A43 list" on 2026-10-19 and have not pasted it yet. When it arrives: implement each assertion in `scripts/verify-all.mjs`, run the harness, and only proceed to Stage 3A when they all PASS. Until then Stage 3A must not start (rules R10/R11).

## When the gate is cleared → Stage 3A (in this order, one part at a time)

1. Part A: `electron/main.cjs` + `preload.cjs` + `tray.cjs` + `config.cjs` + `secureStore.cjs` + `companies.cjs`; backend inside main process; data dir `<userData>/companies/<id>`; graceful quit; log rotation; single instance; tray menu; no console window.
2. Part B: `electron/tunnel.cjs` with `@ngrok/ngrok` (pinned) + adapter for fake-SDK tests; safeStorage DPAPI token; `OnlineAccessCard.tsx` (desktop-only, IPC only); ONLINE banner; error mapping; auto-online default off.
3. Part C: backend remote-mode (`trust proxy loopback`, remoteGuard, remote 403 lists, email+IP limiters, 8h remote sessions, `/api/auth/logout-all` + Settings button, runtime-config flag).
4. Part D: backup/restore with `tar` npm package, schedule (`backupScheduler.cjs`), pre-restore safety backup, corrupt/malicious archive rejection.
5. Part E: `CompanySwitchCard.tsx` + company folders + business profile edit (A52/A53 semantics).
6. Part F: `build/icon.ico`, `BUILD-EXE.bat`, `scripts/build-exe.mjs`, electron-builder NSIS per-user config, better-sql3 rebuild for Electron ABI, packaged smoke test, `make-clean-zip.mjs` update, `.gitignore` update.
7. Assertions: add `backend/test/stage3a-suite.mjs` + A44-A55 to `scripts/verify-all.mjs`; set `const STAGE = "3A"`; full harness green.
8. Docs: final `REPORT.md` (stage 3A) + `BUILD_OUTPUT.txt`; tell the owner to run BUILD-EXE.bat → VERIFY.bat → MAKE-ZIP.bat and send the four files.

## After Stage 3A (later stages, not now)

* Stage 2 Repairs, Stage 4 WhatsApp + wa.me links, Stage 3 Tailscale alternative, then installer polish (icon, signing if ever required).
