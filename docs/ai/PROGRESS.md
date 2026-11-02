# PhoneZone: Progress Log (docs/ai/PROGRESS.md)

## Current Milestone: 16-Item Bug Fix & Feature Suite (Per problem.pdf)

### Status Overview
- Total Identified Items: 16
- Verified Root Causes: 16/16
- Implementation In-Progress: Yes
- Target: Verify 100% in Browser (`http://localhost:8080` & `http://localhost:4545`) before building any EXE.

### Implementation Checklist
- [ ] Item 1: Restore Backup file selector click fix (`DatabaseTab.tsx`)
- [ ] Item 2 & 13a: Hicelltek / TAC brand object parse fix + DB cleanup (`hicelltekService.js`)
- [ ] Item 3: Aadhaar OCR WebWorker / backend native fallback (`useAadhaarOcr.ts`)
- [ ] Item 4: Payment proof view button in Inventory + purchase invoice inclusion (`InventoryTab.tsx`, invoice generator)
- [ ] Item 5: Separate purchase `payment_proof_photos` vs `sale_documents` in sold invoices (`SoldTab.tsx`, `inventoryService.js`)
- [ ] Item 6a: Move Sold Phones into Inventory sub-tab & add Sold Phones Purchase Records (`AdminDashboard.tsx`, `InventoryTab.tsx`)
- [ ] Item 6b: Admin session persistence on browser reload/back + prominent Logout button in header (`AdminDashboard.tsx`, `AdminPanel.tsx`)
- [ ] Item 7: Dashboard Purchase Overview (Average Purchase Value per brand/model, stock incoming rates) (`DashboardTab.tsx`, `dashboardService.js`)
- [ ] Item 8: Repair Delivered Payment Collection Modal + Customer Ledger auto-update + Live Dashboard Repair Revenue tile (`RepairsTab.tsx`, `DashboardTab.tsx`)
- [ ] Item 9: OpenWA embedded standalone verification & standalone launch config (`backend/src/services/openwaService.js`)
- [ ] Item 10: Sellers tab profile photo full-size viewer & photo edit/update (`SuppliersTab.tsx`)
- [ ] Item 11: B2B Dealers profile photo fix (broken image, full-size preview, download, edit/update) (`B2BDealersTab.tsx`)
- [ ] Item 12: B2B Batch Purchase brand auto-fill & overwrite bug (`DealerBatchPurchaseDialog.tsx`)
- [ ] Item 13b: B2B Dealer Ledger & WhatsApp payment notification statement (`B2BDealersTab.tsx`, `b2bDealerService.js`)
- [ ] Item 14a & 14b: Multi-phone batch sale combined invoice + Multi-phone combined purchase with shared Shapath Patra (`InventoryTab.tsx`, `ProcessSaleDialog.tsx`, `AddPhoneDialog.tsx`)
- [x] Item 14c: Strict staff role permissions (sales staff cannot access repairs or system management; technicians strictly isolated to repairs department; Live Dashboard restricted to admin/owner) (`AdminDashboard.tsx`, `useAuth.tsx`, `backend/src/routes/index.js`)
- [ ] Item 15: Repair jobs table responsive layout (no horizontal scroll) (`RepairsTab.tsx`)
- [ ] Item 16: Dark mode UI contrast audit & high-contrast text fix (`WhatsAppMarketingTab.tsx`, global CSS/cards)
