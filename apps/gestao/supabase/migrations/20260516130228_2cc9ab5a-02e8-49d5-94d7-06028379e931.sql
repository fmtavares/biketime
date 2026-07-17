
-- Log table
CREATE TABLE IF NOT EXISTS public.webhook_novo_cliente_log (
  id BIGSERIAL PRIMARY KEY,
  cliente_id UUID,
  request_id BIGINT,
  payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_novo_cliente_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_novo_cliente_log_select_admin"
  ON public.webhook_novo_cliente_log
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Function
CREATE OR REPLACE FUNCTION public.notify_novo_cliente_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_payload jsonb;
  v_request_id bigint;
BEGIN
  IF NEW.whatsapp IS NULL OR btrim(NEW.whatsapp) = '' THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'mensagem', 'Ola Seja Bem Vindo a Bike Time',
    'phone', NEW.whatsapp
  );

  SELECT net.http_post(
    url := 'https://primary-production-647a.up.railway.app/webhook-test/c55dabb1-f458-4789-aacc-4a9f6e347a5a',
    body := v_payload,
    headers := jsonb_build_object('Content-Type', 'application/json')
  ) INTO v_request_id;

  INSERT INTO public.webhook_novo_cliente_log(cliente_id, request_id, payload)
  VALUES (NEW.id, v_request_id, v_payload);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.webhook_novo_cliente_log(cliente_id, payload, error_message)
  VALUES (NEW.id, v_payload, SQLERRM);
  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS trg_notify_novo_cliente_webhook ON public.clientes;
CREATE TRIGGER trg_notify_novo_cliente_webhook
  AFTER INSERT ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_novo_cliente_webhook();
