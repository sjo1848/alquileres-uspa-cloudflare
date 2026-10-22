PRAGMA foreign_keys=ON;
DELETE FROM image_operations;
DELETE FROM idempotency_records;
DELETE FROM admin_audit_events;
DELETE FROM contact_events;
DELETE FROM listing_images;
DELETE FROM static_listing_images;
DELETE FROM listings;
DELETE FROM auth_action_tokens;
DELETE FROM auth_rate_limits;
DELETE FROM users;
INSERT INTO users(id,email,password_hash,role,created_at,updated_at,email_verified_at) VALUES
('owner-a','owner.a@example.test','$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS','OWNER',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('owner-b','owner.b@example.test','$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS','OWNER',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('admin-a','admin@example.test','$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS','ADMIN',strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
INSERT INTO listings(id,owner_id,status,title,description,location,location_search,price_amount,price_period,rental_duration,max_occupants,currency,publication_status,availability_status,last_confirmed_at,rejection_reason,created_at,updated_at)
VALUES('owner-approved-photo','owner-a','APPROVED','Casa aprobada con fotos','Una casa sintética en Uspallata para la regresión de fotos OWNER.','Uspallata, Mendoza','uspallata mendoza',48000,'WEEK','WEEKS',4,'ARS','PUBLISHED','AVAILABLE',strftime('%Y-%m-%dT%H:%M:%fZ','now'),NULL,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
INSERT INTO listing_images(id,listing_id,object_key,original_name,mime_type,byte_size,position,created_at,updated_at,blob_data)
VALUES('owner-approved-photo-image','owner-approved-photo','d1blob:owner-approved-photo-image','foto aprobada.png','image/png',124,0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'),X'89504e470d0a1a0a0000000d4948445200000030000000300802000000d8606ed00000004349444154789cedce310d00201000b117c68c7f0b38c105c7d0a4023a67afaf4c3e10121212aa0742424242f540484848a81e08090909d503212121a17a202424f4d805e1e97bb53858e8640000000049454e44ae426082');
INSERT INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position)
VALUES('owner-approved-photo-static','owner-approved-photo','/media/catalog/cabana-cerro.svg','image/svg+xml',123,0);
