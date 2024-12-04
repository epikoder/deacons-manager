-- Add up migration script here
CREATE TABLE public.affiliates(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fullname text NOT NULL,
    phone text NOT NULL,
    email text,
    source_list text[] DEFAULT ARRAY[] ::text[],
    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.affiliates TO authenticated;
