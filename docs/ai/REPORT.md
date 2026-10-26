# PhoneZone: Full System Verification Report (REPORT.md)

**Generated:** 2026-10-20  
**Target:** Local Web ERP Verification Gate (Pre-EXE / Pre-APK)  
**Status:** **ALL 61 ASSERTIONS PASSED (ZERO FAILURES, ZERO SKIPS)**

---

## 0. Executive Summary
Per user directive, PhoneZone has been completely built, hardened, and verified for full offline web usage. **EXE building is paused** so the owner can run and test everything locally in the browser (`http://127.0.0.1:47713`).

- **Repairs Module:** Fully private with Luhn IMEI validation, job sheets with QR codes, A4 repair invoices, and inventory cross-checks.
- **Multi-Shop Scoping:** Staff see only their shop's inventory and repairs; admin sees all; collision-free invoice numbering per shop.
- **WhatsApp Marketing:** Chrome MV3 extension with server-paced queue (daily cap, 25-70s delay, active hours 10:00-20:00, opt-in enforcement).
- **Security & Safety:** In-process backups with rollback, Aadhaar masking, viewer role enforcement, session management, loopback setup protection.

---

## 1. Automated Verification Proof
```
PhoneZone VERIFY
========================================================================
Stage            : 5
Date             : 2026-10-20
Node             : v24.21.0
Platform         : win32 x64 (10.0.26200)
Project root     : C:\Users\Kohinoor\Desktop\phonezonestp-mainv2.zipp

--- sha256 of security-critical files ---
8e208417becaa29cb28b295307fb3bb9411f6a624b087854059ae2d563a81494  backend/src/routes/index.js
a4591b1bb89dc1f1b46ce063a79fb930c288e098082a94b5359578ff6ea9f610  backend/src/routes/compat.js
2614c41ca22e49ddaea06221da1c2aa60c30f71a43d244d56863f9212ac53cb6  backend/src/services/inventoryService.js
b6f22d41ebfd2770d59040aab1987bc761683a0d423ac22c79cd70d6f3e1215b  backend/src/services/storageService.js
bc1cc310ab46a3ba3eb847333982e112d0874ef82e82ab8f5677a32305be03bd  backend/src/services/authService.js
24eff0d0ad18d04f72bbecd145cd2730eeee3fe20d7c3aa6d068d836f6fc168c  backend/src/services/backupService.js
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
3a864eb36dfae6f4767d25ab81e5025136315d6d2193fa6aedc7176967abff15  database/migrations/011_repairs.sql
aa8108071dd90eb71663531878f6ae06dd036804b79e3e61c140f1e6274eab57  database/migrations/012_multi_shop.sql
f5161b2f1d6a532eddb19f19364877d4bfae8bd02f5f779da45ae69e61cb1c29  database/migrations/013_whatsapp.sql

--- A01: node --check on backend + scripts ---
  A01 PASS  40 files checked, 0 failed

--- A02 / A03: migrations ---
  A02 PASS  12/12 migrations applied to a brand-new database
  A03 PASS  7 pre-stamped, 12/12 after startup

--- live backend on a throwaway data directory ---
  server ready on http://127.0.0.1:48410/api
  A04 PASS  GET /api/health -> 200
  A05 PASS  users at startup = 0, password printed = false
  A14 PASS  /setup 403, /setup/upload 403, /setup/restore 403, users 0
  A05b PASS  setup -> 200, admin accounts = 1
  A07a PASS  login -> 200
  A11 PASS  no private fields
  A07 PASS  POST /api/pg/phones/select -> 200, array = true
  A12 PASS  anonymous object fetch -> 401
  A08 PASS  empty filters -> 400, phones = 0
  A09 PASS  injection filter -> 400, phones = 0
  A10 PASS  phone row kept = true, deleted_at set = true, hidden from select = true
  A38 PASS  empty filters -> 400, rows@1 = 0, unchanged = true
  A39 PASS  bogus column -> 400, rows@1 = 0, unchanged = true
  A40 PASS  insert 403, update 403, delete 403, rows 4 -> 4
  A41 PASS  files insert 403, update 403, forged row true, private 404, public 404, db leaked = false
  A42 PASS  bogus select -> 400
  A43 PASS  values 400, filter column 400, filter op 400, unchanged = true
  A13 PASS  html-as-jpg 400, real png 201, nosniff = nosniff
  A15 PASS  Luhn-invalid IMEI -> 400
  A16 PASS  first 201, duplicate 400
  A17 PASS  rejected = 400, orphan seller rows = 0
  A18 PASS  purchase_returned sale 400, 2nd purchase_return 400, 2nd sales_return 400
  A19 PASS  FY 2026-27, format ok = true, unique 20/20, sample SAL-MAIN-2026-27-0001
  A06 PASS  10 wrong = 401, 11th = 429, blocked correct = 429, after window = 200
  R01 PASS  upload 201, listed yes, owner phone, bytes 70, public fetch 200
  R02 PASS  delete 200, still listed = false, public after delete 404
  R03 PASS  usage 2 file(s) / 4166 bytes, list 2 / 4166
  R04 PASS  attempts (blocked after 10), message readable = true
  R05 PASS  fresh purchase 201, or+is select 200, admin_settings single row = true
  R06 PASS  seed sale 201, dashboard revenue 350 vs rows 350, profit 250 vs 250
  A47 PASS  runtime-config 200, contains offline flag = true
  A56 PASS  forged file path -> 404
  A21 PASS  repairs tables found: 4/4
  A22 PASS  invalid Luhn repair IMEI -> 400
  A23 PASS  status -> ready, ready_at = true, logs = 2
  A24 PASS  board_replaced = 1
  A25 PASS  found = 1, soft-deleted row kept = true
  A26 PASS  by-phone found = Anand Repair, in customers table = 0
  A27 PASS  repair data leaked in public routes = false
  A28 PASS  escaped output = &lt;img src=x onerror=alert(1)&gt;
  A61 PASS  by-phone match returned repair customer
  A62 PASS  audit note status 201, rows in audit_logs = 1
  A31 PASS  staff2 sees shop 1 phone = false, admin sees all = true
  A63 PASS  cross-shop update status = 403
  A64 PASS  shop1 SAL-MAIN-2026-27-0021 vs shop2 SAL-B2-2026-27-0001
  A32 PASS  pg 404, setup 404, repair 404, public inventory 200
  A33 PASS  handles not-installed = true, funnel blocked = true
  A34 PASS  queued phones: 9876500001, non-opted excluded = true
  A35 PASS  first item: 9876500001, second waitSeconds: 10
  A36 PASS  revoked token call returned 401
  A37 PASS  extension MV3 manifest valid = true
  A65 PASS  masked = •••• •••• 7777, unmasked fetch = 200, audit logged = true
  A66 PASS  viewer read 200, viewer insert blocked 403
  A67 PASS  active sessions count = 1, current marked = true, revoke status = 200
  A68 PASS  system optimize status 200

--- backend regression suites ---
  test/offline-suite.mjs: 138 passed, 0 failed
  SUITE1 PASS  138 passed, 0 failed
  test/first-setup-suite.mjs: 32 passed, 0 failed
  SUITE2 PASS  32 passed, 0 failed

--- A20: typecheck and production build ---
  tsc exit 0
  npm run build exit 0
  A20 PASS  tsc 0, build 0

========================================================================
SUMMARY: PASSED 61 / FAILED 0 / SKIPPED 0
```

---

## 2. Deliverables
- Clean backup archive: `deliverables/PhoneZone_stage5_verified_2026-10-20.zip` (24.58 MB)
- Extension directory: `extension/` (ready to load in Chrome via developer mode)
- Full automated test suite: `VERIFY.bat` (producing `VERIFY_OUTPUT.txt`)

