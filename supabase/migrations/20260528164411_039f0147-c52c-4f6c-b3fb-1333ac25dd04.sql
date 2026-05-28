
CREATE TABLE public.lock_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid,
  lock_date date NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lock_dates_company ON public.lock_dates(company_id, branch_id, lock_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lock_dates TO authenticated;
GRANT ALL ON public.lock_dates TO service_role;

ALTER TABLE public.lock_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY ld_company_read ON public.lock_dates FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY ld_finance_write ON public.lock_dates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE TRIGGER update_lock_dates_updated_at
  BEFORE UPDATE ON public.lock_dates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function to check if a date is locked for a given company/branch
CREATE OR REPLACE FUNCTION public.is_date_locked(_company_id uuid, _branch_id uuid, _txn_date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lock_dates
    WHERE company_id = _company_id
      AND (branch_id IS NULL OR branch_id = _branch_id)
      AND _txn_date <= lock_date
  );
$$;
