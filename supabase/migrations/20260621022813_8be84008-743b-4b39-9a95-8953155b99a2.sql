
CREATE TABLE IF NOT EXISTS public.checklist_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_roles TO authenticated;
GRANT ALL ON public.checklist_roles TO service_role;
ALTER TABLE public.checklist_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read roles" ON public.checklist_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage roles" ON public.checklist_roles FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE IF NOT EXISTS public.checklist_role_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.checklist_roles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_role_users TO authenticated;
GRANT ALL ON public.checklist_role_users TO service_role;
ALTER TABLE public.checklist_role_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read role users" ON public.checklist_role_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "staff manage role users" ON public.checklist_role_users FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

ALTER TABLE public.checklist_itens ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.checklist_roles(id) ON DELETE SET NULL;
