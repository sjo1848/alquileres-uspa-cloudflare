-- Unicode normalization is performed by the Worker, including pre-existing rows.
ALTER TABLE listings ADD COLUMN location_search TEXT NOT NULL DEFAULT '';
CREATE INDEX listings_location_search_idx ON listings(location_search);
