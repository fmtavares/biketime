CREATE TABLE public.marketing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  openai_response_id text,
  image text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketing_jobs_select_own" ON public.marketing_jobs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "marketing_jobs_insert_own" ON public.marketing_jobs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "marketing_jobs_update_own" ON public.marketing_jobs
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER marketing_jobs_set_updated_at
  BEFORE UPDATE ON public.marketing_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-uploads', 'marketing-uploads', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "marketing_uploads_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'marketing-uploads');

CREATE POLICY "marketing_uploads_insert_auth" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'marketing-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "marketing_uploads_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'marketing-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);