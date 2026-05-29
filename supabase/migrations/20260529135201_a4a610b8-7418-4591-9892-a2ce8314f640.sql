
-- Audit triggers for transaction tables to enable Historical Log per record

DROP TRIGGER IF EXISTS trg_audit_journal_entries ON public.journal_entries;
CREATE TRIGGER trg_audit_journal_entries
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_journal_entry_lines ON public.journal_entry_lines;
CREATE TRIGGER trg_audit_journal_entry_lines
AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_invoices ON public.invoices;
CREATE TRIGGER trg_audit_invoices
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_invoice_lines ON public.invoice_lines;
CREATE TRIGGER trg_audit_invoice_lines
AFTER INSERT OR UPDATE OR DELETE ON public.invoice_lines
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_payments ON public.payments;
CREATE TRIGGER trg_audit_payments
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_payment_allocations ON public.payment_allocations;
CREATE TRIGGER trg_audit_payment_allocations
AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_fixed_assets ON public.fixed_assets;
CREATE TRIGGER trg_audit_fixed_assets
AFTER INSERT OR UPDATE OR DELETE ON public.fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS trg_audit_asset_disposals ON public.asset_disposals;
CREATE TRIGGER trg_audit_asset_disposals
AFTER INSERT OR UPDATE OR DELETE ON public.asset_disposals
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
