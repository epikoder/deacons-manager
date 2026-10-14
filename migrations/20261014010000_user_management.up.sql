-- User management for the /users pages.
--
-- 20250908010000_fix_create_user made create_user / delete_user reachable. This adds
-- the rest of what an admin needs - list, edit, reset a password, remove and restore -
-- and closes the holes that only matter once users can actually be removed:
--
--   * refresh_token() read auth.users.refresh_token_expiry, which nothing ever sets,
--     so a refresh token never expired server-side, and it did not check deleted_at,
--     so a removed user could keep refreshing their way back in. It now checks the
--     token's own expiry and the user's status.
--   * Removing a user, resetting their password, or changing their role or email
--     deletes their tokens, so the change takes effect at the next refresh (within the
--     hour the current access token has left) rather than in a week.
--   * An admin cannot remove or demote themselves, and the last active admin cannot be
--     removed or demoted, so the app can never be left with nobody able to manage it.
--
-- All entry points are SECURITY DEFINER (admin has no grant on auth.*) and executable
-- by "admin" only.

----------------
-- Who is calling. The Vike app's tokens carry {role, user: {id, ...}, exp}.
CREATE OR REPLACE FUNCTION auth.uid()
  RETURNS uuid
  AS $$
  SELECT
    nullif(auth.jwt() -> 'user' ->> 'id', '')::uuid;
$$
LANGUAGE sql
STABLE;

-- Normalised for comparison; auth.users.email has a case-insensitive CHECK but no
-- uniqueness, so two spellings of one address could otherwise coexist.
CREATE OR REPLACE FUNCTION auth.normalize_email(email text)
  RETURNS text
  AS $$
  SELECT
    lower(btrim(email));
$$
LANGUAGE sql
IMMUTABLE;

CREATE OR REPLACE FUNCTION auth.assert_email_available(email text, except_id uuid DEFAULT NULL)
  RETURNS void
  AS $$
BEGIN
  IF EXISTS (
    SELECT
      1
    FROM
      auth.users u
    WHERE
      auth.normalize_email(u.email) = auth.normalize_email($1)
      AND u.deleted_at IS NULL
      AND u.id IS DISTINCT FROM except_id) THEN
  RAISE unique_violation
  USING message = 'a user with this email already exists';
END IF;
END;
$$
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auth.assert_valid_role(role text)
  RETURNS void
  AS $$
BEGIN
  IF $1 NOT IN ('authenticated', 'admin') THEN
    RAISE insufficient_privilege
    USING message = 'role must be one of: authenticated, admin';
  END IF;
END;
$$
LANGUAGE plpgsql
IMMUTABLE;

CREATE OR REPLACE FUNCTION auth.assert_password_ok(password text)
  RETURNS void
  AS $$
BEGIN
  IF password IS NULL OR length(password) < 8 THEN
    RAISE check_violation
    USING message = 'password must be at least 8 characters';
  END IF;
END;
$$
LANGUAGE plpgsql
IMMUTABLE;

-- Refuses a change that would leave no active admin.
CREATE OR REPLACE FUNCTION auth.assert_not_last_admin(user_id uuid)
  RETURNS void
  AS $$
BEGIN
  IF EXISTS (
    SELECT
      1
    FROM
      auth.users
    WHERE
      id = $1
      AND role = 'admin'
      AND deleted_at IS NULL)
    AND (
      SELECT
        count(*)
      FROM
        auth.users
      WHERE
        role = 'admin'
        AND deleted_at IS NULL) <= 1 THEN
    RAISE check_violation
    USING message = 'this is the last admin; make someone else an admin first';
  END IF;
END;
$$
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auth.revoke_tokens(user_id uuid)
  RETURNS void
  AS $$
  DELETE FROM auth.tokens
  WHERE auth.tokens.user_id = $1;
$$
LANGUAGE sql;

----------------
-- A partial unique index is the real guarantee, but it cannot be created while
-- duplicates exist, and silently deleting someone's account to make room is not a
-- migration's call. Create it when the data allows; otherwise say what to clean up.
-- The functions below enforce the same rule either way.
DO $$
DECLARE
  dupes text;
