PRAGMA foreign_keys = ON;
DROP TABLE IF EXISTS listing_images;
DROP TABLE IF EXISTS listings;
DROP TABLE IF EXISTS users;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN'))
);
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('DRAFT','REJECTED','APPROVED')),
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0,1)),
  legacy_price_per_night INTEGER,
  legacy_max_guests INTEGER,
  price_amount INTEGER,
  last_confirmed_at TEXT
);
CREATE TABLE IF NOT EXISTS listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  position INTEGER NOT NULL,
  UNIQUE(listing_id, position)
);
