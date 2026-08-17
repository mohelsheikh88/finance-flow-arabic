-- 1) Storage: partner-attachments (path convention: <partner_id>/<doc_type>/<file>)
DROP POLICY IF EXISTS "partner_attach_read" ON storage.objects;
DROP POLICY IF EXISTS "partner_attach_insert" ON storage.objects;
DROP POLICY IF EXISTS "partner_attach_update" ON storage.objects;
DROP POLICY IF EXISTS "partner_attach_delete" ON storage.objects;

CREATE POLICY "partner_attach_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'partner-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = ((storage.foldername(name))[1])::uuid
      AND public.has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "partner_attach_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'partner-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = ((storage.foldername(name))[1])::uuid
      AND public.has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "partner_attach_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'partner-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = ((storage.foldername(name))[1])::uuid
      AND public.has_company_access(auth.uid(), p.company_id)
  )
)
WITH CHECK (
  bucket_id = 'partner-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = ((storage.foldername(name))[1])::uuid
      AND public.has_company_access(auth.uid(), p.company_id)
  )
);

CREATE POLICY "partner_attach_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'partner-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id = ((storage.foldername(name))[1])::uuid
      AND public.has_company_access(auth.uid(), p.company_id)
  )
);

-- 2) Storage: transaction-attachments (path convention: <branch_id>/<type>/<txn_id>/<file>)
DROP POLICY IF EXISTS "txn_att_read" ON storage.objects;
DROP POLICY IF EXISTS "txn_att_insert" ON storage.objects;
DROP POLICY IF EXISTS "txn_att_update" ON storage.objects;
DROP POLICY IF EXISTS "txn_att_delete" ON storage.objects;

CREATE POLICY "txn_att_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.has_branch_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "txn_att_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'transaction-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.has_branch_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "txn_att_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.has_branch_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'transaction-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.has_branch_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "txn_att_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'transaction-attachments'
  AND (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND public.has_branch_access(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 3) Revoke direct EXECUTE on internal SECURITY DEFINER functions (triggers/seeders/helpers).
REVOKE EXECUTE ON FUNCTION public.is_date_locked(uuid, uuid, date) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_default_account_types() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_default_classifications() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.seed_default_accounting_buckets() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_account_type_from_type_id() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_account_type_classification_from_cls() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_account_bucket_from_classification() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lock_date_invoice() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lock_date_invoice_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lock_date_je() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lock_date_je_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lock_date_payment() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lock_date_payment_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lock_date_fixed_asset() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lock_date_fixed_asset_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lock_date_depreciation() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lock_date_depreciation_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lock_date_asset_disposal() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lock_date_asset_disposal_delete() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM anon, authenticated, PUBLIC;
