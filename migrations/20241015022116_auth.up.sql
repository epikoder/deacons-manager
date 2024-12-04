CREATE SCHEMA auth;

SET "app.jwt_secret" = '';

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE EXTENSION IF NOT EXISTS pgjwt;

CREATE ROLE anon NOINHERIT;

CREATE ROLE authenticated NOINHERIT;

GRANT anon TO authenticated;

GRANT USAGE ON SCHEMA public TO anon;

GRANT USAGE ON SCHEMA public TO authenticated;

CREATE TABLE auth.users(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'),
  password text NOT NULL CHECK (length("password") < 512),
  role text NOT NULL CHECK (length("role") < 255),
  user_raw_meta_data jsonb DEFAULT '{}' ::jsonb,
  app_meta_data jsonb DEFAULT '{}' ::jsonb,
  refresh_token text,
  refresh_token_expiry timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at timestamp
);

CREATE TABLE auth.tokens(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  token text NOT NULL,
  sub text NOT NULL,
  expiry timestamp
);

-- Trigger function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER
  AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;

-- Trigger for the users table
CREATE TRIGGER update_user_updated_at
  BEFORE UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Role check
CREATE FUNCTION auth.check_role_exists()
  RETURNS TRIGGER
  AS $$
BEGIN
  IF NOT EXISTS(
    SELECT
      1
    FROM
      pg_roles AS r
    WHERE
      r.rolname = NEW.role) THEN
  RAISE foreign_key_violation
  USING message = 'unknown role: ' || NEW.role;
  RETURN NULL;
END IF;
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ensure_user_role_exists
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE auth.check_role_exists();

-- Crypt
CREATE FUNCTION auth.encrypt_password()
  RETURNS TRIGGER
  AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.password <> OLD.password THEN
    NEW.password = public.crypt(NEW.password, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER encrypt_password
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE auth.encrypt_password();

-- Define a composite type for tokens
CREATE TYPE public.token_pair AS (
  access_token text,
  refresh_token text
);

-- Function to generate JWT tokens
CREATE FUNCTION public.generate_jwt_token("role" text, "user" jsonb, expiry int)
  RETURNS text
  AS $$
BEGIN
  RETURN public.sign(row_to_json(r), current_setting('app.jwt_secret'))
FROM(
  SELECT
    "role",
    json_build_object('id', "user" ->> 'id', 'email', "user" ->> 'email', 'role', "user" ->> 'role', 'user_raw_meta_data', "user" -> 'user_raw_meta_data', 'app_meta_data', "user" -> 'app_meta_data') AS "user",
    extract(epoch FROM now())::integer + expiry AS exp) r;
END;
$$
LANGUAGE plpgsql;

-- Login: Generate Access and Refresh Tokens
-- Login: Generate Access and Refresh Tokens
CREATE FUNCTION public.login(email text, password text)
  RETURNS public.token_pair
  AS $$
DECLARE
  user_data jsonb;
  _role text;
  result public.token_pair;
  _email alias FOR email;
  _password alias FOR password;
BEGIN
  -- Check email and password, and ensure deleted_at is null
  SELECT
    row_to_json(u) INTO user_data
  FROM
    auth.users u
  WHERE
    u.email = _email
    AND u.password = public.crypt(_password, u.password)
    AND u.deleted_at IS NULL;
  IF user_data IS NULL THEN
    RAISE invalid_password
    USING message = 'invalid user or password';
  END IF;
    _role := user_data ->> 'role';
    -- Generate access token (1 hour)
    result.access_token := public.generate_jwt_token(_role, user_data, 60 * 60);
    -- Generate refresh token (7 days)
    result.refresh_token := public.generate_jwt_token(_role, user_data, 7 * 24 * 60 * 60);
    -- Insert tokens into the auth.tokens table
    INSERT INTO auth.tokens(user_id, token, sub, expiry)
      VALUES ((user_data ->> 'id')::uuid, result.access_token, 'access_token', now() + interval '1 hour'),
((user_data ->> 'id')::uuid, result.refresh_token, 'refresh_token', now() + interval '7 days');
    RETURN result;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.login(text, text) TO anon;

-- Refresh Tokens: Generate New Access Token Using Refresh Token
CREATE FUNCTION public.refresh_token(refresh_token text)
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

GRANT EXECUTE ON FUNCTION public.refresh_token(text) TO anon;

GRANT EXECUTE ON FUNCTION public.refresh_token(text) TO anon;
