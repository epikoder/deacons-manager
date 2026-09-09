-- A non-superuser connection role for PostgREST.
--
-- PostgREST logs in as one role and runs SET LOCAL ROLE <jwt.role> per request,
-- with no allowlist over that claim. When it connects as a superuser, a JWT
-- claiming role "postgres" is honoured - so the JWT secret stops being the key to
-- the API and becomes the key to the database. A non-superuser can only switch
-- into roles it is a member of, and the same forged token is refused with
-- "permission denied to set role".
--
-- This creates the role and its memberships only. It deliberately sets NO
-- password, so the role cannot be used until someone sets one out of band -
-- a credential does not belong in a migration file. Use:
--
--   ./scripts/set-authenticator-password.sh
--
-- which sets it and prints the db-uri line for postgrest.conf. Until PostgREST is
-- repointed at this role nothing changes; the switch is that one config line plus
-- a restart, and repointing it back is an instant rollback.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    -- NOINHERIT: it holds none of these privileges between requests, only what
    -- SET ROLE gives it for the duration of one.
    CREATE ROLE authenticator LOGIN NOINHERIT;
    RAISE NOTICE 'created role authenticator (no password yet - run scripts/set-authenticator-password.sh)';
  ELSE
    RAISE NOTICE 'role authenticator already exists; ensuring memberships only';
  END IF;
END
$$;

-- Every role PostgREST may switch into must be granted, or requests carrying that
-- role fail with "permission denied to set role". app_client included, otherwise
-- third-party tokens break the moment you repoint db-uri.
GRANT anon, authenticated, "admin", app_client TO authenticator;

GRANT USAGE ON SCHEMA public TO authenticator;
