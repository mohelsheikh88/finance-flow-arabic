
-- ===== 20260528153235_a3f78d2a-a9e8-42d0-876a-bd237cdd9218.sql =====

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

-- ===== 20260528160308_0684aa11-0de6-4b54-ab64-21f0b7fa4ba1.sql =====
-- Enums
CREATE TYPE public.invoice_type AS ENUM ('customer', 'vendor');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'posted', 'paid', 'partially_paid', 'cancelled');
CREATE TYPE public.payment_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.payment_status AS ENUM ('draft', 'posted', 'cancelled');

-- INVOICES
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  invoice_type invoice_type NOT NULL,
  partner_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  currency_code TEXT NOT NULL DEFAULT 'SAR',
  reference TEXT,
  notes TEXT,
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(18,2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(18,2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'draft',
  journal_id UUID,
  journal_entry_id UUID,
  created_by UUID,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_company ON public.invoices(company_id);
CREATE INDEX idx_invoices_branch ON public.invoices(branch_id);
CREATE INDEX idx_invoices_partner ON public.invoices(partner_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);
CREATE INDEX idx_invoices_date ON public.invoices(invoice_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_branch_read ON public.invoices
  FOR SELECT TO authenticated
  USING (public.has_branch_access(auth.uid(), branch_id));

CREATE POLICY invoices_accountant_insert ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_branch_access(auth.uid(), branch_id) AND
    public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
  );

CREATE POLICY invoices_accountant_update ON public.invoices
  FOR UPDATE TO authenticated
  USING (
    public.has_branch_access(auth.uid(), branch_id) AND
    public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
  );

CREATE POLICY invoices_admin_delete ON public.invoices
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager']::app_role[]));

CREATE TRIGGER tr_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- INVOICE LINES
CREATE TABLE public.invoice_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL,
  line_number INTEGER NOT NULL,
  description TEXT,
  account_id UUID NOT NULL,
  cost_center_id UUID,
  quantity NUMERIC(18,4) NOT NULL DEFAULT 1,
  unit_price NUMERIC(18,4) NOT NULL DEFAULT 0,
  tax_id UUID,
  tax_rate NUMERIC(6,3) NOT NULL DEFAULT 0,
  subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  total NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_lines_invoice ON public.invoice_lines(invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_lines TO authenticated;
GRANT ALL ON public.invoice_lines TO service_role;

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY il_read_via_invoice ON public.invoice_lines
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_lines.invoice_id AND public.has_branch_access(auth.uid(), i.branch_id)
  ));

CREATE POLICY il_write_via_invoice ON public.invoice_lines
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND public.has_branch_access(auth.uid(), i.branch_id)
      AND public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND public.has_branch_access(auth.uid(), i.branch_id)
      AND public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
  ));

-- PAYMENTS
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  direction payment_direction NOT NULL,
  partner_id UUID NOT NULL,
  payment_number TEXT NOT NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency_code TEXT NOT NULL DEFAULT 'SAR',
  bank_account_id UUID,
  payment_method_id UUID,
  journal_id UUID,
  journal_entry_id UUID,
  reference TEXT,
  notes TEXT,
  status payment_status NOT NULL DEFAULT 'draft',
  created_by UUID,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_company ON public.payments(company_id);
CREATE INDEX idx_payments_branch ON public.payments(branch_id);
CREATE INDEX idx_payments_partner ON public.payments(partner_id);
CREATE INDEX idx_payments_date ON public.payments(payment_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_branch_read ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_branch_access(auth.uid(), branch_id));

CREATE POLICY payments_accountant_insert ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_branch_access(auth.uid(), branch_id) AND
    public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
  );

CREATE POLICY payments_accountant_update ON public.payments
  FOR UPDATE TO authenticated
  USING (
    public.has_branch_access(auth.uid(), branch_id) AND
    public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
  );

CREATE POLICY payments_admin_delete ON public.payments
  FOR DELETE TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager']::app_role[]));

CREATE TRIGGER tr_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PAYMENT ALLOCATIONS
CREATE TABLE public.payment_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  allocated_amount NUMERIC(18,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pa_payment ON public.payment_allocations(payment_id);
CREATE INDEX idx_pa_invoice ON public.payment_allocations(invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_allocations TO authenticated;
GRANT ALL ON public.payment_allocations TO service_role;

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY pa_read_via_payment ON public.payment_allocations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = payment_allocations.payment_id AND public.has_branch_access(auth.uid(), p.branch_id)
  ));

CREATE POLICY pa_write_via_payment ON public.payment_allocations
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = payment_allocations.payment_id
      AND public.has_branch_access(auth.uid(), p.branch_id)
      AND public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.payments p
    WHERE p.id = payment_allocations.payment_id
      AND public.has_branch_access(auth.uid(), p.branch_id)
      AND public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant','accountant']::app_role[])
  ));
