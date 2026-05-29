-- Customer Types table for categorizing customers
CREATE TABLE public.customer_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_types TO authenticated;
GRANT ALL ON public.customer_types TO service_role;

ALTER TABLE public.customer_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY ct_company_read ON public.customer_types
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY ct_finance_write ON public.customer_types
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role, 'chief_accountant'::app_role, 'accountant'::app_role]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_customer_types_updated_at
  BEFORE UPDATE ON public.customer_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link partners (customers) to a customer type
ALTER TABLE public.partners
  ADD COLUMN customer_type_id uuid REFERENCES public.customer_types(id) ON DELETE SET NULL;

CREATE INDEX idx_partners_customer_type ON public.partners(customer_type_id);
