
-- =====================================================
-- ENUMS
-- =====================================================
CREATE TYPE public.app_role AS ENUM (
  'admin',
  'finance_manager',
  'accounting_manager',
  'chief_accountant',
  'accountant',
  'internal_auditor'
);

CREATE TYPE public.account_type AS ENUM (
  'asset',
  'liability',
  'equity',
  'income',
  'expense'
);

CREATE TYPE public.journal_type AS ENUM (
  'sales',
  'purchase',
  'bank',
  'cash',
  'misc'
);

CREATE TYPE public.fiscal_period_status AS ENUM (
  'open',
  'closed',
  'locked'
);

CREATE TYPE public.je_status AS ENUM (
  'draft',
  'posted',
  'cancelled'
);

CREATE TYPE public.tax_type AS ENUM (
  'sale',
  'purchase'
);

CREATE TYPE public.payment_method_type AS ENUM (
  'cash',
  'bank_transfer',
  'check',
  'card',
  'other'
);

-- =====================================================
-- UTILITY: updated_at trigger
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =====================================================
-- COMPANIES & BRANCHES
-- =====================================================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  vat_number TEXT,
  cr_number TEXT,
  address_ar TEXT,
  address_en TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  logo_url TEXT,
  default_currency TEXT NOT NULL DEFAULT 'SAR',
  fiscal_year_start_month INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  address_ar TEXT,
  address_en TEXT,
  phone TEXT,
  is_main BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- PROFILES
-- =====================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  display_name_ar TEXT,
  display_name_en TEXT,
  phone TEXT,
  avatar_url TEXT,
  default_company_id UUID REFERENCES public.companies(id),
  default_branch_id UUID REFERENCES public.branches(id),
  preferred_language TEXT NOT NULL DEFAULT 'ar',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- ROLES & PERMISSIONS
-- =====================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role, company_id)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_branch_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, branch_id)
);

GRANT SELECT ON public.user_branch_access TO authenticated;
GRANT ALL ON public.user_branch_access TO service_role;
ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER FUNCTIONS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.has_branch_access(_user_id UUID, _branch_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR EXISTS (SELECT 1 FROM public.user_branch_access WHERE user_id = _user_id AND branch_id = _branch_id);
$$;

CREATE OR REPLACE FUNCTION public.has_company_access(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_branch_access uba
      JOIN public.branches b ON b.id = uba.branch_id
      WHERE uba.user_id = _user_id AND b.company_id = _company_id
    );
$$;

-- ROLE/PROFILE RLS POLICIES
CREATE POLICY "profiles_self_read" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_admin_delete" ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "user_branch_access_self_read" ON public.user_branch_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- COMPANIES & BRANCHES RLS
CREATE POLICY "companies_read_accessible" ON public.companies FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), id));
CREATE POLICY "companies_admin_all" ON public.companies FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "branches_read_accessible" ON public.branches FOR SELECT TO authenticated
  USING (public.has_branch_access(auth.uid(), id));
CREATE POLICY "branches_admin_all" ON public.branches FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =====================================================
-- HANDLE NEW USER TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name_en, display_name_ar)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name_en', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name_ar', split_part(NEW.email, '@', 1))
  );

  -- Auto-grant admin to the founding admin email
  IF lower(NEW.email) = 'mohamed.elsheikh@alhayat.sa' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- CURRENCIES & EXCHANGE RATES
