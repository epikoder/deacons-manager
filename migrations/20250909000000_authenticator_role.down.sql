-- Repoint db-uri in postgrest.conf away from this role and restart PostgREST
-- BEFORE reverting, or the API loses its ability to connect.
REVOKE ALL ON SCHEMA public FROM authenticator;

REVOKE anon, authenticated, "admin", app_client FROM authenticator;

DROP ROLE IF EXISTS authenticator;
