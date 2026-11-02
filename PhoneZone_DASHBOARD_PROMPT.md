# PhoneZone: DASHBOARD prompt for Antigravity (ek hi prompt)

## Aapke liye steps

1. Antigravity me **wahi PhoneZone folder** khula rakho (jisme `docs/ai/` aur baaki files hain).
2. Dono reference images attach karo: `REF_1_glass_dashboard.png` aur `REF_2_dark_teal_dashboard.png`. Chaho to original videos bhi attach kar do.
3. Neeche **box ka poora text** paste karo.
4. Agar Antigravity pehle se bada master brief chala raha hai: ye prompt bhi paste kar do. Wo ise "Stage D" bana ke queue me daal dega aur Repairs (Stage 2) ke baad karega. Alag se kuch karne ki zaroorat nahi.
5. Beech me atak jaye ya credits khatam hon, to naye session me likho: `docs/ai/CONTEXT.md, TODO.md aur PROGRESS.md padho, aur jahan ruke the wahin se continue karo.`
6. Khatam hone par mujhe `REPORT.md`, `VERIFY_OUTPUT.txt` aur nayi zip bhejo. Main dashboard ke numbers khud dobara check karunga.

**Is prompt me pichli chat ke generic prompt se kya alag hai** (kyunki ab asli code pata hai):
- Stack fixed hai: React 18 + Vite + Tailwind + shadcn. `recharts` aur `lucide-react` pehle se hain, `framer-motion` nahi hai (add hoga). `next-themes` aur Tailwind `dark` class pehle se hai.
- App offline chalti hai, to **koi CDN, Google Fonts ya online image nahi** (EXE me wo kaam nahi karenge).
- "Aaj" ka hisaab **India ke time (IST)** se hoga, UTC se nahi.
- Numbers frontend me nahi, **backend ke ek naye endpoint** me nikalenge, aur uske tests honge.
- Repairs ka pipeline tabhi chalega jab Repairs module (Stage 2) bana ho. Tab tak wahan saaf message dikhega.
- Admin tabs wali file ka naam `AdminDashboard.tsx` hai, par wo sirf tabs ka wrapper hai. Naya Dashboard tab uske andar judega.

---

## PROMPT (poora box copy karo)

