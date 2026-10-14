-- Archiving, and "assigned implies confirmed".
--
-- Customers resubmit the same order two or three times. Deleting the extras loses the
-- record, so they are archived instead: hidden from every list and chart, kept in the
-- table, and restorable from the Archived filter.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS archived_on timestamp;

-- Every list query filters on archived_on IS NULL and orders by created_at.
CREATE INDEX IF NOT EXISTS orders_active_created_at_idx ON public.orders (created_at)
WHERE
  archived_on IS NULL;

----------------
-- An order handed to an agent has been confirmed, whatever path wrote it. Without this
-- an assigned order with a NULL confirmed_on matched the UnConfirmed filter forever.
CREATE OR REPLACE FUNCTION public.confirm_on_assign_trigger()
  RETURNS TRIGGER
  AS $$
BEGIN
  IF NEW.agent_id IS NOT NULL AND NEW.confirmed_on IS NULL THEN
    NEW.confirmed_on := coalesce(NEW.assigned_on, now());
  END IF;
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS confirm_orders_on_assign ON public.orders;

CREATE TRIGGER confirm_orders_on_assign
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.confirm_on_assign_trigger();

-- Rows already in that state.
UPDATE
  public.orders
SET
  confirmed_on = coalesce(assigned_on, now())
WHERE
  agent_id IS NOT NULL
  AND confirmed_on IS NULL;

----------------
-- Dashboard charts: a duplicate is not a second order. Same definitions as
-- 20241020113351_functions.up.sql plus the archived_on condition on the join.
CREATE OR REPLACE FUNCTION cummulative_orders_for_affiliate_by_month(year int)
  RETURNS TABLE(
    month date,
    source text,
    order_count bigint,
    pending_count bigint,
    delivered_count bigint
  )
  AS $$
BEGIN
  RETURN QUERY WITH months_in_year AS(
    SELECT
      generate_series(date_trunc('month', to_date(year || '-01-01', 'YYYY-MM-DD')), date_trunc('month', to_date(year || '-12-01', 'YYYY-MM-DD')), '1 month'::interval)::date AS month
)
  SELECT
    mi.month,
    o.source,
    count(o._id) AS order_count,
    count(
      CASE WHEN o.delivery_status = 'pending' THEN
        1
      END) AS pending_count,
    count(
      CASE WHEN o.delivery_status = 'delivered' THEN
        1
      END) AS delivered_count
  FROM
    months_in_year mi
    LEFT JOIN public.orders o ON date_trunc('month', o.created_at) = mi.month
      AND o.archived_on IS NULL
  WHERE
    extract(YEAR FROM mi.month) = year
    AND o."source" IS NOT NULL
  GROUP BY
    mi.month,
    o.source
  ORDER BY
    mi.month,
    o.source;
END;
$$
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cummulative_orders_by_state(year int)
  RETURNS TABLE(
    month date,
    state text,
    order_count bigint,
    pending_count bigint,
    delivered_count bigint
  )
  AS $$
BEGIN
  RETURN QUERY WITH months_in_year AS(
    SELECT
      generate_series(date_trunc('month', to_date(year || '-01-01', 'YYYY-MM-DD')), date_trunc('month', to_date(year || '-12-01', 'YYYY-MM-DD')), '1 month'::interval)::date AS month
)
  SELECT
    mi.month,
    o.state,
    count(o._id) AS order_count,
    count(
      CASE WHEN o.delivery_status = 'pending' THEN
        1
      END) AS pending_count,
    count(
      CASE WHEN o.delivery_status = 'delivered' THEN
        1
      END) AS delivered_count
  FROM
    months_in_year mi
    LEFT JOIN public.orders o ON date_trunc('month', o.created_at) = mi.month
      AND o.archived_on IS NULL
  WHERE
    extract(YEAR FROM mi.month) = year
    AND o.state IS NOT NULL
    AND o.state != ''
  GROUP BY
    mi.month,
    o.state
  ORDER BY
    mi.month,
    o.state;
END;
$$
LANGUAGE plpgsql;
