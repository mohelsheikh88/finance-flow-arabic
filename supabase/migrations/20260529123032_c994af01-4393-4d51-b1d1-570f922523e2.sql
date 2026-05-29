
-- Storage bucket for partner attachments (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-attachments', 'partner-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Attachments metadata table
CREATE TABLE IF NOT EXISTS public.partner_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partner_id uuid NOT NULL,
  doc_type text NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size bigint,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_attachments_partner ON public.partner_attachments(partner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_attachments TO authenticated;
GRANT ALL ON public.partner_attachments TO service_role;

ALTER TABLE public.partner_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pa_read ON public.partner_attachments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_attachments.partner_id
      AND public.has_company_access(auth.uid(), p.company_id)
  ));

CREATE POLICY pa_write ON public.partner_attachments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_attachments.partner_id
      AND public.has_company_access(auth.uid(), p.company_id)
      AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance_manager'::app_role,'accounting_manager'::app_role,'chief_accountant'::app_role,'accountant'::app_role])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = partner_attachments.partner_id
      AND public.has_company_access(auth.uid(), p.company_id)
  ));

-- Storage RLS: authenticated users with company access can manage files in this bucket
CREATE POLICY "partner_attach_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'partner-attachments');

CREATE POLICY "partner_attach_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'partner-attachments');

CREATE POLICY "partner_attach_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'partner-attachments');
