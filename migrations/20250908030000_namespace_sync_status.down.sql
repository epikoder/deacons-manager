DROP FUNCTION IF EXISTS public.me_namespace();

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

ALTER FUNCTION public.me_namespace() SET search_path = public, auth, pg_temp;

REVOKE EXECUTE ON FUNCTION public.me_namespace() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.me_namespace() TO app_client, "admin";
