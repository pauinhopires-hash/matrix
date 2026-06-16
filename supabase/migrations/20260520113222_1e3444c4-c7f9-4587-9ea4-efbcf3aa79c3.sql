-- 1) Tighten checklist_registros UPDATE policy
DROP POLICY IF EXISTS "checklist_registros update" ON public.checklist_registros;

CREATE POLICY "checklist_registros update"
ON public.checklist_registros
FOR UPDATE
TO authenticated
USING (done_by = auth.uid() OR public.is_staff(auth.uid()))
WITH CHECK (done_by = auth.uid() OR public.is_staff(auth.uid()));

-- 2) Remove broad SELECT policy on estoque-fotos that enables listing.
-- The bucket remains public so getPublicUrl downloads still work;
-- there is just no policy granting list access anymore.
DROP POLICY IF EXISTS "estoque-fotos read" ON storage.objects;