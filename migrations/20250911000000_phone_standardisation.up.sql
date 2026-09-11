-- Canonical phone storage and searchable phone/name columns.
--
-- Numbers arrive in every shape the source sites allow: 08031234567, 8031234567,
-- 2348031234567, +234 803 123 4567, 0803-123-4567. Searching them with ilike '%q%'
-- only ever matches the format the admin happened to guess.
--
-- Canonical form is 0XXXXXXXXXX for Nigeria and E.164 (+...) for anywhere else.

----------------
-- Structural normalisation only: no prefix table, nothing that rots as the NCC issues
-- new ranges. Semantic validation ("is this a real, assigned number") belongs in the
-- application, where libphonenumber can tell a human to fix it.
--
-- Anything this cannot confidently place is returned UNCHANGED. Guessing would turn a
-- malformed number into a plausible wrong one, which is worse than leaving it ugly.
CREATE OR REPLACE FUNCTION public.normalize_phone(p text)
  RETURNS text
  AS $$
DECLARE
  raw text;
  d text;
  intl boolean;
BEGIN
  IF p IS NULL OR btrim(p) = '' THEN
    RETURN p;
  END IF;
  raw := btrim(p);
  intl := left(raw, 1) = '+' OR left(regexp_replace(raw, '\s', '', 'g'), 2) = '00';
  d := regexp_replace(raw, '\D', '', 'g');
  IF d = '' THEN
    RETURN p;
  END IF;
  -- 00 as an international prefix is just + spelled out.
  IF left(d, 2) = '00' THEN
    d := substring(d FROM 3);
    intl := TRUE;
  END IF;
  -- Nigeria, however it was written.
  IF length(d) = 13 AND left(d, 3) = '234' THEN
    RETURN '0' || right(d, 10);
  END IF;
  IF length(d) = 11 AND left(d, 1) = '0' THEN
    RETURN d;
  END IF;
  IF length(d) = 10 AND left(d, 1) IN ('7', '8', '9') THEN
    RETURN '0' || d;
  END IF;
  -- Explicitly international and not Nigerian: keep E.164.
  IF intl THEN
    RETURN '+' || d;
  END IF;
  -- Unrecognised. Leave it exactly as it was.
  RETURN p;
END;
$$
LANGUAGE plpgsql
IMMUTABLE;

CREATE OR REPLACE FUNCTION public.normalize_phone_trigger()
  RETURNS TRIGGER
  AS $$
BEGIN
  NEW.phone := public.normalize_phone(NEW.phone);
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;

-- Every write path - the crawler via Order.update(), the manual entry page, any
-- third-party client - goes through the database, so this is the only place that
-- catches all of them.
CREATE TRIGGER normalize_orders_phone
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_phone_trigger();

CREATE TRIGGER normalize_agents_phone
  BEFORE INSERT OR UPDATE ON public.agents
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_phone_trigger();

CREATE TRIGGER normalize_affiliates_phone
  BEFORE INSERT OR UPDATE ON public.affiliates
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_phone_trigger();

----------------
-- Search support.
--
-- The last ten digits are the same for every way one number can be written, so this
-- matches whatever the admin types: 0906722, 906722, +234906722..., 234906722...
ALTER TABLE public.orders
  ADD COLUMN phone_digits text GENERATED ALWAYS AS (right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)) STORED;

CREATE INDEX orders_phone_digits_idx ON public.orders (phone_digits text_pattern_ops);

-- A surname is a substring of fullname, and ilike '%q%' cannot use a btree index.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX orders_fullname_trgm_idx ON public.orders USING gin (fullname gin_trgm_ops);

GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO authenticated, "admin";
