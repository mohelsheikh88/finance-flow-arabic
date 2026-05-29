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