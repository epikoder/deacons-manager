-- Add down migration script here
DROP FUNCTION IF EXISTS "get_orders_by_day";

DROP FUNCTION IF EXISTS "get_orders_by_month";

DROP FUNCTION IF EXISTS "get_earning_by_day";

DROP FUNCTION IF EXISTS "get_earning_by_month";

DROP FUNCTION IF EXISTS "get_books_with_agent";

DROP FUNCTION IF EXISTS "get_books_distribution";

drop function if exists "cummulative_orders_for_affiliate_by_month";

drop function if exists "cummulative_orders_by_state";
