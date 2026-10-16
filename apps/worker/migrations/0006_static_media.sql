-- Operator-managed synthetic/public media only; no OWNER upload capability.
CREATE TABLE static_listing_images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  asset_path TEXT NOT NULL CHECK(asset_path GLOB '/media/catalog/*' AND instr(asset_path,'..')=0 AND instr(asset_path,'?')=0 AND instr(asset_path,'#')=0),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/svg+xml','image/webp','image/png','image/jpeg')),
  byte_size INTEGER NOT NULL CHECK(byte_size>0),
  position INTEGER NOT NULL CHECK(position>=0),
  UNIQUE(listing_id,position)
);
