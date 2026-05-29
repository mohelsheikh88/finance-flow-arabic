
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
