-- Self-service password change for Settings -> Change password.
--
-- The caller proves the current password, sets a new one, and every existing session
-- for the account is signed out (a password change is often "someone else has it").
-- The caller's own session continues on the fresh token pair this returns, which the
-- client stores in place of the old one.

CREATE OR REPLACE FUNCTION public.change_password(current_password text, new_password text)
  RETURNS public.token_pair
  AS $$
DECLARE
  _uid uuid := auth.uid();
  _hash text;
  user_data jsonb;
  result public.token_pair;
BEGIN
  IF _uid IS NULL THEN
    RAISE insufficient_privilege
    USING message = 'sign in to change your password';
  END IF;
  SELECT
    u.password INTO _hash
  FROM
    auth.users u
  WHERE
    u.id = _uid
    AND u.deleted_at IS NULL;
  IF _hash IS NULL OR _hash <> public.crypt(current_password, _hash) THEN
    RAISE invalid_password
    USING message = 'current password is incorrect';
  END IF;
  PERFORM
    auth.assert_password_ok(new_password);
  IF _hash = public.crypt(new_password, _hash) THEN
    RAISE check_violation
    USING message = 'choose a password different from the current one';
  END IF;
  -- auth.encrypt_password() hashes it on the way in.
  UPDATE
    auth.users u
  SET
    password = new_password
  WHERE
    u.id = _uid;
  PERFORM
    auth.revoke_tokens(_uid);
  -- Re-issue exactly as login() does.
  SELECT
    row_to_json(u) INTO user_data
  FROM
    auth.users u
  WHERE
    u.id = _uid;
  result.access_token := public.generate_jwt_token(user_data ->> 'role', user_data, 60 * 60);
  result.refresh_token := public.generate_jwt_token(user_data ->> 'role', user_data, 7 * 24 * 60 * 60);
  INSERT INTO auth.tokens(user_id, token, sub, expiry)
    VALUES (_uid, result.access_token, 'access_token', now() + interval '1 hour'),
(_uid, result.refresh_token, 'refresh_token', now() + interval '7 days');
  RETURN result;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

ALTER FUNCTION public.change_password(text, text) SET search_path = public, auth, pg_temp;

REVOKE EXECUTE ON FUNCTION public.change_password(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.change_password(text, text) TO authenticated, "admin";
