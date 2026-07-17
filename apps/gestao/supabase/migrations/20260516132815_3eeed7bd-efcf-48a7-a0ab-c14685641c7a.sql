CREATE OR REPLACE FUNCTION public.notify_novo_cliente_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_payload jsonb;
  v_request_id bigint;
BEGIN
  IF NEW.whatsapp IS NULL OR btrim(NEW.whatsapp) = '' THEN
    RETURN NEW;
  END IF;

  v_payload := jsonb_build_object(
    'tipo', 'criacao_usuario',
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
$function$;