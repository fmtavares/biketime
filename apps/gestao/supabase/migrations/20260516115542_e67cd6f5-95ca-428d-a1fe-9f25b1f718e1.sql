-- 1. Extensões
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

-- 2. Tabela de log
CREATE TABLE IF NOT EXISTS public.sync_clientes_log (
  id bigserial PRIMARY KEY,
  operation text NOT NULL,
  record_id uuid,
  request_id bigint,
  payload jsonb,
  status_code int,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_clientes_log_created
  ON public.sync_clientes_log (created_at DESC);

ALTER TABLE public.sync_clientes_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sync_clientes_log_select_admin ON public.sync_clientes_log;
CREATE POLICY sync_clientes_log_select_admin
  ON public.sync_clientes_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. Função que dispara HTTP via pg_net
CREATE OR REPLACE FUNCTION public.sync_clientes_to_external()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url text;
  v_key text;
  v_endpoint text;
  v_payload jsonb;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'sync_dest_url' LIMIT 1;
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets WHERE name = 'sync_dest_service_key' LIMIT 1;

  IF v_url IS NULL OR v_key IS NULL THEN
    INSERT INTO public.sync_clientes_log(operation, record_id, error_message)
    VALUES (TG_OP, COALESCE(NEW.id, OLD.id),
            'Vault secrets missing: sync_dest_url ou sync_dest_service_key');
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- remove barra final se houver
  v_url := regexp_replace(v_url, '/+$', '');

  IF TG_OP = 'DELETE' THEN
    v_endpoint := v_url || '/rest/v1/clientes?id=eq.' || OLD.id::text;
    SELECT net.http_delete(
      url := v_endpoint,
      headers := jsonb_build_object(
        'apikey', v_key,
        'Authorization', 'Bearer ' || v_key
      )
    ) INTO v_request_id;

    INSERT INTO public.sync_clientes_log(operation, record_id, request_id)
    VALUES ('DELETE', OLD.id, v_request_id);

    RETURN OLD;
  ELSE
    v_endpoint := v_url || '/rest/v1/clientes';
    v_payload := to_jsonb(NEW);

    SELECT net.http_post(
      url := v_endpoint,
      body := v_payload,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_key,
        'Authorization', 'Bearer ' || v_key,
        'Prefer', 'resolution=merge-duplicates,return=minimal'
      )
    ) INTO v_request_id;

    INSERT INTO public.sync_clientes_log(operation, record_id, request_id, payload)
    VALUES (TG_OP, NEW.id, v_request_id, v_payload);

    RETURN NEW;
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.sync_clientes_log(operation, record_id, error_message)
  VALUES (TG_OP, COALESCE(NEW.id, OLD.id), SQLERRM);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. Trigger na tabela clientes
DROP TRIGGER IF EXISTS trg_sync_clientes_external ON public.clientes;
CREATE TRIGGER trg_sync_clientes_external
AFTER INSERT OR UPDATE OR DELETE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.sync_clientes_to_external();