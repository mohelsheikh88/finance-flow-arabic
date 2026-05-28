-- 1) Create accounting_buckets table
CREATE TABLE public.accounting_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  statement text NOT NULL DEFAULT 'balance_sheet',
  normal_balance text NOT NULL DEFAULT 'debit',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

-- 2) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_buckets TO authenticated;
GRANT ALL ON public.accounting_buckets TO service_role;

-- 3) RLS
ALTER TABLE public.accounting_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ab_company_read"
  ON public.accounting_buckets FOR SELECT
  TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "ab_finance_write"
  ON public.accounting_buckets FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role, 'chief_accountant'::app_role]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- 4) Updated-at trigger
CREATE TRIGGER trg_accounting_buckets_updated_at
  BEFORE UPDATE ON public.accounting_buckets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Seed defaults for all existing companies
INSERT INTO public.accounting_buckets (company_id, code, name_ar, name_en, statement, normal_balance, sort_order)
SELECT c.id, v.code, v.name_ar, v.name_en, v.statement, v.normal_balance, v.sort_order
FROM public.companies c
CROSS JOIN (VALUES
  ('asset',     'أصول',         'Assets',      'balance_sheet',    'debit',  10),
  ('liability', 'التزامات',      'Liabilities', 'balance_sheet',    'credit', 20),
  ('equity',    'حقوق الملكية',  'Equity',      'balance_sheet',    'credit', 30),
  ('income',    'إيرادات',       'Income',      'income_statement', 'credit', 40),
  ('expense',   'مصروفات',       'Expenses',    'income_statement', 'debit',  50)
) AS v(code, name_ar, name_en, statement, normal_balance, sort_order)
ON CONFLICT (company_id, code) DO NOTHING;

-- 6) Auto-seed for new companies
CREATE OR REPLACE FUNCTION public.seed_default_accounting_buckets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.accounting_buckets (company_id, code, name_ar, name_en, statement, normal_balance, sort_order) VALUES
    (NEW.id, 'asset',     'أصول',         'Assets',      'balance_sheet',    'debit',  10),
    (NEW.id, 'liability', 'التزامات',      'Liabilities', 'balance_sheet',    'credit', 20),
    (NEW.id, 'equity',    'حقوق الملكية',  'Equity',      'balance_sheet',    'credit', 30),
    (NEW.id, 'income',    'إيرادات',       'Income',      'income_statement', 'credit', 40),
    (NEW.id, 'expense',   'مصروفات',       'Expenses',    'income_statement', 'debit',  50)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_accounting_buckets
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_accounting_buckets();