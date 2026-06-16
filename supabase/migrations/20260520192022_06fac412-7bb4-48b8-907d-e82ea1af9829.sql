CREATE POLICY "setores read anon"
ON public.setores
FOR SELECT
TO anon
USING (ativo = true);