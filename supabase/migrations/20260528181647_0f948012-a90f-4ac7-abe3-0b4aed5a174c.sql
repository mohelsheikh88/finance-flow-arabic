
-- 1) Classifications table
CREATE TABLE public.classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  statement text NOT NULL CHECK (statement IN ('balance_sheet','income_statement')),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit','credit')),
  bucket public.account_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classifications TO authenticated;
GRANT ALL ON public.classifications TO service_role;

ALTER TABLE public.classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY cls_company_read ON public.classifications
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY cls_finance_write ON public.classifications
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_cls_updated BEFORE UPDATE ON public.classifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Seeder function + trigger on companies
CREATE OR REPLACE FUNCTION public.seed_default_classifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.classifications (company_id, code, name_ar, name_en, statement, normal_balance, bucket) VALUES
    (NEW.id, 'ASSET',     'أصول',         'Assets',      'balance_sheet',    'debit',  'asset'),
    (NEW.id, 'LIABILITY', 'التزامات',     'Liabilities', 'balance_sheet',    'credit', 'liability'),
    (NEW.id, 'EQUITY',    'حقوق الملكية', 'Equity',      'balance_sheet',    'credit', 'equity'),
    (NEW.id, 'INCOME',    'إيرادات',      'Income',      'income_statement', 'credit', 'income'),
    (NEW.id, 'EXPENSE',   'مصروفات',      'Expenses',    'income_statement', 'debit',  'expense')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_classifications ON public.companies;
CREATE TRIGGER trg_seed_default_classifications
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_classifications();

-- Backfill for existing companies
INSERT INTO public.classifications (company_id, code, name_ar, name_en, statement, normal_balance, bucket)
SELECT c.id, v.code, v.name_ar, v.name_en, v.statement, v.normal_balance, v.bucket::public.account_type
FROM public.companies c
CROSS JOIN (VALUES
  ('ASSET','أصول','Assets','balance_sheet','debit','asset'),
  ('LIABILITY','التزامات','Liabilities','balance_sheet','credit','liability'),
  ('EQUITY','حقوق الملكية','Equity','balance_sheet','credit','equity'),
  ('INCOME','إيرادات','Income','income_statement','credit','income'),
  ('EXPENSE','مصروفات','Expenses','income_statement','debit','expense')
) AS v(code, name_ar, name_en, statement, normal_balance, bucket)
ON CONFLICT DO NOTHING;

-- 3) Link account_types to classifications (optional)
ALTER TABLE public.account_types
  ADD COLUMN IF NOT EXISTS classification_id uuid REFERENCES public.classifications(id) ON DELETE SET NULL;

-- Backfill links via matching company + matching legacy classification → bucket
UPDATE public.account_types at
SET classification_id = c.id
FROM public.classifications c
WHERE at.classification_id IS NULL
  AND c.company_id = at.company_id
  AND c.bucket = at.classification;

-- Sync trigger: when classification_id is set, mirror its bucket into legacy enum column
CREATE OR REPLACE FUNCTION public.sync_account_type_classification_from_cls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket public.account_type;
BEGIN
  IF NEW.classification_id IS NOT NULL THEN
    SELECT bucket INTO v_bucket FROM public.classifications WHERE id = NEW.classification_id;
    IF v_bucket IS NOT NULL THEN
      NEW.classification := v_bucket;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_at_cls ON public.account_types;
CREATE TRIGGER trg_sync_at_cls
  BEFORE INSERT OR UPDATE ON public.account_types
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_type_classification_from_cls();
