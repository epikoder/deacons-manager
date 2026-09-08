DROP FUNCTION IF EXISTS public.delete_user(uuid);

DROP FUNCTION IF EXISTS public.create_user(text, text, text, text, text);

DROP FUNCTION IF EXISTS auth.create_user(text, text, text, text, text);

-- Restore the original (broken) signature so the chain is reversible.
CREATE FUNCTION auth.create_user(fullname text, email text, password text)
  RETURNS uuid
  AS $$
DECLARE
  new_user_id uuid;
BEGIN
  INSERT INTO auth.users(fullname, email, password, role)
    VALUES ($1, $2, $3, 'authenticated')
  RETURNING
    id INTO new_user_id;
  RETURN new_user_id;
END;
$$
LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION auth.create_user(text, text, text) TO "admin";
