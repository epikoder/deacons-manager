-- Function to get orders grouped by day for a given year and month
CREATE OR REPLACE FUNCTION get_orders_by_day(month int, year int, agent text, source_filter text[])
    RETURNS TABLE(
        day date,
        order_count bigint,
        pending_count bigint,
        delivered_count bigint
    )
    AS $$
BEGIN
    RETURN QUERY WITH days_in_month AS(
        -- Generate a series of all days in the given month, up to the current day
        SELECT
            generate_series(date_trunc('month', to_date(year || '-' || month || '-01', 'YYYY-MM-DD')), LEAST(CURRENT_DATE, date_trunc('month', to_date(year || '-' || month || '-01', 'YYYY-MM-DD')) + INTERVAL '1 month' - INTERVAL '1 day'), '1 day'::interval)::date AS day
)
    SELECT
        dim.day,
        coalesce(count(o._id), 0) AS order_count,
        coalesce(count(
                CASE WHEN o.delivery_status = 'pending' THEN
                    1
                END), 0) AS pending_count,
        coalesce(count(
                CASE WHEN o.delivery_status = 'delivered' THEN
                    1
                END), 0) AS delivered_count
    FROM
        days_in_month dim
    LEFT JOIN public.orders o ON date(o.created_at) = dim.day
WHERE
    extract(YEAR FROM dim.day) = year
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

-- Function to get orders grouped by month for a given year
CREATE OR REPLACE FUNCTION get_orders_by_month(year int, agent text, source_filter text[])
    RETURNS TABLE(
        month date,
        order_count bigint,
        pending_count bigint,
        delivered_count bigint
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
        coalesce(count(o._id), 0) AS order_count,
        coalesce(count(
                CASE WHEN o.delivery_status = 'pending' THEN
                    1
                END), 0) AS pending_count,
        coalesce(count(
                CASE WHEN o.delivery_status = 'delivered' THEN
                    1
                END), 0) AS delivered_count
    FROM
        months_in_year dim
    LEFT JOIN public.orders o ON date_trunc('month', o.created_at) = dim.month
WHERE
    extract(YEAR FROM dim.month) = year
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

-----------------
-- Function to get orders grouped by day for a given year and month
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

-- Function to get orders grouped by month for a given year
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

---------------
CREATE OR REPLACE FUNCTION get_books_with_agent()
    RETURNS json
    AS $$
DECLARE
    result json;
BEGIN
    WITH aggregated_books AS (
        SELECT
            allocated_books.book_name,
            sum(allocated_books.book_count::bigint) AS book_count
        FROM
            agents a
        CROSS JOIN LATERAL json_each_text(a.books) AS allocated_books(book_name,
            book_count)
    GROUP BY
        allocated_books.book_name
)
SELECT
    json_object_agg(book_name, book_count) INTO result
FROM
    aggregated_books;
    RETURN result;
END;
$$
LANGUAGE plpgsql;

---------------
CREATE OR REPLACE FUNCTION get_books_distribution()
    RETURNS json
    AS $$
DECLARE
    result json;
BEGIN
    SELECT
        json_agg(json_build_object('id', a.id, 'name', a.fullname, 'books', a.books)) INTO result
    FROM
        agents a;
    RETURN result;
END;
$$
LANGUAGE plpgsql;

-------------------
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
