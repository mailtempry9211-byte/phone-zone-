# PhoneZone: Full Audit + EXE/Tailscale Architecture + Repair Module Plan

Zip examine kiya: backend line-by-line padha, frontend grep + key flows, DB schema/migrations, Supabase policies. Maine backend ko ek **scratch copy** me install karke chalaya. Original files touch nahi kiye.

Har finding pe tag hai:
- **[TESTED]** = maine chala ke confirm kiya
- **[CODE]** = code padh ke mila, abhi runtime test nahi hua

---

## PART 1: Abhi ka asli status (sabse pehle ye padho)

### P0: App abhi chalti hi nahi (4 blockers, sab TESTED)

| # | Problem | Kahan | Proof |
|---|---|---|---|
| 1 | Plain `.js` file me TypeScript syntax (`email: string`) | `backend/src/routes/index.js` line 33, 53, 66 | `node src/server.js` -> `SyntaxError: Unexpected token ':'`. Backend start hi nahi hota |
| 2 | Migration 008 invalid SQL. SQLite me `ADD COLUMN IF NOT EXISTS` supported nahi hai. Plus dono columns migration **003** me pehle se hain | `database/migrations/008_admin_settings_flags.sql` | Startup abort: `near "EXISTS": syntax error`. Fix: 008 file delete karo |
| 3 | `table()` helper define hi nahi hai | `backend/src/routes/compat.js` lines 133, 191, 233, 245 | Login ke baad `/api/pg/phones/select` -> 500, log me `table is not defined`. **Poora admin UI (inventory, sellers, returns, accounting) offline mode me dead** |
| 4 | Login rate limiter bana hai par kahin lagaya nahi | `routes/index.js` | 12 galat password -> sab 401, kabhi block nahi hua |

Pichle AI agent ne in sab ko "fixed" bataya tha kyunki usne kuch run nahi kiya tha. `FIXES.md` me likha "50 passed" us se pehle ka hai.

### P0: Folder me asli business data hai

- `data/database/phonezone.db` me **58 sellers, 35 customers, 3 users, 2 live sessions** hain
- `data/storage/...` me Aadhaar / purchase document photos hain
- `data/backups/*.tar.gz`, `data11/` (purana data), `.env`, ngrok logs, `ngrok-domain.txt` bhi hain
- `ngrok-run.log` batata hai ki app **kai din ngrok se internet pe khuli thi**

**Kya karo:**
1. Ye zip kisi ko mat bhejo, kisi AI/GitHub pe mat daalo.
2. Agar kabhi share hua ho, to sab admin passwords badlo.
3. Code ko data se alag rakho. `.gitignore` me `data/`, `data11/`, `.env`, `*.log`, `*.tar.gz`, `dist/`, `node_modules/` daalo.
4. Ek naya clean zip banao (bina data ke) jab agents ko do.

### P0: Electron folder missing

`package.json` ka `main` = `electron/main.cjs`, par `electron/` folder zip me hai hi nahi. Isliye **EXE bana hi nahi sakte** jab tak ye nahi banta (Part 4).

---

## PART 2: Security findings

### Critical (internet pe khulne se pehle fix zaroori)

| # | Issue | Kahan | Tag |
|---|---|---|---|
| S1 | `/pg/storage/object/:bucket/*` pe **login nahi lagta**. Aadhaar, purchase document, payment proof photos bina login ke khul sakte hain (path me sirf timestamp hai) | `compat.js` last route | CODE |
| S2 | `GET /api/config` **public** hai aur poora settings deta hai: bank name, **account number, IFSC**, account holder, Udyam, email | `routes/index.js` `/config` | CODE (field fresh DB me khali thi, bharne par leak hogi) |
| S3 | `/pg/:table/delete` me column whitelist nahi lagta (`buildWhere(filters)` bina table ke). Column name me quote daal ke SQL inject ho sakta hai. Empty filter = poori table delete. Ye hard delete hai (soft-delete aur audit bypass). Allowed tables me `audit_logs` aur `files` bhi hain, yaani log tamper ho sakta hai | `compat.js` delete route | CODE (3 se pehle table() bug ki wajah se test nahi ho paya) |
| S4 | `/api/setup`, `/api/setup/upload`, `/api/setup/restore` **public**. Fresh install pe jo pehle pahunche wo owner ban jaata hai. ngrok ke saath ye real risk hai | `routes/index.js` | CODE |
| S5 | Bootstrap admin ab bhi bante hain: startup pe `admin@phonezone.local` + random password ban jaata hai (maine dekha, console me print hua), phir wizard doosra admin banata hai. Electron me console dikhta nahi, to ye password kisi ko pata nahi aur account hamesha ke liye admin rahta hai | `authService.ensureBootstrapAdmin` | TESTED |
| S6 | Supabase online mode: storage bucket `phonezone-uploads` **public** hai, aur **public upload/update/delete** policy hai. Anon key `dist` bundle me hai, matlab koi bhi Aadhaar photos padh/delete kar sakta hai | `supabase/migrations/20250716...sql` | CODE |

### High

| # | Issue | Tag |
|---|---|---|
| S7 | Upload me MIME client ka trust hota hai (magic bytes check nahi), `text/html` allowed hai, aur `/public/files/:id` usko inline serve karta hai. Public `/setup/upload` se bhi ho sakta hai. Stored XSS | CODE |
| S8 | Login rate limit nahi (P0-4). Cookie me `Secure` flag nahi, session token DB me plaintext | TESTED / CODE |
| S9 | Restore: `/backups/restore-upload` 10 MB wala multer use karta hai (badi backup fail hogi). Restore fail hone par `parked` folders wapas nahi aate (rollback adhoora). Uploaded tar ke symlink/contents validate nahi hote | CODE |
| S10 | Aadhaar number DB me plaintext, backups unencrypted, Hicelltek API keys DB me plaintext (aur backup me jaati hain) | CODE |
| S11 | Koi security headers nahi (helmet / CSP / nosniff). Public `/public/messages` pe spam limit nahi | CODE |
| S12 | Role system hai (admin/staff/viewer) par shops ke hisaab se user scope nahi hai. 2 dukaan me staff doosri dukaan ka data dekh sakta hai | CODE |

### Functionality / logic bugs

