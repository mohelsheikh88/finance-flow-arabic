ALTER TABLE public.approval_steps_def
  ALTER COLUMN required_role TYPE text USING required_role::text;