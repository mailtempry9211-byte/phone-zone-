# PhoneZone: Security Status (docs/ai/SECURITY_STATUS.md)

| ID | Issue | Status | Evidence / Mitigation |
|---|---|---|---|
| S1 | Anonymous private-file access | FIXED | `GET /pg/storage/object/:bucket/*` requires auth (A12) |
| S2 | Public `/api/config` leak | FIXED | Sanitized public settings (A11) |
| S3 | Compat SQL injection & delete guard | FIXED | Strict column whitelist, table whitelist, empty filter blocked (A08, A09, A38-A43) |
| S4 | Setup takeover | FIXED | Loopback-only, rate-limited, blocked if `X-Forwarded-For` present (A14) |
| S5 | Bootstrap admin secret | FIXED | First admin created only via setup wizard (A05) |
| S6 | Supabase storage bucket exposure | ACCEPTED/OFFLINE | Offline-first mode operates on local SQLite; anon keys disabled in offline app |
| S7 | Upload file MIME spoofing | FIXED | Magic byte verification, no HTML/JS, `X-Content-Type-Options: nosniff` (A13) |
| S8 | Login rate limit & hashed sessions | FIXED | 10 attempts limit, 429 response, SHA-256 hashed sessions in DB (A06, migration 009) |
| S9 | Backup/Restore integrity & rollback | IN PROGRESS (Stage 3A) | Replacing external tar with npm `tar`, sha256 manifest, atomic swap |
| S10 | Plaintext Aadhaar & unencrypted data | IN PROGRESS (Stage 5) | Masking last 4 digits in UI/print, safe storage of sensitive keys |
| S11 | Missing security headers & spam | FIXED | Helmet enabled, rate limiting applied (A13, R04) |
| S12 | Cross-shop data leakage | IN PROGRESS (Stage 3B) | Shop-scoping middleware and query constraints |

