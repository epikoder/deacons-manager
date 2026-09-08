DROP FUNCTION IF EXISTS public.me_orders_by_month(int);

DROP FUNCTION IF EXISTS public.me_orders_by_day(int, int);

DROP FUNCTION IF EXISTS public.me_earning_by_month(int);

DROP FUNCTION IF EXISTS public.me_earning_by_day(int, int);

DROP FUNCTION IF EXISTS public.me_namespace();

DROP FUNCTION IF EXISTS public.app_refresh_token(text);

DROP FUNCTION IF EXISTS public.app_token(text, text, text);

DROP FUNCTION IF EXISTS public.generate_app_jwt_token(jsonb, int);

DROP FUNCTION IF EXISTS auth.current_source_list();

DROP FUNCTION IF EXISTS auth.jwt();

DROP INDEX IF EXISTS auth.tokens_token_idx;

ALTER TABLE auth.tokens DROP COLUMN IF EXISTS namespace;

ALTER TABLE auth.tokens DROP COLUMN IF EXISTS app_id;

DROP TABLE IF EXISTS auth.app_namespaces;

DROP TRIGGER IF EXISTS encrypt_client_secret ON auth.apps;

DROP FUNCTION IF EXISTS auth.encrypt_client_secret();

DROP TABLE IF EXISTS auth.apps;

REVOKE app_client FROM authenticator;

DROP ROLE IF EXISTS app_client;
