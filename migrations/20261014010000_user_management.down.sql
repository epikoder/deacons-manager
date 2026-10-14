-- Back to the 20250908010000 / 20241015022116 definitions.

DROP FUNCTION IF EXISTS public.restore_user(uuid);

DROP FUNCTION IF EXISTS public.reset_user_password(uuid, text);

DROP FUNCTION IF EXISTS public.update_user(uuid, text, text, text, text);

DROP FUNCTION IF EXISTS public.list_users();

DROP TYPE IF EXISTS public.app_user;

CREATE OR REPLACE FUNCTION public.create_user(fname text, lname text, email text, password text, role text DEFAULT 'authenticated')
  RETURNS uuid
  AS $$
  SELECT
    auth.create_user(fname, lname, email, password, role);
$$
LANGUAGE sql
SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.delete_user(user_id uuid)
  RETURNS void
  AS $$
  SELECT
    auth.delete_user(user_id);
$$
LANGUAGE sql
SECURITY DEFINER;

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
  -- Fetch user data and check expiry of old refresh token
  SELECT
    row_to_json(u),
    refresh_token_expiry INTO user_data,
    _expiry
  FROM
    auth.tokens t
  LEFT JOIN auth.users as u ON u.id = t.user_id
WHERE
  t.token = _refresh_token
    AND t.sub = 'refresh_token';
  IF user_data IS NULL OR _expiry < now() THEN
    RAISE invalid_password
    USING message = 'invalid or expired refresh token';
  END IF;
    _role := user_data ->> 'role';
    -- Generate new access token (1 hour)
    result.access_token := public.generate_jwt_token(_role, user_data, 60 * 60);
    -- Generate new refresh token (7 days)
    result.refresh_token := public.generate_jwt_token(_role, user_data, 7 * 24 * 60 * 60);
    -- Insert new tokens into the auth.tokens table
    INSERT INTO auth.tokens(user_id, token, sub, expiry)
      VALUES ((user_data ->> 'id')::uuid, result.access_token, 'access_token', now() + interval '1 hour'),
((user_data ->> 'id')::uuid, result.refresh_token, 'refresh_token', now() + interval '7 days');
    RETURN result;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

ALTER FUNCTION public.refresh_token(text) RESET search_path;

DROP INDEX IF EXISTS auth.users_active_email_key;

DROP FUNCTION IF EXISTS auth.revoke_tokens(uuid);

DROP FUNCTION IF EXISTS auth.assert_not_last_admin(uuid);

DROP FUNCTION IF EXISTS auth.assert_password_ok(text);

DROP FUNCTION IF EXISTS auth.assert_valid_role(text);

DROP FUNCTION IF EXISTS auth.assert_email_available(text, uuid);

DROP FUNCTION IF EXISTS auth.normalize_email(text);

DROP FUNCTION IF EXISTS auth.uid();
