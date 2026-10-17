-- Preserve the source AdminAuditLog shape while retaining listing-specific fields
-- used by the current moderation UI. Existing synthetic audit rows are migrated.
CREATE TABLE admin_audit_events_v2 (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  listing_id TEXT,
  target_owner_id TEXT REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  metadata TEXT NOT NULL CHECK(json_valid(metadata)),
  reason TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO admin_audit_events_v2(id,actor_id,action,entity_type,entity_id,listing_id,target_owner_id,metadata,reason,created_at)
SELECT id,actor_id,action,'LISTING',listing_id,listing_id,target_owner_id,json_object('reason',reason),reason,created_at
FROM admin_audit_events;

DROP TABLE admin_audit_events;
ALTER TABLE admin_audit_events_v2 RENAME TO admin_audit_events;

CREATE INDEX admin_audit_events_actor_idx ON admin_audit_events(actor_id,created_at DESC);
CREATE INDEX admin_audit_events_listing_idx ON admin_audit_events(listing_id,created_at DESC);
CREATE INDEX admin_audit_events_target_owner_idx ON admin_audit_events(target_owner_id,created_at DESC);
CREATE INDEX admin_audit_events_recent_idx ON admin_audit_events(created_at DESC,id DESC);

-- Only rows needing moderation/publication occupy this index.
CREATE INDEX listings_admin_review_queue_created_idx
  ON listings(created_at DESC,id DESC)
  WHERE status='SUBMITTED' OR (status='APPROVED' AND publication_status='UNPUBLISHED');
