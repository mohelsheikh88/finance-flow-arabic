CREATE TABLE public.user_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_key text NOT NULL,
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_access TO authenticated;
GRANT ALL ON public.user_module_access TO service_role;

ALTER TABLE public.user_module_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own module access"
ON public.user_module_access FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage module access"
ON public.user_module_access FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_user_module_access_updated
BEFORE UPDATE ON public.user_module_access
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_audit_user_module_access
AFTER INSERT OR UPDATE OR DELETE ON public.user_module_access
FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();