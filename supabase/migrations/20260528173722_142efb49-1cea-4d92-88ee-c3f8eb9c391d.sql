
-- 1. Audit log table
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  user_id UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  old_data JSONB,
  new_data JSONB
);

CREATE INDEX idx_audit_log_changed_at ON public.audit_log (changed_at DESC);
CREATE INDEX idx_audit_log_table_name ON public.audit_log (table_name);
CREATE INDEX idx_audit_log_user_id ON public.audit_log (user_id);
CREATE INDEX idx_audit_log_record_id ON public.audit_log (record_id);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_admin_read ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 2. Generic trigger function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id UUID;
  v_old JSONB;
  v_new JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
    BEGIN v_record_id := (v_old->>'id')::UUID; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    BEGIN v_record_id := (v_new->>'id')::UUID; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
  ELSE
    v_old := NULL;
    v_new := to_jsonb(NEW);
    BEGIN v_record_id := (v_new->>'id')::UUID; EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
  END IF;

  INSERT INTO public.audit_log (table_name, record_id, action, user_id, old_data, new_data)
  VALUES (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_old, v_new);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 3. Attach trigger to every public table (excluding audit_log itself)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> 'audit_log'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I;
       CREATE TRIGGER trg_audit_%I
       AFTER INSERT OR UPDATE OR DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();',
      r.tablename, r.tablename, r.tablename, r.tablename
    );
  END LOOP;
END$$;
