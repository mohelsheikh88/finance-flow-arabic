
ALTER TABLE public.lock_dates
  ADD CONSTRAINT lock_dates_company_id_fkey
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE public.lock_dates
  ADD CONSTRAINT lock_dates_branch_id_fkey
    FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
