-- Restore the pre-unification definitions verbatim from
-- 20241020113351_functions.up.sql, including their disagreeing formulas.

DROP FUNCTION IF EXISTS public.affiliate_order_earning(int, json, int, int);

DROP FUNCTION IF EXISTS public.book_cost();

CREATE OR REPLACE FUNCTION get_earning_by_day(month int, year int, agent text, source_filter text[])
    RETURNS TABLE(
        day date,
        earning bigint
    )
    AS $$
BEGIN
    RETURN QUERY WITH days_in_month AS(
        SELECT
            generate_series(date_trunc('month', to_date(year || '-' || month || '-01', 'YYYY-MM-DD')), LEAST(CURRENT_DATE, date_trunc('month', to_date(year || '-' || month || '-01', 'YYYY-MM-DD')) + INTERVAL '1 month' - INTERVAL '1 day'), '1 day'::interval)::date AS day
)
    SELECT
        dim.day,
        cast(sum(
                CASE WHEN agent IS NOT NULL
                    AND o.agent_id::text = agent THEN
                    o.delivery_cost
                WHEN array_length(source_filter, 1) > 0 THEN
                    o.order_amount -(
                        SELECT
                            sum(coalesce(value::numeric, 0) * 1200)
                        FROM json_each_text(o.books)) + coalesce(o.office_charge, 0) + coalesce(o.delivery_cost, 0)
                ELSE
                    0
                END) AS bigint) AS earning
    FROM
        days_in_month dim
    LEFT JOIN public.orders o ON date(o.delivered_on) = dim.day
where
    o.delivered_on IS NOT NULL
        AND o.delivery_status = 'delivered'
        AND extract(YEAR FROM dim.day) = year
        AND extract(MONTH FROM dim.day) = month
        AND((agent IS NOT NULL
                AND o.agent_id::text = agent)
            OR(array_length(source_filter, 1) > 0
                AND o.source ILIKE ANY(source_filter)))
    GROUP BY
        dim.day
    ORDER BY
        dim.day;
END;
$$
LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_earning_by_month(year int, agent text, source_filter text[])
    RETURNS TABLE(
        month date,
        earning bigint
    )
    AS $$
BEGIN
    RETURN QUERY WITH months_in_year AS(
        -- Generate a series of months for the given year
        SELECT
            generate_series(date_trunc('month', to_date(year || '-01-01', 'YYYY-MM-DD')), date_trunc('month', to_date(year || '-12-01', 'YYYY-MM-DD')) + INTERVAL '1 month' - INTERVAL '1 day', '1 month'::interval)::date AS month
)
    SELECT
        dim.month,
        sum(
            CASE WHEN agent IS NOT NULL
                AND o.agent_id::text = agent THEN
                o.delivery_cost
            WHEN array_length(source_filter, 1) > 0 THEN
                o.office_charge + o.delivery_cost
            ELSE
                0
            END) AS earning
    FROM
        months_in_year dim
    LEFT JOIN public.orders o ON date_trunc('month', CASE WHEN o.delivered_on IS NOT NULL THEN
            o.delivered_on
        ELSE
            o.created_at
        END) = dim.month
WHERE
    extract(YEAR FROM dim.month) = year
        AND o.delivery_status = 'delivered'
        AND o.delivered_on IS NOT NULL
        AND((agent IS NOT NULL
                AND o.agent_id::text = agent)
            OR(array_length(source_filter, 1) > 0
                AND o.source ILIKE ANY(source_filter)))
    GROUP BY
        dim.month
    ORDER BY
        dim.month;
END;
$$
LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_earning_by_day(int, int, text, text[]) TO authenticated, "admin";

GRANT EXECUTE ON FUNCTION public.get_earning_by_month(int, text, text[]) TO authenticated, "admin";
