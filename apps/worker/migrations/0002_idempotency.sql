CREATE TABLE idempotency_records (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  request_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('PENDING','COMMITTED','NEEDS_REPAIR')),
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id, scope, request_key)
);

ALTER TABLE image_operations ADD COLUMN image_id TEXT;
CREATE INDEX image_operations_image_idx ON image_operations(listing_id, image_id, kind, created_at);
