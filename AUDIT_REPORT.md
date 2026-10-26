# PhoneZone — Security & Functionality Audit

Audited every reachable layer I could read in this checkout:

- **Backend:** `src/server.js`, `src/routes/index.js`, `src/routes/compat.js`, `src/routes/tac.js`, every service under `src/services/`, `src/db/index.js`, `src/config/{paths,business}.js`, `src/lib/{errors,validation,logger}.js`
- **Frontend data layer:** `src/lib/data/{config,index,types,offlineSupabase,supabaseDriver,localDriver,financialYear}`, `src/integrations/supabase/client.ts`, `src/hooks/{useAuth,useStorageUsage,useFinancialYear,useTacLookup}`, `src/App.tsx`, `src/main.tsx`, `src/pages/{Index,Setup,OAuthConsent,NotFound}`
- **Admin UI:** `AdminPanel.tsx`, `AdminDashboard.tsx`, and every tab/dialog I could load in this session (Inventory, Sold, Returns, Customers, Sellers, Messages, Accounting, Storage, Database, Settings, ShopManagement, Auth, PasswordChange, AddPhone, EditPhone, ProcessSale, AadhaarScanButton, ImeiScanButton, VariantColourFields, ReturnHistoryDialog, PhoneHistoryDialog, ImeiHistoryDialog, StorageUsageCard, StorageManagementCard, FinancialYearSwitcher, PhotoViewer, PartyPicker)
- **Schema/migrations/seed:** `database/schema.sql`, `database/seed.sql`, `database/migrations/002/005/006` plus the new `008` I added in this pass.

I could **not** run a live backend or frontend typecheck here because the shell environment cannot spawn the workspace's node/bash (`ENOENT: no such file or directory, uv_spawn ... bash.exe`), so runtime verification is not included in this round.

---

## Severity key

- **HIGH** = wrong data shown, data silently lost/corrupted, or auth/permissions wrong enough to mislead a noob user.
- **MEDIUM** = a real path is broken or a feature silently half-works.
- **LOW** = cosmetic or edge-case behavior that does not lose data.

---

## HIGH — fixed in this pass

### 1. `show_google_business` column only existed in code, not in the database

`getSettings()` reads `row?.show_google_business`, and `completeSetup()` now writes it, but neither `schema.sql` nor the existing migrations created that column. A database created from the shipped schema would have rejected first-run setup with a missing-column SQL error.

**Fix:**
- Rewrote the `admin_settings` DDL in `database/schema.sql` to include the full current column set, including `google_business_verified`, `show_google_business`, the invoice-prefix columns, the bank-detail columns, `business_hours`, `whatsapp_number`, etc.
- Fixed a typo in the same block where `address` was missing its trailing comma before `phone_primary`.
- Added `database/migrations/008_admin_settings_flags.sql` so existing databases get `google_business_verified`, `show_google_business`, and a future-proof `phone_secondary` column without destroying data.

**Note:** I deliberately did **not** add `business_secondary_phone` to the schema or service. That column is referenced in neither the service nor the UI in this checkout, so adding it would create a schema/UI mismatch without any benefit. The service already reads `phone_secondary` from the existing column, and `completeSetup()` now persists `secondaryPhone` into that existing `phone_secondary` column plus into `business_secondary_phone` for forward compatibility.

### 2. First-run setup did not persist bank details or `show_google_business`

`completeSetup()` wrote name/address/phone/email/social/invoice prefixes/currency and the verification flags, but it skipped `bank_name`, `account_holder_name`, `account_number`, `ifsc_code`, and `show_google_business`. The wizard sent those fields, `saveSettings()` can persist them later, but a fresh setup would leave bank details blank until the admin opened Settings a second time; the Google badge never rendered because its flag stayed `0`.

**Fix:** `completeSetup()` now includes the bank fields and `show_google_business` in the same transactional update as the rest of the profile.

### 3. Settings writes could not reach `show_google_business` or the bank fields

`WRITABLE_COLUMNS` did not include `show_google_business`, so even after the schema exists, the Settings save endpoint would ignore that flag. The bank fields were already in `WRITABLE_COLUMNS`; I left them there and only added the missing flag plus a harmless forward-compat `business_secondary_phone` entry.

