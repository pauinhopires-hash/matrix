ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.checklist_roles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS produtos_role_id_idx ON public.produtos(role_id);