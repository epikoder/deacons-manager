-- Add up migration script here
CREATE TABLE public.configs(
    name text NOT NULL PRIMARY KEY UNIQUE,
    value json,
    type text DEFAULT 'string',
    secret boolean DEFAULT FALSE
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configs TO authenticated;