| # | Issue | Tag |
|---|---|---|
| F1 | Phone add UI `supabase.from('phones').insert` (compat) se jaata hai, backend ke `createPurchase` se nahi. Isliye: IMEI mandatory sirf form me hai, server pe nahi. Duplicate-IMEI check nahi. Purchase invoice atomic nahi banta. Seller bann jaata hai par phone fail ho to orphan seller bachta hai | CODE |
| F2 | `validImei` sirf 14-16 digit check karta hai, **Luhn checksum nahi** | CODE |
| F3 | Sale: `purchase_returned` phone bhi bik sakta hai. `processReturn` me state check nahi (double return possible). `processed_by` hamesha "Admin" | CODE |
| F4 | Invoice number calendar-year se bante hain, financial year (Apr-Mar) se nahi, jabki baaki app FY-based hai | CODE |
| F5 | JSON restore me photo URLs remap nahi hote. DatabaseTab "delete all" ab archive hai (theek) | CODE |
| F6 | Logo/signature data-URL se jaate hain (shop dialog), offline me toot sakte hain | CODE |
| F7 | `RepairServices.tsx` me WhatsApp number hardcoded (`919125790119`). Footer me "2024" hardcoded | CODE |
| F8 | Repairs ka backend basic hai (`repairService.js`), par **admin UI hai hi nahi**. Sirf homepage ka `RepairServices.tsx` hai | CODE |

Achhi baatein (rakhna): server `127.0.0.1` pe bind hota hai, scrypt password hashing, WAL + `synchronous=FULL`, soft-delete + audit trail, path traversal guard, parameterized SQL (compat ke delete ko chhod ke), TAC engine local-first with ask/auto/off.

---

## PART 3: EXE + background services + 2 dukaan architecture

### 3.1 Aaj kya hai
`PHONEZONE-CONTROL.bat` menu se start/stop/backup/ngrok karta hai. Isme cmd window khulti hai. Aapko chahiye: **double-click EXE -> window me app -> cross (X) dabane pe tray me -> Quit pe sab band, koi black window nahi**.

### 3.2 Target architecture

```
Dukaan 1 PC (SERVER)                                Dukaan 2 PC (CLIENT)
+----------------------------------------+          +---------------------------+
| PhoneZone.exe (Electron)               |          | PhoneZone.exe (Client mode)|
|  - tray icon + app window              |          |  - sirf window, apna       |
|  - Express+SQLite (same process)       | tailnet  |    server/DB nahi          |
|  - Tailscale (Windows service, auto)   |<-------->|  - Tailscale installed     |
|  - hidden: tailscale serve/funnel      | encrypted|  - URL: https://pc1.xxx.   |
|  - hidden: auto backup scheduler       |          |    ts.net                  |
+----------------------------------------+          +---------------------------+
          |
          +--> Public catalog only (Funnel) -> customers browse phones
```

### 3.3 Sabse important decision: sync mat banao, ek server rakho

Aap "sync" bol rahe ho, par 2 dukaan ke liye **sabse safe aur simple**:
- **Ek hi PC server** (ek hi SQLite DB). Dukaan 2 usi server se Tailscale ke through juda rehta hai.
- Isme **sync conflict hota hi nahi** (ek hi database hai), aur ek hi IMEI do baar nahi bik sakta.
- Do alag DB + sync banana bahut risky hai (conflict, duplicate invoice numbers, IMEI double-sale). Isse tab karna jab internet roz kharab rehta ho.

Kamzori aur uska ilaj:
- Server PC band ya net down -> dukaan 2 ruk jaayegi. **Ilaj:** auto backup har raat + server PC ki UPS/auto-start with Windows + ek backup PC pe copy (Part 7, prompt 4).
- SQLite ek time pe ek write karta hai. 2 dukaan ke liye bilkul theek hai.

### 3.4 Tailscale vs ngrok

| | Tailscale `serve` (tailnet-only) | Tailscale `funnel` (public) | ngrok |
|---|---|---|---|
| Kaun khol sakta hai | sirf aapke login wale devices | poora internet | poora internet |
| Admin panel ke liye | **Haan, yehi use karo** | Nahi | Nahi |
| Public homepage ke liye | - | Haan (sirf catalog) | Possible, par free me domain/limits |
| Cost | Free personal | Free | Free tier limited |
| HTTPS | Automatic | Automatic | Automatic |

**Rule:** Admin/ERP kabhi funnel/ngrok pe mat rakho. Sirf **tailnet** me rakho. Agar public website chahiye (customers phones dekhein), to ek **alag chhota public server** (alag port) chalao jo sirf `/api/public/inventory`, `/api/public/files`, `/api/public/messages` aur homepage serve kare. Funnel sirf us port pe lagao. Admin port tailnet-only rahe.

### 3.5 Background me koi cmd window na khule, kaise
- Electron ka main process hi Express server ko **same process me** chalaye (`import createServer`), alag node.exe nahi.
- Jo bhi external exe chalani ho (`tailscale.exe serve ...`), uska `child_process.spawn/execFile` me **`windowsHide: true`** lagao. Isse black window nahi aati.
- Tailscale Windows ka **service** hai, wo khud background me chalti hai, uski window ki zarurat nahi.
- ngrok agar rakhna ho to npm package `@ngrok/ngrok` use karo (andar hi chalta hai, exe nahi, window nahi). Par recommend: Tailscale.
- Tray menu: Open PhoneZone / Status (Server running, Tailscale connected, Last backup) / Backup now / Start with Windows (toggle) / **Quit**.
- **X dabane pe** window sirf hide ho (tray me rahe). **Quit pe** graceful shutdown: server band, DB WAL checkpoint, close, tailscale serve band, phir exit.
- Single-instance lock: do baar double-click karo to doosri window nahi, wahi khule.
- Windows ke saath auto-start (login item).
- Port busy ho to agle free port pe chale aur window usi se khule.

### 3.6 Client mode (Dukaan 2)
Setup me ek choice: **"Ye main server hai"** ya **"Ye client hai"**. Client me server URL dalna hota hai (`https://pc1.tailnet-name.ts.net`). Client EXE apna backend start nahi karti, sirf us URL ko window me kholti hai. Login wahi (server wale users).

### 3.7 Multi-shop (data me)
Pehle se `shops` table aur `shop_id` hai. Chahiye: `users.shop_id` (ya `user_shops`), har list/insert shop se filter ho, admin ko "All shops" dikhe, staff ko sirf apni dukaan. Invoice prefix per shop (jaise `PZ1-`, `PZ2-`).

---

## PART 4: Repair module (private, homepage pe nahi dikhega)

