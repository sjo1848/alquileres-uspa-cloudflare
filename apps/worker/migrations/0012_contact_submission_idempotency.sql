ALTER TABLE contact_events ADD COLUMN submission_key TEXT;
ALTER TABLE contact_events ADD COLUMN submission_fingerprint TEXT;
CREATE UNIQUE INDEX contact_events_listing_submission_key_idx
  ON contact_events(listing_id,submission_key);