-- =====================================================
CREATE TABLE public.currencies (
  code TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  symbol TEXT,
  decimals INT NOT NULL DEFAULT 2,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.currencies TO authenticated;
GRANT ALL ON public.currencies TO service_role;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "currencies_read_all" ON public.currencies FOR SELECT TO authenticated USING (true);
CREATE POLICY "currencies_admin_write" ON public.currencies FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  currency_code TEXT NOT NULL REFERENCES public.currencies(code),
  rate_date DATE NOT NULL,
  rate NUMERIC(18, 8) NOT NULL CHECK (rate > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, currency_code, rate_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fx_company_access" ON public.exchange_rates FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "fx_admin_write" ON public.exchange_rates FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- =====================================================
-- FISCAL PERIODS
-- =====================================================
CREATE TABLE public.fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  status fiscal_period_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (date_to >= date_from)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiscal_periods TO authenticated;
GRANT ALL ON public.fiscal_periods TO service_role;
ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_fp_updated BEFORE UPDATE ON public.fiscal_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "fp_company_access" ON public.fiscal_periods FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "fp_finance_write" ON public.fiscal_periods FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- =====================================================
-- CHART OF ACCOUNTS
-- =====================================================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  account_type account_type NOT NULL,
  parent_id UUID REFERENCES public.accounts(id) ON DELETE RESTRICT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  currency_code TEXT REFERENCES public.currencies(code),
  is_reconcilable BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_accounts_company ON public.accounts(company_id);
CREATE INDEX idx_accounts_parent ON public.accounts(parent_id);

CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "accounts_company_read" ON public.accounts FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "accounts_finance_write" ON public.accounts FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- =====================================================
-- COST CENTERS (hierarchical, unlimited depth)
-- =====================================================
CREATE TABLE public.cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  parent_id UUID REFERENCES public.cost_centers(id) ON DELETE RESTRICT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_centers TO authenticated;
GRANT ALL ON public.cost_centers TO service_role;
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cc_company ON public.cost_centers(company_id);
CREATE INDEX idx_cc_parent ON public.cost_centers(parent_id);

CREATE TRIGGER trg_cc_updated BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "cc_company_read" ON public.cost_centers FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "cc_finance_write" ON public.cost_centers FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- =====================================================
-- PAYMENT TERMS
-- =====================================================
CREATE TABLE public.payment_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  days INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_terms TO authenticated;
GRANT ALL ON public.payment_terms TO service_role;
ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_pt_updated BEFORE UPDATE ON public.payment_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "pt_company_read" ON public.payment_terms FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "pt_finance_write" ON public.payment_terms FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- =====================================================
-- TAXES
-- =====================================================
CREATE TABLE public.taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  rate NUMERIC(7, 4) NOT NULL DEFAULT 0,
  tax_type tax_type NOT NULL,
  account_id UUID REFERENCES public.accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.taxes TO authenticated;
GRANT ALL ON public.taxes TO service_role;
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_taxes_updated BEFORE UPDATE ON public.taxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "taxes_company_read" ON public.taxes FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "taxes_finance_write" ON public.taxes FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- =====================================================
-- JOURNALS (Sales, Purchase, Bank, Cash, Misc)
-- =====================================================
CREATE TABLE public.journals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  journal_type journal_type NOT NULL,
  default_debit_account_id UUID REFERENCES public.accounts(id),
  default_credit_account_id UUID REFERENCES public.accounts(id),
  currency_code TEXT REFERENCES public.currencies(code),
  sequence_prefix TEXT,
  sequence_next INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journals TO authenticated;
GRANT ALL ON public.journals TO service_role;
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_journals_updated BEFORE UPDATE ON public.journals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "journals_company_read" ON public.journals FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "journals_finance_write" ON public.journals FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- =====================================================
-- PARTNERS (Customer + Vendor unified)
-- =====================================================
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_customer BOOLEAN NOT NULL DEFAULT false,
  is_vendor BOOLEAN NOT NULL DEFAULT false,
  vat_number TEXT,
  cr_number TEXT,
  email TEXT,
  phone TEXT,
  address_ar TEXT,
  address_en TEXT,
  city TEXT,
  country TEXT DEFAULT 'SA',
  payment_term_id UUID REFERENCES public.payment_terms(id),
  credit_limit NUMERIC(18, 2) DEFAULT 0,
  receivable_account_id UUID REFERENCES public.accounts(id),
  payable_account_id UUID REFERENCES public.accounts(id),
  default_sale_tax_id UUID REFERENCES public.taxes(id),
  default_purchase_tax_id UUID REFERENCES public.taxes(id),
  currency_code TEXT REFERENCES public.currencies(code),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code),
  CHECK (is_customer OR is_vendor)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partners TO authenticated;
GRANT ALL ON public.partners TO service_role;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_partners_company ON public.partners(company_id);
CREATE INDEX idx_partners_customer ON public.partners(company_id) WHERE is_customer;
CREATE INDEX idx_partners_vendor ON public.partners(company_id) WHERE is_vendor;

CREATE TRIGGER trg_partners_updated BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "partners_company_read" ON public.partners FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "partners_finance_write" ON public.partners FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- =====================================================
-- BANK ACCOUNTS & PAYMENT METHODS
-- =====================================================
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id),
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT,
  iban TEXT,
  swift_code TEXT,
  currency_code TEXT NOT NULL DEFAULT 'SAR' REFERENCES public.currencies(code),
  gl_account_id UUID REFERENCES public.accounts(id),
  journal_id UUID REFERENCES public.journals(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_ba_updated BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "ba_company_read" ON public.bank_accounts FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "ba_finance_write" ON public.bank_accounts FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  method_type payment_method_type NOT NULL,
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  is_inbound BOOLEAN NOT NULL DEFAULT true,
  is_outbound BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_pm_updated BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "pm_company_read" ON public.payment_methods FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));
