-- 1) Add the new column
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS classification_id uuid REFERENCES public.classifications(id);

CREATE INDEX IF NOT EXISTS accounts_classification_id_idx
  ON public.accounts(classification_id);

-- 2) Backfill from account_types where possible
UPDATE public.accounts a
SET classification_id = at.classification_id
FROM public.account_types at
WHERE a.account_type_id = at.id
  AND at.classification_id IS NOT NULL
  AND a.classification_id IS NULL;

-- 3) Backfill remaining rows by matching bucket within the same company
--    (pick the classification with the lowest sort_order / code for determinism)
WITH ranked AS (
  SELECT
    c.id,
    c.company_id,
    c.bucket,
    ROW_NUMBER() OVER (
      PARTITION BY c.company_id, c.bucket
      ORDER BY c.sort_order NULLS LAST, c.code
    ) AS rn
  FROM public.classifications c
)
UPDATE public.accounts a
SET classification_id = r.id
FROM ranked r
WHERE a.classification_id IS NULL
  AND a.company_id = r.company_id
  AND a.account_type = r.bucket
  AND r.rn = 1;

-- 4) Trigger to keep accounts.account_type (bucket text) in sync from classification
CREATE OR REPLACE FUNCTION public.sync_account_bucket_from_classification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket text;
BEGIN
  IF NEW.classification_id IS NOT NULL THEN
    SELECT bucket INTO v_bucket
    FROM public.classifications
    WHERE id = NEW.classification_id;
    IF v_bucket IS NOT NULL THEN
      NEW.account_type := v_bucket;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_sync_bucket ON public.accounts;
CREATE TRIGGER trg_accounts_sync_bucket
BEFORE INSERT OR UPDATE OF classification_id ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_bucket_from_classification();