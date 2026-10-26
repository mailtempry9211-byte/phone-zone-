# PhoneZone fixes (overlay on top of your project)

Copy these files over your project folder (same paths). Your `data/` folder is NOT touched.

## "Setup failed" - root cause
The Vite dev server (`npm run dev`, port 8080) only proxies `/api` to the backend on port 47713.
`npm run dev` does NOT start that backend. With no backend, every `/api/*` call returned a non-JSON
500 and the page just said "Setup failed". The IFSC code is not validated anywhere - it was not the cause.

## Fixed
1. `npm run dev:all` (new, scripts/dev.mjs) starts backend + Vite together. `npm run backend` starts only the backend.
2. Setup.tsx: clear error message when backend is unreachable / non-JSON response.
3. Setup.tsx: after setup or restore, a full reload is used. Before, App.tsx kept stale `setupComplete=false`,
   so `navigate('/')` bounced back to /setup in a loop.
4. Setup.tsx: removed `React.Fragment` (lovable-tagger put `data-lov-id` on it = the 1042 red console errors).
5. backend routes/index.js: account creation + settings save are one transaction (a failure no longer leaves a
   half-created user that makes every retry fail). Duplicate email gives a readable message.
6. backend business.js: server bound to 0.0.0.0 by default (anyone on the Wi-Fi could reach /api/setup).
   Now 127.0.0.1. Override with PHONEZONE_HOST if you really want LAN access.
7. Change Password never worked offline: UI collected the current password but never sent it. Fixed
   (PasswordChangeDialog, useAuth, offlineSupabase). Backend minimum length 8 -> 6 to match the UI.
8. offlineSupabase.ts: login stored the wrong object as session, so "Authenticated as: {user.email}" was empty.
9. config/business-config.json: currency symbol and price template had a literal `?` instead of the rupee sign.

## Verified
- tsc: 0 errors, vite build: OK, backend offline suite: 50 passed / 0 failed.
- Setup with your exact form values, login, change password, duplicate-email case: all pass against a real running backend.

## Not fixed (needs your decision)
- `electron/` folder is missing from the zip, but package.json `main` is `electron/main.cjs` and the build config
  lists `electron/**`. `npm run electron:dev` and `installer:build` cannot work until it is restored.
- 140+ ESLint `no-explicit-any` errors (style only, build is fine).
- `.env` (Supabase URL + anon key) is not in .gitignore. The anon key is public by design, but keep the file out of git.
- Frontend bundle is ~1 MB (no code splitting). Works, just slower first load.

## Node 24 / better-sqlite3 build error (added)
better-sqlite3 11.10 has no prebuilt binary for Node 24 (ABI 137), so npm tried to compile it and failed
without Visual Studio. Upgraded to better-sqlite3 ^12.11.1 (prebuilt for Node 20-26). Backend suite: 50/50.
After copying files run:  cd backend && npm install
