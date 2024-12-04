-- -- Add down migration script here
DROP FUNCTION IF EXISTS public.refresh_token;

DROP FUNCTION IF EXISTS public.login;

DROP FUNCTION IF EXISTS public.generate_jwt_token;

DROP TRIGGER IF EXISTS encrypt_password ON auth.users;

DROP FUNCTION IF EXISTS auth.encrypt_password;

DROP TRIGGER IF EXISTS update_user_updated_at ON auth.users;

DROP FUNCTION IF EXISTS auth.update_updated_at_column;

DROP TYPE public.token_pair;

DROP TABLE IF EXISTS auth.tokens;

DROP TABLE IF EXISTS auth.users;

DROP FUNCTION IF EXISTS auth.check_role_exists;

REVOKE USAGE ON SCHEMA public FROM anon;

REVOKE USAGE ON SCHEMA public FROM authenticated;

DROP ROLE IF EXISTS authenticated;

DROP ROLE IF EXISTS anon;

DROP SCHEMA IF EXISTS "auth";
