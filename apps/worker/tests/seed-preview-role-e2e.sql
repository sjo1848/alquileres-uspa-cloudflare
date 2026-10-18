-- Local-only Playwright adapter accounts; never apply this fixture to remote D1.
INSERT OR IGNORE INTO users(id,email,password_hash,role,created_at,updated_at)
VALUES('synthetic-catalog-admin','preview.admin@example.test','$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS','ADMIN','2026-10-18T00:00:00.000Z','2026-10-18T00:00:00.000Z');
