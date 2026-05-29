
-- Fixed assets
CREATE OR REPLACE FUNCTION public.enforce_lock_date_fixed_asset()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_date_locked(NEW.company_id, NEW.branch_id, NEW.acquisition_date) THEN
    RAISE EXCEPTION 'Date % is locked. No fixed assets can be created or modified on or before the lock date.', NEW.acquisition_date;
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_date_locked(OLD.company_id, OLD.branch_id, OLD.acquisition_date) THEN
    RAISE EXCEPTION 'Cannot modify fixed asset: original date % is locked.', OLD.acquisition_date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_lock_date_fixed_asset_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_date_locked(OLD.company_id, OLD.branch_id, OLD.acquisition_date) THEN
    RAISE EXCEPTION 'Cannot delete fixed asset: date % is locked.', OLD.acquisition_date;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_fixed_asset ON public.fixed_assets;
CREATE TRIGGER trg_lock_fixed_asset BEFORE INSERT OR UPDATE ON public.fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_fixed_asset();

DROP TRIGGER IF EXISTS trg_lock_fixed_asset_del ON public.fixed_assets;
CREATE TRIGGER trg_lock_fixed_asset_del BEFORE DELETE ON public.fixed_assets
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_fixed_asset_delete();

-- Asset disposals (lookup company/branch via fixed_assets)
CREATE OR REPLACE FUNCTION public.enforce_lock_date_asset_disposal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_branch uuid;
BEGIN
  SELECT company_id, branch_id INTO v_company, v_branch FROM public.fixed_assets WHERE id = NEW.asset_id;
  IF public.is_date_locked(v_company, v_branch, NEW.disposal_date) THEN
    RAISE EXCEPTION 'Date % is locked. No asset disposals can be created or modified on or before the lock date.', NEW.disposal_date;
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_date_locked(v_company, v_branch, OLD.disposal_date) THEN
    RAISE EXCEPTION 'Cannot modify asset disposal: original date % is locked.', OLD.disposal_date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_lock_date_asset_disposal_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_branch uuid;
BEGIN
  SELECT company_id, branch_id INTO v_company, v_branch FROM public.fixed_assets WHERE id = OLD.asset_id;
  IF public.is_date_locked(v_company, v_branch, OLD.disposal_date) THEN
    RAISE EXCEPTION 'Cannot delete asset disposal: date % is locked.', OLD.disposal_date;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_asset_disposal ON public.asset_disposals;
CREATE TRIGGER trg_lock_asset_disposal BEFORE INSERT OR UPDATE ON public.asset_disposals
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_asset_disposal();

DROP TRIGGER IF EXISTS trg_lock_asset_disposal_del ON public.asset_disposals;
CREATE TRIGGER trg_lock_asset_disposal_del BEFORE DELETE ON public.asset_disposals
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_asset_disposal_delete();

-- Depreciation schedule (lookup company/branch via fixed_assets)
CREATE OR REPLACE FUNCTION public.enforce_lock_date_depreciation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_branch uuid;
BEGIN
  SELECT company_id, branch_id INTO v_company, v_branch FROM public.fixed_assets WHERE id = NEW.asset_id;
  IF public.is_date_locked(v_company, v_branch, NEW.period_date) THEN
    RAISE EXCEPTION 'Date % is locked. No depreciation entries can be created or modified on or before the lock date.', NEW.period_date;
  END IF;
  IF TG_OP = 'UPDATE' AND public.is_date_locked(v_company, v_branch, OLD.period_date) THEN
    RAISE EXCEPTION 'Cannot modify depreciation entry: original date % is locked.', OLD.period_date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_lock_date_depreciation_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid; v_branch uuid;
BEGIN
  SELECT company_id, branch_id INTO v_company, v_branch FROM public.fixed_assets WHERE id = OLD.asset_id;
  IF public.is_date_locked(v_company, v_branch, OLD.period_date) THEN
    RAISE EXCEPTION 'Cannot delete depreciation entry: date % is locked.', OLD.period_date;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_lock_depreciation ON public.depreciation_schedule;
CREATE TRIGGER trg_lock_depreciation BEFORE INSERT OR UPDATE ON public.depreciation_schedule
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_depreciation();

DROP TRIGGER IF EXISTS trg_lock_depreciation_del ON public.depreciation_schedule;
CREATE TRIGGER trg_lock_depreciation_del BEFORE DELETE ON public.depreciation_schedule
FOR EACH ROW EXECUTE FUNCTION public.enforce_lock_date_depreciation_delete();