-- ===== 20260528161035_10da7c2f-797f-4fc6-b939-541b8ad9cb39.sql =====

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

-- ===== 20260528164411_039f0147-c52c-4f6c-b3fb-1333ac25dd04.sql =====

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

-- ===== 20260528171845_c34017f8-0391-49f9-919d-99c1b325d1ca.sql =====
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', r.tablename);
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', r.tablename);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;
-- ===== 20260528173722_142efb49-1cea-4d92-88ee-c3f8eb9c391d.sql =====

-- 1. Audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  user_id UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_data JSONB,
  new_data JSONB
);

CREATE INDEX idx_audit_log_changed_at ON public.audit_log (changed_at DESC);
CREATE INDEX idx_audit_log_table_name ON public.audit_log (table_name);
CREATE INDEX idx_audit_log_user_id ON public.audit_log (user_id);
CREATE INDEX idx_audit_log_record_id ON public.audit_log (record_id);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_admin_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 2. Generic trigger function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    BEGIN v_record_id := (v_old->>'id')::UUID; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    BEGIN v_record_id := (v_new->>'id')::UUID; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
  ELSE
    v_old := NULL;
    v_new := to_jsonb(NEW);
    BEGIN v_record_id := (v_new->>'id')::UUID; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, action, user_id, old_data, new_data)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Attach trigger to every public table (excluding audit_log itself)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'audit_log'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I;
       CREATE TRIGGER trg_audit_%I
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();',
      r.tablename, r.tablename, r.tablename, r.tablename
    );
  END LOOP;
END$$;

-- ===== 20260528173737_381db218-0932-411c-87fa-5a3a054d1fb3.sql =====
REVOKE EXECUTE ON FUNCTION public.log_audit_event() FROM PUBLIC, anon, authenticated;
-- ===== 20260528180845_faeabc90-72c5-462e-b82b-64dcf1084e5d.sql =====
-- Create account_types table for customizable account types per company
CREATE TABLE public.account_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  classification account_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_types TO authenticated;
GRANT ALL ON public.account_types TO service_role;

ALTER TABLE public.account_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY at_company_read ON public.account_types
  FOR SELECT TO authenticated
  USING (has_company_access(auth.uid(), company_id));

CREATE POLICY at_finance_write ON public.account_types
  FOR ALL TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role, 'chief_accountant'::app_role]))
  WITH CHECK (has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_account_types_updated
  BEFORE UPDATE ON public.account_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default 5 classifications for every existing company
INSERT INTO public.account_types (company_id, code, name_ar, name_en, classification)
SELECT c.id, 'ASSET',     'أصول',         'Assets',      'asset'::account_type     FROM public.companies c
UNION ALL SELECT c.id, 'LIABILITY', 'التزامات',      'Liabilities', 'liability'::account_type FROM public.companies c
UNION ALL SELECT c.id, 'EQUITY',    'حقوق الملكية',  'Equity',      'equity'::account_type    FROM public.companies c
UNION ALL SELECT c.id, 'INCOME',    'إيرادات',       'Income',      'income'::account_type    FROM public.companies c
UNION ALL SELECT c.id, 'EXPENSE',   'مصروفات',       'Expenses',    'expense'::account_type   FROM public.companies c
ON CONFLICT DO NOTHING;

-- Link accounts to account_types
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS account_type_id uuid REFERENCES public.account_types(id) ON DELETE RESTRICT;

-- Backfill: assign each account to the default type matching its current classification within its company
UPDATE public.accounts a
SET account_type_id = t.id
FROM public.account_types t
WHERE a.account_type_id IS NULL
  AND t.company_id = a.company_id
  AND t.classification = a.account_type
  AND t.code IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE');

CREATE INDEX IF NOT EXISTS idx_accounts_account_type_id ON public.accounts(account_type_id);

-- Auto-seed defaults whenever a new company is created
CREATE OR REPLACE FUNCTION public.seed_default_account_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.account_types (company_id, code, name_ar, name_en, classification) VALUES
    (NEW.id, 'ASSET',     'أصول',         'Assets',      'asset'),
    (NEW.id, 'LIABILITY', 'التزامات',      'Liabilities', 'liability'),
    (NEW.id, 'EQUITY',    'حقوق الملكية',  'Equity',      'equity'),
    (NEW.id, 'INCOME',    'إيرادات',       'Income',      'income'),
    (NEW.id, 'EXPENSE',   'مصروفات',       'Expenses',    'expense')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_companies_seed_account_types
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_account_types();

-- Keep accounts.account_type enum column in sync from account_type_id.classification
CREATE OR REPLACE FUNCTION public.sync_account_type_from_type_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cls account_type;
BEGIN
  IF NEW.account_type_id IS NOT NULL THEN
    SELECT classification INTO v_cls FROM public.account_types WHERE id = NEW.account_type_id;
    IF v_cls IS NOT NULL THEN
      NEW.account_type := v_cls;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounts_sync_type
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_type_from_type_id();
-- ===== 20260528181647_0f948012-a90f-4ac7-abe3-0b4aed5a174c.sql =====

-- 1) Classifications table
CREATE TABLE public.classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  statement text NOT NULL CHECK (statement IN ('balance_sheet','income_statement')),
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit','credit')),
  bucket public.account_type NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classifications TO authenticated;
