-- Expose how current deacons-manager's view of a namespace is.
--
-- deacons-manager is the source of truth for earnings AND for validated orders: an order
-- only exists here once it has been pulled from the affiliate's site and processed, and
-- orders that were archived, rejected or judged to be bots never make it in. The
-- affiliate's own /admin/orders is raw intake and will legitimately show a higher count.
--
-- For that difference to be readable rather than alarming, consumers need to know how
-- fresh this mirror is, so me_namespace() now also returns the ingest and delivery
-- watermarks alongside the display metadata.

DROP FUNCTION IF EXISTS public.me_namespace();

CREATE OR REPLACE FUNCTION public.me_namespace()
  RETURNS TABLE(
    namespace text,
    source_list text[],
    fullname text,
    phone text,
    email text,
    validated_orders bigint,
    last_order_at timestamp,
    last_delivered_on timestamp
  )
  AS $$
DECLARE
  _sources text[] := auth.current_source_list();
BEGIN
  RETURN QUERY
  SELECT
    auth.jwt() ->> 'namespace',
    _sources,
    -- Display metadata is best effort: a namespace works with no curated affiliates row.
    (SELECT a.fullname FROM public.affiliates a WHERE a.source_list && _sources LIMIT 1),
    (SELECT a.phone    FROM public.affiliates a WHERE a.source_list && _sources LIMIT 1),
    (SELECT a.email    FROM public.affiliates a WHERE a.source_list && _sources LIMIT 1),
    o.validated_orders,
    o.last_order_at,
    o.last_delivered_on
  FROM (
    SELECT
      count(*) AS validated_orders,
      max(created_at) AS last_order_at,
      max(delivered_on) AS last_delivered_on
    FROM public.orders
    WHERE source ILIKE ANY (_sources)) o;
END;
$$
LANGUAGE plpgsql
STABLE
SECURITY DEFINER;

ALTER FUNCTION public.me_namespace() SET search_path = public, auth, pg_temp;

REVOKE EXECUTE ON FUNCTION public.me_namespace() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.me_namespace() TO app_client, "admin";
