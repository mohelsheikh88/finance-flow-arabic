-- Create fiscal_positions table for managing tax bearer classifications per Zakat requirements
CREATE TABLE public.fiscal_positions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    is_saudi BOOLEAN NOT NULL DEFAULT true,
    vat_applicable BOOLEAN NOT NULL DEFAULT true,
    zakat_applicable BOOLEAN NOT NULL DEFAULT true,
    income_tax_applicable BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grants for data API access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_positions TO authenticated;
GRANT ALL ON public.fiscal_positions TO service_role;

-- Enable RLS
ALTER TABLE public.fiscal_positions ENABLE ROW LEVEL SECURITY;

-- RLS policies following project conventions
CREATE POLICY "fp_company_read" ON public.fiscal_positions FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "fp_finance_write" ON public.fiscal_positions FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- Auto-update updated_at trigger
CREATE TRIGGER trg_fiscal_positions_updated
  BEFORE UPDATE ON public.fiscal_positions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();