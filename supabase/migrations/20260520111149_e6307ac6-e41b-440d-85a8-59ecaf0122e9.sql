-- RLS policies for checklist-fotos bucket (private)
CREATE POLICY "checklist-fotos read authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'checklist-fotos');

CREATE POLICY "checklist-fotos insert own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'checklist-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "checklist-fotos delete own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'checklist-fotos' AND auth.uid()::text = (storage.foldername(name))[1]);