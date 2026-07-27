-- Permite service_role / admin (auth.uid() NULL) vincular user_id ao criar acesso do portal.
-- A proteção continua valendo só para cliente autenticado não-staff.

CREATE OR REPLACE FUNCTION public.clientes_protect_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Sem sessão (ex.: service_role) ou equipe: permite UPDATE completo
  IF auth.uid() IS NULL OR public.is_staff(auth.uid()) THEN
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
