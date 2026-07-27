-- Impede que o cliente (não-staff) altere colunas sensíveis via UPDATE.
CREATE OR REPLACE FUNCTION public.clientes_protect_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Sem permissão para alterar este cadastro';
  END IF;

  NEW.email := OLD.email;
  NEW.cpf := OLD.cpf;
  NEW.vip := OLD.vip;
  NEW.origem_lead := OLD.origem_lead;
  NEW.observacoes := OLD.observacoes;
  NEW.user_id := OLD.user_id;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  NEW.vendedor_responsavel := OLD.vendedor_responsavel;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clientes_protect_sensitive ON public.clientes;
CREATE TRIGGER trg_clientes_protect_sensitive
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.clientes_protect_sensitive_columns();
