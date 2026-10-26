# PhoneZone: Engineering Progress Log (docs/ai/PROGRESS.md)

## 2026-10-20: Full Web ERP Implementation & Zero-Defect Gate (Stages 1-5 Complete)

### 1. Stage 3B: Multi-Shop Scoping, Collision-Free Invoicing & Public Server
- **Migration 012 (`012_multi_shop.sql`):** Added `users.shop_id`, `shops.shop_code`, `invoices.shop_id`, `returns.shop_id`.
- **Query Scoping in `compat.js` & `repairs.js`:**
  - Non-admin staff queries strictly auto-filter by `req.user.shopId`.
  - Non-admin staff attempting to update or delete records belonging to another shop receive `403 Forbidden`.
  - Admin users view all counters with `?shop=all` or filter per shop.
- **Collision-Free Numbering:**
  - Invoices generated atomically with shop code prefixes (`SAL-MAIN-2026-27-NNNN`, `SAL-B2-2026-27-NNNN`).
  - Repair job numbering (`RJ-MAIN-2026-27-NNNN`, `RJ-B2-2026-27-NNNN`).
- **Minimal Public Server (`backend/src/publicServer.js`):**
  - Serves strictly public catalog routes (`/public/inventory`, `/public-config`, `/config`, `/public/files/:id`, `/public/messages`).
  - Non-public routes (`/pg/*`, `/setup`, `/settings`, `/repair/*`) return `404 Not Found`.
- **Tailscale Manager (`backend/src/lib/tailscale.js`, `electron/tailscale.cjs`):**
  - CLI wrapper detecting installation status gracefully without crashing.
  - Tailscale Funnel strictly forbidden on the admin port.

### 2. Stage 4: WhatsApp Marketing Module & Chrome MV3 Extension
- **Migration 013 (`013_whatsapp.sql`):** Created `wa_templates`, `wa_campaigns`, `wa_queue`, `wa_message_log`, `wa_tokens`; added `whatsapp_opt_in` and `wa_opted_out_at` columns.
- **Backend Queue Dispatcher (`backend/src/services/waService.js`, `routes/wa.js`):**
  - Opt-in enforcement: campaigns strictly query customers where `whatsapp_opt_in = 1 AND wa_opted_out_at IS NULL`.
  - Rate limiting & pacing: 25–70s gaps between dispatches, daily cap (50 msgs/day), active business hours (10:00–20:00).
  - Bearer token authentication with SHA-256 storage and one-click revocation.
- **Chrome MV3 Extension (`extension/`):**
  - `manifest.json`, `background.js`, `content.js`, `popup.html`, `popup.js`, `README.md`.
  - Connects to PhoneZone local server to pace and dispatch messages via WhatsApp Web without scraping.
- **Marketing UI (`src/components/admin/MarketingTab.tsx`):**
  - Campaign creation, queue monitoring, template builder, token generator, and customer opt-out tool.

### 3. Stage 5: Hardening Backlog (H1-H10)
- **Aadhaar Masking (A65):**
  - Customer and seller Aadhaar numbers are masked in lists (`•••• •••• XXXX`).
  - Unmasked view (`GET /api/customers/:id/aadhaar`) is explicitly audited in `audit_logs`.
- **Viewer Role Enforcement (A66):**
  - Read-only users (`role = 'viewer'`) can read via `/api/pg/*` but all mutating actions (`insert`, `update`, `delete`) return `403 Forbidden`.
- **Active Session Management (A67):**
  - `GET /api/auth/sessions` lists active sessions; `DELETE /api/auth/sessions/:id` revokes targeted sessions.
- **Database Maintenance (A68):**
  - `POST /api/system/optimize` runs `VACUUM; ANALYZE;` under admin role.

### 4. Verification Suite Results
- **`node scripts/verify-all.mjs`:** **SUMMARY: PASSED 61 / FAILED 0 / SKIPPED 0**
  - A01-A20: Core baseline tests PASS
  - A38-A43, R01-R06: Compatibility & financial calculations PASS
  - A47, A56: Runtime-config & path traversal guards PASS
  - A21-A28, A61, A62: Private repairs, Luhn IMEI, QR job sheet, cross-checks PASS
  - A31, A63, A64: Multi-shop scoping, cross-shop protection, non-colliding invoices PASS
  - A32, A33: Public server isolation & Tailscale manager PASS
  - A34-A37: WhatsApp opt-in queue, gap enforcement, token revocation, MV3 manifest PASS
  - A65-A68: Aadhaar masking, viewer role enforcement, session management, database optimization PASS
- **Backend Regression Suites:**
  - `test/offline-suite.mjs`: 138 passed, 0 failed
  - `test/first-setup-suite.mjs`: 32 passed, 0 failed
- **Frontend Quality:**
  - TypeScript check: 0 errors
  - Vite production build: built in 9.94s, exit 0
