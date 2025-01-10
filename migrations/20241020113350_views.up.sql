-- Add up migration script here
CREATE OR REPLACE VIEW "affiliate_orders" AS
SELECT
    o.*,
    a.id as aid
FROM
    orders o
    LEFT JOIN affiliates a ON o.source ILIKE ANY (a.source_list)
WHERE
    a.source_list IS NOT NULL
    AND array_length(a.source_list, 1) > 0;

GRANT SELECT ON "affiliate_orders" TO authenticated;

GRANT SELECT ON "affiliate_orders" TO admin;