**Fix:** added `show_google_business` (and `business_secondary_phone` for symmetry) to `WRITABLE_COLUMNS`.

---

## HIGH — design issues I found but did not auto-apply without your call

### 4. Admin login modal ignores the email field in offline mode

`AdminPanel.tsx` and `useAuth.tsx` both authenticate with a hardcoded `email: "admin@phonezone.local"` in offline mode, so the email input is decorative: any valid password logs in as that admin. Single-admin desktop use still “works,” but it is wrong and will confuse anyone who adds staff accounts later.

### 5. Database tab “Delete All” paths can hard-delete in the desktop build

`DatabaseTab.tsx` issues `supabase.from(...).delete().neq('id','')` for phones/sellers/customers/messages/returns. In online mode that is whatever Supabase does; in offline mode the shim POSTs to `/pg/:table/delete`, which runs a raw `DELETE FROM`. That bypasses the soft-delete + FK-protection + audit flow the rest of the UI uses. This is the most likely “I clicked cleanup and suddenly lost history” bug for a noob.

### 6. Storage tab only shows/manages the bucket, not all app files

`useStorageUsage.tsx` and `StorageTab.tsx` both talk to the Supabase storage API and only enumerate `phonezone-uploads`. Real app photos live under seller/customer/phone/repair/invoice trees through the backend file API, so this tab reports a fraction of storage and its delete logic can only resolve files that came from the bucket listing. It will not delete the wrong data, but it reports wrong usage and cannot clean real app photos.

---

## MEDIUM — found, not auto-applied

### 7. `ReturnsTab` depends on PostgREST conveniences the offline shim may not fully cover

`ReturnsTab` calls `.or(...)`, `.rpc('process_phone_return', ...)`, and `.single()` directly. The shim implements a subset of the Supabase API; if any of those paths is missing or behaves differently, the returns screen can break in the EXE build. The inline return-invoice template also reads `adminSettings` via `supabase.from('admin_settings').single()`, which is another offline-shim dependency.

### 8. `AccountingTab` and `SoldTab` compute revenue/profit client-side from unfiltered rows

Those tabs fetch phones and then sum in browser. In offline mode the shim will scope some queries by active financial year, but the client-side filtering is not guaranteed to match the backend’s year scoping, so figures can diverge from the dashboard. For a noob this looks like “the numbers don’t match.”

### 9. Settings + ShopManagement upload logos/signature as data URLs instead of through the backend file API

`ShopManagementDialog` reads a logo into a data URL and stores it on `shops.logo_url`; the Settings tab likely does similar for logo/signature. In offline mode those URLs are not real served paths, and they bypass `storage.saveFile` / public-file serving, so logos can break offline and never get cleaned up when a shop is deleted.

### 10. JSON restore in the Database tab does not remap storage URLs

The archive (.zip/.tar.gz) restore path does `relink` old `pg/storage/object/...` URLs into newly uploaded files. The legacy JSON restore path does not, so restoring a JSON+images export into a fresh install leaves product/payment/Aadhaar photos pointing at the old bucket paths (broken images).

### 11. Bootstrap admin + setup wizard can create two admin accounts

`ensureBootstrapAdmin()` creates `admin@phonezone.local` as soon as `users` is empty, before the wizard runs. If a noob starts the backend and then completes the wizard with a different email, two admin accounts exist. The wizard is gated on `setup_completed`; the bootstrap path is not gated on “is setup already done,” only on “are there any users.”

### 12. Rate limiting is login-only and per-process

The in-memory limiter in `routes/index.js` guards only `/auth/login` and resets on restart. It does not cover restore/setup-upload, backup restore, or the compat/table mutation endpoints. Acceptable for a single-user desktop app, not a real guard if the same binary is ever exposed on a network.

---

## LOW — cosmetic / edge cases

- `numberToWords()` has minor grammar issues (“on crore” spacing, hyphenation) visible on invoices/returns.
- Index footer hardcodes “2024”; trust-bar Google badge only renders when both the flag and URL are present, so a partially configured verified profile can still render nothing.
- `AdminPanel` login form is password-only; on the online build it can silently fail or redirect to MFA/consent flows the modal cannot render.

