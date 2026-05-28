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