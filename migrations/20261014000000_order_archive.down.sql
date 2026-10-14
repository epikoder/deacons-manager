-- Restore the chart functions to their 20241020113351_functions.up.sql definitions.
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
WHERE
    extract(YEAR FROM mi.month) = year
        and o."source" is not null
    GROUP BY
        mi.month,
        o.source
    ORDER BY
        mi.month,
        o.source;
END;
$$
LANGUAGE plpgsql;

----------------
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
WHERE
    extract(YEAR FROM mi.month) = year
        and o.state is not null
        and o.state != ''
    GROUP BY
        mi.month,
        o.state
    ORDER BY
        mi.month,
        o.state;
END;
$$
LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS confirm_orders_on_assign ON public.orders;

DROP FUNCTION IF EXISTS public.confirm_on_assign_trigger();

DROP INDEX IF EXISTS public.orders_active_created_at_idx;

ALTER TABLE public.orders DROP COLUMN IF EXISTS archived_on;
