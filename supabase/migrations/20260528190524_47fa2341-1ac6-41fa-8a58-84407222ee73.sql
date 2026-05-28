
ALTER TABLE public.classifications ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_classifications_sort ON public.classifications(company_id, sort_order);

-- Seed sort_order with current ordering (statement, code) per company
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY statement, code) * 10 AS rn
  FROM public.classifications
)
UPDATE public.classifications c SET sort_order = o.rn FROM ordered o WHERE c.id = o.id;
