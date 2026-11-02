# PhoneZone: Dashboard Specification (docs/ai/DASHBOARD_SPEC.md)

## 1. Project Facts & Architecture Inspection
- **Admin Wrapper:** `src/components/admin/AdminDashboard.tsx` is the tab wrapper component hosting Inventory, Sold, Returns, Customers, Sellers, Messages, Accounting, Storage, Database, Settings, etc.
- **New Tab:** `Dashboard` is added as the FIRST tab and set as `defaultValue="dashboard"`.
- **Existing Dashboard Endpoint:** `backend/src/services/reportService.js` has `reports.dashboard(req.query)` which calculates revenue, expenses, and gross profit. We preserve and do not break it.
- **New Endpoint:** `GET /api/dashboard/overview` registered under `staff` middleware in `backend/src/routes/index.js` and implemented in `backend/src/services/dashboardService.js`.
- **Timezone:** All day boundaries (today, yesterday) and Financial Year (April 1 to March 31) are computed strictly in Indian Standard Time (`Asia/Kolkata`).
- **Repairs Module Status:** Stage 2 is already implemented (`repair_jobs`, `repair_customers`, `repair_job_items`, `repair_status_log` tables exist in SQLite).
- **Customer Dues:** No dedicated customer ledger/dues table exists; therefore, according to Master Brief rules, we display "Repair Balance Due" (sum of `final_price - advance_paid` on active repair jobs: `status NOT IN ('delivered', 'cancelled')`) and document this decision here.

## 2. Data Contract: `GET /api/dashboard/overview`
Query params: `range=week|month|year` (default `week`), `shop` (optional), `fy` (optional, default active financial year).
Response structure (all numbers are strictly numbers, never null or NaN):
```json
{
  "generatedAt": "2026-10-29T11:45:00.000Z",
  "timezone": "Asia/Kolkata",
  "financialYear": "2026-2027",
  "today": {
    "salesAmount": 45000,
    "phonesSold": 3,
    "profit": 6500,
    "purchasesAmount": 28000,
    "phonesBought": 2,
    "returnsCount": 0
  },
  "yesterday": {
    "salesAmount": 38000,
    "phonesSold": 2,
    "profit": 5200,
    "purchasesAmount": 32000,
    "phonesBought": 2,
    "returnsCount": 0
  },
  "stock": {
    "count": 16,
    "value": 245000,
    "agingBuckets": {
      "d0_30": 10,
      "d31_60": 4,
      "d61_90": 2,
      "d90plus": 0
    },
    "lowStock": false,
    "threshold": 5
  },
  "people": {
    "customers": 5,
    "sellers": 7,
    "newCustomers30d": 3
  },
  "messages": {
    "unread": 0
  },
  "repairs": {
    "available": true,
    "pending": 4,
    "readyForDelivery": 2,
    "balanceDue": 2800,
    "byStage": {
      "received": 1,
      "diagnosing": 1,
      "waiting_parts": 1,
      "in_progress": 1,
      "ready": 2,
      "delivered": 12
    },
    "jobs": []
  },
  "series": [
    { "label": "23 Oct", "date": "2026-10-23", "sales": 32000, "profit": 4500, "count": 2 }
  ],
  "brands": [
    { "name": "Apple", "count": 6, "value": 140000 },
    { "name": "Samsung", "count": 5, "value": 65000 },
    { "name": "Xiaomi", "count": 3, "value": 28000 },
    { "name": "Others", "count": 2, "value": 12000 }
  ],
  "recentInvoices": [
    {
      "id": "inv-1",
      "number": "SAL-2026-27-0012",
      "type": "sale",
      "party": "Rahul Verma",
      "amount": 24000,
      "status": "paid",
      "date": "2026-10-29T10:15:00.000Z"
    }
  ],
  "alerts": [
    { "type": "aging", "severity": "warning", "text": "2 phones in stock for over 60 days", "count": 2, "link": "inventory" }
  ]
}
```
*Note on Admin-only fields:* If caller's role is not `admin`, `profit`, `stock.value`, and `brands[].value` are omitted or scrubbed from the payload.

## 3. Visual Styles & Design Tokens

### Style 1: Glass (REF_1 inspired)
- **Background:** Dynamic gradient ambient blobs (`#38bdf8`, `#fbbf24`, `#34d399`) with backdrop blur 20-30px over dark slate `#0b0f19`.
- **Card Styling:** Frosted translucent cards (`rgba(255, 255, 255, 0.08)` to `0.15`), 1px luminous border (`rgba(255, 255, 255, 0.12)`), radius 24px (`rounded-3xl`), soft ambient drop-shadow.
- **Navigation:** Floating pill bottom bar with sub-views (Overview, Sales, Repairs, Stock, Reports).
- **Highlight Card:** Today's Sales formatted with an emerald gradient background and live glowing pulse.

### Style 2: Dark Teal ("Moorly" / REF_2 inspired)
- **Background:** Deep navy/obsidian (`#070b12`) with atmospheric teal `#14b8a6` glow top-left and warm amber `#f59e0b` glow behind the header.
- **Top Bar:** Breadcrumbs with green backend pulse dot, pill tabs, global search box, quick "+ New" action button, theme mode toggle.
- **Light Variant:** Crisp aqua/ice-white gradient with matching dark charcoal typography and teal accents.
- **Repair Pipeline:** Horizontal kanban columns with status indicators, counts, and job cards.
- **Stage Track Animation:** `RepairStageTrack` featuring an animated phone icon traveling along the stage path (Received -> Delivered) with teal path fill.

## 4. Frontend Organization
- `src/components/admin/dashboard/`
  - `DashboardTab.tsx`: Main view container, lazy loaded.
  - `DashboardShell.tsx`: Glass vs Dark Teal layout selector.
  - `useDashboardData.ts`: TanStack React Query hook for `/api/dashboard/overview`.
  - `StyleSwitch.tsx`: Style toggle (Glass / Dark Teal) & animation reducer.
  - `dashboardFormat.ts`: Currency (₹ INR), date, and relative time helpers.
  - `widgets/`:
    - `Greeting.tsx`: Time-aware greeting & Moorly-style natural language summary.
    - `StatCard.tsx`: Count-up, sparkline, and % change indicator.
    - `SalesChart.tsx`: Area chart with gradient fill (Week / Month / Year).
    - `BrandDonut.tsx`: Donut chart showing brand distribution.
    - `RepairPipeline.tsx`: Multi-stage repair board.
    - `RepairStageTrack.tsx`: Animated stage tracker.
    - `RecentInvoices.tsx`: Recent invoice history.
    - `AlertsPanel.tsx`: Urgent stock & repair warnings.
    - `QuickActions.tsx`: Quick buttons for New Sale, New Repair, Add Phone.
    - `StockAging.tsx`: 0-30, 31-60, 61-90, 90+ days aging breakdown.

