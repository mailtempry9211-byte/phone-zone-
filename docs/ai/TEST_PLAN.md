# PhoneZone: Test Plan & Assertion Registry (docs/ai/TEST_PLAN.md)

## Automated Assertion Registry
| ID | Stage | What It Proves | How | Automated / Manual |
|---|---|---|---|---|
| A01 | 1 | Backend & scripts syntax check | `node --check` across all js/mjs files | Automated |
| A02 | 1 | Fresh DB migration check | Apply all migrations to empty DB | Automated |
| A03 | 1 | Existing DB migration check | Apply delta to pre-stamped DB | Automated |
| A04 | 1 | Health check | `GET /api/health` returns 200 | Automated |
| A05 | 1 | Zero admin at startup | Setup wizard creates the single admin | Automated |
| A06 | 1 | Login rate limit | 10 wrong attempts trigger 429 rate limit | Automated |
| A07 | 1 | Compat select operation | `POST /api/pg/phones/select` returns array | Automated |
| A08 | 1 | Delete empty filter guard | Empty filters rejected with 400 | Automated |
| A09 | 1 | Injection filter guard | Malformed filters rejected with 400 | Automated |
| A10 | 1 | Soft delete compliance | Rows marked deleted, hidden from select | Automated |
| A11 | 1 | Config data leak prevention | `/api/config` excludes bank details | Automated |
| A12 | 1 | Private storage protection | Anonymous file fetch returns 401 | Automated |
| A13 | 1 | File upload MIME check | HTML disguised as image rejected (400) | Automated |
| A14 | 1 | Setup route loopback guard | `X-Forwarded-For` rejected with 403 | Automated |
| A15 | 1 | Luhn IMEI validation | Invalid Luhn IMEI rejected with 400 | Automated |
| A16 | 1 | Duplicate IMEI prevention | Duplicate unsold IMEI rejected with 400 | Automated |
| A17 | 1 | Atomic purchase creation | Failed purchase leaves no orphan seller | Automated |
| A18 | 1 | Return state enforcement | No selling returned phones, no double return | Automated |
| A19 | 1 | Financial year invoice sequence | Invoices follow FY numbering format | Automated |
| A20 | 1 | TypeScript & Build | `tsc --noEmit` and `npm run build` exit 0 | Automated |
| A38-A43 | 1.1 | Compat update & select guards | Whitelist columns, no injection | Automated |
| R01-R06 | 1.1 | Storage, limits, accounting | Real file list, dashboard calculations | Automated |
| A47 | 3A | Runtime config endpoint | `GET /runtime-config.js` sets offline flag | Automated |
| A56 | 3A | Forged path file protection | Forged file path returns 404 | Automated |
| A51, A60 | 3A | In-process backup & rollback | Clean tar round trip & rollback on failure | Automated |
| A52 | 3A | Business profile snapshot | Historical invoices keep original details | Automated |
| A53 | 3A | Multi-company isolation | Separate directory per company | Automated |
| A44, A45 | 3A | Remote guard protection | Route restrictions when remote | Automated |
| A21-A28 | 2 | Repairs module | Private tables, Luhn, jobs, templates | Automated |
| A61, A62 | 2 | Repair cross-checks | Phone and IMEI cross-checks | Automated |
| A31-A33 | 3B | Multi-shop & public server | Shop scoping, public minimal server | Automated |
| A34-A37 | 4 | WhatsApp marketing | Opt-in queue, rate limits, extension | Automated |
| A65-A74 | 5 | Hardening | Masking, roles, active sessions | Automated |

## Owner Manual Testing Checklist
1. **Local Web Run:** Start app via `npm run dev:all` or `node backend/src/server.js`, navigate to `http://127.0.0.1:47713` or `http://localhost:8080`.
2. **First Run Setup:** Create initial shop administrator profile.
3. **Purchase Flow:** Buy a phone from a seller (enter Aadhaar, test IMEI with TAC auto-fill).
4. **Repairs Tab:** Open Repairs, create a job sheet, test printable A4 preview with QR code.
5. **Cross-Check:** In purchase dialog, enter a phone or IMEI previously entered in Repairs to see the automatic alert banner.
6. **Sales Flow:** Sell an unsold phone to a customer, print customer invoice.
7. **Backup:** Click "Backup Now", verify backup file creation in downloads/folder.

