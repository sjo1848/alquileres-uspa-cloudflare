INSERT OR REPLACE INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at)
VALUES
  ('synthetic-catalog-owner','preview.owner@example.test','local-test-only','OWNER',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  ('synthetic-catalog-admin','preview.admin@example.test','local-test-only','ADMIN',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
