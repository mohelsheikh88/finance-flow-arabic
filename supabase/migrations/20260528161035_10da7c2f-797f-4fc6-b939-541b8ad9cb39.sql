
-- Enums
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE approval_doc_type AS ENUM ('journal_entry', 'invoice', 'payment', 'asset_disposal');
CREATE TYPE depreciation_method AS ENUM ('straight_line', 'declining_balance');
CREATE TYPE asset_status AS ENUM ('draft', 'active', 'fully_depreciated', 'disposed');

-- =================== APPROVAL WORKFLOWS ===================
CREATE TABLE public.approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  document_type approval_doc_type NOT NULL,
  min_amount NUMERIC NOT NULL DEFAULT 0,
  max_amount NUMERIC,
  currency_code TEXT NOT NULL DEFAULT 'SAR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_workflows TO authenticated;
GRANT ALL ON public.approval_workflows TO service_role;
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY wf_read ON public.approval_workflows FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY wf_write ON public.approval_workflows FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role]))
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE TABLE public.approval_steps_def (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  required_role app_role NOT NULL,
  step_name_ar TEXT NOT NULL,
  step_name_en TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workflow_id, step_order)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_steps_def TO authenticated;
GRANT ALL ON public.approval_steps_def TO service_role;
ALTER TABLE public.approval_steps_def ENABLE ROW LEVEL SECURITY;

CREATE POLICY wfs_read ON public.approval_steps_def FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.approval_workflows w WHERE w.id = workflow_id AND has_company_access(auth.uid(), w.company_id)));
CREATE POLICY wfs_write ON public.approval_steps_def FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role]))
  WITH CHECK (EXISTS (SELECT 1 FROM public.approval_workflows w WHERE w.id = workflow_id AND has_company_access(auth.uid(), w.company_id)));

-- =================== APPROVAL REQUESTS ===================
CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  workflow_id UUID NOT NULL REFERENCES public.approval_workflows(id),
  document_type approval_doc_type NOT NULL,
  document_id UUID NOT NULL,
  document_reference TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'SAR',
  status approval_status NOT NULL DEFAULT 'pending',
  current_step INTEGER NOT NULL DEFAULT 1,
  requested_by UUID NOT NULL,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_req_doc ON public.approval_requests(document_type, document_id);
CREATE INDEX idx_approval_req_status ON public.approval_requests(status, current_step);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_requests TO authenticated;
GRANT ALL ON public.approval_requests TO service_role;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY ar_read ON public.approval_requests FOR SELECT TO authenticated
  USING (has_branch_access(auth.uid(), branch_id));
CREATE POLICY ar_insert ON public.approval_requests FOR INSERT TO authenticated
  WITH CHECK (has_branch_access(auth.uid(), branch_id));
CREATE POLICY ar_update ON public.approval_requests FOR UPDATE TO authenticated
  USING (has_branch_access(auth.uid(), branch_id));

CREATE TABLE public.approval_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  action approval_status NOT NULL,
  acted_by UUID NOT NULL,
  acted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  comments TEXT
);

CREATE INDEX idx_approval_actions_req ON public.approval_actions(request_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_actions TO authenticated;
GRANT ALL ON public.approval_actions TO service_role;
ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY aa_read ON public.approval_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.approval_requests r WHERE r.id = request_id AND has_branch_access(auth.uid(), r.branch_id)));
CREATE POLICY aa_insert ON public.approval_actions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.approval_requests r WHERE r.id = request_id AND has_branch_access(auth.uid(), r.branch_id)));

-- =================== FIXED ASSETS ===================
CREATE TABLE public.asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  asset_account_id UUID,
  depreciation_account_id UUID,
  accumulated_depreciation_account_id UUID,
  default_useful_life_months INTEGER NOT NULL DEFAULT 60,
  default_depreciation_method depreciation_method NOT NULL DEFAULT 'straight_line',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_categories TO authenticated;