BEGIN
  SELECT
    string_agg(e, ', ') INTO dupes
  FROM (
    SELECT
      auth.normalize_email(email) AS e
    FROM
      auth.users
    WHERE
      deleted_at IS NULL
    GROUP BY
      1
    HAVING
      count(*) > 1) d;
  IF dupes IS NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS users_active_email_key ON auth.users (auth.normalize_email(email))
    WHERE
      deleted_at IS NULL;
  ELSE
    RAISE NOTICE 'users_active_email_key not created: duplicate active emails (%). Remove the extra accounts and re-run this block.', dupes;
  END IF;
END
$$;

----------------
-- Fixed refresh: the token's own expiry, and only for users that still exist.
CREATE OR REPLACE FUNCTION public.refresh_token(refresh_token text)
  RETURNS public.token_pair
  AS $$
DECLARE
  user_data jsonb;
  _expiry timestamp;
  _role text;
  result public.token_pair;
  _refresh_token alias FOR refresh_token;
BEGIN
  SELECT
    row_to_json(u),
    t.expiry INTO user_data,
    _expiry
  FROM
    auth.tokens t
    JOIN auth.users AS u ON u.id = t.user_id
  WHERE
    t.token = _refresh_token
    AND t.sub = 'refresh_token'
    AND u.deleted_at IS NULL;
  IF user_data IS NULL OR _expiry IS NULL OR _expiry < now() THEN
    RAISE invalid_password
    USING message = 'invalid or expired refresh token';
  END IF;
  _role := user_data ->> 'role';
  result.access_token := public.generate_jwt_token(_role, user_data, 60 * 60);
  result.refresh_token := public.generate_jwt_token(_role, user_data, 7 * 24 * 60 * 60);
  INSERT INTO auth.tokens(user_id, token, sub, expiry)
    VALUES ((user_data ->> 'id')::uuid, result.access_token, 'access_token', now() + interval '1 hour'),
((user_data ->> 'id')::uuid, result.refresh_token, 'refresh_token', now() + interval '7 days');
  RETURN result;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

----------------
-- List. A set-returning RPC over a named row type, so PostgREST filters, orders and
-- pages it like a table. Order by a column that is also in `select`:
--   /rpc/list_users?id=eq.<uuid>   /rpc/list_users?select=*&order=created_at.desc
CREATE TYPE public.app_user AS (
  id uuid,
  email text,
  role text,
  fname text,
  lname text,
  created_at timestamp,
  updated_at timestamp,
  deleted_at timestamp,
  last_seen_at timestamp
);

CREATE OR REPLACE FUNCTION public.list_users()
  RETURNS SETOF public.app_user
  AS $$
  SELECT
    u.id,
    u.email,
    u.role,
    u.user_raw_meta_data ->> 'fname',
    u.user_raw_meta_data ->> 'lname',
    u.created_at,
    u.updated_at,
    u.deleted_at,
    -- Every access token is issued with a one hour expiry, so the newest one marks
    -- the last sign-in or refresh. Approximate, but it is all auth.tokens records.
    (
      SELECT
        max(t.expiry) - interval '1 hour'
      FROM
        auth.tokens t
      WHERE
        t.user_id = u.id
        AND t.sub = 'access_token')
  FROM
    auth.users u;
$$
LANGUAGE sql
STABLE
SECURITY DEFINER;

----------------
-- Create: same as before, plus email normalisation, uniqueness and a length floor.
CREATE OR REPLACE FUNCTION public.create_user(fname text, lname text, email text, password text, role text DEFAULT 'authenticated')
  RETURNS uuid
  AS $$
BEGIN
  PERFORM
    auth.assert_valid_role(role);
  PERFORM
    auth.assert_password_ok(password);
  PERFORM
    auth.assert_email_available(email);
  RETURN auth.create_user(fname, lname, auth.normalize_email(email), password, role);
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

----------------
CREATE OR REPLACE FUNCTION public.update_user(user_id uuid, fname text, lname text, email text, role text)
  RETURNS void
  AS $$
