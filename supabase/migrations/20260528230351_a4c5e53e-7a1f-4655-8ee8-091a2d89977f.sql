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