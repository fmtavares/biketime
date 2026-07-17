CREATE POLICY "marketing_uploads_update_own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'marketing-uploads'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'marketing-uploads'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);