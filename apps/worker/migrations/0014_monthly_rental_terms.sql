-- Optional owner-declared rental conditions. Existing listings stay NULL and
-- are presented as "No informado"; no historical value is inferred.
ALTER TABLE listings ADD COLUMN deposit_status TEXT
  CHECK (deposit_status IS NULL OR deposit_status IN ('NOT_INFORMED','ASK_OWNER','NOT_REQUIRED','FIXED_AMOUNT'));
ALTER TABLE listings ADD COLUMN deposit_amount INTEGER
  CHECK (deposit_amount IS NULL OR deposit_amount BETWEEN 1 AND 2147483647);
ALTER TABLE listings ADD COLUMN deposit_currency TEXT
  CHECK (deposit_currency IS NULL OR deposit_currency IN ('ARS','USD'));
ALTER TABLE listings ADD COLUMN internet_included TEXT
  CHECK (internet_included IS NULL OR internet_included IN ('INCLUDED','NOT_INCLUDED','NOT_INFORMED'));
ALTER TABLE listings ADD COLUMN water_included TEXT
  CHECK (water_included IS NULL OR water_included IN ('INCLUDED','NOT_INCLUDED','NOT_INFORMED'));
ALTER TABLE listings ADD COLUMN electricity_included TEXT
  CHECK (electricity_included IS NULL OR electricity_included IN ('INCLUDED','NOT_INCLUDED','NOT_INFORMED'));
ALTER TABLE listings ADD COLUMN gas_included TEXT
  CHECK (gas_included IS NULL OR gas_included IN ('INCLUDED','NOT_INCLUDED','NOT_INFORMED'));
ALTER TABLE listings ADD COLUMN pets_policy TEXT
  CHECK (pets_policy IS NULL OR pets_policy IN ('ALLOWED','NOT_ALLOWED','ASK_OWNER','NOT_INFORMED'));
ALTER TABLE listings ADD COLUMN available_from TEXT
  CHECK (available_from IS NULL OR (length(available_from)=10 AND available_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'));

-- An amount is only valid as an explicitly declared fixed amount, with currency.
-- Other deposit states cannot accidentally carry an amount.
CREATE TRIGGER listings_validate_rental_terms_insert
BEFORE INSERT ON listings
WHEN NOT (
  (NEW.deposit_status='FIXED_AMOUNT' AND NEW.deposit_amount IS NOT NULL AND NEW.deposit_currency IS NOT NULL)
  OR ((NEW.deposit_status IS NULL OR NEW.deposit_status!='FIXED_AMOUNT') AND NEW.deposit_amount IS NULL AND NEW.deposit_currency IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'invalid deposit declaration');
END;

CREATE TRIGGER listings_validate_rental_terms_update
BEFORE UPDATE OF deposit_status,deposit_amount,deposit_currency ON listings
WHEN NOT (
  (NEW.deposit_status='FIXED_AMOUNT' AND NEW.deposit_amount IS NOT NULL AND NEW.deposit_currency IS NOT NULL)
  OR ((NEW.deposit_status IS NULL OR NEW.deposit_status!='FIXED_AMOUNT') AND NEW.deposit_amount IS NULL AND NEW.deposit_currency IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'invalid deposit declaration');
END;
