-- M2.1 #61: private owner-proposed edits. Public catalog continues reading listings.
-- Exactly one mutable revision record per listing; no existing row backfill.
CREATE TABLE listing_change_revisions (
  listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id),
  state TEXT NOT NULL CHECK (state IN ('DRAFT','SUBMITTED','REJECTED','APPROVED','APPLIED')),
  payload TEXT NOT NULL CHECK (json_valid(payload) AND length(payload) BETWEEN 2 AND 12000),
  base_updated_at TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  rejection_reason TEXT CHECK (rejection_reason IS NULL OR length(rejection_reason) BETWEEN 3 AND 1000),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  reviewed_at TEXT,
  applied_at TEXT,
  CHECK ((state='REJECTED') = (rejection_reason IS NOT NULL)),
  CHECK (state!='APPLIED' OR applied_at IS NOT NULL)
);

CREATE INDEX listing_change_revisions_queue ON listing_change_revisions(state,updated_at,listing_id);

-- Keep owner binding immutable, even if a future API makes a mistake.
CREATE TRIGGER listing_change_revisions_insert_owner
BEFORE INSERT ON listing_change_revisions
WHEN NOT EXISTS (
  SELECT 1 FROM listings l WHERE l.id=NEW.listing_id
    AND l.owner_id=NEW.owner_id AND l.status='APPROVED'
)
BEGIN
  SELECT RAISE(ABORT,'revision listing must belong to approved owner');
END;

CREATE TRIGGER listing_change_revisions_update_owner
BEFORE UPDATE ON listing_change_revisions
WHEN OLD.owner_id!=NEW.owner_id OR OLD.listing_id!=NEW.listing_id
  OR NOT EXISTS (
    SELECT 1 FROM listings l WHERE l.id=NEW.listing_id
      AND l.owner_id=NEW.owner_id AND l.status='APPROVED'
  )
BEGIN
  SELECT RAISE(ABORT,'revision listing ownership changed');
END;
