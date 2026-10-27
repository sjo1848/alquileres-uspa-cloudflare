PRAGMA foreign_keys=ON;
INSERT OR IGNORE INTO users(id,email,password_hash,role,created_at,updated_at)
VALUES('synthetic-catalog-owner','preview.owner@example.test','not-used','OWNER','2026-10-16T00:00:00.000Z','2026-10-16T00:00:00.000Z');
INSERT OR IGNORE INTO users(id,email,password_hash,role,created_at,updated_at)
VALUES('synthetic-catalog-admin','preview.admin@example.test','not-used','ADMIN','2026-10-16T00:00:00.000Z','2026-10-16T00:00:00.000Z');
-- Reset only this seed's synthetic public records for repeatable local browser journeys.
DELETE FROM contact_events WHERE owner_id='synthetic-catalog-owner';
DELETE FROM idempotency_records WHERE owner_id='synthetic-catalog-owner';
DELETE FROM static_listing_images WHERE listing_id IN ('synthetic-casa-rio','synthetic-cabana-cerro','synthetic-catalog-02','synthetic-catalog-03','synthetic-catalog-04','synthetic-catalog-05','synthetic-catalog-06','synthetic-catalog-07');
DELETE FROM listings WHERE owner_id='synthetic-catalog-owner';
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
 '2026-08-01T12:00:00.000Z','2026-10-14T12:00:00.000Z','2026-10-14T12:00:00.000Z'),
('synthetic-catalog-02','synthetic-catalog-owner','APPROVED','Casa de la Ladera',
 'Casa sintética de muestra, rodeada por el paisaje del valle.',
 'Uspallata, Mendoza',72000,'WEEK','WEEKS',2,'ARS','PUBLISHED','AVAILABLE',
 '2026-10-17T12:00:00.000Z','2026-10-13T12:00:00.000Z','2026-10-13T12:00:00.000Z'),
('synthetic-catalog-03','synthetic-catalog-owner','APPROVED','Cabaña del Valle Alto',
 'Alojamiento sintético para comparar estadías mensuales.',
 'Uspallata, Mendoza',580,'MONTH','MONTHS',5,'USD','PUBLISHED','AVAILABLE',
 '2026-08-01T12:00:00.000Z','2026-10-12T12:00:00.000Z','2026-10-12T12:00:00.000Z'),
('synthetic-catalog-04','synthetic-catalog-owner','APPROVED','Refugio de Muestra',
 'Publicación sintética con información de precio pendiente de confirmar.',
 'Uspallata, Mendoza',45000,NULL,NULL,NULL,'ARS','PUBLISHED','UNAVAILABLE',
 NULL,'2026-10-11T12:00:00.000Z','2026-10-11T12:00:00.000Z'),
('synthetic-catalog-05','synthetic-catalog-owner','APPROVED','Casa del Río Quieto',
 'Casa sintética de muestra con capacidad para grupos.',
 -- M1 regression: price frequency and rental duration are independent declarations.
 'Uspallata, Mendoza',135000,'MONTH','PERMANENT',6,'ARS','PUBLISHED','AVAILABLE',
 '2026-10-16T12:00:00.000Z','2026-10-10T12:00:00.000Z','2026-10-10T12:00:00.000Z'),
('synthetic-catalog-06','synthetic-catalog-owner','APPROVED','Casita de Muestra',
 'Alojamiento sintético con último registro de disponibilidad antiguo.',
 'Uspallata, Mendoza',39000,'WEEK','WEEKS',2,'ARS','PUBLISHED','UNAVAILABLE',
 '2026-08-12T12:00:00.000Z','2026-10-09T12:00:00.000Z','2026-10-09T12:00:00.000Z'),
('synthetic-catalog-07','synthetic-catalog-owner','APPROVED','Cabaña Viento Andino',
 'Publicación sintética sin fecha reciente de confirmación.',
 'Uspallata, Mendoza',660,'MONTH','FLEXIBLE',4,'USD','PUBLISHED','AVAILABLE',
 NULL,'2026-10-08T12:00:00.000Z','2026-10-08T12:00:00.000Z');

UPDATE listings SET location_search=LOWER(location) WHERE id LIKE 'synthetic-%';
-- Synthetic-only WebP photography used by the local I06.4 public journey.
INSERT OR REPLACE INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES('synthetic-image-0','synthetic-casa-rio','/media/catalog/valle-sintetico.webp','image/webp',237790,0);
INSERT OR REPLACE INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES('synthetic-image-1','synthetic-cabana-cerro','/media/catalog/cabana-sintetica.webp','image/webp',175324,0);
INSERT OR REPLACE INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES('synthetic-image-2','synthetic-catalog-02','/media/catalog/cabana-sintetica.webp','image/webp',175324,0);
INSERT OR REPLACE INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES('synthetic-image-3','synthetic-catalog-03','/media/catalog/valle-sintetico.webp','image/webp',237790,0);
INSERT OR REPLACE INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES('synthetic-image-4','synthetic-catalog-04','/media/catalog/cabana-sintetica.webp','image/webp',175324,0);
INSERT OR REPLACE INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES('synthetic-image-5','synthetic-catalog-05','/media/catalog/valle-sintetico.webp','image/webp',237790,0);
INSERT OR REPLACE INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES('synthetic-image-6','synthetic-catalog-06','/media/catalog/cabana-sintetica.webp','image/webp',175324,0);
INSERT OR REPLACE INTO static_listing_images(id,listing_id,asset_path,mime_type,byte_size,position) VALUES('synthetic-image-7','synthetic-catalog-07','/media/catalog/valle-sintetico.webp','image/webp',237790,0);

-- Synthetic OWNER login; password: synthetic-owner-password-1 (bcrypt cost 12).
UPDATE users SET password_hash='$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS' WHERE id='synthetic-catalog-owner';
UPDATE users SET password_hash='$2b$12$0YkafzqqdCLg0biWLYYHYO2Q7zMyTxGv/dh50357J.0Nrmt8iBRTS' WHERE id='synthetic-catalog-admin';
