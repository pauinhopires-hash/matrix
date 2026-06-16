DELETE FROM public.checklist_registros
WHERE done_by = (SELECT id FROM auth.users WHERE email='pauinhopires@gmail.com')
  AND updated_at::date = CURRENT_DATE;