```
PROJECT: PhoneZone (offline-first shop ERP for a second-hand + new phone shop with a repair section; React 18 + Vite + TypeScript + Tailwind 3 + shadcn/ui frontend, Node/Express + SQLite backend, runs on Windows, being packaged as an Electron EXE). Reference images REF_1_glass_dashboard.png (Glassy Dashboard V2) and REF_2_dark_teal_dashboard.png (Dashboard Animation, "Moorly") are attached. Study them closely; they are the visual targets.

GOAL: Add a beautiful, fast, REAL-DATA Dashboard to the Admin panel in TWO visual styles (Glass and Dark Teal, the latter with a Light variant) with a style switch. Do NOT break, remove or rename any existing feature, route, table, setting or test.

You are an autonomous engineer. The owner is a NON-PROGRAMMER (keyboard and mouse only). Talk to the owner in short, simple Hinglish (Roman script) in chat; write code, comments, UI text and documents in simple English.

=====================================================================
RULE 0: CONTEXT FILES AND PROGRESS DISCIPLINE (MOST IMPORTANT)
=====================================================================
The session may stop anytime (credits, crash). You must be able to resume from files alone.
 - Project memory lives in docs/ai/: CONTEXT.md, PRD.md, ARCHITECTURE.md, DECISIONS.md, TODO.md, PROGRESS.md, REMAINING.md, SECURITY_STATUS.md, TEST_PLAN.md, CHANGELOG.md. If they exist (the master brief was run), USE them: read CONTEXT.md and TODO.md first. If docs/ai/ does not exist, create minimal CONTEXT.md, TODO.md, PROGRESS.md, DECISIONS.md and TEST_PLAN.md there first.
 - Create docs/ai/DASHBOARD_SPEC.md (design tokens, layout, widget list, data contract, decisions) BEFORE coding. It is the single source of truth for this feature.
 - Add tasks T-D01... to docs/ai/TODO.md (one line each, [ ] / [~] / [x] / [!], with the assertion IDs that prove them). Tick [x] ONLY after the task is implemented AND tested.
 - After EVERY step (even a small one) append to docs/ai/PROGRESS.md: date/time, what was done, files created/changed, evidence (command + result), CURRENT STEP and NEXT STEP in plain words. Never batch updates for later.
 - Before a risky change write in PROGRESS.md what you are about to do.
 - At the start of every session and whenever lost: read CONTEXT.md, TODO.md, PROGRESS.md, DASHBOARD_SPEC.md, tell the owner in 3 lines where we stopped, continue from NEXT STEP. Never redo finished steps.
 - Keep steps small (one file or one widget at a time).
 - At the end of the feature update CONTEXT.md, REMAINING.md, TEST_PLAN.md, CHANGELOG.md and write REPORT.md (format below).

=====================================================================
RULES (inherited from the PhoneZone master brief; obey all)
=====================================================================
R1 EVIDENCE: never write "done/fixed/works" without real command output (last 40 lines in the report). If you cannot run something, write "NOT RUN: reason" and put it in the owner's manual checklist.
R2 After every edit re-open the file and confirm the change is really there.
R3 Tests use TEMP data dirs (PHONEZONE_DATA_DIR) and FAKE demo data only. Never read or print real customer data (names, phones, IMEIs, Aadhaar).
R4 No secrets in code, logs, reports or chat.
R5 Before starting, snapshot: copy src, backend (without node_modules), database, scripts, electron, package.json, tailwind.config.ts, vite.config.ts into _backup_dashboard_<YYYYMMDD-HHMM>/ . Also keep a filename.backup of every existing file you edit (AdminDashboard.tsx, index.css, tailwind.config.ts, routes/index.js, package.json, etc.).
R6 Stay in scope: new files wherever possible; list every changed existing file in the report.
R7 No destructive commands. No npm audit fix --force.
R8 SQLite migrations: NO `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; plain ALTER only after checking no earlier migration added the column; test on a fresh DB and an existing-migrations DB; add a NEW numbered file, never edit applied ones. Avoid migrations unless unavoidable; tell the owner why in the report.
R9 Backend is plain ESM JavaScript, no TypeScript syntax; run `node --check` on every changed backend/scripts file.
R10 Windows first; no bash-only scripts; no console windows.
R13 Every message a shop employee sees: plain English, say what happened and what to do next.
R14 No hard-coded business data (names, phone numbers, bank details).
R15 Escape user text in any generated HTML.

