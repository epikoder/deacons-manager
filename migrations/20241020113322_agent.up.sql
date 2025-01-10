-- Add up migration script here
CREATE TABLE public.agents(
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    fullname text not null,
    phone text not null UNIQUE,
    email text,
    state text not null,
    books json DEFAULT '{}',
    transactions json[] DEFAULT Array[] ::json[],
    created_at timestamp DEFAULT CURRENT_TIMESTAMP
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agents TO admin;
