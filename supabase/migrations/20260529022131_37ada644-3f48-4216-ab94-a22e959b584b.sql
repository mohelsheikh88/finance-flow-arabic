DROP TRIGGER IF EXISTS trg_prevent_lock_date_update ON public.lock_dates;
DROP TRIGGER IF EXISTS trg_prevent_lock_date_delete ON public.lock_dates;
DROP FUNCTION IF EXISTS public.prevent_lock_date_change();