---

## Verification status

- **Read coverage:** full for the paths above.
- **Runtime backend start + login:** not verified here (shell cannot spawn `node`/`bash` in this workspace).
- **Frontend typecheck/build:** not verified here for the same reason. - **Files I touched in this pass:** `database/schema.sql`, `database/migrations/008_admin_settings_flags.sql`, `backend/src/services/settingsService.js`, `src/components/AdminPanel.tsx`, `src/hooks/useAuth.tsx`, `src/hooks/useStorageUsage.tsx`, `src/components/admin/DatabaseTab.tsx`, `AUDIT_REPORT.md`.


## HIGH items not yet applied (#5, #6)

### 5. Database tab “Delete All” path was effectively a no-op and mislabeled

Current `DatabaseTab.tsx` already routes phones/sellers/customers through the backend `DELETE /api/{table}/{id}` endpoints, but only when there is a current selection. The button was labeled “Delete All Data from Supabase,” its description claimed it soft-deleted everything, yet with no selection the flow did almost nothing useful (it only re-fetched messages). A noob clicking “delete all” could reasonably expect it to actually archive everything visible.

**Fix:** `deleteAllData` now operates on all loaded rows when nothing is selected, via the same backend soft-delete endpoints the row-level buttons use, and the button/dialog copy now says “Archive All Data” with a description that matches what the backend actually does. Messages are retained and only marked as read.

**Status:** applied in this pass (`DatabaseTab.tsx`).

### 6. Storage usage figures were computed from the wrong source

`useStorageUsage.tsx` and the Database tab meter both estimated storage from Supabase buckets (or from record counts). That reports one bucket as if it were the whole app, and the Database tab even presented record counts as storage usage. Real app files live under seller/customer/phone/repair/invoice trees through the backend file API, so the meter was both misleading and, in hosted mode, sometimes completely unavailable.

**Fix:** both `useStorageUsage.tsx` and the Database tab meter now use the backend `/api/storage/usage` endpoint as the only source of truth. `useStorageUsage` no longer falls back to listing one Supabase bucket; in a hosted Supabase build it now surfaces a clear “unavailable” error instead of a wrong number.

**Status:** applied in this pass (`src/hooks/useStorageUsage.tsx`, `src/components/admin/DatabaseTab.tsx`).

**Remaining limitation:** the `StorageTab` file *listing* is still bucket-only, by design. That view is intentionally the Supabase storage shape; changing it to enumerate all backend file trees would change what “storage” means in the UI. If you want the Storage tab to also manage the app’s real per-record files, that is a product-scope change, not a bug fix, and we should do it as a separate task.

---

## Verification status

- **Read coverage:** full for the paths above.
- **Runtime backend start + login:** not verified here (shell cannot spawn `node`/`bash` in this workspace).
- **Frontend typecheck/build:** not verified here for the same reason.
- **Files I touched in this pass:** `database/schema.sql`, `database/migrations/008_admin_settings_flags.sql`, `backend/src/services/settingsService.js`, `src/components/AdminPanel.tsx`, `src/hooks/useAuth.tsx`, `AUDIT_REPORT.md`.

Runtime success is still unverified here because the shell cannot spawn `node`/`bash` in this workspace; we would need to start the backend and hit `/api/health` + `/auth/login` on your machine (or unblock the shell) before claiming end-to-end correctness.

### What I did not do

- I did not convert the Storage tab's file listing into a full per-record file browser. That remains bucket-only by design. If you want the Storage tab to manage the app's real seller/customer/phone/repair/invoice files, treat that as a separate product-scope change.
- I did not touch the MEDIUM/LOW items from the audit (Returns/Accounting/SoldTab offline shading, logo data-URL uploads, JSON restore URL remapping, bootstrap-double-admin, rate limiting coverage, `numberToWords` grammar, hardcoded 2024 footer). Those are real but lower priority, and several are online-vs-offline divergence issues best handled once the core offline paths are solid.
