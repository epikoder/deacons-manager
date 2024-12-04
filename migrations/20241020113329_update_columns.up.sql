-- Add up migration script here
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS "delivered_on" timestamp;

ALTER TABLE public.orders
    ALTER COLUMN delivery_status SET DEFAULT 'pending';

ALTER TABLE public.orders
    DROP COLUMN IF EXISTS "affiliate_id";

ALTER TABLE public.affiliates
    DROP COLUMN IF EXISTS "balance";

ALTER TABLE public.agents
    DROP COLUMN IF EXISTS "balance";
