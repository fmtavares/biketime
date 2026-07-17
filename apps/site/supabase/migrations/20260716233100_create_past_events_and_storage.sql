CREATE TABLE public.past_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  description TEXT NOT NULL,
  photos TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.past_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Past events are viewable by everyone"
  ON public.past_events FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert past events"
  ON public.past_events FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update past events"
  ON public.past_events FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete past events"
  ON public.past_events FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_past_events_updated_at
BEFORE UPDATE ON public.past_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('event-photos', 'event-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Listagem restrita; URLs públicas do bucket continuam funcionando
CREATE POLICY "Admins can select event photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'event-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can upload event photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update event photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-photos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete event photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-photos' AND public.has_role(auth.uid(), 'admin'));
