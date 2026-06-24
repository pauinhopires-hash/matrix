-- Defense-in-depth: explicit restrictive policy preventing non-admins from
-- inserting, updating, or deleting rows in user_roles. Even if a future
-- permissive policy is added by mistake, this restrictive policy must also
-- pass, blocking privilege escalation.
CREATE POLICY "user_roles restrict writes to admins"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));