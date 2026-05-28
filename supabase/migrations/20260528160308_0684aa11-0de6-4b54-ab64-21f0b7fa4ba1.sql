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