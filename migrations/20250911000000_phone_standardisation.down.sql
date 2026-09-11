DROP INDEX IF EXISTS public.orders_fullname_trgm_idx;

DROP INDEX IF EXISTS public.orders_phone_digits_idx;

ALTER TABLE public.orders DROP COLUMN IF EXISTS phone_digits;

DROP TRIGGER IF EXISTS normalize_affiliates_phone ON public.affiliates;

DROP TRIGGER IF EXISTS normalize_agents_phone ON public.agents;

DROP TRIGGER IF EXISTS normalize_orders_phone ON public.orders;

DROP FUNCTION IF EXISTS public.normalize_phone_trigger();

DROP FUNCTION IF EXISTS public.normalize_phone(text);
