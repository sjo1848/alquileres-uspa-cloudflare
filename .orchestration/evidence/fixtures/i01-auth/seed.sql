PRAGMA foreign_keys = ON;
DELETE FROM listings;
DELETE FROM users;
INSERT INTO users(id,email,password_hash,role) VALUES
 ('owner-a','owner.a@example.test','$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS','OWNER'),
 ('owner-b','owner.b@example.test','$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS','OWNER'),
 ('admin-a','admin@example.test','$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS','ADMIN');
INSERT INTO listings(id,owner_id,title) VALUES
 ('listing-a','owner-a','Synthetic A'), ('listing-b','owner-b','Synthetic B');
