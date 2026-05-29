CREATE TRIGGER trg_journals_audit_allow_manual
AFTER UPDATE ON public.journals
FOR EACH ROW
WHEN (OLD.allow_manual_entries IS DISTINCT FROM NEW.allow_manual_entries)
EXECUTE FUNCTION public.log_audit_event();