GRANT ALL ON public.classifications TO service_role;

ALTER TABLE public.classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY cls_company_read ON public.classifications
  FOR SELECT TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY cls_finance_write ON public.classifications
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','finance_manager','accounting_manager','chief_accountant']::app_role[]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE TRIGGER trg_cls_updated BEFORE UPDATE ON public.classifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Seeder function + trigger on companies
CREATE OR REPLACE FUNCTION public.seed_default_classifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.classifications (company_id, code, name_ar, name_en, statement, normal_balance, bucket) VALUES
    (NEW.id, 'ASSET',     'أصول',         'Assets',      'balance_sheet',    'debit',  'asset'),
    (NEW.id, 'LIABILITY', 'التزامات',     'Liabilities', 'balance_sheet',    'credit', 'liability'),
    (NEW.id, 'EQUITY',    'حقوق الملكية', 'Equity',      'balance_sheet',    'credit', 'equity'),
    (NEW.id, 'INCOME',    'إيرادات',      'Income',      'income_statement', 'credit', 'income'),
    (NEW.id, 'EXPENSE',   'مصروفات',      'Expenses',    'income_statement', 'debit',  'expense')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_default_classifications ON public.companies;
CREATE TRIGGER trg_seed_default_classifications
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_classifications();

-- Backfill for existing companies
INSERT INTO public.classifications (company_id, code, name_ar, name_en, statement, normal_balance, bucket)
SELECT c.id, v.code, v.name_ar, v.name_en, v.statement, v.normal_balance, v.bucket::public.account_type
FROM public.companies c
CROSS JOIN (VALUES
  ('ASSET','أصول','Assets','balance_sheet','debit','asset'),
  ('LIABILITY','التزامات','Liabilities','balance_sheet','credit','liability'),
  ('EQUITY','حقوق الملكية','Equity','balance_sheet','credit','equity'),
  ('INCOME','إيرادات','Income','income_statement','credit','income'),
  ('EXPENSE','مصروفات','Expenses','income_statement','debit','expense')
) AS v(code, name_ar, name_en, statement, normal_balance, bucket)
ON CONFLICT DO NOTHING;

-- 3) Link account_types to classifications (optional)
ALTER TABLE public.account_types
  ADD COLUMN IF NOT EXISTS classification_id uuid REFERENCES public.classifications(id) ON DELETE SET NULL;

-- Backfill links via matching company + matching legacy classification → bucket
UPDATE public.account_types at
SET classification_id = c.id
FROM public.classifications c
WHERE at.classification_id IS NULL
  AND c.company_id = at.company_id
  AND c.bucket = at.classification;

-- Sync trigger: when classification_id is set, mirror its bucket into legacy enum column
CREATE OR REPLACE FUNCTION public.sync_account_type_classification_from_cls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket public.account_type;
BEGIN
  IF NEW.classification_id IS NOT NULL THEN
    SELECT bucket INTO v_bucket FROM public.classifications WHERE id = NEW.classification_id;
    IF v_bucket IS NOT NULL THEN
      NEW.classification := v_bucket;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_at_cls ON public.account_types;
CREATE TRIGGER trg_sync_at_cls
  BEFORE INSERT OR UPDATE ON public.account_types
  FOR EACH ROW EXECUTE FUNCTION public.sync_account_type_classification_from_cls();

-- ===== 20260528190524_47fa2341-1ac6-41fa-8a58-84407222ee73.sql =====

ALTER TABLE public.classifications ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_classifications_sort ON public.classifications(company_id, sort_order);

-- Seed sort_order with current ordering (statement, code) per company
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id ORDER BY statement, code) * 10 AS rn
  FROM public.classifications
)
UPDATE public.classifications c SET sort_order = o.rn FROM ordered o WHERE c.id = o.id;

