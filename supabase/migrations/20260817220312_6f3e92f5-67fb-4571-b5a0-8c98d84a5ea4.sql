-- 1. Helper: branch/company consistency (needed by RLS)
CREATE OR REPLACE FUNCTION public.branch_in_company(_branch_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = _branch_id AND b.company_id = _company_id);
$$;
REVOKE ALL ON FUNCTION public.branch_in_company(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.branch_in_company(uuid, uuid) TO authenticated;

-- 2. Role/access helpers: only answer for the calling user (service_role has no auth.uid())
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid())
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid())
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid())
     AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.has_branch_access(_user_id uuid, _branch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid())
     AND (public.is_admin(_user_id)
          OR EXISTS (SELECT 1 FROM public.user_branch_access WHERE user_id = _user_id AND branch_id = _branch_id));
$$;

CREATE OR REPLACE FUNCTION public.has_company_access(_user_id uuid, _company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (auth.uid() IS NULL OR _user_id = auth.uid())
     AND (public.is_admin(_user_id)
          OR EXISTS (
            SELECT 1 FROM public.user_branch_access uba
            JOIN public.branches b ON b.id = uba.branch_id
            WHERE uba.user_id = _user_id AND b.company_id = _company_id));
$$;

-- 3. is_date_locked is only used by SECURITY DEFINER triggers: not callable by clients
REVOKE EXECUTE ON FUNCTION public.is_date_locked(uuid, uuid, date) FROM anon, authenticated, PUBLIC;

-- 4. Company-level write scoping for financial documents
DROP POLICY IF EXISTS invoices_accountant_insert ON public.invoices;
CREATE POLICY invoices_accountant_insert ON public.invoices FOR INSERT TO authenticated
WITH CHECK (
  public.has_branch_access(auth.uid(), branch_id)
  AND public.branch_in_company(branch_id, company_id)
  AND public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
);

DROP POLICY IF EXISTS invoices_accountant_update ON public.invoices;
CREATE POLICY invoices_accountant_update ON public.invoices FOR UPDATE TO authenticated
USING (
  public.has_branch_access(auth.uid(), branch_id)
  AND public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
)
WITH CHECK (
  public.has_branch_access(auth.uid(), branch_id)
  AND public.branch_in_company(branch_id, company_id)
  AND public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
);

DROP POLICY IF EXISTS invoices_admin_delete ON public.invoices;
CREATE POLICY invoices_admin_delete ON public.invoices FOR DELETE TO authenticated
USING (
  public.has_branch_access(auth.uid(), branch_id)
  AND public.has_any_role(auth.uid(), ARRAY['admin','finance_manager']::app_role[])
);

-- Restrictive company/branch consistency guard for payments and journal entries
DROP POLICY IF EXISTS payments_company_branch_consistency ON public.payments;
CREATE POLICY payments_company_branch_consistency ON public.payments AS RESTRICTIVE
FOR ALL TO authenticated
USING (true)
WITH CHECK (public.branch_in_company(branch_id, company_id));

DROP POLICY IF EXISTS je_company_branch_consistency ON public.journal_entries;
CREATE POLICY je_company_branch_consistency ON public.journal_entries AS RESTRICTIVE
FOR ALL TO authenticated
USING (true)
WITH CHECK (public.branch_in_company(branch_id, company_id));

-- 5. Explicit admin-only write coverage for module access grants
DROP POLICY IF EXISTS user_module_access_admin_write_only ON public.user_module_access;
CREATE POLICY user_module_access_admin_write_only ON public.user_module_access AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.is_admin(auth.uid()) OR user_id = auth.uid())
WITH CHECK (public.is_admin(auth.uid()));