ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_partner_id_fkey
  FOREIGN KEY (partner_id) REFERENCES public.partners(id) ON DELETE RESTRICT;