DECLARE
  _user auth.users;
  _email text := auth.normalize_email(email);
  _role alias FOR role;
BEGIN
  SELECT
    * INTO _user
  FROM
    auth.users u
  WHERE
    u.id = user_id
    AND u.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE no_data_found
    USING message = 'user not found';
  END IF;
  PERFORM
    auth.assert_valid_role(_role);
  IF _role <> _user.role THEN
    IF user_id = auth.uid() THEN
      RAISE check_violation
      USING message = 'you cannot change your own role';
    END IF;
    IF _user.role = 'admin' THEN
      PERFORM
        auth.assert_not_last_admin(user_id);
    END IF;
  END IF;
  -- Only a changed address is checked, so an account that already shares its email
  -- with another (no unique index yet) can still have its name or role edited.
  IF _email <> auth.normalize_email(_user.email) THEN
    PERFORM
      auth.assert_email_available(_email, user_id);
  END IF;
  UPDATE
    auth.users u
  SET
    email = _email,
    role = _role,
    user_raw_meta_data = (coalesce(u.user_raw_meta_data, '{}'::jsonb) - 'fname' - 'lname') || jsonb_strip_nulls(jsonb_build_object('fname', nullif(btrim(fname), ''), 'lname', nullif(btrim(lname), '')))
  WHERE
    u.id = user_id;
  -- Role and email are baked into the token; make them re-sign-in to pick them up.
  IF _role <> _user.role OR _email <> auth.normalize_email(_user.email) THEN
    PERFORM
      auth.revoke_tokens(user_id);
  END IF;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

----------------
-- An admin sets a new password for someone who has lost theirs.
CREATE OR REPLACE FUNCTION public.reset_user_password(user_id uuid, password text)
  RETURNS void
  AS $$
BEGIN
  PERFORM
    auth.assert_password_ok(password);
  -- auth.encrypt_password() hashes it on the way in.
  UPDATE
    auth.users u
  SET
    password = reset_user_password.password
  WHERE
    u.id = user_id
    AND u.deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE no_data_found
    USING message = 'user not found';
  END IF;
  PERFORM
    auth.revoke_tokens(user_id);
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

----------------
-- Remove (soft delete) with the lock-out guards, and sign them out.
CREATE OR REPLACE FUNCTION public.delete_user(user_id uuid)
  RETURNS void
  AS $$
BEGIN
  IF user_id = auth.uid() THEN
    RAISE check_violation
    USING message = 'you cannot remove your own account';
  END IF;
  PERFORM
    auth.assert_not_last_admin(user_id);
  PERFORM
    auth.delete_user(user_id);
  PERFORM
    auth.revoke_tokens(user_id);
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.restore_user(user_id uuid)
  RETURNS void
  AS $$
DECLARE
  _email text;
BEGIN
  SELECT
    u.email INTO _email
  FROM
    auth.users u
  WHERE
    u.id = user_id
    AND u.deleted_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE no_data_found
    USING message = 'no removed user with that id';
  END IF;
  -- Someone may have been given the address since.
  PERFORM
    auth.assert_email_available(_email, user_id);
  UPDATE
    auth.users u
  SET
    deleted_at = NULL
  WHERE
    u.id = user_id;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

----------------
ALTER FUNCTION public.refresh_token(text) SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.list_users() SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.create_user(text, text, text, text, text) SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.update_user(uuid, text, text, text, text) SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.reset_user_password(uuid, text) SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.delete_user(uuid) SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.restore_user(uuid) SET search_path = public, auth, pg_temp;

REVOKE EXECUTE ON FUNCTION public.list_users() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_user(uuid, text, text, text, text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.reset_user_password(uuid, text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.restore_user(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_users() TO "admin";

GRANT EXECUTE ON FUNCTION public.update_user(uuid, text, text, text, text) TO "admin";

GRANT EXECUTE ON FUNCTION public.reset_user_password(uuid, text) TO "admin";

GRANT EXECUTE ON FUNCTION public.restore_user(uuid) TO "admin";
