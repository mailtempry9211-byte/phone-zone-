-- Migration 009 - Session tokens are now stored hashed (sha256).
--
-- Why: `sessions.id` used to hold the RAW session token. Anyone who could read
-- the SQLite file (a copied backup, a shared folder, a stolen laptop) could
-- replay that value as a valid login without ever knowing the password.
-- authService now stores sha256(token) and hashes the incoming cookie/Bearer
-- value before lookup, so the stored value is no longer usable as a credential.
--
-- Effect on existing installs: every session created before this migration
-- becomes invalid (its stored id is a raw token, which can never match a hash),
-- so all users must sign in again once. No business data is touched.

DELETE FROM sessions;

-- No down migration: restoring raw tokens would re-open the hole.
