# PhoneZone: Task Registry & Tracking (docs/ai/TODO.md)

## Phase 0: Baseline & Memory
- [x] T-000: Establish baseline verify run (A01-A20, A38-A43, R01-R06). Proof: 36 passed.
- [x] T-001: Create permanent context files in `docs/ai/`.

## Stage 3A: Core Packaging, Safety & Backups
- [x] T-010: Implement `GET /runtime-config.js` and CSP settings (A47).
- [x] T-011: Forged file path returns 404 (A56).
- [x] T-012: In-process backup/restore via `tar` package with integrity checks and rollback (A51, A60).
- [x] T-013: Business profile editable with historical invoice snapshots (A52).
- [x] T-014: Multi-company data directory switcher (A53).
- [x] T-015: Remote safety guard, trust proxy loopback, remote login limits (A44, A45, A46, A50, A59).
- [x] T-016: Embedded ngrok manager structure with fake SDK adapter for test environment (A48, A49).

## Stage 2: Repairs Module (Private)
- [x] T-020: Database migration for repairs tables, indexes, triggers (A21).
- [x] T-021: Backend services (`repairCustomerService`, `repairJobService`, `/api/repair/*`) with Luhn checks (A22, A23, A24, A25, A26).
- [x] T-022: Ensure private repair data is never exposed in public routes (A27).
- [x] T-023: Admin UI: Repairs tab, customer picker, AddRepairDialog, RepairDetailDialog.
- [x] T-024: A4 Job sheet and repair invoice HTML templates with strict escaping (A28).
- [x] T-025: Cross-check by phone number (A61) and IMEI match with motherboard warning (A62).
- [x] T-026: Seed demo repair data in `scripts/seed-demo.mjs`.

## Stage 3B: Multi-Shop, Tailscale & Minimal Public Server
- [x] T-030: User shop isolation migration and query scoping (A31, A63).
- [x] T-031: Collision-free multi-shop invoice and job numbering (A64).
- [x] T-032: Minimal public server on port 47714 exposing only catalog (A32).
- [x] T-033: Tailscale service manager wrapper (A33).

## Stage 4: WhatsApp Marketing
- [x] T-040: WhatsApp database migration (templates, campaigns, queue, tokens) (A34).
- [x] T-041: Server queue with daily cap, business hours, and interval enforcement (A35).
- [x] T-042: Token revocation and security (A36).
- [x] T-043: Marketing tab UI with templates and campaign management.
- [x] T-044: Manifest V3 Chrome extension files in `extension/` (A37).

## Stage 5: Hardening Backlog (H1-H10)
- [x] T-050: Aadhaar number masking (last 4 digits in lists) and audit log on view (A65).
- [x] T-051: Role enforcement (viewer read-only, staff restrictions) (A66).
- [x] T-052: Active session management and session revocation (A67).
- [x] T-053: Security audit and system optimization (A68).

## Stage 6: Final Verification & Web Ready
- [x] T-060: Run full test suite verify-all.mjs with all cumulative assertions green (61/61 PASSED).
- [x] T-061: Verify local web execution (`npm run dev:all` / Express port 47713 + Vite port 8080).
- [x] T-062: Comprehensive documentation and handover for owner browser testing.
