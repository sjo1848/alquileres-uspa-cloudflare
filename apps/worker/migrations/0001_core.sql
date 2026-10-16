PRAGMA foreign_keys = ON;
CREATE TABLE users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('OWNER','ADMIN')), created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE listings (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SUBMITTED','REJECTED','APPROVED')),
  title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', location TEXT NOT NULL,
  price_amount INTEGER, price_period TEXT CHECK(price_period IN ('WEEK','MONTH') OR price_period IS NULL),
  rental_duration TEXT CHECK(rental_duration IN ('WEEKS','MONTHS','PERMANENT','FLEXIBLE') OR rental_duration IS NULL),
  max_occupants INTEGER, currency TEXT CHECK(currency IN ('ARS','USD') OR currency IS NULL),
  publication_status TEXT NOT NULL DEFAULT 'UNPUBLISHED' CHECK(publication_status IN ('UNPUBLISHED','PUBLISHED')),
  availability_status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK(availability_status IN ('AVAILABLE','UNAVAILABLE')),
  last_confirmed_at TEXT, rejection_reason TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX listings_owner_status_idx ON listings(owner_id,status);
CREATE INDEX listings_publication_availability_idx ON listings(publication_status,availability_status,last_confirmed_at);
CREATE TABLE listing_images (
  id TEXT PRIMARY KEY, listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE, original_name TEXT NOT NULL, mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size > 0), position INTEGER NOT NULL CHECK(position >= 0),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(listing_id, position)
);
CREATE TABLE listing_locks(listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE, token TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE image_operations(
  id TEXT PRIMARY KEY, listing_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('ADD','DELETE')),
  state TEXT NOT NULL CHECK(state IN ('PENDING','COMMITTED','CLEANED','COMPENSATED','NEEDS_REPAIR','CLEANUP_PENDING')),
  object_key TEXT NOT NULL, backup_key TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