-- ===== 20260528193649_e84e174c-e223-490a-8456-7616a67cf4af.sql =====
ALTER TABLE public.account_types
  ADD COLUMN IF NOT EXISTS parent_id uuid NULL REFERENCES public.account_types(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_account_types_parent_id ON public.account_types(parent_id);

-- Ensure parent (if any) belongs to same company and is a group, and classification matches parent
CREATE OR REPLACE FUNCTION public.validate_account_type_parent()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  p record;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF NEW.parent_id = NEW.id THEN
      RAISE EXCEPTION 'Account type cannot be its own parent';
    END IF;
    SELECT id, company_id, is_group, classification
      INTO p FROM public.account_types WHERE id = NEW.parent_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Parent account type not found';
    END IF;
    IF p.company_id <> NEW.company_id THEN
      RAISE EXCEPTION 'Parent must belong to same company';
    END IF;
    IF p.is_group = false THEN
      RAISE EXCEPTION 'Parent must be a group account type';
    END IF;
    IF p.classification <> NEW.classification THEN
      RAISE EXCEPTION 'Child classification must match parent classification';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_account_type_parent ON public.account_types;
CREATE TRIGGER trg_validate_account_type_parent
BEFORE INSERT OR UPDATE ON public.account_types
FOR EACH ROW EXECUTE FUNCTION public.validate_account_type_parent();
-- ===== 20260528195031_7789479c-60dc-4191-9e31-1b6b60aee606.sql =====
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_partner_id_fkey
  FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE RESTRICT;
-- ===== 20260528195638_24cfdd77-9988-47e2-a7a2-8bad0bdddd1f.sql =====
ALTER TABLE public.account_types ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_account_types_sort ON public.account_types(company_id, parent_id, sort_order);
-- Seed initial sort_order based on code per (company, parent)
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY company_id, COALESCE(parent_id::text, 'root'), classification ORDER BY code) * 10 AS rn
  FROM public.account_types
)
UPDATE public.account_types t SET sort_order = r.rn FROM ranked r WHERE r.id = t.id AND t.sort_order = 0;
-- ===== 20260528202611_7a9e117e-122c-4695-bddb-14bfcc92f584.sql =====
DROP TRIGGER IF EXISTS trg_seed_default_account_types ON public.companies;
DROP TRIGGER IF EXISTS seed_default_account_types ON public.companies;
DROP TRIGGER IF EXISTS companies_seed_default_account_types ON public.companies;
-- ===== 20260528215423_499799d7-80a9-4f3a-a91f-91d1ad6cd7b6.sql =====
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
-- ===== 20260528224635_80b9ac81-9f79-49f1-aecf-4d03160269ca.sql =====
-- 1) Create accounting_buckets table
CREATE TABLE public.accounting_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  statement text NOT NULL DEFAULT 'balance_sheet',
  normal_balance text NOT NULL DEFAULT 'debit',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

-- 2) Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_buckets TO authenticated;
GRANT ALL ON public.accounting_buckets TO service_role;

-- 3) RLS
ALTER TABLE public.accounting_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ab_company_read"
  ON public.accounting_buckets FOR SELECT
  TO authenticated
  USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "ab_finance_write"
  ON public.accounting_buckets FOR ALL
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin'::app_role, 'finance_manager'::app_role, 'accounting_manager'::app_role, 'chief_accountant'::app_role]))
  WITH CHECK (public.has_company_access(auth.uid(), company_id));

-- 4) Updated-at trigger
CREATE TRIGGER trg_accounting_buckets_updated_at
  BEFORE UPDATE ON public.accounting_buckets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Seed defaults for all existing companies
INSERT INTO public.accounting_buckets (company_id, code, name_ar, name_en, statement, normal_balance, sort_order)
SELECT c.id, v.code, v.name_ar, v.name_en, v.statement, v.normal_balance, v.sort_order
FROM public.companies c
CROSS JOIN (VALUES
  ('asset',     'أصول',         'Assets',      'balance_sheet',    'debit',  10),
  ('liability', 'التزامات',      'Liabilities', 'balance_sheet',    'credit', 20),
  ('equity',    'حقوق الملكية',  'Equity',      'balance_sheet',    'credit', 30),
  ('income',    'إيرادات',       'Income',      'income_statement', 'credit', 40),
  ('expense',   'مصروفات',       'Expenses',    'income_statement', 'debit',  50)
) AS v(code, name_ar, name_en, statement, normal_balance, sort_order)
ON CONFLICT (company_id, code) DO NOTHING;

