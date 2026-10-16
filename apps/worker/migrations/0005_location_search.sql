-- Existing lab fixtures are ASCII. New application writes normalize NFC + Unicode lowercase.
ALTER TABLE listings ADD COLUMN location_search TEXT NOT NULL DEFAULT '';
UPDATE listings SET location_search=LOWER(location);
