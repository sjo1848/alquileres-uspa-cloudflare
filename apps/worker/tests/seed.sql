PRAGMA foreign_keys=ON;
DROP TRIGGER IF EXISTS fail_image_insert;
DROP TRIGGER IF EXISTS fail_image_delete;
DROP TRIGGER IF EXISTS fail_restore_delete;
DELETE FROM image_operations; DELETE FROM listing_images; DELETE FROM listings; DELETE FROM users;
INSERT INTO users(id,email,password_hash,role,created_at,updated_at) VALUES
('owner-a','owner.a@example.test','$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS','OWNER','2026-10-12T00:00:00.000Z','2026-10-12T00:00:00.000Z'),
('owner-b','owner.b@example.test','$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS','OWNER','2026-10-12T00:00:00.000Z','2026-10-12T00:00:00.000Z'),
('admin-a','admin@example.test','$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS','ADMIN','2026-10-12T00:00:00.000Z','2026-10-12T00:00:00.000Z');