-- 6) Auto-seed for new companies
CREATE OR REPLACE FUNCTION public.seed_default_accounting_buckets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.accounting_buckets (company_id, code, name_ar, name_en, statement, normal_balance, sort_order) VALUES
    (NEW.id, 'asset',     'أصول',         'Assets',      'balance_sheet',    'debit',  10),
    (NEW.id, 'liability', 'التزامات',      'Liabilities', 'balance_sheet',    'credit', 20),
    (NEW.id, 'equity',    'حقوق الملكية',  'Equity',      'balance_sheet',    'credit', 30),
    (NEW.id, 'income',    'إيرادات',       'Income',      'income_statement', 'credit', 40),
    (NEW.id, 'expense',   'مصروفات',       'Expenses',    'income_statement', 'debit',  50)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_accounting_buckets
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_accounting_buckets();
-- ===== 20260528230351_a4c5e53e-7a1f-4655-8ee8-091a2d89977f.sql =====
ALTER TABLE public.classifications
  ALTER COLUMN bucket TYPE text USING bucket::text;

ALTER TABLE public.account_types
  ALTER COLUMN classification TYPE text USING classification::text;

ALTER TABLE public.accounts
  ALTER COLUMN account_type TYPE text USING account_type::text;

CREATE OR REPLACE FUNCTION public.sync_account_type_from_type_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cls text;
BEGIN
  IF NEW.account_type_id IS NOT NULL THEN
    SELECT classification INTO v_cls FROM public.account_types WHERE id = NEW.account_type_id;
    IF v_cls IS NOT NULL THEN
      NEW.account_type := v_cls;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_account_type_classification_from_cls()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bucket text;
BEGIN
  IF NEW.classification_id IS NOT NULL THEN
    SELECT bucket INTO v_bucket FROM public.classifications WHERE id = NEW.classification_id;
    IF v_bucket IS NOT NULL THEN
      NEW.classification := v_bucket;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
-- ===== 20260529013507_f0521319-32a8-4dda-aece-73f1078248b3.sql =====
-- 1) Add the new column
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS classification_id uuid REFERENCES public.classifications(id);

CREATE INDEX IF NOT EXISTS accounts_classification_id_idx
  ON public.accounts(classification_id);

-- 2) Backfill from account_types where possible
UPDATE public.accounts a
SET classification_id = at.classification_id
FROM public.account_types at
WHERE a.account_type_id = at.id
  AND at.classification_id IS NOT NULL
  AND a.classification_id IS NULL;

-- 3) Backfill remaining rows by matching bucket within the same company
--    (pick the classification with the lowest sort_order / code for determinism)
WITH ranked AS (
  SELECT
    c.id,
    c.company_id,
    c.bucket,
    ROW_NUMBER() OVER (
      PARTITION BY c.company_id, c.bucket
      ORDER BY c.sort_order NULLS LAST, c.code
    ) AS rn
  FROM public.classifications c
)
UPDATE public.accounts a
SET classification_id = r.id
FROM ranked r
WHERE a.classification_id IS NULL
  AND a.company_id = r.company_id
  AND a.account_type = r.bucket
  AND r.rn = 1;

-- 4) Trigger to keep accounts.account_type (bucket text) in sync from classification
CREATE OR REPLACE FUNCTION public.sync_account_bucket_from_classification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket text;
BEGIN
  IF NEW.classification_id IS NOT NULL THEN
    SELECT bucket INTO v_bucket
    FROM public.classifications
    WHERE id = NEW.classification_id;
    IF v_bucket IS NOT NULL THEN
      NEW.account_type := v_bucket;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accounts_sync_bucket ON public.accounts;
CREATE TRIGGER trg_accounts_sync_bucket
BEFORE INSERT OR UPDATE OF classification_id ON public.accounts
FOR EACH ROW
EXECUTE FUNCTION public.sync_account_bucket_from_classification();
-- ===== 20260529021527_094fc1b6-c4ae-4366-aba3-9a528f70acb2.sql =====

ALTER TABLE public.lock_dates
  ADD CONSTRAINT lock_dates_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.lock_dates
  ADD CONSTRAINT lock_dates_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';

-- ===== 20260529021805_c61de3c7-588a-4800-84a3-9c1c9a45f51f.sql =====
-- 1) Prevent updates/deletes on lock_dates (immutable once created)
CREATE OR REPLACE FUNCTION public.prevent_lock_date_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Allow only updating notes; block changes to date/scope
    IF NEW.lock_date IS DISTINCT FROM OLD.lock_date
       OR NEW.company_id IS DISTINCT FROM OLD.company_id
       OR NEW.branch_id IS DISTINCT FROM OLD.branch_id THEN
      RAISE EXCEPTION 'Lock date entries are immutable and cannot be modified';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Lock date entries cannot be deleted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_lock_date_update ON public.lock_dates;
CREATE TRIGGER trg_prevent_lock_date_update
BEFORE UPDATE ON public.lock_dates
FOR EACH ROW EXECUTE FUNCTION public.prevent_lock_date_change();

DROP TRIGGER IF EXISTS trg_prevent_lock_date_delete ON public.lock_dates;
CREATE TRIGGER trg_prevent_lock_date_delete
BEFORE DELETE ON public.lock_dates
FOR EACH ROW EXECUTE FUNCTION public.prevent_lock_date_change();

