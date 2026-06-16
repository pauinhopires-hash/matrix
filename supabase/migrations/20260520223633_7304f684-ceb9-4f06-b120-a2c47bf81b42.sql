
CREATE OR REPLACE FUNCTION public.profiles_guard_protected_cols()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Não é permitido alterar o status do próprio perfil';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Não é permitido alterar o email do perfil';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Não é permitido alterar o id do perfil';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_protected_cols ON public.profiles;
CREATE TRIGGER profiles_guard_protected_cols
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_protected_cols();

DROP POLICY IF EXISTS "profiles staff update" ON public.profiles;
CREATE POLICY "profiles staff update" ON public.profiles
FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "checklist-fotos read authenticated" ON storage.objects;

CREATE POLICY "checklist-fotos read staff" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'checklist-fotos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "estoque-fotos auth upload" ON storage.objects;
DROP POLICY IF EXISTS "estoque-fotos auth update" ON storage.objects;

CREATE POLICY "estoque-fotos insert own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'estoque-fotos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "estoque-fotos update own or staff" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'estoque-fotos'
  AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid()))
)
WITH CHECK (
  bucket_id = 'estoque-fotos'
  AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid()))
);

CREATE POLICY "estoque-fotos delete own or staff" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'estoque-fotos'
  AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.is_staff(auth.uid()))
);