### 4.1 Design rules (aapki requirements ke hisaab se)
1. **Alag section "Repairs"** admin me. Public API/homepage me iska koi data nahi jaata.
2. **Repair customers alag table** (`repair_customers`), sale/purchase customers se alag.
3. **IMEI mandatory** + Luhn validation. IMEI daalte hi TAC se phone ka naam/model auto-fill. Agar TAC local DB me nahi mila to **API se poochega: "Online fetch karun?"** (existing ask/auto/off setting reuse).
4. Customer detail: **Aadhaar scan** (existing AadhaarScanButton) ya manual typing.
5. **Job Sheet + Invoice** print: customer, phone, IMEI, problem, accessories received, estimate, advance, parts, labour, final price, warranty, terms, QR job number.
6. **Repair history kabhi delete nahi hoti** (soft-delete only). Form ka data delete kiye bina history dekh sako.

### 4.2 Cross-linking (aapka main idea)
**A) Phone number match (Inventory me phone add karte waqt):** seller/customer ka number dalte hi agar wo `repair_customers` me mila -> popup: *"Ye number repair customer hai. Kaun si details fetch karun?"* (naam, address, ID, photo, checkboxes). Fetch karne par repair record **delete nahi hota**, sirf copy hota hai.
Saath me button **"Is customer ki repair history dekho"**.

**B) IMEI match (phone purchase karte waqt):** IMEI daalte hi `repair_jobs` me check. Mila to **bada warning**: *"Ye phone hamare yahan [date] ko repair hua tha"* + **kya repair hua** (e.g. motherboard replace, display) + kis customer ka tha + final price. Button "Full repair details dekho". Isse:
- scam se bachoge (kisi ne board badalwa ke bech diya),
- rate bargain me madad milegi.
Repair kiya hua part type "Motherboard / Board change" ho to red flag `board_replaced = 1`.

### 4.3 Tables (migration `008_repairs.sql`, SQLite-valid, `IF NOT EXISTS` sirf CREATE TABLE/INDEX pe)
- `repair_customers(id, shop_id, name, phone UNIQUE, address, id_proof_type, id_number, aadhaar_photo_file_id, photo_file_id, whatsapp_opt_in, deleted_at, created_at, updated_at)`
- `repair_jobs(id, job_no UNIQUE, shop_id, repair_customer_id, device_brand, device_model, imei, imei2, tac, problem, accessories_received, device_passcode_note, estimate, advance_paid, parts_cost, labour_cost, final_price, status [received, diagnosing, waiting_parts, in_progress, ready, delivered, cancelled], payment_status, board_replaced, warranty_days, technician, received_at, ready_at, delivered_at, notes, financial_year, deleted_at, ...)`
- `repair_job_items(id, job_id, kind [part|labour], description, qty, unit_price)`
- `repair_status_log(id, job_id, status, note, user_id, at)` (poori timeline)
- `repair_photos` via existing `files` table (owner_type `repair`)
- Index: `repair_jobs(imei)`, `repair_customers(phone)`.

### 4.4 API (sab `staff` auth ke peeche, shop-scoped)
`GET/POST /api/repair/customers`, `GET /api/repair/customers/by-phone/:phone`, `GET/POST/PUT /api/repair/jobs`, `POST /api/repair/jobs/:id/status`, `GET /api/repair/by-imei/:imei` (cross-check), `GET /api/repair/jobs/:id/print`.
Cross-check endpoints sirf logged-in staff ko dikhein.

---

## PART 5: WhatsApp marketing Chrome extension

**Seedhi baat (zaroori):** WhatsApp Web ko script se auto-message bhejna WhatsApp ke Terms ke khilaf hai. Number **ban** ho sakta hai, especially naye/unknown contacts ko bulk bhejne par. Do raaste hain:

| | Option A: Chrome extension (aapka plan) | Option B: WhatsApp Business Cloud API (official) |
|---|---|---|
| Ban risk | **Medium-High** | Nahi |
| Cost | Free | Per-conversation charge, Meta approval + template approval |
| Setup | Easy | Thoda mushkil, par stable |

Agar Option A hi karna hai to **safety rules built-in** rakho:
- Sirf unko bhejo jinhone **opt-in** diya ho (`whatsapp_opt_in` field), "STOP" likhne par opt-out.
- Daily cap (jaise 30-40 msgs/din), random delay 20-60 sec, break after har 10 msgs, raat me nahi.
- **Alag business number** use karo, apna main number nahi.
- Pehle apne contacts / purane customers jinse baat hui hai.
- Har message ka log (`wa_message_log`) aur dry-run mode.

### Architecture
- Extension (Manifest V3) sirf `https://web.whatsapp.com/*` pe content script chalaye.
- PhoneZone server pe `wa_campaigns`, `wa_queue`, `wa_templates`, `wa_message_log` tables.
- Extension PhoneZone se **alag extension-API-token** (admin-generated, revocable) se queue leti hai (server URL tailnet ya localhost).
- Templates variables: `{name}`, `{device}`, `{job_no}`, `{status}`, `{price}`, `{shop}`.
- **Repair customers ko:** "Ready for delivery / status update / warranty reminder". **Buyers ko:** "New stock / discount offer".
- Extension queue se ek ek karke number open karke message type + send karti hai, aur result server ko report karti hai (sent / failed / not-on-whatsapp).

---

## PART 6: Ye sab kaise karna hai (aapke liye)

Aapki setting ke hisaab se: main code nahi likh raha. Neeche **ready-to-paste prompts** hain jo Freebuff / Cline / Kilo me daalne hain. Har prompt me exact files, steps aur "kab done maano" likha hai.

**Order zaroori hai. Prompt 0 pehle, bina skip kiye.**

**Har prompt ke saath ye line pehle paste karna (bahut zaroori):**
> RULES: Do not say "fixed" or "done" unless you actually ran the commands listed under VERIFY and pasted their real output. If you cannot run a command, say so explicitly and stop. Edit only the files named. Never touch the `data/` or `data11/` folders. Never print or commit secrets. After each file edit, re-open the file and confirm the change is there.

---

## PART 7: Agent prompts

### PROMPT 0: App ko chalu karo (P0 fixes)

