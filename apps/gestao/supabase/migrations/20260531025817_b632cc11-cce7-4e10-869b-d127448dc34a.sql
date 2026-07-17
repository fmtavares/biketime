UPDATE storage.buckets SET public = true WHERE id = 'bike-fotos';

CREATE POLICY "Public read access to bike-fotos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'bike-fotos');