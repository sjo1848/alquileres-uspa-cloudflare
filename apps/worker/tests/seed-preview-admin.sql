-- Apply only to the isolated synthetic Cloudflare Preview D1 after protected merge.
-- The Preview password login is disabled; this synthetic hash placeholder is never used.
INSERT OR IGNORE INTO users(id,email,password_hash,role,created_at,updated_at)
VALUES('synthetic-catalog-admin','preview.admin@example.test','not-used','ADMIN','2026-10-18T00:00:00.000Z','2026-10-18T00:00:00.000Z');
