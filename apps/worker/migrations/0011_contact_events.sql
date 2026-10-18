CREATE TABLE contact_events (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL CHECK(length(visitor_name) BETWEEN 1 AND 120),
  visitor_email TEXT NOT NULL CHECK(length(visitor_email) BETWEEN 3 AND 254),
  message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 2000),
  state TEXT NOT NULL DEFAULT 'UNREAD' CHECK(state IN ('UNREAD','READ')),
  created_at TEXT NOT NULL
);
CREATE INDEX contact_events_listing_id_created_at_idx ON contact_events(listing_id,created_at DESC,id DESC);
CREATE INDEX contact_events_owner_id_created_at_idx ON contact_events(owner_id,created_at DESC,id DESC);