CREATE POLICY "pm_finance_write" ON public.payment_methods FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- =====================================================
-- JOURNAL ENTRIES & LINES (Core GL)
-- =====================================================
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  journal_id UUID NOT NULL REFERENCES public.journals(id) ON DELETE RESTRICT,
  period_id UUID REFERENCES public.fiscal_periods(id),
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  reference TEXT,
  description TEXT,
  status je_status NOT NULL DEFAULT 'draft',
  source_type TEXT,
  source_id UUID,
  currency_code TEXT NOT NULL DEFAULT 'SAR' REFERENCES public.currencies(code),
  total_debit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  created_by UUID,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, entry_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entries TO authenticated;
GRANT ALL ON public.journal_entries TO service_role;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_je_company_date ON public.journal_entries(company_id, entry_date DESC);
CREATE INDEX idx_je_branch ON public.journal_entries(branch_id);
CREATE INDEX idx_je_journal ON public.journal_entries(journal_id);
CREATE INDEX idx_je_status ON public.journal_entries(status);

CREATE TRIGGER trg_je_updated BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "je_branch_read" ON public.journal_entries FOR SELECT TO authenticated
  USING (public.has_branch_access(auth.uid(), branch_id));
CREATE POLICY "je_accountant_insert" ON public.journal_entries FOR INSERT TO authenticated
  WITH CHECK (
    public.has_branch_access(auth.uid(), branch_id)
    AND public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
  );
CREATE POLICY "je_accountant_update" ON public.journal_entries FOR UPDATE TO authenticated
  USING (
    public.has_branch_access(auth.uid(), branch_id)
    AND public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
  );
CREATE POLICY "je_admin_delete" ON public.journal_entries FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager']::app_role[]));

CREATE TABLE public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  line_number INT NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  partner_id UUID REFERENCES public.partners(id),
  cost_center_id UUID REFERENCES public.cost_centers(id),
  description TEXT,
  debit NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(18, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  currency_code TEXT REFERENCES public.currencies(code),
  fx_rate NUMERIC(18, 8) DEFAULT 1,
  tax_id UUID REFERENCES public.taxes(id),
  reconciled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT (debit > 0 AND credit > 0))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_entry_lines TO authenticated;
GRANT ALL ON public.journal_entry_lines TO service_role;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_jel_entry ON public.journal_entry_lines(entry_id);
CREATE INDEX idx_jel_account ON public.journal_entry_lines(account_id);
CREATE INDEX idx_jel_partner ON public.journal_entry_lines(partner_id);
CREATE INDEX idx_jel_cc ON public.journal_entry_lines(cost_center_id);

CREATE POLICY "jel_read_via_entry" ON public.journal_entry_lines FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = entry_id AND public.has_branch_access(auth.uid(), je.branch_id)
  ));
CREATE POLICY "jel_write_via_entry" ON public.journal_entry_lines FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = entry_id
      AND public.has_branch_access(auth.uid(), je.branch_id)
      AND public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.id = entry_id
      AND public.has_branch_access(auth.uid(), je.branch_id)
      AND public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
  ));

-- =====================================================
-- SEED: Base currencies
-- =====================================================
INSERT INTO public.currencies (code, name_ar, name_en, symbol, decimals) VALUES
  ('SAR', 'ريال سعودي', 'Saudi Riyal', '﷼', 2),
  ('USD', 'دولار أمريكي', 'US Dollar', '$', 2),
  ('EUR', 'يورو', 'Euro', '€', 2),
  ('AED', 'درهم إماراتي', 'UAE Dirham', 'د.إ', 2),
  ('GBP', 'جنيه إسترليني', 'British Pound', '£', 2),
  ('EGP', 'جنيه مصري', 'Egyptian Pound', 'ج.م', 2),
  ('KWD', 'دينار كويتي', 'Kuwaiti Dinar', 'د.ك', 3);