-- 2) Block inserts/updates on financial documents at or before lock date
CREATE OR REPLACE FUNCTION public.enforce_lock_date_je()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_date_locked(NEW.company_id, NEW.branch_id, NEW.entry_date) THEN
    RAISE EXCEPTION 'Date % is locked. No journal entries can be created or modified on or before the lock date.', NEW.entry_date;
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_date_locked(OLD.company_id, OLD.branch_id, OLD.entry_date) THEN
    RAISE EXCEPTION 'Cannot modify journal entry: original date % is locked.', OLD.entry_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lock_je ON public.journal_entries;
CREATE TRIGGER trg_enforce_lock_je
BEFORE INSERT OR UPDATE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_je();

CREATE OR REPLACE FUNCTION public.enforce_lock_date_je_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_date_locked(OLD.company_id, OLD.branch_id, OLD.entry_date) THEN
    RAISE EXCEPTION 'Cannot delete journal entry: date % is locked.', OLD.entry_date;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lock_je_del ON public.journal_entries;
CREATE TRIGGER trg_enforce_lock_je_del
BEFORE DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_je_delete();

-- Invoices
CREATE OR REPLACE FUNCTION public.enforce_lock_date_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_date_locked(NEW.company_id, NEW.branch_id, NEW.invoice_date) THEN
    RAISE EXCEPTION 'Date % is locked. No invoices can be created or modified on or before the lock date.', NEW.invoice_date;
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_date_locked(OLD.company_id, OLD.branch_id, OLD.invoice_date) THEN
    RAISE EXCEPTION 'Cannot modify invoice: original date % is locked.', OLD.invoice_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lock_invoice ON public.invoices;
CREATE TRIGGER trg_enforce_lock_invoice
BEFORE INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_invoice();

CREATE OR REPLACE FUNCTION public.enforce_lock_date_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_date_locked(OLD.company_id, OLD.branch_id, OLD.invoice_date) THEN
    RAISE EXCEPTION 'Cannot delete invoice: date % is locked.', OLD.invoice_date;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lock_invoice_del ON public.invoices;
CREATE TRIGGER trg_enforce_lock_invoice_del
BEFORE DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_invoice_delete();

-- Payments
CREATE OR REPLACE FUNCTION public.enforce_lock_date_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_date_locked(NEW.company_id, NEW.branch_id, NEW.payment_date) THEN
    RAISE EXCEPTION 'Date % is locked. No payments can be created or modified on or before the lock date.', NEW.payment_date;
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_date_locked(OLD.company_id, OLD.branch_id, OLD.payment_date) THEN
    RAISE EXCEPTION 'Cannot modify payment: original date % is locked.', OLD.payment_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lock_payment ON public.payments;
CREATE TRIGGER trg_enforce_lock_payment
BEFORE INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_payment();

CREATE OR REPLACE FUNCTION public.enforce_lock_date_payment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_date_locked(OLD.company_id, OLD.branch_id, OLD.payment_date) THEN
    RAISE EXCEPTION 'Cannot delete payment: date % is locked.', OLD.payment_date;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_lock_payment_del ON public.payments;
CREATE TRIGGER trg_enforce_lock_payment_del
BEFORE DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_payment_delete();
-- ===== 20260529022131_37ada644-3f48-4216-ab94-a22e959b584b.sql =====
DROP TRIGGER IF EXISTS trg_prevent_lock_date_update ON public.lock_dates;
DROP TRIGGER IF EXISTS trg_prevent_lock_date_delete ON public.lock_dates;
DROP FUNCTION IF EXISTS public.prevent_lock_date_change();
-- ===== 20260529023010_28c1e5e5-9f37-4f10-82ae-487703248e02.sql =====

-- Fixed assets
CREATE OR REPLACE FUNCTION public.enforce_lock_date_fixed_asset()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_date_locked(NEW.company_id, NEW.branch_id, NEW.acquisition_date) THEN
    RAISE EXCEPTION 'Date % is locked. No fixed assets can be created or modified on or before the lock date.', NEW.acquisition_date;
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_date_locked(OLD.company_id, OLD.branch_id, OLD.acquisition_date) THEN
    RAISE EXCEPTION 'Cannot modify fixed asset: original date % is locked.', OLD.acquisition_date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_lock_date_fixed_asset_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_date_locked(OLD.company_id, OLD.branch_id, OLD.acquisition_date) THEN
    RAISE EXCEPTION 'Cannot delete fixed asset: date % is locked.', OLD.acquisition_date;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_fixed_asset ON public.fixed_assets;
CREATE TRIGGER trg_lock_fixed_asset BEFORE INSERT OR UPDATE ON public.fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_fixed_asset();

