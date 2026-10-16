ALTER TABLE image_reorder_operations ADD COLUMN listing_id TEXT REFERENCES listings(id) ON DELETE CASCADE;
ALTER TABLE image_reorder_operations ADD COLUMN retryable INTEGER NOT NULL DEFAULT 1 CHECK(retryable IN (0, 1));