=====================================================================
STEP 0: INSPECT FIRST (no dashboard code yet)
=====================================================================
Read and write the findings into DASHBOARD_SPEC.md ("Project facts") and PROGRESS.md:
 - src/components/admin/AdminDashboard.tsx: despite its name it is the admin TABS wrapper (Inventory, Sold, Returns, Customers, Sellers, Messages, Accounting, Storage, Database, Settings). The new tab goes in here. Note which tab is currently the default (Tabs defaultValue).
 - src/components/AdminPanel.tsx (login + header that renders AdminDashboard), src/index.css and tailwind.config.ts (CSS variables, darkMode: ["class"], next-themes usage), src/components/ui/* (shadcn), src/lib/data/offlineSupabase.ts and src/lib/data/config.ts (how the UI talks to the backend; window.__PHONEZONE_OFFLINE__), src/hooks/* (data hooks, react-query usage).
 - backend/src/routes/index.js: the existing `r.get("/dashboard", staff, ...)` -> reports.dashboard(req.query) in backend/src/services/reportService.js. Read what it already returns and who uses it (grep AccountingTab). REUSE its logic where correct; do not break it (existing assertion R06 compares dashboard figures with rows).
 - Which tables/columns exist for: phones (price columns, is_sold, sold_at/sale date, return_status, deleted_at, brand/phone_name/model, created_at), sellers, customers, invoices (type, amount, status, date, financial_year), returns, messages (read flag), admin_settings, shops. Whether a "customer dues / credit / unpaid balance" concept exists. DO NOT invent one: if it does not exist, drop the "Customer Dues" card (or, once the Repairs module exists, show "Repair balance due" = final price minus advance for open repair jobs) and record the decision in DECISIONS.md.
 - Whether the Repairs module (repair_jobs, repair_customers, GET /api/repair/*) exists yet. If NOT: build everything else, make the Repairs widgets self-detect (endpoint 404 -> friendly empty state "Repairs section is not set up yet"), mark the pipeline tasks T-D?? as BLOCKED-BY-STAGE-2 and finish them right after Stage 2.
 - Whether a shop-scoping mechanism exists (req.scope / shop_id filters, Stage 3B). If not, make the endpoint accept an optional `shop` query parameter ready for it.
 - Whether an IMEI scan / universal scan feature exists (ImeiScanButton, AadhaarScanButton, ImeiHistoryDialog). The "Universal Scan" quick action must map to something real (e.g. opens IMEI scan then IMEI history); if nothing fits, name it "Scan IMEI".
 - package.json: confirm recharts and lucide-react exist; framer-motion is missing. Decide the animation approach: add `framer-motion` (pin an exact version at least 14 days old, MIT licence) for card entrances, hover lift, count-up and the stage-track marker. No GSAP (not needed). Report the gzip bundle-size delta.
Then write the TODO list and a 10-line plan, show it to the owner, and continue.

=====================================================================
STEP 1: BACKEND DATA CONTRACT (numbers come from SQL, never from the browser)
=====================================================================
Create backend/src/services/dashboardService.js and register GET /api/dashboard/overview (same `staff` middleware as the existing /dashboard; do not touch the existing route's behaviour). Query params: range=week|month|year (default week), shop (optional, ignored until scoping exists), fy (optional, default active financial year). Response (JSON, all numbers are numbers, never null/NaN; empty database -> zeros and empty arrays):
 {
  generatedAt, timezone: "Asia/Kolkata", financialYear,
  today: { salesAmount, phonesSold, profit*, purchasesAmount, phonesBought, returnsCount },
  yesterday: same fields (for % change), 
  stock: { count, value*, agingBuckets: { d0_30, d31_60, d61_90, d90plus }, lowStock: bool/threshold info },
  people: { customers, sellers, newCustomers30d },
  messages: { unread },
  repairs: { available: bool, pending, readyForDelivery, byStage: { received, diagnosing, waiting_parts, in_progress, ready, delivered }, jobs: [ {id, jobNo, customerName, device, problem, status, ageDays} up to 8 per stage ], balanceDue* },
  series: [ { label, date, sales, profit* , count } ]  (range: week=last 7 days, month=last 30 days, year=12 months of the financial year Apr-Mar),
  brands: [ { name, count, value* } ] (top 5 + Others; derive brand from the brand column if it exists, otherwise from phone_name's first word with a small normalisation map Apple/iPhone, Samsung, Xiaomi/Redmi/Poco, Vivo, Oppo, Realme, OnePlus; never crash on odd names),
  recentInvoices: [ last 8: {id, number, type, party, amount, status, date} ],
  alerts: [ {type, severity, text, count, link} ] (low stock below a threshold, phones unsold more than 60 days, repairs waiting more than 3 days, unread messages, pending purchase returns)
 }
 * Fields marked * (profit, stock value, brand value, repair balance) are ADMIN-ONLY: for non-admin roles omit them (the UI hides the card).
RULES:
 - "Today", week, month and financial year boundaries use Asia/Kolkata (IST) and April-March FY. First check how dates are stored (UTC ISO? local?) and write the conversion in DASHBOARD_SPEC.md. Test rows at 23:59 IST and 00:01 IST.
 - Sales = sold phones (is_sold) with the sale date in range, excluding soft-deleted rows and sales that were later returned; profit = sale price minus purchase price of those phones. Stock = unsold, not soft-deleted, not purchase-returned. Make the SQL match the definitions used by Sold/Inventory/Accounting; if the existing reportService uses a different definition, STOP and write the difference in NEEDS DECISION instead of silently choosing.
 - No private fields in the payload: no IMEI, Aadhaar, seller identity, addresses, bank details, tokens.
 - Cache the result in memory for 20 seconds per (range, fy, shop, role); invalidate on any write route that already exists (or keep the TTL short if that is too invasive).
 - Add indexes only if EXPLAIN shows a table scan on large tables; use a new numbered migration.
 - A "refresh" button in the UI forces a fresh call (query param nocache=1, admin/staff only).

=====================================================================
STEP 2: FRONTEND STRUCTURE
=====================================================================
New files (nothing else is rewritten): src/components/admin/dashboard/{DashboardTab.tsx, DashboardShell.tsx, useDashboardData.ts, StyleSwitch.tsx, widgets/{Greeting,StatCard,Sparkline,SalesChart,BrandDonut,RepairPipeline,RepairStageTrack,RecentInvoices,AlertsPanel,QuickActions,StockAging}.tsx, styles/{glass.css or Tailwind layer, darkteal.css}, dashboardFormat.ts}.
 - Add a "Dashboard" tab as the FIRST tab and make it the default (existing tabs unchanged and still reachable). Lazy-load DashboardTab (React.lazy) so the rest of the admin does not get heavier.
 - Data: react-query with the new endpoint (staleTime 20 s, refetch on window focus, refetch every 60 s while the tab is visible).
 - Persist the user's choice (style: glass | darkteal; mode: dark | light for Dark Teal) in localStorage per device (key phonezone.dashboard.prefs). Do NOT write it to the database. Default: Glass.
 - Loading = skeletons (no spinners-only), error = friendly card with Retry, empty = helpful empty states ("No sales today yet. Start with New Sale").
 - Every number formatted Indian style (₹ 1,23,456), dates dd-mm-yyyy, relative times ("3 days").
 - Role awareness: hide admin-only widgets when the API omits their fields.
 - Offline-first: NO external fonts, images, scripts or CDN. Use the existing font stack or bundle a font locally; backgrounds are CSS gradients/blurred blobs (a locally bundled image under 150 KB is allowed). Add an assertion that dist/ contains no http(s) font/CDN references.
 - Accessibility: aria-labels on icon buttons, keyboard focus rings, contrast AA in both styles, charts have a text summary for screen readers.

=====================================================================
STEP 3: CONTENT (all widgets use the REAL endpoint data)
=====================================================================
A) Greeting: "Good morning/afternoon/evening, <logged-in user's name>" (IST), date, financial year, and ONE human sentence like Moorly's: "Today you sold 3 phones for ₹ 41,500. 2 repairs are ready for delivery." built from real numbers (no sentence parts for zero values).
B) Stat cards with count-up and % change vs yesterday (green up / red down arrow, "no change"): Today's Sales (₹) + phones sold; Today's Profit (admin only); Phones in Stock + stock value (value admin only); Repairs Pending / Ready for delivery; Repair balance due (replaces Customer Dues if no dues concept exists); Customers and Sellers totals; Unread messages. Each has a tiny sparkline (last 7 days) where data exists. In Glass style the main card (Today's Sales) is the green gradient highlight card like the reference.
C) Sales chart: smooth area/line (recharts) with gradient fill, toggle Week / Month / Year, optional Profit series for admin, tooltips in ₹.
D) Repair Pipeline (needs the Repairs module): columns Received, Diagnosing, Waiting for Parts, Repairing, Ready, Delivered with counts and small job cards (customer, device, problem, age badge). Click a card opens the existing repair detail dialog (or navigates to the Repairs tab with that job selected). Filter chips + "Only today" toggle like the reference. Dark Teal draws a connecting line between columns with an animated pulse.
E) Repair stage track (the "boat on a route" animation of REF_2): a reusable RepairStageTrack component, a horizontal line with 6 stage dots (Received -> Delivered) where a small PHONE icon slides along the line to the current stage with an easing animation and the line fills with teal up to that stage. Use it inside the repair detail dialog header (Stage 2 file RepairDetailDialog.tsx: add it there only if it exists, as a one-line import) and in pipeline card hover. Respect reduced motion (no sliding, just fill).
F) Brand donut: stock count by brand with centre total and legend bars (like the Reports screen of REF_1). Toggle Stock / Sales.
G) Recent invoices (last 8): party, amount, type badge (Purchase / Sale / Return / Repair), status, relative time; click opens the existing invoice (reprint) function.
H) Alerts panel: low stock, phones unsold > 60 days ("slow movers"), repairs waiting > 3 days, unread messages, pending returns; each alert deep-links to the right tab.
I) Stock aging bars (0-30, 31-60, 61-90, 90+ days): very useful for a second-hand shop.
J) Quick actions (floating "+ New" menu in Dark Teal, buttons row in Glass): New Sale (opens the existing sale flow), New Repair (opens AddRepairDialog if Stage 2 exists, else hidden), Add Phone (AddPhoneDialog), Add Customer, Scan IMEI (existing IMEI scan -> history). Wire to the EXISTING dialogs/functions; do not duplicate logic.
K) Global search box (Dark Teal top bar): searches IMEI, phone name, customer/seller name or phone through existing endpoints; max 8 results, debounced 300 ms, results open the matching existing screen. Never show Aadhaar numbers.

=====================================================================
STEP 4: THE TWO STYLES (match the reference images)
=====================================================================
STYLE 1: GLASS (REF_1)
 - Soft blurred warm background built from CSS gradient blobs (peach/amber/teal) over a neutral base; frosted-glass cards (rgba(255,255,255,0.14-0.22), backdrop-filter blur 18-24px, 1px light border, radius 24px, soft shadow); white text with good contrast (check AA; add a subtle dark overlay if needed); `glass-card` utility class defined once.
 - Left slim vertical icon rail (hover shows labels) + top welcome bar (avatar, "Welcome, <name>", shop name from settings, bell) + FLOATING PILL bottom navigation: Overview, Sales, Repairs, Stock, Customers, Reports; the active item is a white pill; Customers and Reports can deep-link to the existing tabs/exports, the others are dashboard sub-views (Overview = all widgets; Sales = chart + top models + recent invoices; Repairs = pipeline; Stock = donut + aging + alerts).
 - Main number card = emerald gradient; stat cards lift 5px on hover; goal rings (circular progress) for "Monthly sales target" and "Stock health" (target is a simple setting stored in localStorage until the owner asks for more; if no target is set show a soft "Set a target" chip).
 - Charts: thin lines with soft glow, rounded donut.
STYLE 2: DARK TEAL (REF_2, "Moorly")
 - Near-black navy background with a teal glow top-left and a warm amber glow behind the header; cards one step lighter with 1px borders; accent mint/teal (#5eead4 family); each stat card has a faint coloured top tint (teal, amber, blue, rose) and a sparkline.
 - Top bar: pill tabs (Overview, Sales, Repairs, Stock, Reports) with small count badges, search, teal "+ New" button (quick actions), bell with a red alert-count badge, sun/moon theme toggle, avatar; a small breadcrumb line "Workspace / Dashboard" with a green "online" dot only when the backend health call succeeds.
 - Greeting block with the human sentence and two buttons (Pipeline, + New repair).
 - Sales chart with a segmented toggle and gradient fill; right column "Waiting on you" list (repairs ready for delivery, overdue pickups, unread messages) with due chips like "in 3d", "2 days late".
 - Pipeline = horizontal kanban columns (coloured header dot, count, total value), with filter chips and an "Only mine" toggle ("Only mine" shows jobs assigned to the logged-in user once the technician field exists; hide it otherwise).
 - LIGHT MODE variant: pale aqua/white gradient with a faint wave pattern, same layout, tokens swapped through CSS variables (no duplicated markup).
Both styles share the same widgets and data; only the shell and tokens differ. Define design tokens (colours, radii, shadows, blur, spacing) in DASHBOARD_SPEC.md and as CSS variables scoped to a `.pz-dash` wrapper so NOTHING leaks into the rest of the app (check Inventory/Sold/Settings pages look identical before and after).

=====================================================================
STEP 5: ANIMATION (light, smooth, reduce-motion aware)
=====================================================================
Cards fade+slide in with a 60 ms stagger; numbers count up (700 ms, ease-out, skip when reduced motion); charts draw in; hover lift; tab/sub-view crossfade; pipeline connector pulse; stage-track marker slide (1.2 s power3.inOut-like easing). All animation through framer-motion or CSS transforms/opacity only (GPU friendly). Honour `prefers-reduced-motion` AND an in-app "Reduce animations" toggle in the Style switch menu (stored in localStorage). No animation may run while the tab is hidden. Target: dashboard first paint under 1 s on an ordinary shop PC; no layout shift.

=====================================================================
STEP 6: RESPONSIVE
=====================================================================
Must look right at 1920 px, 1366 px laptop, 768 px tablet and 390 px phone (the owner will open it remotely from a phone through the ngrok link). On phones: single column, bottom pill nav stays thumb-reachable, sub-views scroll, tables become cards, charts shrink without clipping, touch targets at least 44 px.

=====================================================================
STEP 7: TESTS (add to scripts/verify-all.mjs and backend/test/*; cumulative; keep ALL earlier assertions PASS)
=====================================================================
 A75 GET /api/dashboard/overview without login -> 401; with login -> 200 and the documented shape.
 A76 On seeded FAKE data the numbers equal independent SQL counts/sums: today's sales amount + phones sold, profit, stock count/value, customers, sellers, series totals, brand counts, recent invoices.
 A77 Time boundaries: rows at 23:59 IST and 00:01 IST land on the right day; week/month/year and financial-year (April-March) boundaries are correct.
 A78 Soft-deleted phones, returned sales and purchase-returned phones are excluded as defined; sold-then-returned does not count as a sale.
 A79 Empty database -> 200 with zeros and empty arrays (no NaN, no null numbers, no error).
 A80 Payload contains no private fields (no imei, aadhaar, id_number, address, bank, token keys; scan the JSON keys and values), and for a non-admin role the admin-only fields are absent.
 A81 Remote rules still hold: remote OFF -> 403 for remote requests; remote ON -> logged-in remote users can read the dashboard (it is read-only and non-sensitive after A80).
 A82 Performance: 10,000 fake phones + 5,000 sales -> overview under 300 ms warm and under 1.5 s cold on the test machine; report the measured times.
 A83 Frontend: `npx tsc --noEmit -p tsconfig.app.json` and `npm run build` exit 0; report the gzip size delta of the main bundle and of the lazy Dashboard chunk (budget: Dashboard chunk + framer-motion under 250 KB gzip); `dist/` contains no http(s) font/CDN/image URLs.
 A84 Existing /api/dashboard route and AccountingTab figures unchanged (the existing R06 assertion still passes).
 A85 Repairs widgets: with the Repairs module present, pipeline counts per stage equal repair_jobs counts; without it the endpoint reports repairs.available=false and the UI shows the empty state (test both).
 MANUAL / BROWSER (use your built-in browser, save screenshots to docs/ai/dashboard-screens/): Glass desktop, Glass mobile (390 px), Dark Teal dark, Dark Teal light, pipeline with demo jobs, stage track animation start/end frame, empty state, error state (stop the backend), role-limited view. Compare each against the reference images and list differences you could not match. Verify the style choice survives Ctrl+F5, that old tabs look unchanged, and that the browser console has no errors. If you cannot run a browser, mark NOT RUN and give the owner the exact click checklist.
Update SEED-DEMO (scripts/seed-demo.mjs) so the demo data produces an interesting dashboard (30 days of fake sales across 5 brands, aged stock, 2 unread messages, and repair jobs in several stages when Stage 2 exists).

=====================================================================
BUILD ORDER (tick each in TODO.md)
=====================================================================
1 inspect + spec + todo + snapshot | 2 backend service + endpoint + A75-A80 | 3 data hook + shell + style switch + tokens | 4 stat cards + greeting | 5 Glass layout + pill nav | 6 sales chart + brand donut + stock aging | 7 recent invoices + alerts + quick actions + search | 8 Dark Teal shell + light mode | 9 repair pipeline + stage track (after Stage 2 if missing) | 10 animations + reduced motion | 11 responsive pass | 12 perf test + bundle check + screenshots | 13 final verify, docs, report.
If you run short of time, finish the GLASS style completely first, then Dark Teal.

=====================================================================
REPORT.md FORMAT (write at the end; also REPORT-dashboard.md)
=====================================================================
0 Summary (max 8 lines) | 1 Files created/changed table [path | new/edited | reason | lines +/-] | 2 Assertions A75-A85 + all earlier [PASS/FAIL/NOT RUN | command | evidence] | 3 Raw evidence (command, exit code, last 40 lines) | 4 sha256 of dashboardService.js, routes/index.js, package.json | 5 NOT VERIFIED / limitations (e.g. visual match with the references, EXE not rebuilt) | 6 NEEDS DECISION | 7 New risks | 8 Owner's click-by-click checklist (restart with the .bat or the EXE, Ctrl+F5, open Dashboard, switch styles, check numbers against Sold/Inventory).
FINAL CHAT MESSAGE (Hinglish): what was done, files created, files changed, how to restart (.bat or rebuild the EXE with BUILD-EXE.bat), what is still in TODO. Then tell the owner to send REPORT.md, VERIFY_OUTPUT.txt and the newest zip (MAKE-ZIP.bat) for review.

BEGIN NOW with RULE 0 and STEP 0.
```
