ALTER TABLE public.account_types ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_account_types_sort ON public.account_types(company_id, parent_id, sort_order);
-- Seed initial sort_order based on code per (company, parent)
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY company_id, COALESCE(parent_id::text, 'root'), classification ORDER BY code) * 10 AS rn
  FROM public.account_types
)
UPDATE public.account_types t SET sort_order = r.rn FROM ranked r WHERE r.id = t.id AND t.sort_order = 0;