DROP TRIGGER IF EXISTS trg_lock_fixed_asset_del ON public.fixed_assets;
CREATE TRIGGER trg_lock_fixed_asset_del BEFORE DELETE ON public.fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_fixed_asset_delete();

-- Asset disposals (lookup company/branch via fixed_assets)
CREATE OR REPLACE FUNCTION public.enforce_lock_date_asset_disposal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_branch uuid;
BEGIN
  SELECT company_id, branch_id INTO v_company, v_branch FROM public.fixed_assets WHERE id = NEW.asset_id;
  IF public.is_date_locked(v_company, v_branch, NEW.disposal_date) THEN
    RAISE EXCEPTION 'Date % is locked. No asset disposals can be created or modified on or before the lock date.', NEW.disposal_date;
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_date_locked(v_company, v_branch, OLD.disposal_date) THEN
    RAISE EXCEPTION 'Cannot modify asset disposal: original date % is locked.', OLD.disposal_date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_lock_date_asset_disposal_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_branch uuid;
BEGIN
  SELECT company_id, branch_id INTO v_company, v_branch FROM public.fixed_assets WHERE id = OLD.asset_id;
  IF public.is_date_locked(v_company, v_branch, OLD.disposal_date) THEN
    RAISE EXCEPTION 'Cannot delete asset disposal: date % is locked.', OLD.disposal_date;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_asset_disposal ON public.asset_disposals;
CREATE TRIGGER trg_lock_asset_disposal BEFORE INSERT OR UPDATE ON public.asset_disposals
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_asset_disposal();

DROP TRIGGER IF EXISTS trg_lock_asset_disposal_del ON public.asset_disposals;
CREATE TRIGGER trg_lock_asset_disposal_del BEFORE DELETE ON public.asset_disposals
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_asset_disposal_delete();

-- Depreciation schedule (lookup company/branch via fixed_assets)
CREATE OR REPLACE FUNCTION public.enforce_lock_date_depreciation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_branch uuid;
BEGIN
  SELECT company_id, branch_id INTO v_company, v_branch FROM public.fixed_assets WHERE id = NEW.asset_id;
  IF public.is_date_locked(v_company, v_branch, NEW.period_date) THEN
    RAISE EXCEPTION 'Date % is locked. No depreciation entries can be created or modified on or before the lock date.', NEW.period_date;
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_date_locked(v_company, v_branch, OLD.period_date) THEN
    RAISE EXCEPTION 'Cannot modify depreciation entry: original date % is locked.', OLD.period_date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_lock_date_depreciation_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_branch uuid;
BEGIN
  SELECT company_id, branch_id INTO v_company, v_branch FROM public.fixed_assets WHERE id = OLD.asset_id;
  IF public.is_date_locked(v_company, v_branch, OLD.period_date) THEN
    RAISE EXCEPTION 'Cannot delete depreciation entry: date % is locked.', OLD.period_date;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_depreciation ON public.depreciation_schedule;
CREATE TRIGGER trg_lock_depreciation BEFORE INSERT OR UPDATE ON public.depreciation_schedule
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_depreciation();

DROP TRIGGER IF EXISTS trg_lock_depreciation_del ON public.depreciation_schedule;
CREATE TRIGGER trg_lock_depreciation_del BEFORE DELETE ON public.depreciation_schedule
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_depreciation_delete();

-- ===== 20260529024659_2b1e77d4-90e6-43fe-af83-8d673bb6a1b2.sql =====
-- Create roles registry table for managing role metadata (names, descriptions, activation)
CREATE TABLE public.roles_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.roles_registry TO authenticated;
GRANT ALL ON public.roles_registry TO service_role;

ALTER TABLE public.roles_registry ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "roles_registry_read"
ON public.roles_registry FOR SELECT
TO authenticated
USING (true);

-- Only admins can write
CREATE POLICY "roles_registry_admin_write"
ON public.roles_registry FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER trg_roles_registry_updated_at
BEFORE UPDATE ON public.roles_registry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed system roles (cannot be deleted)
INSERT INTO public.roles_registry (code, name_ar, name_en, description_ar, description_en, is_system, sort_order) VALUES
  ('admin',              'مدير النظام',      'Administrator',     'صلاحيات كاملة على النظام',                'Full system access',                          true, 10),
  ('finance_manager',    'المدير المالي',     'Finance Manager',   'إدارة شؤون مالية، إعتماد عمليات كبرى',    'Manages finance, approves high-value items',  true, 20),
  ('accounting_manager', 'مدير المحاسبة',     'Accounting Manager','إدارة الفريق المحاسبي والقيود',           'Manages accounting team and entries',         true, 30),
  ('chief_accountant',   'رئيس الحسابات',     'Chief Accountant',  'مراجعة وإعتماد قيود ومعاملات يومية',      'Reviews and approves daily transactions',     true, 40),
  ('accountant',         'محاسب',             'Accountant',        'إدخال وتسجيل العمليات اليومية',           'Records daily transactions',                   true, 50)
