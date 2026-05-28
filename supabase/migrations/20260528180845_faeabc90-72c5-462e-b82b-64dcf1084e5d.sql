-- Create account_types table for customizable account types per company
CREATE TABLE public.account_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  classification account_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_types TO authenticated;
GRANT ALL ON public.account_types TO service_role;

ALTER TABLE public.account_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY at_company_read ON public.account_types
  FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY at_finance_write ON public.account_types
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role, 'chief_accountant'::app_role]))
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_account_types_updated
  BEFORE UPDATE ON public.account_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default 5 classifications for every existing company
INSERT INTO public.account_types (company_id, code, name_ar, name_en, classification)
SELECT c.id, 'ASSET',     'أصول',         'Assets',      'asset'::account_type     FROM public.companies c
UNION ALL SELECT c.id, 'LIABILITY', 'التزامات',      'Liabilities', 'liability'::account_type FROM public.companies c
UNION ALL SELECT c.id, 'EQUITY',    'حقوق الملكية',  'Equity',      'equity'::account_type    FROM public.companies c
UNION ALL SELECT c.id, 'INCOME',    'إيرادات',       'Income',      'income'::account_type    FROM public.companies c
UNION ALL SELECT c.id, 'EXPENSE',   'مصروفات',       'Expenses',    'expense'::account_type   FROM public.companies c
ON CONFLICT DO NOTHING;

-- Link accounts to account_types
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_type_id uuid REFERENCES public.account_types(id) ON DELETE RESTRICT;

-- Backfill: assign each account to the default type matching its current classification within its company
UPDATE public.accounts a
SET account_type_id = t.id
FROM public.account_types t
WHERE a.account_type_id IS NULL
  AND t.company_id = a.company_id
  AND t.classification = a.account_type
  AND t.code IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE');

CREATE INDEX IF NOT EXISTS idx_accounts_account_type_id ON public.accounts(account_type_id);

-- Auto-seed defaults whenever a new company is created
CREATE OR REPLACE FUNCTION public.seed_default_account_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.account_types (company_id, code, name_ar, name_en, classification) VALUES
    (NEW.id, 'ASSET',     'أصول',         'Assets',      'asset'),
    (NEW.id, 'LIABILITY', 'التزامات',      'Liabilities', 'liability'),
    (NEW.id, 'EQUITY',    'حقوق الملكية',  'Equity',      'equity'),
    (NEW.id, 'INCOME',    'إيرادات',       'Income',      'income'),
    (NEW.id, 'EXPENSE',   'مصروفات',       'Expenses',    'expense')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_seed_account_types
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_account_types();

-- Keep accounts.account_type enum column in sync from account_type_id.classification
CREATE OR REPLACE FUNCTION public.sync_account_type_from_type_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cls account_type;
BEGIN
  IF NEW.account_type_id IS NOT NULL THEN
    SELECT classification INTO v_cls FROM public.account_types WHERE id = NEW.account_type_id;
    IF v_cls IS NOT NULL THEN
      NEW.account_type := v_cls;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounts_sync_type
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_type_from_type_id();