-- Unified transaction attachments (polymorphic: invoice, payment, journal_entry, ...)
CREATE TABLE public.transaction_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('invoice','payment','journal_entry','asset','asset_disposal')),
  transaction_id uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  file_size bigint,
  description text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_txn_att_lookup ON public.transaction_attachments(transaction_type, transaction_id);
CREATE INDEX idx_txn_att_branch ON public.transaction_attachments(branch_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_attachments TO authenticated;
GRANT ALL ON public.transaction_attachments TO service_role;

ALTER TABLE public.transaction_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY ta_read ON public.transaction_attachments
  FOR SELECT TO authenticated
  USING (public.has_branch_access(auth.uid(), branch_id));

CREATE POLICY ta_write ON public.transaction_attachments
  FOR ALL TO authenticated
  USING (public.has_branch_access(auth.uid(), branch_id)
    AND public.has_any_role(auth.uid(), ARRAY['admin'::app_role,'finance_manager'::app_role,'accounting_manager'::app_role,'chief_accountant'::app_role,'accountant'::app_role]))
  WITH CHECK (public.has_branch_access(auth.uid(), branch_id));

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('transaction-attachments','transaction-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: branch members can read/write objects in this bucket
CREATE POLICY "txn_att_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'transaction-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "txn_att_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'transaction-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "txn_att_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'transaction-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "txn_att_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'transaction-attachments' AND auth.uid() IS NOT NULL);
