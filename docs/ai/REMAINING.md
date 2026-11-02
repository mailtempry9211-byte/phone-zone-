# PhoneZone: Remaining Items & PDF Task Registry (docs/ai/REMAINING.md)

## Active PDF Specification Tracker (16 Critical Modules & Fixes)

### Item 1: Admin > Database & Backup > "Restore Backup (ZIP / TAR.GZ)" File Selector
- **Status**: [x] Complete
- **Proof**: File input decoupled from pointer-events-none label button; direct ref trigger opens native Windows file picker.

### Item 2 & 13a: Hicelltek / TAC Auto-fill Brand Name `[object Object]` & DB Cleanup
- **Status**: [x] Complete
- **Proof**: Unpacked `brand.name || brand.title || brand.slug` across `hicelltekService.js` and `tacService.js`. Repaired bad SQLite rows.

### Item 3: Aadhaar OCR Engine Initialization Failure
- **Status**: [x] Complete
- **Proof**: Enabled `workerBlobURL: true` in `useAadhaarOcr.ts` + added seamless fallback to native server-side `/api/ocr/aadhaar`.

### Item 4: Purchase Payment Proof Picture Missing in Inventory
- **Status**: [x] Complete
- **Proof**: Added `[Payment]` proof viewer button in `InventoryTab.tsx` and wired payment proof into purchase invoices.

### Item 5: Purchase Payment Proof Appears as Sales Document in Sold Invoice
- **Status**: [x] Complete
- **Proof**: Added `sale_documents` column in migration 025; decoupled purchase payment proofs from sold documents across `inventoryService.js`, `SoldTab.tsx`, and `ProcessSaleDialog.tsx`.

### Item 6a: Inventory Tab Restructuring (Sold Phones Sub-Tab & Purchase Records)
- **Status**: [x] Complete
- **Proof**: Defaulted `statusFilter` to `"available"`; added top view switcher pills (`Available Stock`, `Sold Phones Purchase Records`, `Sold Phones (Sales) ->`, `All`).

### Item 6b: Browser Refresh / Back Button Navigation & Missing Logout Button
- **Status**: [x] Complete
- **Proof**: Persisted admin session in `sessionStorage` in `Index.tsx`; added active tab retention; added prominent `[Logout]` button next to `[Storefront]`.

### Item 7: Live Dashboard Purchase Overview & Model Average Valuation
- **Status**: [x] Complete
- **Proof**: Implemented `purchaseOverview` calculations in `dashboardService.js`; created `PurchaseDashboardView.tsx`; wired into `DashboardShell.tsx`.

### Item 8: Repair Delivered Payment Collection Modal & Dashboard Repair Revenue Tile
- **Status**: [x] Complete
- **Proof**: Created `RepairPaymentCollectionDialog.tsx`; linked to status updates; added inline `[Pay]` quick action; added Repair Revenue StatCard to `DashboardShell.tsx`.

### Item 9: OpenWA Embedded Standalone Verification & Session Isolation
- **Status**: [x] Complete
- **Proof**: Dynamic directory discovery in `openWaService.js`; isolated user sessions in `%APPDATA%\PhoneZone\openwa\data`; auto-starts on boot.

### Item 10: Phone Suppliers (Sellers) Profile Photo Full Preview & Update
- **Status**: [x] Complete
- **Proof**: Added clickable avatar modal with download; added seller photo upload in both Add and Edit seller dialogs.

### Item 11: B2B Dealers Profile Photo Broken & Missing Full Preview / Update
- **Status**: [x] Complete
- **Proof**: Added fallback avatar for broken images, clickable thumbnail for full-size inspection, and download option.

### Item 12: B2B Batch Purchase Brand Overwrite Bug
- **Status**: [x] Complete
- **Proof**: Reset brand to empty on row creation in `DealerBatchPurchaseDialog.tsx`; TAC lookup authoritatively overwrites brand on IMEI entry.

### Item 13b: B2B Dealer Ledger & WhatsApp Statement Dispatch
- **Status**: [x] Complete
- **Proof**: Created `dealer_ledgers` table in migration 025; implemented `GET/POST /api/dealers/:id/ledger`; added Ledger dialog and WhatsApp statement dispatch in `DealersTab.tsx`.

### Item 14a: Batch Multi-Phone Sale (Combined Invoice)
- **Status**: [x] Complete
- **Proof**: Added phone card selection checkboxes in `InventoryTab.tsx`, floating bottom action bar `[Process Multi-Sale ({count})]`, and combined invoice generator `buildCombinedSaleInvoiceHtml`.

### Item 14b: Combined Multi-Phone Purchase (Single Seller KYC & Combined Voucher)
- **Status**: [x] Complete
- **Proof**: Added `additional_phones` batch support in `inventoryService.createPurchase`; added multi-phone intake form in `AddPhoneDialog.tsx` with single shared KYC; added `buildCombinedPurchaseInvoiceHtml`.

### Item 14c: Staff Role & Permission Enforcement
- **Status**: [x] Complete
- **Proof**: Implemented role-based tab scoping in `AdminDashboard.tsx`; hidden Repair Workshop and System Management from sales staff; hid repair metrics in `DashboardShell.tsx`.

### Item 15: Repair Table Responsive Layout (Zero Horizontal Scroll)
- **Status**: [x] Complete
- **Proof**: Added Table/Cards layout toggle in `RepairsTab.tsx`; created responsive auto-wrapping grid cards view for all screen sizes.

### Item 16: Dark Mode Contrast Audit & High-Contrast Text
- **Status**: [x] Complete
- **Proof**: Upgraded muted grey text to high-contrast emerald/slate/cyan classes across `MarketingTab.tsx` and admin forms.

## User Request #10: Production Fixes Tracker (All 7 Issues Resolved)
1. **TAC IMEI Auto-fill for Additional Phones**: Complete. `lookupExtraImei` queries `/api/tac/${digits}` and falls back to `/api/tac/fetch`.
2. **Retail Combined Voucher vs B2B Bill**: Complete. Differentiates `Boolean(phone.is_dealer)`; retail shows "Combined Bill", dealer shows "B2B Bill".
3. **Sale Document Upload 404 / Image not found**: Complete. Whitelisted in storage service, migration 026 executed, 200 OK verified.
4. **Extra Phones Inherit Seller KYC Documents & Payment Proof**: Complete. Integrated in both individual invoices and combined vouchers.
6. **Admin Panel Back Button Kicking Out to Storefront**: Complete. Maintains admin tab history stack with zero storefront ejection.
7. **B2B Dealer Credit Ledger Broken (Blank while total was 39000)**: Complete. Auto-syncs batches, updates balance to -₹39,000, records all debits/credits.
8. **Combined Sales Invoice Regeneration in Sold Tab**: Complete. Saved `batch_sale_id`, added "Combined Bill" button and multi-selection floating action bar.
