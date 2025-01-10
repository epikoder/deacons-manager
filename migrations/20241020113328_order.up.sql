-- Add up migration script here
CREATE TABLE public.orders(
    _id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id uuid REFERENCES public.affiliates(id),
    agent_id uuid REFERENCES public.agents(id),
    id text NOT NULL,
    source text NOT NULL,
    email text,
    fullname text,
    phone text,
    item text NOT NULL,
    order_amount int NOT NULL DEFAULT 0,
    address text,
    state text NOT NULL,
    delivery_status text,
    delivery_cost int,
    office_charge int,
    books json DEFAULT '{}',
    assigned_on timestamp,
    confirmed_on timestamp,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.orders
    ADD CONSTRAINT unique_source_id UNIQUE (source, id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO admin;
