ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS is_receivable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_payable boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_accounts_is_receivable ON public.accounts(company_id) WHERE is_receivable;
CREATE INDEX IF NOT EXISTS idx_accounts_is_payable ON public.accounts(company_id) WHERE is_payable;