GRANT ALL ON public.asset_categories TO service_role;
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY ac_read ON public.asset_categories FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id));
CREATE POLICY ac_write ON public.asset_categories FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role]))
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE TABLE public.fixed_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  category_id UUID REFERENCES public.asset_categories(id),
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT,
  acquisition_date DATE NOT NULL,
  acquisition_cost NUMERIC NOT NULL,
  salvage_value NUMERIC NOT NULL DEFAULT 0,
  useful_life_months INTEGER NOT NULL,
  depreciation_method depreciation_method NOT NULL DEFAULT 'straight_line',
  depreciation_start_date DATE NOT NULL,
  accumulated_depreciation NUMERIC NOT NULL DEFAULT 0,
  current_book_value NUMERIC NOT NULL DEFAULT 0,
  asset_account_id UUID,
  depreciation_account_id UUID,
  accumulated_depreciation_account_id UUID,
  status asset_status NOT NULL DEFAULT 'draft',
  partner_id UUID,
  invoice_id UUID,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

CREATE INDEX idx_assets_branch ON public.fixed_assets(branch_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_assets TO authenticated;
GRANT ALL ON public.fixed_assets TO service_role;
ALTER TABLE public.fixed_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY fa_read ON public.fixed_assets FOR SELECT TO authenticated
  USING (has_branch_access(auth.uid(), branch_id));
CREATE POLICY fa_write ON public.fixed_assets FOR ALL TO authenticated
  USING (has_branch_access(auth.uid(), branch_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role, 'chief_accountant'::app_role, 'accountant'::app_role]))
  WITH CHECK (has_branch_access(auth.uid(), branch_id));

CREATE TABLE public.depreciation_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id) ON DELETE CASCADE,
  period_date DATE NOT NULL,
  depreciation_amount NUMERIC NOT NULL,
  accumulated_depreciation NUMERIC NOT NULL,
  book_value NUMERIC NOT NULL,
  is_posted BOOLEAN NOT NULL DEFAULT false,
  journal_entry_id UUID,
  posted_at TIMESTAMPTZ,
  posted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(asset_id, period_date)
);

CREATE INDEX idx_dep_sched_asset ON public.depreciation_schedule(asset_id, period_date);
CREATE INDEX idx_dep_sched_posted ON public.depreciation_schedule(is_posted, period_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.depreciation_schedule TO authenticated;
GRANT ALL ON public.depreciation_schedule TO service_role;
ALTER TABLE public.depreciation_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY ds_read ON public.depreciation_schedule FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fixed_assets a WHERE a.id = asset_id AND has_branch_access(auth.uid(), a.branch_id)));
CREATE POLICY ds_write ON public.depreciation_schedule FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fixed_assets a WHERE a.id = asset_id AND has_branch_access(auth.uid(), a.branch_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role, 'chief_accountant'::app_role, 'accountant'::app_role])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fixed_assets a WHERE a.id = asset_id AND has_branch_access(auth.uid(), a.branch_id)));

CREATE TABLE public.asset_disposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.fixed_assets(id),
  disposal_date DATE NOT NULL,
  disposal_type TEXT NOT NULL,
  proceeds NUMERIC NOT NULL DEFAULT 0,
  book_value_at_disposal NUMERIC NOT NULL,
  gain_loss NUMERIC NOT NULL,
  notes TEXT,
  journal_entry_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_disposals TO authenticated;
GRANT ALL ON public.asset_disposals TO service_role;
ALTER TABLE public.asset_disposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY ad_read ON public.asset_disposals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fixed_assets a WHERE a.id = asset_id AND has_branch_access(auth.uid(), a.branch_id)));
CREATE POLICY ad_write ON public.asset_disposals FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.fixed_assets a WHERE a.id = asset_id AND has_branch_access(auth.uid(), a.branch_id) AND has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role])))
  WITH CHECK (EXISTS (SELECT 1 FROM public.fixed_assets a WHERE a.id = asset_id AND has_branch_access(auth.uid(), a.branch_id)));

-- Timestamp triggers
CREATE TRIGGER tr_wf_upd BEFORE UPDATE ON public.approval_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_ar_upd BEFORE UPDATE ON public.approval_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_ac_upd BEFORE UPDATE ON public.asset_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_fa_upd BEFORE UPDATE ON public.fixed_assets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
