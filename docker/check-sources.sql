-- Reconcile orders.source against the namespaces registered for an app client.
--
-- Run this against ANY database (production included) before seeding
-- auth.app_namespaces there. orders.source is free text stamped by whatever name
-- OrderService.registerSource() used in pages/(authenticated)/+Layout.tsx, so the only
-- way to know the real values is to look.
--
--   psql "$DATABASE_URL" -v client=drm-local -f docker/check-sources.sql

\set client :client

\echo '=== every distinct source actually present in orders ==='
SELECT source, count(*) AS orders,
       count(*) FILTER (WHERE delivery_status = 'delivered') AS delivered,
       min(created_at)::date AS first_seen,
       max(created_at)::date AS last_seen
FROM public.orders
GROUP BY source
ORDER BY orders DESC;

\echo '=== sources with NO namespace mapping for this client (invisible to it) ==='
SELECT o.source, count(*) AS orders
FROM public.orders o
WHERE NOT EXISTS (
  SELECT 1 FROM auth.app_namespaces n
  JOIN auth.apps a ON a.id = n.app_id
  WHERE a.client_id = :'client' AND o.source ILIKE ANY (n.source_list))
GROUP BY o.source
ORDER BY orders DESC;

\echo '=== namespaces pointing at sources that match NO orders (typo or not live yet) ==='
SELECT n.namespace, n.source_list
FROM auth.app_namespaces n
JOIN auth.apps a ON a.id = n.app_id
WHERE a.client_id = :'client'
  AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.source ILIKE ANY (n.source_list));

\echo '=== case drift: source spellings that differ only by case ==='
SELECT lower(source) AS folded, array_agg(DISTINCT source) AS spellings
FROM public.orders
GROUP BY lower(source)
HAVING count(DISTINCT source) > 1;
