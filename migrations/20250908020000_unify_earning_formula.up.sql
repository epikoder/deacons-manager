-- One definition of "earning".
--
-- There were three, and they disagreed:
--
--   1. get_earning_by_day   order_amount - books*1200 + office_charge + delivery_cost
--   2. get_earning_by_month                             office_charge + delivery_cost
--   3. order.ts affiliateEarning
--                           order_amount - books*costPerBook - office_charge - delivery_cost
--
-- (1) and (2) do not reconcile at all - summing a year of days gives a different number
-- from summing the same year of months, which is what the affiliate profile page shows
-- side by side as "month" and "total". (2) also has no coalesce, so one NULL
-- office_charge or delivery_cost nulls out an entire month.
--
-- (1) and (3) disagree on the *sign* of office_charge and delivery_cost. (3) is right:
--   - it is what the affiliate-facing report page (/affiliates/report/:id) already shows;
--   - office_charge is a 10% cut taken by the office (OFFICE_CHARGE = .1), i.e. a cost;
--   - delivery_cost is what the agent is paid - the agent branch of these very functions
--     returns o.delivery_cost as the agent's earning, so it cannot also be affiliate income;
--   - isConfigValidForPaidAmount() asserts order_amount > delivery + books + office,
--     which only makes sense if those are costs.
-- Under (1) an order could earn the affiliate more than the customer ever paid: a 15000
-- order with 1200 of books, 1500 office and 2000 delivery yielded 17300.
--
-- This migration defines the formula once and points both functions at it.

-- Book unit cost was hardcoded as 1200 in SQL while the app stores it in configs.book_cost
-- (see src/utils/guard.ts, which seeds it and falls back to 1200). Read the config, keep
-- 1200 as the fallback so behaviour is unchanged when it is unset.
CREATE OR REPLACE FUNCTION public.book_cost()
  RETURNS numeric
  AS $$
  SELECT
    coalesce((
      SELECT (c.value #>> '{}')::numeric
      FROM public.configs c
      WHERE c.name = 'book_cost'), 1200);
$$
LANGUAGE sql
STABLE;

-- What an affiliate earns on one delivered order: revenue less the cost of the books,
-- the office cut and the delivery. Floored at zero, mirroring order.ts affiliateEarning.
CREATE OR REPLACE FUNCTION public.affiliate_order_earning(order_amount int, books json, office_charge int, delivery_cost int)
  RETURNS numeric
  AS $$
  SELECT
    greatest(coalesce(order_amount, 0) - coalesce((
        SELECT sum(coalesce(value::numeric, 0) * public.book_cost())
        FROM json_each_text(coalesce(books, '{}'::json))), 0) - coalesce(office_charge, 0) - coalesce(delivery_cost, 0), 0);
$$
LANGUAGE sql
STABLE;

CREATE OR REPLACE FUNCTION public.get_earning_by_day(month int, year int, agent text, source_filter text[])
  RETURNS TABLE(
    day date,
    earning bigint
  )
  AS $$
BEGIN
  RETURN QUERY WITH days_in_month AS (
    SELECT
      generate_series(date_trunc('month', to_date(year || '-' || month || '-01', 'YYYY-MM-DD')), LEAST(CURRENT_DATE, date_trunc('month', to_date(year || '-' || month || '-01', 'YYYY-MM-DD')) + INTERVAL '1 month' - INTERVAL '1 day'), '1 day'::interval)::date AS day
)
  SELECT
    dim.day,
    cast(sum(
      CASE WHEN agent IS NOT NULL
        AND o.agent_id::text = agent THEN
        coalesce(o.delivery_cost, 0)
      WHEN array_length(source_filter, 1) > 0 THEN
        public.affiliate_order_earning(o.order_amount, o.books, o.office_charge, o.delivery_cost)
      ELSE
        0
      END) AS bigint) AS earning
  FROM
    days_in_month dim
    LEFT JOIN public.orders o ON date(o.delivered_on) = dim.day
  WHERE
    o.delivered_on IS NOT NULL
    AND o.delivery_status = 'delivered'
    AND extract(YEAR FROM dim.day) = year
    AND extract(MONTH FROM dim.day) = month
    AND ((agent IS NOT NULL
        AND o.agent_id::text = agent)
      OR (array_length(source_filter, 1) > 0
        AND o.source ILIKE ANY (source_filter)))
  GROUP BY
    dim.day
  ORDER BY
    dim.day;
END;
$$
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_earning_by_month(year int, agent text, source_filter text[])
  RETURNS TABLE(
    month date,
    earning bigint
  )
  AS $$
BEGIN
  RETURN QUERY WITH months_in_year AS (
    SELECT
      generate_series(date_trunc('month', to_date(year || '-01-01', 'YYYY-MM-DD')), date_trunc('month', to_date(year || '-12-01', 'YYYY-MM-DD')) + INTERVAL '1 month' - INTERVAL '1 day', '1 month'::interval)::date AS month
)
  SELECT
    dim.month,
    cast(sum(
      CASE WHEN agent IS NOT NULL
        AND o.agent_id::text = agent THEN
        coalesce(o.delivery_cost, 0)
      WHEN array_length(source_filter, 1) > 0 THEN
        public.affiliate_order_earning(o.order_amount, o.books, o.office_charge, o.delivery_cost)
      ELSE
        0
      END) AS bigint) AS earning
  FROM
    months_in_year dim
    -- Was date_trunc(CASE WHEN delivered_on IS NOT NULL THEN delivered_on ELSE created_at END),
    -- but the WHERE below already requires delivered_on IS NOT NULL, so the created_at branch
    -- was dead - and bucketing by a different date from get_earning_by_day is precisely what
    -- stopped the two reconciling.
    LEFT JOIN public.orders o ON date_trunc('month', o.delivered_on) = dim.month
  WHERE
    extract(YEAR FROM dim.month) = year
    AND o.delivery_status = 'delivered'
    AND o.delivered_on IS NOT NULL
    AND ((agent IS NOT NULL
        AND o.agent_id::text = agent)
      OR (array_length(source_filter, 1) > 0
        AND o.source ILIKE ANY (source_filter)))
  GROUP BY
    dim.month
  ORDER BY
    dim.month;
END;
$$
LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION public.get_earning_by_day(int, int, text, text[]) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_earning_by_month(int, text, text[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_earning_by_day(int, int, text, text[]) TO authenticated, "admin";

GRANT EXECUTE ON FUNCTION public.get_earning_by_month(int, text, text[]) TO authenticated, "admin";

GRANT EXECUTE ON FUNCTION public.book_cost() TO authenticated, "admin", app_client;

GRANT EXECUTE ON FUNCTION public.affiliate_order_earning(int, json, int, int) TO authenticated, "admin", app_client;
