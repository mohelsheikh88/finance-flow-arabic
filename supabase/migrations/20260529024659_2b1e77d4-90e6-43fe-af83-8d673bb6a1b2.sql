-- Create roles registry table for managing role metadata (names, descriptions, activation)
CREATE TABLE public.roles_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_ar TEXT,
  description_en TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.roles_registry TO authenticated;
GRANT ALL ON public.roles_registry TO service_role;

ALTER TABLE public.roles_registry ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read
CREATE POLICY "roles_registry_read"
ON public.roles_registry FOR SELECT
TO authenticated
USING (true);

-- Only admins can write
CREATE POLICY "roles_registry_admin_write"
ON public.roles_registry FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER trg_roles_registry_updated_at
BEFORE UPDATE ON public.roles_registry
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed system roles (cannot be deleted)
INSERT INTO public.roles_registry (code, name_ar, name_en, description_ar, description_en, is_system, sort_order) VALUES
  ('admin',              'مدير النظام',      'Administrator',     'صلاحيات كاملة على النظام',                'Full system access',                          true, 10),
  ('finance_manager',    'المدير المالي',     'Finance Manager',   'إدارة شؤون مالية، إعتماد عمليات كبرى',    'Manages finance, approves high-value items',  true, 20),
  ('accounting_manager', 'مدير المحاسبة',     'Accounting Manager','إدارة الفريق المحاسبي والقيود',           'Manages accounting team and entries',         true, 30),
  ('chief_accountant',   'رئيس الحسابات',     'Chief Accountant',  'مراجعة وإعتماد قيود ومعاملات يومية',      'Reviews and approves daily transactions',     true, 40),
  ('accountant',         'محاسب',             'Accountant',        'إدخال وتسجيل العمليات اليومية',           'Records daily transactions',                   true, 50)
ON CONFLICT (code) DO NOTHING;