ON CONFLICT (code) DO NOTHING;
-- ===== 20260529030133_d4816d1f-b9f9-44e4-ad89-027100cd336b.sql =====
ALTER TABLE public.approval_workflows
  ADD COLUMN IF NOT EXISTS journal_type text;

ALTER TABLE public.approval_workflows
  ALTER COLUMN document_type DROP NOT NULL;
-- ===== 20260529033059_97cc811d-32ba-4128-b215-4e9ada5161e0.sql =====

-- Grant required Data API access
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Admins can read all role assignments
DROP POLICY IF EXISTS user_roles_admin_read ON public.user_roles;
CREATE POLICY user_roles_admin_read ON public.user_roles
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

-- Admins can grant roles
DROP POLICY IF EXISTS user_roles_admin_insert ON public.user_roles;
CREATE POLICY user_roles_admin_insert ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- Admins can revoke roles
DROP POLICY IF EXISTS user_roles_admin_delete ON public.user_roles;
CREATE POLICY user_roles_admin_delete ON public.user_roles
  FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

-- ===== 20260529034055_e02d595a-d423-4797-925a-87e2702f8208.sql =====
ALTER TABLE public.approval_steps_def
  ALTER COLUMN required_role TYPE text USING required_role::text;
-- ===== 20260529113823_59daf772-f881-4d66-bd16-5b17d62a618f.sql =====
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
-- ===== 20260529114214_1d47ca12-4c3f-40ad-bcd0-60d7e9c9dde9.sql =====
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_receivable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_payable boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_accounts_is_receivable ON public.accounts(company_id) WHERE is_receivable;
CREATE INDEX IF NOT EXISTS idx_accounts_is_payable ON public.accounts(company_id) WHERE is_payable;
-- ===== 20260529114946_a02cd651-5c67-43fb-a331-a9f04f9c245b.sql =====
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

-- ===== 20260529120107_43f15a73-d005-4ac9-aa29-43db50599efc.sql =====
ALTER TABLE public.customer_types ADD COLUMN IF NOT EXISTS receivable_account_id uuid;
-- ===== 20260529123032_c994af01-4393-4d51-b1d1-570f922523e2.sql =====

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

-- ===== 20260529131445_46eb47f0-073d-4474-8d5a-4500e21b72c8.sql =====

-- Add missing FKs so PostgREST can resolve nested selects
ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_invoice_id_fkey
  FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;

ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id);

ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_tax_id_fkey
  FOREIGN KEY (tax_id) REFERENCES public.taxes(id);

ALTER TABLE public.invoice_lines
  ADD CONSTRAINT invoice_lines_cost_center_id_fkey
  FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);

-- ===== 20260529132127_042c12a0-0206-4f63-bc48-5fc6a012e5dd.sql =====
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS allow_manual_entries boolean NOT NULL DEFAULT true;
-- ===== 20260529134040_9f085da0-43d5-4048-b664-a7c3c6407fca.sql =====
CREATE TRIGGER trg_journals_audit_allow_manual
AFTER UPDATE ON public.journals
FOR EACH ROW
WHEN (OLD.allow_manual_entries IS DISTINCT FROM NEW.allow_manual_entries)
EXECUTE FUNCTION public.log_audit_event();
-- ===== 20260529135201_a4a610b8-7418-4591-9892-a2ce8314f640.sql =====

-- Audit triggers for transaction tables to enable Historical Log per record

DROP TRIGGER IF EXISTS trg_audit_journal_entries ON public.journal_entries;
CREATE TRIGGER trg_audit_journal_entries
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_journal_entry_lines ON public.journal_entry_lines;
CREATE TRIGGER trg_audit_journal_entry_lines
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_invoices ON public.invoices;
CREATE TRIGGER trg_audit_invoices
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_invoice_lines ON public.invoice_lines;
CREATE TRIGGER trg_audit_invoice_lines
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_lines
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_payment_allocations ON public.payment_allocations;
CREATE TRIGGER trg_audit_payment_allocations
AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_fixed_assets ON public.fixed_assets;
CREATE TRIGGER trg_audit_fixed_assets
AFTER INSERT OR UPDATE OR DELETE ON public.fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_asset_disposals ON public.asset_disposals;
CREATE TRIGGER trg_audit_asset_disposals
AFTER INSERT OR UPDATE OR DELETE ON public.asset_disposals
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- ===== 20260529173941_66af4170-f176-4032-86c3-aee85379d02d.sql =====
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
