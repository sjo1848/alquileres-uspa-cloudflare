CREATE TABLE admin_audit_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id),
  listing_id TEXT NOT NULL,
  target_owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK(action IN ('LISTING_APPROVED','LISTING_PUBLISHED','LISTING_REJECTED')),
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX admin_audit_events_listing_idx
  ON admin_audit_events(listing_id, created_at DESC);

CREATE INDEX admin_audit_events_recent_idx
  ON admin_audit_events(created_at DESC, id DESC);
