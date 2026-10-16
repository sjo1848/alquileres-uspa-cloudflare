ALTER TABLE image_operations ADD COLUMN result_json TEXT;
ALTER TABLE image_operations ADD COLUMN cleanup_complete INTEGER NOT NULL DEFAULT 0 CHECK(cleanup_complete IN (0, 1));

CREATE TABLE image_reorder_operations (
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL,
  request_key TEXT NOT NULL,
  request_fingerprint TEXT NOT NULL,
  result_json TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('PENDING','COMMITTED','NEEDS_REPAIR')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(owner_id, scope, request_key)
);
