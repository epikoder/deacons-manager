-- Third-party API clients.
--
-- Until now the only principals were admins: every JWT the system issued came from
-- public.login() and carried table-level rights over every affiliate's data. That is
-- not something we can hand to deacons-resource-manager, let alone to any other app.
--
-- An app client is granted a token scoped to a *namespace*, which resolves to a set of
-- order sources. Scope lives in the token, minted from auth.app_namespaces - never taken
-- from a caller argument the way get_earning_by_day(..., source_filter) does.

CREATE TABLE auth.apps(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id text NOT NULL UNIQUE,
  client_secret text NOT NULL CHECK (length(client_secret) < 512),
  -- Reserved for a future RFC 7523 assertion flow (a client signing its own JWT,
  -- verified here with public.verify(..., 'HS256')). Unused today.
  signing_secret text,
  scopes text[] NOT NULL DEFAULT ARRAY['earnings:read', 'orders:read']::text[],
  disabled_at timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_apps_updated_at
  BEFORE UPDATE ON auth.apps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Mirrors auth.encrypt_password() on auth.users.
CREATE OR REPLACE FUNCTION auth.encrypt_client_secret()
  RETURNS TRIGGER
  AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.client_secret <> OLD.client_secret THEN
    NEW.client_secret = public.crypt(NEW.client_secret, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;

CREATE TRIGGER encrypt_client_secret
  BEFORE INSERT OR UPDATE ON auth.apps
  FOR EACH ROW
  EXECUTE PROCEDURE auth.encrypt_client_secret();

-- namespace -> the order sources it may read.
--
-- For the swarm apps this is the identity mapping ('Ella' -> {Ella}): deacons-manager
-- polls https://ella.prep50.com.ng/api/orders_v1 and stamps orders.source with the same
-- name deacons-resource-manager uses as its swarm/owner name. It is a text[] so one
-- namespace can cover an affiliate running several storefronts, matching
-- affiliates.source_list. Deliberately no FK to public.affiliates: scope is defined in
-- terms of sources, so this works whether or not a curated affiliate row exists.
CREATE TABLE auth.app_namespaces(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES auth.apps(id) ON DELETE CASCADE,
  namespace text NOT NULL,
  source_list text[] NOT NULL CHECK (array_length(source_list, 1) > 0),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (app_id, namespace)
);

-- Issued app tokens live alongside user tokens so revocation/audit stays in one place.
ALTER TABLE auth.tokens ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE auth.tokens ADD COLUMN app_id uuid REFERENCES auth.apps(id) ON DELETE CASCADE;
ALTER TABLE auth.tokens ADD COLUMN namespace text;
CREATE INDEX tokens_token_idx ON auth.tokens(token);

----------------
-- The app role. No table grants at all: an app_client token can execute the me_* RPCs
-- below and nothing else. This is the whole point - it is why we do not hand out an
-- admin token, and why a third party cannot read public.orders wholesale.
CREATE ROLE app_client NOINHERIT;

GRANT USAGE ON SCHEMA public TO app_client;

GRANT app_client TO authenticator;

----------------
-- Claim helpers.
CREATE OR REPLACE FUNCTION auth.jwt()
  RETURNS jsonb
  AS $$
  SELECT
    coalesce(nullif(current_setting('request.jwt.claims', TRUE), ''), '{}')::jsonb;
$$
LANGUAGE sql
STABLE;

-- The source scope for the current caller.
-- app_client: from the token. admin: NULL, meaning unscoped - preserving today's
-- behaviour for the Vike app exactly.
CREATE OR REPLACE FUNCTION auth.current_source_list()
  RETURNS text[]
  AS $$
DECLARE
  _claims jsonb := auth.jwt();
  _sources text[];
BEGIN
  IF _claims ->> 'role' IS DISTINCT FROM 'app_client' THEN
    RETURN NULL;
  END IF;
  SELECT
    array_agg(value::text) INTO _sources
  FROM
    jsonb_array_elements_text(coalesce(_claims -> 'source_list', '[]'::jsonb)) AS value;
  IF _sources IS NULL OR array_length(_sources, 1) IS NULL THEN
    RAISE insufficient_privilege
    USING message = 'token carries no source scope';
  END IF;
  RETURN _sources;
END;
$$
LANGUAGE plpgsql
STABLE;

----------------
-- public.generate_jwt_token hardcodes a {role, user, exp} shape that the Vike client
-- decodes in src/utils/auth.ts:makeUser, so app tokens get their own signer rather than
-- bending that one.
CREATE OR REPLACE FUNCTION public.generate_app_jwt_token(claims jsonb, expiry int)
  RETURNS text
  AS $$
  -- pgjwt's sign() takes json, not jsonb, and there is no direct jsonb->json cast.
  --
  -- jti is what makes each token unique. Without it the payload is a pure function of
  -- (claims, exp-to-the-second), so two tokens minted in the same second are byte
  -- identical - which silently turns refresh-token rotation into a no-op, since the
  -- row we delete and the row we insert carry the same string. It also gives us a
  -- stable handle for revoking a single issuance.
  SELECT
    public.sign((claims || jsonb_build_object('jti', gen_random_uuid(), 'exp', extract(epoch FROM now())::integer + expiry))::text::json, current_setting('app.jwt_secret'));
$$
LANGUAGE sql
VOLATILE;

-- Client-credentials grant. Server-to-server only.
CREATE OR REPLACE FUNCTION public.app_token(client_id text, client_secret text, namespace text)
  RETURNS public.token_pair
  AS $$
DECLARE
  _app auth.apps%ROWTYPE;
  _sources text[];
  _claims jsonb;
  result public.token_pair;
  _client_id alias FOR client_id;
  _client_secret alias FOR client_secret;
  _namespace alias FOR namespace;
BEGIN
  SELECT
    * INTO _app
  FROM
    auth.apps a
  WHERE
    a.client_id = _client_id
    AND a.client_secret = public.crypt(_client_secret, a.client_secret)
    AND a.disabled_at IS NULL;
  IF _app.id IS NULL THEN
    RAISE invalid_password
    USING message = 'invalid client credentials';
  END IF;
  SELECT
    n.source_list INTO _sources
  FROM
    auth.app_namespaces n
  WHERE
    n.app_id = _app.id
    AND n.namespace = _namespace;
  IF _sources IS NULL THEN
    -- PostgREST reads a PTxxx SQLSTATE as an explicit HTTP status. The client did
    -- authenticate, so this is 403 (forbidden), not 401 (unauthenticated).
    RAISE sqlstate 'PT403'
    USING message = 'unknown namespace for this client';
  END IF;
  _claims := jsonb_build_object('role', 'app_client', 'app_id', _app.id, 'client_id', _app.client_id, 'scopes', to_jsonb(_app.scopes), 'namespace', _namespace, 'source_list', to_jsonb(_sources));
  result.access_token := public.generate_app_jwt_token(_claims, 60 * 60);
  result.refresh_token := public.generate_app_jwt_token(_claims, 7 * 24 * 60 * 60);
  INSERT INTO auth.tokens(app_id, namespace, token, sub, expiry)
    VALUES (_app.id, _namespace, result.access_token, 'access_token', now() + interval '1 hour'),
    (_app.id, _namespace, result.refresh_token, 'refresh_token', now() + interval '7 days');
  RETURN result;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.app_token(text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.app_token(text, text, text) TO anon;

-- Exchange a refresh token for a fresh pair. Separate from public.refresh_token, which
-- is keyed on auth.users and reads expiry from a column that is never populated.
CREATE OR REPLACE FUNCTION public.app_refresh_token(refresh_token text)
  RETURNS public.token_pair
  AS $$
DECLARE
  _app_id uuid;
  _app_client_id text;
  _scopes text[];
  _namespace text;
  _sources text[];
  _claims jsonb;
  result public.token_pair;
  _refresh_token alias FOR refresh_token;
BEGIN
  SELECT
    a.id,
    a.client_id,
    a.scopes,
    t.namespace INTO _app_id,
    _app_client_id,
    _scopes,
    _namespace
  FROM
    auth.tokens t
    JOIN auth.apps a ON a.id = t.app_id
  WHERE
    t.token = _refresh_token
    AND t.sub = 'refresh_token'
    AND t.expiry > now()
    AND a.disabled_at IS NULL;
  IF _app_id IS NULL THEN
    RAISE invalid_password
    USING message = 'invalid or expired refresh token';
  END IF;
  SELECT
    n.source_list INTO _sources
  FROM
    auth.app_namespaces n
  WHERE
    n.app_id = _app_id
    AND n.namespace = _namespace;
  IF _sources IS NULL THEN
    RAISE sqlstate 'PT403'
    USING message = 'namespace no longer granted to this client';
  END IF;
  _claims := jsonb_build_object('role', 'app_client', 'app_id', _app_id, 'client_id', _app_client_id, 'scopes', to_jsonb(_scopes), 'namespace', _namespace, 'source_list', to_jsonb(_sources));
  result.access_token := public.generate_app_jwt_token(_claims, 60 * 60);
  result.refresh_token := public.generate_app_jwt_token(_claims, 7 * 24 * 60 * 60);
  DELETE FROM auth.tokens
  WHERE token = _refresh_token;
  INSERT INTO auth.tokens(app_id, namespace, token, sub, expiry)
    VALUES (_app_id, _namespace, result.access_token, 'access_token', now() + interval '1 hour'),
    (_app_id, _namespace, result.refresh_token, 'refresh_token', now() + interval '7 days');
  RETURN result;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.app_refresh_token(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.app_refresh_token(text) TO anon;

GRANT EXECUTE ON FUNCTION public.app_refresh_token(text) TO app_client;

----------------
-- Scoped RPCs.
--
-- Thin wrappers over the functions in 20241020113351_functions.up.sql that take NO
-- source_filter: they read it from the token. The originals stay as they are for the
-- admin/Vike path, but are never granted to app_client - so the only way an app can name
-- a source is by holding a token minted for it.
CREATE OR REPLACE FUNCTION public.me_namespace()
  RETURNS TABLE(
    namespace text,
    source_list text[],
    fullname text,
    phone text,
    email text
  )
  AS $$
DECLARE
  _sources text[] := auth.current_source_list();
BEGIN
  RETURN QUERY
  -- Display metadata is resolved opportunistically: an affiliates row is nice to have,
  -- not required, so a namespace with no curated row still returns its scope.
  SELECT
    auth.jwt() ->> 'namespace',
    _sources,
    a.fullname,
    a.phone,
    a.email
  FROM (
    SELECT
      1) noop
  LEFT JOIN public.affiliates a ON a.source_list && _sources
LIMIT 1;
END;
$$
LANGUAGE plpgsql
STABLE
SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.me_earning_by_day(month int, year int)
  RETURNS TABLE(
    day date,
    earning bigint
  )
  AS $$
  SELECT
    * FROM public.get_earning_by_day(month, year, NULL, auth.current_source_list());
$$
LANGUAGE sql
STABLE
SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.me_earning_by_month(year int)
  RETURNS TABLE(
    month date,
    earning bigint
  )
  AS $$
  SELECT
    * FROM public.get_earning_by_month(year, NULL, auth.current_source_list());
$$
LANGUAGE sql
STABLE
SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.me_orders_by_day(month int, year int)
  RETURNS TABLE(
    day date,
    order_count bigint,
    pending_count bigint,
    delivered_count bigint
  )
  AS $$
  SELECT
    * FROM public.get_orders_by_day(month, year, NULL, auth.current_source_list());
$$
LANGUAGE sql
STABLE
SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.me_orders_by_month(year int)
  RETURNS TABLE(
    month date,
    order_count bigint,
    pending_count bigint,
    delivered_count bigint
  )
  AS $$
  SELECT
    * FROM public.get_orders_by_month(year, NULL, auth.current_source_list());
$$
LANGUAGE sql
STABLE
SECURITY DEFINER;

-- A SECURITY DEFINER function runs as its owner (postgres), so lock the search_path to
-- stop a caller-supplied one resolving these unqualified names somewhere else.
ALTER FUNCTION public.me_namespace() SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.me_earning_by_day(int, int) SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.me_earning_by_month(int) SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.me_orders_by_day(int, int) SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.me_orders_by_month(int) SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.app_token(text, text, text) SET search_path = public, auth, pg_temp;

ALTER FUNCTION public.app_refresh_token(text) SET search_path = public, auth, pg_temp;

REVOKE EXECUTE ON FUNCTION public.me_namespace() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.me_earning_by_day(int, int) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.me_earning_by_month(int) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.me_orders_by_day(int, int) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.me_orders_by_month(int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.me_namespace() TO app_client, "admin";

GRANT EXECUTE ON FUNCTION public.me_earning_by_day(int, int) TO app_client, "admin";

GRANT EXECUTE ON FUNCTION public.me_earning_by_month(int) TO app_client, "admin";

GRANT EXECUTE ON FUNCTION public.me_orders_by_day(int, int) TO app_client, "admin";

GRANT EXECUTE ON FUNCTION public.me_orders_by_month(int) TO app_client, "admin";

----------------
-- PostgREST grants EXECUTE on functions to PUBLIC by default, which would let an
-- app_client token call the arg-taking originals and name any source it likes. Close
-- that: the admin/Vike path keeps them, app_client does not.
REVOKE EXECUTE ON FUNCTION public.get_earning_by_day(int, int, text, text[]) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_earning_by_month(int, text, text[]) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_orders_by_day(int, int, text, text[]) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_orders_by_month(int, text, text[]) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.cummulative_orders_for_affiliate_by_month(int) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.cummulative_orders_by_state(int) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_books_distribution() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_books_with_agent() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_earning_by_day(int, int, text, text[]) TO authenticated, "admin";

GRANT EXECUTE ON FUNCTION public.get_earning_by_month(int, text, text[]) TO authenticated, "admin";

GRANT EXECUTE ON FUNCTION public.get_orders_by_day(int, int, text, text[]) TO authenticated, "admin";

GRANT EXECUTE ON FUNCTION public.get_orders_by_month(int, text, text[]) TO authenticated, "admin";

GRANT EXECUTE ON FUNCTION public.cummulative_orders_for_affiliate_by_month(int) TO authenticated, "admin";

GRANT EXECUTE ON FUNCTION public.cummulative_orders_by_state(int) TO authenticated, "admin";

GRANT EXECUTE ON FUNCTION public.get_books_distribution() TO authenticated, "admin";

GRANT EXECUTE ON FUNCTION public.get_books_with_agent() TO authenticated, "admin";
