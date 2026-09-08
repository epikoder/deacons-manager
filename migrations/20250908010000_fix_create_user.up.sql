-- Fix auth.create_user().
--
-- The original (20241015022116_auth.up.sql) inserts into a `fullname` column that
-- auth.users does not have, so every call fails with:
--     column "fullname" of relation "users" does not exist
-- It has never worked. Nothing calls it: the two user pages under
-- pages/(authenticated)/users/ are UI stubs with no submit handler, and the function
-- lives in the auth schema, which PostgREST does not expose (PGRST_DB_SCHEMAS=public).
--
-- Two things are needed to make it usable:
--   1. write the name where the client actually reads it - src/utils/auth.ts:makeUser
--      builds its display name from user_raw_meta_data.fname / .lname;
--   2. a public.* wrapper, since an auth.* function is unreachable over the API.

DROP FUNCTION IF EXISTS auth.create_user(text, text, text);

CREATE OR REPLACE FUNCTION auth.create_user(fname text, lname text, email text, password text, role text DEFAULT 'authenticated')
  RETURNS uuid
  AS $$
DECLARE
  new_user_id uuid;
  _fname alias FOR fname;
  _lname alias FOR lname;
  _email alias FOR email;
  _password alias FOR password;
  _role alias FOR role;
BEGIN
  -- The role is checked against pg_roles by the ensure_user_role_exists trigger, but
  -- that would happily accept 'postgres'. Constrain it to the application roles so
  -- creating a user can never be an escalation path.
  IF _role NOT IN ('authenticated', 'admin') THEN
    RAISE insufficient_privilege
    USING message = 'role must be one of: authenticated, admin';
  END IF;
  INSERT INTO auth.users(email, password, role, user_raw_meta_data)
    VALUES (_email, _password, _role, jsonb_strip_nulls(jsonb_build_object('fname', nullif(btrim(_fname), ''), 'lname', nullif(btrim(_lname), ''))))
  RETURNING
    id INTO new_user_id;
  RETURN new_user_id;
END;
$$
LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION auth.create_user(text, text, text, text, text) TO "admin";

-- Reachable entry point. SECURITY DEFINER so it can write to auth.users, which the
-- admin role has no direct grant on, and locked to admins.
CREATE OR REPLACE FUNCTION public.create_user(fname text, lname text, email text, password text, role text DEFAULT 'authenticated')
  RETURNS uuid
  AS $$
  SELECT
    auth.create_user(fname, lname, email, password, role);
$$
LANGUAGE sql
SECURITY DEFINER;

ALTER FUNCTION public.create_user(text, text, text, text, text) SET search_path = public, auth, pg_temp;

REVOKE EXECUTE ON FUNCTION public.create_user(text, text, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_user(text, text, text, text, text) TO "admin";

-- auth.delete_user() is correct but was likewise unreachable; give it a wrapper too so
-- the pair is usable from the admin UI.
CREATE OR REPLACE FUNCTION public.delete_user(user_id uuid)
  RETURNS void
  AS $$
  SELECT
    auth.delete_user(user_id);
$$
LANGUAGE sql
SECURITY DEFINER;

ALTER FUNCTION public.delete_user(uuid) SET search_path = public, auth, pg_temp;

REVOKE EXECUTE ON FUNCTION public.delete_user(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.delete_user(uuid) TO "admin";
