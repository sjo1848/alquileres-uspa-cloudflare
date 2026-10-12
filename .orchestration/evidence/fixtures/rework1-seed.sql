DELETE FROM listing_images;
DELETE FROM listings;
DELETE FROM users;
INSERT OR REPLACE INTO users(id,email,role) VALUES
 ('owner-1','owner@example.test','OWNER'),
 ('owner-2','other@example.test','OWNER'),
 ('admin-1','admin@example.test','ADMIN');
INSERT OR REPLACE INTO listings(id,owner_id,status,published,legacy_price_per_night,legacy_max_guests,price_amount,last_confirmed_at)
VALUES ('listing-1','owner-1','DRAFT',0,12000,4,NULL,NULL), ('listing-2','owner-2','DRAFT',0,15000,2,NULL,NULL);
