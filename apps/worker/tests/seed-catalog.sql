PRAGMA foreign_keys=ON;
INSERT OR IGNORE INTO users(id,email,password_hash,role,created_at,updated_at)
VALUES('synthetic-catalog-owner','preview.owner@example.test','not-used','OWNER','2026-10-16T00:00:00.000Z','2026-10-16T00:00:00.000Z');
INSERT OR IGNORE INTO users(id,email,password_hash,role,created_at,updated_at)
VALUES('synthetic-catalog-admin','preview.admin@example.test','not-used','ADMIN','2026-10-16T00:00:00.000Z','2026-10-16T00:00:00.000Z');
INSERT OR IGNORE INTO listings(
  id,owner_id,status,title,description,location,price_amount,price_period,
  rental_duration,max_occupants,currency,publication_status,availability_status,
  last_confirmed_at,created_at,updated_at
) VALUES
('synthetic-casa-rio','synthetic-catalog-owner','APPROVED','Casa junto al arroyo',
 'Casa luminosa para una estadía tranquila en Uspallata. Datos de muestra sintéticos.',
 'Uspallata, Mendoza',45000,'WEEK','WEEKS',4,'ARS','PUBLISHED','AVAILABLE',
 '2026-10-15T12:00:00.000Z','2026-10-15T12:00:00.000Z','2026-10-15T12:00:00.000Z'),
('synthetic-cabana-cerro','synthetic-catalog-owner','APPROVED','Cabaña del cerro',
 'Cabaña de muestra para probar la ficha de propiedad y los filtros.',
 'Uspallata, Mendoza',98000,'MONTH','MONTHS',3,'ARS','PUBLISHED','UNAVAILABLE',
 '2026-08-01T12:00:00.000Z','2026-10-14T12:00:00.000Z','2026-10-14T12:00:00.000Z');

UPDATE listings SET location_search=LOWER(location) WHERE id LIKE 'synthetic-%';
INSERT OR REPLACE INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES('synthetic-image-0','synthetic-casa-rio','/media/catalog/casa-rio.svg','image/svg+xml',1236,0);
INSERT OR REPLACE INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES('synthetic-image-1','synthetic-cabana-cerro','/media/catalog/cabana-cerro.svg','image/svg+xml',1233,0);

-- Synthetic OWNER login; password: synthetic-owner-password-1 (bcrypt cost 12).
UPDATE users SET password_hash='$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS' WHERE id='synthetic-catalog-owner';
UPDATE users SET password_hash='$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS' WHERE id='synthetic-catalog-admin';
