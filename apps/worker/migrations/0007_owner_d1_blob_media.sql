ALTER TABLE listing_images ADD COLUMN blob_data BLOB;

CREATE TABLE media_storage_usage (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  used_bytes INTEGER NOT NULL CHECK (used_bytes >= 0 AND used_bytes <= 250000000)
);
INSERT INTO media_storage_usage (id, used_bytes) VALUES (1, 0);

CREATE TRIGGER listing_blob_validate_insert
BEFORE INSERT ON listing_images
WHEN NEW.blob_data IS NOT NULL
BEGIN
  SELECT CASE
    WHEN typeof(NEW.blob_data) != 'blob'
      OR length(NEW.blob_data) != NEW.byte_size
      OR NEW.byte_size > 1800000
    THEN RAISE(ABORT, 'invalid d1 media blob')
  END;
  SELECT CASE
    WHEN (SELECT used_bytes FROM media_storage_usage WHERE id = 1) + NEW.byte_size > 250000000
    THEN RAISE(ABORT, 'd1 media quota exceeded')
  END;
END;

CREATE TRIGGER listing_blob_account_insert
AFTER INSERT ON listing_images
WHEN NEW.blob_data IS NOT NULL
BEGIN
  UPDATE media_storage_usage SET used_bytes = used_bytes + NEW.byte_size WHERE id = 1;
END;

CREATE TRIGGER listing_blob_validate_update
BEFORE UPDATE OF blob_data, byte_size ON listing_images
WHEN OLD.blob_data IS NOT NEW.blob_data OR OLD.byte_size != NEW.byte_size
BEGIN
  SELECT CASE
    WHEN NEW.blob_data IS NOT NULL AND (
      typeof(NEW.blob_data) != 'blob'
      OR length(NEW.blob_data) != NEW.byte_size
      OR NEW.byte_size > 1800000
    )
    THEN RAISE(ABORT, 'invalid d1 media blob')
  END;
  SELECT CASE
    WHEN NEW.blob_data IS NOT NULL
      AND (SELECT used_bytes - CASE WHEN OLD.blob_data IS NOT NULL THEN OLD.byte_size ELSE 0 END
           FROM media_storage_usage WHERE id = 1) + NEW.byte_size > 250000000
    THEN RAISE(ABORT, 'd1 media quota exceeded')
  END;
END;

CREATE TRIGGER listing_blob_account_update
AFTER UPDATE OF blob_data, byte_size ON listing_images
WHEN OLD.blob_data IS NOT NEW.blob_data OR OLD.byte_size != NEW.byte_size
BEGIN
  UPDATE media_storage_usage
  SET used_bytes = used_bytes
    - CASE WHEN OLD.blob_data IS NOT NULL THEN OLD.byte_size ELSE 0 END
    + CASE WHEN NEW.blob_data IS NOT NULL THEN NEW.byte_size ELSE 0 END
  WHERE id = 1;
END;

CREATE TRIGGER listing_blob_account_delete
AFTER DELETE ON listing_images
WHEN OLD.blob_data IS NOT NULL
BEGIN
  UPDATE media_storage_usage SET used_bytes = used_bytes - OLD.byte_size WHERE id = 1;
END;