```
GOAL: Make the PhoneZone backend start and the offline admin UI work again.

FILES: backend/src/routes/index.js, backend/src/routes/compat.js, database/migrations/008_admin_settings_flags.sql, backend/src/services/authService.js, backend/src/server.js

STEPS
1. routes/index.js is plain JavaScript (ESM). Remove TypeScript annotations: change `checkLoginRateLimit(email: string)`, `recordFailedLogin(email: string)`, `resetLoginAttempts(email: string)` to plain `(email)`. Search the whole file for any other `: string`, `: number`, `as ` type syntax and remove it.
2. Wire the login rate limiter. In the `POST /auth/login` route: call checkLoginRateLimit(email) first; if not allowed respond 429 with message "Too many attempts. Try again in N minutes."; on login failure call recordFailedLogin; on success call resetLoginAttempts. Key by email AND req.ip. Make sure a failed login does not count twice (checkLoginRateLimit currently increments; fix so only failures increment).
3. compat.js calls `table(req.params.table)` in 4 places but `table` is not defined. Add this helper near the top:
   function table(name) { if (!ALLOWED.has(name)) throw badRequest("Unknown table."); return name; }
   and import { badRequest } from "../lib/errors.js".
4. compat.js `POST /:table/delete`: currently `buildWhere(req.body?.filters || [])` has no table whitelist. Change to `buildWhere(filters, t)`. Reject (400) if filters is empty. Remove "audit_logs" and "files" from the ALLOWED set for the delete route (keep for select if needed). Also make delete on phones, sellers, customers, returns, invoices, repairs do a SOFT delete (UPDATE ... SET deleted_at = datetime('now')) when the table has a deleted_at column, otherwise reject.
5. Delete the file database/migrations/008_admin_settings_flags.sql entirely. Reason: SQLite does not support `ADD COLUMN IF NOT EXISTS`, and migration 003 already adds both google_business_verified and show_google_business. Also delete the same-named duplicate additions from database/schema.sql if they appear twice.
6. authService.ensureBootstrapAdmin: stop auto-creating an admin at startup. Return {created:false} always unless env PHONEZONE_ADMIN_PASSWORD is explicitly set. The setup wizard (POST /api/setup) must be the only way the first admin is created.
7. Run `node --check` on every .js file under backend/src.

VERIFY (paste real output)
- cd backend && npm install && node --check on all files -> no errors
- set PHONEZONE_DATA_DIR to an empty temp folder, run `node src/server.js` -> prints "listening on http://127.0.0.1:47713" and does NOT print a temporary admin password
- run `node test/offline-suite.mjs` -> all tests pass (report the count)
- curl: 12 wrong logins -> after the limit the response is 429
- curl POST /api/pg/phones/delete with filters [] -> 400
- curl POST /api/pg/phones/delete with col `x" OR 1=1 --` -> rejected / no rows deleted
```

### PROMPT 1: Security hardening

```
GOAL: Close the confirmed security holes before any internet exposure.

FILES: backend/src/routes/index.js, backend/src/routes/compat.js, backend/src/services/storageService.js, backend/src/services/settingsService.js, backend/src/services/backupService.js, backend/src/server.js, backend/package.json, supabase/migrations/ (new file), .gitignore (create)

