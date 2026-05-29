ALTER TABLE public.approval_workflows
  ADD COLUMN IF NOT EXISTS journal_type text;

ALTER TABLE public.approval_workflows
  ALTER COLUMN document_type DROP NOT NULL;