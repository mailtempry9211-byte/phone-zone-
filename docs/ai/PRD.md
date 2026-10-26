# PhoneZone: Product Requirements Document (docs/ai/PRD.md)

## 1. Personas
- **Owner / Admin:** Configures business profile, views all shops, manages users, initiates backups, triggers remote access, oversees financial metrics and WhatsApp campaigns.
- **Shop Staff (Technician / Salesperson):** Adds purchases from sellers, performs sales, creates and manages repair jobs, issues job sheets and invoices. Restricted to their assigned shop.
- **Viewer:** Read-only access to inventory, sales, and reports.
- **Second-Shop Staff:** Connects from another PC over Tailscale to the primary server; operates independently within their assigned shop scope.
- **Public Website Visitor:** Browses available phone catalog and submits inquiry messages on the public storefront.

## 2. Module Specifications & User Stories

### M1. Inventory & Purchase
- Staff records seller details (Name, Phone, Aadhaar/ID, photos, payment method, bill/box flags).
- 15-digit Luhn-validated IMEI mandatory.
- TAC lookup automatically fills Brand/Model from local database.
- Atomic transaction: seller record + phone + purchase invoice created together.
- Acceptance criteria: Duplicate unsold IMEI rejected; invalid Luhn rejected; orphan sellers prevented on error.

### M2. Sales & Invoicing
- Staff sells unsold phones to customers.
- Invoice numbers generated with FY prefix (e.g. `SAL-2026-27-0001`).
- Generates clean, escaped A4 print invoice with shop branding and totals in words (Indian numbering system).
- Acceptance criteria: Sold phones cannot be re-sold; invoice numbers sequential and collision-proof.

### M3. Returns
- Customer returns phone (Sales Return) or phone returned to seller (Purchase Return).
- Acceptance criteria: Purchase-returned phone cannot be sold; double returns forbidden.

### M4. Private Repairs Module
- Dedicated private tables (`repair_customers`, `repair_jobs`, `repair_job_items`, `repair_status_log`).
- Job numbers: `RJ-<shopcode>-<FY>-<0000>`.
- Mandatory Luhn IMEI, accessories checklist, passcode note, technician assignment, status transitions (`received` -> `diagnosing` -> `waiting_parts` -> `in_progress` -> `ready` -> `delivered` -> `cancelled`).
- Parts and labour items. If an item is marked "Board/Motherboard", flag `board_replaced = 1`.
- A4 printable Job Sheet (customer copy + shop copy with QR code) and Repair Invoice.
- WhatsApp update link generation (`wa.me` URL with settings template).
- Acceptance criteria: Excluded from all `/api/public` routes; soft delete only; status changes logged with timestamps.

### M5. Cross-Checks
- **By Phone:** Entering a 10-digit phone in Purchase or Sales detects if customer exists in repairs. Offers `RepairMatchDialog` to copy KYC details without altering repair records.
- **By IMEI:** Entering IMEI in Purchase detects if the device was previously repaired. Displays red banner with date and job details. If `board_replaced = 1`, requires user to check "I have seen the repair history" and logs acknowledgment in audit trail.

### M6. Multi-Shop Scoping & Tailscale
- Users linked to specific `shop_id`.
- Staff sees only phones, invoices, returns, and repairs for their shop. Admin can view all or filter by shop (`?shop=all`).
- Multi-shop invoice prefixing and collision-free counter sequences.
- Tailscale status detection and service management.

### M7. Public Storefront & Minimal Catalog Server
- Homepage displays only unsold phones, general store info, and contact form.
- Never leaks cost prices, IMEIs, seller data, customer data, or repair information.

### M8. Backup, Restore & Company Switch
- In-process backup creation using npm `tar` package (no external binary).
- SHA256 integrity manifest, atomic swap on restore with automatic pre-restore backup and rollback.
- Business profile changes snapshot into invoice generation to preserve historical invoices.
- Company switcher supporting distinct data profiles under `<userData>/companies/<id>/`.

### M9. WhatsApp Marketing Extension
- Chrome Manifest V3 extension.
- Server queue manages campaign messages for opted-in customers only.
- Strict server rate limits: active hours (10:00 - 20:00), daily caps, 25-70s random delays, 5-10m rest every 10 messages.
- Dry-run capability and stop/opt-out handling.

## 3. Non-Functional Requirements
- Offline-first execution on localhost.
- Windows 10/11 compatibility.
- Simple English UI with Indian numbering format and INR currency.
- Strict data security: SQL injection prevention, strict upload MIME validation, no secrets in logs.