STEPS
1. PUBLIC CONFIG LEAK: GET /api/config must return only public fields: businessName, tagline, address, primaryPhone, secondaryPhone, email, instagram, whatsappNumber, googleBusiness fields, logoUrl, signatureUrl, businessHours, showUdyam/udyamNumber (only if verified), repairServices, currency. REMOVE bankName, accountHolderName, accountNumber, ifscCode, tacFetchMode, messageTemplates from the public response. Keep the full object only on the authenticated GET /api/settings.
2. UNAUTHENTICATED FILES: in compat.js the route GET /storage/object/:bucket/* has no auth. Add the `staff` middleware to it. Public product photos and logo/signature must keep working through /api/public/files/:id only. Update the frontend getPublicUrl in src/lib/data/offlineSupabase.ts so private buckets (purchase-documents, payment-proofs, aadhaar) are fetched with credentials and product photos use the public route.
3. UPLOAD SAFETY in storageService.saveFile: (a) remove "text/html" from ALLOWED; (b) check magic bytes (JPEG FF D8 FF, PNG 89 50 4E 47, WEBP RIFF....WEBP, PDF %PDF) and ignore the client-sent mimetype; (c) for /public/files and /files responses set `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` only for images/pdf, and `Content-Security-Policy: default-src 'none'`.
4. SETUP LOCK: /api/setup, /api/setup/upload, /api/setup/restore must work only when (a) setup is not completed AND (b) request comes from loopback (req.ip is 127.0.0.1/::1) AND not through a proxy header (X-Forwarded-For absent). Otherwise 403.
5. HEADERS: add `helmet` (npm i helmet in backend). Add cookie option `secure: true` automatically when req.secure or X-Forwarded-Proto is https. Add sameSite 'lax' (already). Add a 20-requests/min limiter on POST /api/public/messages and cap field lengths (name 100, email 150, phone 20, message 2000).
6. SESSIONS: store sha256(token) in sessions.id instead of the raw token (migration needed: invalidate existing sessions). Cookie and Bearer still carry the raw token; lookup hashes it.
7. BACKUP/RESTORE: use `restoreUpload` (500 MB) instead of `upload` on /backups/restore-upload. In restoreBackup, on failure after the swap started, move the `parked` database/storage folders back before reinit. Before extracting, list the archive (`tar -tf`) and reject entries that start with `/`, contain `..`, or are not under `database/`, `storage/`, or `manifest.json`; reject symlinks.
8. SUPABASE (online mode): create supabase/migrations/20261016_private_storage.sql that sets bucket phonezone-uploads public=false, drops the 4 "Allow public ..." policies, and adds policies allowing only `authenticated` to insert/select/update/delete. Add a comment at the top: "Run this in the Supabase SQL editor. Existing public URLs of private documents will stop working; use signed URLs." Do NOT run it yourself.
9. REPO HYGIENE: create .gitignore with data/, data11/, .env, *.log, *.tar.gz, *.db, *.db-wal, *.db-shm, dist/, node_modules/, ngrok-*, tmp-*.mjs, .tmp-*.mjs, err.txt, out.txt. Move the tmp-*.mjs, back-*.png, tmp-*.png debug files into a `scratch/` folder.

VERIFY
- node --check all files; npm run build in project root passes
- curl (no login) GET /api/config -> no bank fields
- curl (no login) GET /api/pg/storage/object/phonezone-uploads/purchase-documents/x.jpg -> 401
- upload a .html renamed to .jpg -> rejected
- POST /api/setup from a non-loopback address (use X-Forwarded-For header) -> 403
- offline-suite passes
```

### PROMPT 2: Phone purchase ko server-validated banao

```
GOAL: Make the Add Phone flow use the validated backend purchase workflow instead of raw table inserts.

FILES: src/components/admin/AddPhoneDialog.tsx, backend/src/lib/validation.js, backend/src/services/inventoryService.js, src/lib/data/offlineSupabase.ts (read only)

STEPS
1. validation.js validImei: keep 14-16 digit check and add a Luhn checksum check for 15-digit IMEIs. Update the message.
2. In inventoryService.createPurchase: IMEI is mandatory (already), duplicate-IMEI check must also consider phones where is_sold=0 AND return_status is null. Create the seller inside the same transaction when seller data is supplied (accept `seller` object OR `seller_id`). If the phone insert fails, no seller is left behind.
3. inventoryService.sellPhone: reject if phone.return_status === 'purchase_returned'; verify the customer exists and is not archived. processReturn: reject sales_return if the phone is not currently sold, and reject a second return of the same type.
4. returns.processed_by must be the logged-in user's display name/email, not the hardcoded "Admin".
5. AddPhoneDialog.tsx handleSubmit: in offline mode call POST /api/purchases (backend createPurchase) with the form data instead of supabase.from('sellers').insert + supabase.from('phones').insert. Keep the Supabase path unchanged for online mode. Keep the TAC /api/tac/learn call.
6. Invoice numbering: nextInvoiceNumber should reset per financial year (use activeFyLabel()) instead of calendar year, e.g. PZ-2026-27-0001.

VERIFY
- add a phone with a bad IMEI (Luhn fail) -> rejected with a clear message
- add the same IMEI twice while unsold -> second rejected
- kill the DB write midway (simulate by passing an invalid payment_method) -> no orphan seller row
- offline-suite passes (add new tests for these)
```

### PROMPT 3: Repairs backend (migration + services + routes)

```
GOAL: Build the private Repairs module backend. It must NEVER appear in any /api/public route or on the homepage.

FILES (create): database/migrations/008_repairs.sql, backend/src/services/repairCustomerService.js, backend/src/services/repairJobService.js, backend/src/routes/repairs.js
FILES (edit): backend/src/routes/index.js (mount router under /api/repair with `staff` middleware), backend/src/services/repairService.js (leave file, but stop using it; add a deprecation comment), backend/src/services/reportService.js (add repairs to dashboard counts only for authenticated routes)

MIGRATION RULES: SQLite syntax only. Use CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS. NEVER use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` (SQLite does not support it).

TABLES
- repair_customers(id TEXT PK, shop_id TEXT, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE, address TEXT, id_proof_type TEXT CHECK in ('aadhaar','pan','driving_license','voter_id') NULL, id_number TEXT, photo_file_id TEXT, aadhaar_photo_file_id TEXT, whatsapp_opt_in INTEGER DEFAULT 0, deleted_at TEXT, created_at, updated_at)
- repair_jobs(id TEXT PK, job_no TEXT UNIQUE NOT NULL, shop_id TEXT, repair_customer_id TEXT NOT NULL REFERENCES repair_customers(id), device_brand TEXT, device_model TEXT, imei TEXT NOT NULL, imei2 TEXT, tac TEXT, problem TEXT NOT NULL, accessories_received TEXT, passcode_note TEXT, estimate REAL, advance_paid REAL DEFAULT 0, parts_cost REAL DEFAULT 0, labour_cost REAL DEFAULT 0, final_price REAL, status TEXT NOT NULL DEFAULT 'received' CHECK in ('received','diagnosing','waiting_parts','in_progress','ready','delivered','cancelled'), payment_status TEXT DEFAULT 'unpaid' CHECK in ('unpaid','partial','paid'), board_replaced INTEGER DEFAULT 0, warranty_days INTEGER DEFAULT 30, technician TEXT, received_at TEXT DEFAULT (datetime('now')), ready_at TEXT, delivered_at TEXT, notes TEXT, financial_year TEXT, deleted_at TEXT, created_at, updated_at)
- repair_job_items(id, job_id REFERENCES repair_jobs(id), kind CHECK in ('part','labour'), description, qty REAL, unit_price REAL, is_board INTEGER DEFAULT 0)
- repair_status_log(id, job_id, status, note, user_id, at)
- Indexes: repair_jobs(imei), repair_jobs(status), repair_jobs(repair_customer_id), repair_customers(phone)
- updated_at triggers like the existing ones.
- Job photos use the existing `files` table with owner_type='repair', owner_id=job id (storage LAYOUT already supports it). Aadhaar/photo of repair customer: owner_type 'repair_customer' — add it to the LAYOUT map in storageService.js as a PRIVATE tree (never public).

RULES
- IMEI is mandatory and must pass validImei (Luhn). Auto-derive tac = first 8 digits.
- job_no format: `RJ-<shopcode>-<FY>-<0000>` via a counter table (reuse the pattern in invoiceService.nextInvoiceNumber, inside a transaction).
- NEVER hard-delete jobs or customers. DELETE routes do soft delete + audit. No purge route.
- Every query filters by deleted_at IS NULL and by the user's shop (admin may pass ?shop=all).
- Status change writes repair_status_log and sets ready_at/delivered_at automatically. board_replaced is set to 1 automatically if any job item has is_board=1.
- final_price = sum(items) unless explicitly set.

ROUTES (all under /api/repair, all behind `staff`)
GET /customers?search=, POST /customers, PUT /customers/:id, GET /customers/by-phone/:phone, GET /customers/:id/history
GET /jobs?status=&search=&shop=, POST /jobs (accepts new customer inline OR repair_customer_id), GET /jobs/:id, PUT /jobs/:id, POST /jobs/:id/status, POST /jobs/:id/items, DELETE /jobs/:id (soft)
GET /by-imei/:imei -> returns [{job_no, received_at, delivered_at, device, problem, items[], board_replaced, final_price, customer:{name, phone}}] newest first (used by purchase cross-check)

VERIFY
- migration applies on a brand-new empty data dir AND on a copy of an existing DB
- node --check, offline-suite passes, add tests: create customer, create job with bad IMEI (rejected), create job, change status (log row created), add board item (board_replaced=1), by-imei returns the job, soft delete hides it from lists but by-imei still returns history
- confirm with curl that NOTHING under /api/public returns repair data
```

### PROMPT 4: Repairs UI (admin tab + job sheet + invoice)

```
GOAL: Add an admin "Repairs" tab with job creation, job sheet and invoice printing.

FILES (create): src/components/admin/RepairsTab.tsx, src/components/admin/AddRepairDialog.tsx, src/components/admin/RepairDetailDialog.tsx, src/components/admin/RepairCustomerPicker.tsx, src/lib/repairTemplates.ts
FILES (edit): src/components/admin/AdminDashboard.tsx (add the tab), src/lib/data/offlineSupabase.ts only if needed (use plain fetch to /api/repair/* with credentials: "include" instead)

REQUIREMENTS
1. RepairsTab: filter chips by status, search by customer/phone/IMEI/job no, table with job_no, customer, device, IMEI, status, estimate/final, date. "New Repair" button.
2. AddRepairDialog sections: (A) Customer: search existing repair customer by phone, or add new with name, phone, address, ID type/number; include the existing AadhaarScanButton + useAadhaarOcr to fill the form, and photo upload. (B) Phone: IMEI field is REQUIRED (red asterisk, cannot submit empty); reuse ImeiScanButton and the useTacLookup hook so TAC auto-fills brand/model. If the TAC is not in the local DB, use the existing tacFetchMode behavior (ask -> show "Fetch from online API?" button; auto; off). (C) Problem: dropdown from settings.repairServices + free text; accessories received checkboxes (SIM, tray, cover, charger, memory card); passcode note. (D) Money: estimate, advance paid, expected completion, warranty days, technician. (E) Photos: before-repair photos.
3. On IMEI entry, call GET /api/repair/by-imei/:imei. If previous jobs exist, show an amber banner "This phone was repaired here before" with a "View history" button.
4. RepairDetailDialog: status timeline (from repair_status_log), buttons to move status, add parts/labour items (with "Board/Motherboard" checkbox), record payment, upload after-photos, Print Job Sheet, Print Invoice, "Send WhatsApp update" (opens wa.me link with the template from settings).
5. repairTemplates.ts: two HTML templates built like src/lib/invoiceTemplates.ts (reuse its `esc()` helper to escape ALL user text): (a) JOB SHEET (customer copy + shop copy on one A4: job no + QR, customer, device, IMEI, problem, accessories, estimate, advance, expected date, terms, signature lines) and (b) REPAIR INVOICE (items table with parts/labour, total, advance, balance, warranty, shop bank/UPI from authenticated settings). Use shop details from /api/settings, no hardcoded names or numbers.
6. Nothing from Repairs may be rendered on the public homepage. Do not touch src/components/RepairServices.tsx except: remove the hardcoded WhatsApp number 919125790119 and read it from settings.whatsappNumber.
7. Mobile friendly (shop staff use phones).

VERIFY
- npm run build passes; npx tsc --noEmit passes
- manual test list (write it in the final answer): create customer by manual typing; create customer via Aadhaar scan; create job without IMEI -> blocked; job with a Luhn-invalid IMEI -> blocked; TAC found -> auto-fill; TAC not found with mode "ask" -> prompt appears; print job sheet and invoice (HTML opens, no raw `<script>` from user text is executed: test with a customer name `<img src=x onerror=alert(1)>`)
```

### PROMPT 5: Cross-check (phone number + IMEI) in Inventory

```
GOAL: When adding a phone purchase/sale, detect repair history by phone number and by IMEI, and let the user choose what to fetch. Never delete repair data.

FILES: src/components/admin/AddPhoneDialog.tsx, src/components/admin/ProcessSaleDialog.tsx, src/components/admin/SellerSelectDialog.tsx, src/components/admin/PartyPicker.tsx, create src/components/admin/RepairMatchDialog.tsx and src/components/admin/RepairHistoryPanel.tsx

STEPS
1. PHONE NUMBER MATCH: in the seller/customer phone field (AddPhoneDialog seller section, ProcessSaleDialog customer section), after a valid 10-digit number is entered call GET /api/repair/customers/by-phone/:phone. If found, open RepairMatchDialog: "This number is a Repair customer: <name>". Show checkboxes: Name, Address, ID type & number, Photo, Aadhaar photo (all ticked by default). Buttons: "Fetch selected details" (copies values into the current form only; do not modify or delete the repair customer), "Skip", "View repair history". Ask only once per phone number per form session.
2. IMEI MATCH: in AddPhoneDialog, when the IMEI is valid, call GET /api/repair/by-imei/:imei (debounced 500 ms, only in offline mode). If results exist show a RED alert box above the IMEI field: "This phone was repaired at our shop on <date> (Job <job_no>)". If any job has board_replaced=1 add: "MOTHERBOARD/BOARD WAS REPLACED - check carefully". Button "View what was repaired" opens RepairHistoryPanel (device, problem, parts/labour items, final price, customer name and phone, status timeline). This panel is read-only.
3. Do not block saving; the staff decides. But if board_replaced=1, require ticking a checkbox "I have seen the repair history" before the purchase can be submitted, and write that acknowledgment in the audit log via POST /api/audit (create a small authenticated endpoint audit.note(userId, action, entity, entityId, details)).
4. The existing getImeiHistory (financial years) check must keep working; show both warnings if both exist.
5. Add the same IMEI check in ProcessSaleDialog (selling a phone previously repaired -> info chip).

VERIFY
- create a repair customer with phone 9XXXXXXXXX and a job with IMEI A; then in Add Phone enter that phone as a seller -> dialog appears; fetch only name+address -> only those are filled; repair record unchanged afterwards
- enter IMEI A in Add Phone -> red banner + history panel works
- job with a board item -> checkbox gate enforced
- build + tsc pass
```

### PROMPT 6: Electron EXE (window + tray + hidden background)

```
GOAL: Create the missing `electron/` folder so the app runs as a Windows EXE with a normal window, a tray icon, graceful Quit, and NO console windows.

FILES (create): electron/main.cjs, electron/preload.cjs, electron/tray.cjs, electron/serviceManager.cjs, electron/config.cjs, build/ (copy icon.ico), 
FILES (edit): package.json (build section: files include electron/**, backend/**, database/**, config/**, dist/**, and node_modules; asarUnpack for better-sqlite3 native module; win target nsis; appId com.phonezone.app; productName PhoneZone; icon icon.ico), backend/src/server.js (export a startServer({host,port}) that returns {server, close}; keep the CLI behavior), backend/ensure-native.cjs (keep)

REQUIREMENTS
1. Single instance: app.requestSingleInstanceLock(); a second launch just focuses the existing window.
2. Data dir: set process.env.PHONEZONE_DATA_DIR to app.getPath('userData')/PhoneZone-data on a fresh install; if a legacy data folder exists next to the exe (./data) offer to use it via a dialog. Never inside Program Files.
3. Run the Express server IN the Electron main process (import the ESM backend with dynamic import()), host 127.0.0.1, port 47713 (if busy, choose a free port and tell the renderer). No extra node.exe, no cmd window.
4. BrowserWindow: loads http://127.0.0.1:<port>; contextIsolation true, nodeIntegration false, sandbox true; block navigation to any external origin (shell.openExternal for wa.me, tel:, mailto: only). Set window.__PHONEZONE_OFFLINE__ = true via preload.
5. Closing the window (X) hides it to the tray; it does NOT quit. Tray menu: Open PhoneZone, status lines (Server: Running, Tailscale: Connected/Not installed, Last backup: <time>), Backup now, Start with Windows (checkbox using app.setLoginItemSettings), Quit.
6. Quit = graceful: stop accepting requests, wait for in-flight requests (max 5 s), run `PRAGMA wal_checkpoint(TRUNCATE)`, close DB, stop child services (see serviceManager), then app.exit(0). Also handle before-quit, SIGINT, and Windows shutdown (session-end).
7. serviceManager.cjs: helper `runHidden(cmd, args)` using child_process.execFile/spawn with { windowsHide: true, shell: false } and a 15 s timeout; never opens a console. Provide functions the Tailscale module will use. Log to the same logs folder.
8. Auto-backup scheduler inside the app: daily at 11:30 PM local time, keep the last 14 backups, also on Quit if the last backup is older than 24 h. Show a tray notification on failure.
9. Mode setting in <dataDir>/config/app-mode.json: { "mode": "server" | "client", "serverUrl": "" }. In client mode do NOT start the backend or DB; just load serverUrl in the window (show an error page with Retry if unreachable). First-run chooser dialog: "This is the MAIN computer (server)" / "This is a SECOND computer (client)".
10. Remove the dependency on PHONEZONE-CONTROL.bat for normal use (keep it for troubleshooting).
11. Add npm scripts: "electron:dev", "dist:win" (electron-builder --win nsis). Add electron and electron-builder to devDependencies if missing. Rebuild better-sqlite3 for Electron's ABI (electron-rebuild or electron-builder's install-app-deps) as part of the build.

VERIFY
- npm run build (frontend) passes
- npx electron . opens the window; log in; add a record; click X -> app stays in tray; tray Open restores; tray Quit -> process fully gone (check Task Manager / `tasklist | findstr PhoneZone` shows nothing)
- no black console window appears at any time (state how you checked)
- npm run dist:win produces an installer in /release; install it on a clean Windows VM or at least run the unpacked build and confirm better-sqlite3 loads
- start the app twice -> only one instance
```

### PROMPT 7: Tailscale (private access + 2nd shop) and optional public catalog

```
GOAL: Let the second shop's computer use the main computer securely over Tailscale, with no console windows and no manual commands. Admin panel must be tailnet-only. Public catalog (optional) is a separate, minimal server.

FILES (create): electron/tailscale.cjs, backend/src/publicServer.js, src/components/admin/RemoteAccessCard.tsx
FILES (edit): electron/main.cjs, electron/tray.cjs, backend/src/server.js, src/components/admin/SettingsTab.tsx (add RemoteAccessCard), backend/src/routes/index.js (add GET /api/system/remote-status and POST /api/system/remote/*, admin only)

DESIGN
- Tailscale is installed separately by the user and runs as a Windows service. The app only talks to its CLI: find tailscale.exe (C:\Program Files\Tailscale\tailscale.exe; also check PATH) and call it ONLY through serviceManager.runHidden (windowsHide:true).
- The admin app listens on 127.0.0.1:47713 only. Remote access uses `tailscale serve --bg --https=443 http://127.0.0.1:47713` (tailnet-only HTTPS, no public internet). NEVER use `tailscale funnel` for this port.
- Public catalog: backend/src/publicServer.js starts a SECOND Express listener on 127.0.0.1:47714 that serves ONLY: the built homepage, GET /api/public/inventory, GET /api/public/files/:id, POST /api/public/messages (with its own rate limit), GET /api/public-config (public fields only). It mounts NO auth, NO /api/pg, NO /api/setup, NO /api/repair. Optional funnel: `tailscale funnel --bg --https=8443 http://127.0.0.1:47714` (only when the admin toggles "Publish website").

electron/tailscale.cjs functions: detect() -> {installed, loggedIn, dnsName, ip}; (via `tailscale status --json`), enableServe(), disableServe(), enableFunnelPublic(), disableFunnelPublic(), status(). Poll status every 30 s for the tray. Handle "not installed" and "not logged in" gracefully with a clear message and a button that opens https://tailscale.com/download.

RemoteAccessCard (Settings tab, admin only): shows Tailscale status, this computer's address (https://<dnsName>), a big "Enable remote access for second shop" toggle, "Publish website to the internet" toggle (with a warning: only the public catalog is exposed), and a beginner step list: 1) Install Tailscale on both computers 2) Sign in with the SAME account/Google login 3) Turn on the toggle here 4) On the second computer open PhoneZone, choose "second computer", paste the address.

SECURITY
- Cookie Secure flag when proxied via https (trust the proxy only for 127.0.0.1).
- Rate limit login by IP+email (already added in prompt 0).
- Show the active sessions in Settings with a "Log out all devices" button.
- Explain that Tailscale ACLs/device approval should be enabled; mention enabling "Device approval" in the Tailscale admin console.

VERIFY
- with Tailscale installed on the test machine: toggle on -> `tailscale serve status` shows the mapping; open the https address from a phone on mobile data with Tailscale app -> login page loads
- from a device NOT on the tailnet the address does not load
- toggling off removes the mapping
- publicServer: curl /api/pg/phones/select, /api/setup, /api/settings, /api/repair/jobs on port 47714 -> all 404
- no console window ever flashes (state how verified)
```

### PROMPT 8: Multi-shop scoping

```
GOAL: Make the app safe for two shops on one server: each staff user sees only their own shop; admin sees all.

FILES: database/migrations/009_user_shops.sql (new), backend/src/services/authService.js, backend/src/routes/index.js, backend/src/routes/compat.js, backend/src/services/inventoryService.js, backend/src/services/peopleService.js, backend/src/services/invoiceService.js, backend/src/services/repairJobService.js, src/hooks/useAuth.tsx, src/components/admin/AdminDashboard.tsx (shop switcher for admin)

STEPS
1. Migration: ALTER TABLE users ADD COLUMN shop_id TEXT; (plain syntax, no IF NOT EXISTS). Add `shop_code TEXT` to shops if missing (separate ALTER). Seed existing users to the first shop.
2. sessionUser/publicUser include shopId and roles. requireAuth sets req.user.shopId.
3. Add `req.scope = { shopId: user is admin ? (req.query.shop || null) : user.shopId }` middleware. Apply to phones, returns, invoices, repairs, repair_jobs in routes AND in compat.js select/insert/update/delete (enforce shop_id filter for non-admins; reject cross-shop ids with 403).
4. Sellers/customers stay shared (people carry across shops) but show a `created_shop` badge.
5. Invoice and job numbers include the shop code: <PREFIX>-<SHOPCODE>-<FY>-<NNNN>, counters per shop.
6. Settings: admin can create staff users (email, password, role staff|viewer, shop). Staff cannot open Database/Backup/Settings tabs (frontend hides, backend enforces with requireRole('admin')).
7. Audit log records shop_id.

VERIFY
- create staff user for shop 2; log in; list phones -> only shop 2 rows; try to open a shop 1 phone by id -> 403; admin with ?shop=all sees both
- duplicate invoice numbers across shops impossible (test by creating invoices in both shops concurrently)
- offline-suite extended and passing
```

### PROMPT 9: WhatsApp marketing extension + server side

```
GOAL: Build a Chrome (Manifest V3) extension that sends queued, templated WhatsApp messages from web.whatsapp.com, driven by PhoneZone, with safety limits. Opt-in customers only.

FILES (create): database/migrations/010_whatsapp.sql, backend/src/services/waService.js, backend/src/routes/wa.js, src/components/admin/MarketingTab.tsx, extension/manifest.json, extension/background.js, extension/content.js, extension/popup.html, extension/popup.js, extension/README.md
FILES (edit): backend/src/routes/index.js (mount /api/wa), src/components/admin/AdminDashboard.tsx (Marketing tab)

DB (SQLite syntax): wa_templates(id, name, category ['repair_update','repair_ready','warranty_reminder','new_stock','offer'], body, active), wa_campaigns(id, name, template_id, audience JSON, status ['draft','running','paused','done'], daily_cap, created_by, created_at), wa_queue(id, campaign_id, phone, name, variables JSON, status ['pending','sent','failed','skipped','opted_out'], error, scheduled_at, sent_at), wa_message_log(id, phone, template_id, body, status, at), wa_tokens(id, token_hash, label, created_at, revoked_at), customers/repair_customers get whatsapp_opt_in INTEGER DEFAULT 0 and wa_opted_out_at (separate ALTER statements).

SERVER
- Audience builders: (a) repair customers with status ready/delivered, warranty ending in N days; (b) buyers (customers) who bought in last N days or never repeated; (c) manual list. ONLY include rows where whatsapp_opt_in=1 and not opted out.
- Template variables: {name} {device} {job_no} {status} {price} {shop} {offer}. Render server-side. Escape/trim, max 1000 chars.
- Extension API (bearer token, hash stored; admin creates/revokes tokens in Marketing tab): GET /api/wa/next (returns next pending item respecting daily cap, active hours 10:00-20:00, minimum random gap 25-70 s, pause after every 10 messages for 5-10 min), POST /api/wa/result {id, status, error}. Stop automatically when a campaign hits its daily cap.
- Incoming "STOP" handling: provide POST /api/wa/optout {phone} (manual button in UI) which sets opt-out and marks queued items opted_out.
- Dry-run mode: campaign flag that renders messages without sending.

EXTENSION (MV3)
- host_permissions only https://web.whatsapp.com/* and the PhoneZone server URL entered in the popup (optional_host_permissions, requested at runtime).
- popup: server URL, token, Start/Pause, today's counter, last result.
- content.js: open chat by navigating to https://web.whatsapp.com/send?phone=<91XXXXXXXXXX>&text=<encoded>, wait for the composer, press the send button, detect "number not on WhatsApp" popup and report failed. No DOM scraping of other chats. No reading contact lists.
- All timing/limits come from the server response, not hardcoded in the extension.
- README.md for a total beginner: how to load the unpacked extension (chrome://extensions -> Developer mode -> Load unpacked), how to paste the token.

UI (MarketingTab): templates CRUD with live preview, audience picker with count, campaign start/pause, queue table, log table, opt-in management. Show a persistent warning banner: "Automated WhatsApp Web sending can get the number banned. Use a separate business number and only message customers who agreed. Official alternative: WhatsApp Business Cloud API."

VERIFY
- dry-run campaign produces rendered messages without sending
- non-opted-in customer never appears in the queue
- daily cap and gap are enforced by the server (show two rapid /next calls: second returns "wait N s")
- revoked token -> 401
- extension loads unpacked without manifest errors (state Chrome version tested)
```

---

## PART 8: Kaam ka sahi order

1. **Aaj:** data/ aur .env ko code se alag karo, naya clean copy banao. Prompt 0 chalao. Verify output dekho.
2. Prompt 1 (security) -> Prompt 2 (purchase flow).
3. Prompt 3 -> 4 -> 5 (Repairs, backend se UI tak, phir cross-check).
4. Prompt 6 (EXE). Isse test karo ek PC pe 2-3 din.
5. Prompt 8 (multi-shop) -> Prompt 7 (Tailscale). Pehle dono PC pe local test, phir internet.
6. Prompt 9 (WhatsApp) sabse last. Pehle repairs ka data jama ho.

Ek baar me ek hi prompt do. Har ke baad us ke VERIFY ka real output mujhe bhej do, main check kar dunga ki sach me hua ya nahi.

## PART 9: Tailscale setup, bilkul beginner steps (jab Prompt 7 ho jaye)

1. Dono computers pe browser kholo -> `tailscale.com/download` -> Windows -> Download -> install (Next, Next, Finish).
2. Tailscale khulega -> **Log in** -> **same Google account** dono computers pe.
3. Main computer pe PhoneZone kholo -> Settings -> Remote Access -> **Enable** toggle on karo.
4. Wahan jo address dikhe (jaise `https://shop-pc.tail1234.ts.net`) wo copy karo.
5. Dusri dukaan ke computer pe PhoneZone install karo -> pehli baar "Second computer" chuno -> address paste karo -> Connect.
6. Tailscale website me login karke **Device approval** on kar do, taki koi aur device na jud sake.

## Last me honest limitations
- Mera test sirf backend pe hua (Linux scratch copy). Frontend `tsc/build`, Electron, aur Tailscale ka asli Windows test mere paas nahi hai. Wo aapke PC pe verify hone chahiye.
- Jahan **[CODE]** likha hai wahan maine code padha hai par chala ke nahi dekha.
