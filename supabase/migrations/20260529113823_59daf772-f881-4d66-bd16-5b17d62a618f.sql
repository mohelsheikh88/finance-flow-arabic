CREATE TABLE public.partner_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partner_contacts_partner ON public.partner_contacts(partner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_contacts TO authenticated;
GRANT ALL ON public.partner_contacts TO service_role;

ALTER TABLE public.partner_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pc_read_via_partner" ON public.partner_contacts
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_id AND public.has_company_access(auth.uid(), p.company_id)));

CREATE POLICY "pc_write_via_partner" ON public.partner_contacts
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_id AND public.has_company_access(auth.uid(), p.company_id) AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role, 'chief_accountant'::app_role, 'accountant'::app_role])))
WITH CHECK (EXISTS (SELECT 1 FROM public.partners p WHERE p.id = partner_id AND public.has_company_access(auth.uid(), p.company_id)));

CREATE TRIGGER trg_partner_contacts_updated_at
BEFORE UPDATE ON public.partner_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();