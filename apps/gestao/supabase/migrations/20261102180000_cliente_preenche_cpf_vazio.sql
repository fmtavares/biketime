-- O cliente preenche o CPF uma vez, quando ainda está vazio.
-- CPF já gravado, e-mail e as demais colunas sensíveis continuam congelados.

CREATE OR REPLACE FUNCTION public.cpf_valido(raw text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  d text;
  i int;
  soma int;
  resto int;
  dv1 int;
  dv2 int;
BEGIN
  d := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
  IF length(d) <> 11 OR d ~ '^(\d)\1{10}$' THEN
    RETURN false;
  END IF;

  soma := 0;
  FOR i IN 1..9 LOOP
    soma := soma + substr(d, i, 1)::int * (11 - i);
  END LOOP;
  resto := soma % 11;
  dv1 := CASE WHEN resto < 2 THEN 0 ELSE 11 - resto END;
  IF dv1 <> substr(d, 10, 1)::int THEN
    RETURN false;
  END IF;

  soma := 0;
  FOR i IN 1..10 LOOP
    soma := soma + substr(d, i, 1)::int * (12 - i);
  END LOOP;
  resto := soma % 11;
  dv2 := CASE WHEN resto < 2 THEN 0 ELSE 11 - resto END;
  RETURN dv2 = substr(d, 11, 1)::int;
END;
$$;

REVOKE ALL ON FUNCTION public.cpf_valido(text) FROM PUBLIC;

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
  NEW.vip := OLD.vip;
  NEW.origem_lead := OLD.origem_lead;
  NEW.observacoes := OLD.observacoes;
  NEW.user_id := OLD.user_id;
  NEW.created_by := OLD.created_by;
  NEW.created_at := OLD.created_at;
  NEW.vendedor_responsavel := OLD.vendedor_responsavel;

  -- CPF vazio pode ser gravado uma vez, só com dígitos válidos.
  IF btrim(coalesce(OLD.cpf, '')) = '' THEN
    IF NEW.cpf IS NULL OR btrim(NEW.cpf) = '' THEN
      NEW.cpf := NULL;
    ELSE
      NEW.cpf := regexp_replace(NEW.cpf, '\D', '', 'g');
      IF NOT public.cpf_valido(NEW.cpf) THEN
        RAISE EXCEPTION 'Informe um CPF válido';
      END IF;
    END IF;
  ELSE
    NEW.cpf := OLD.cpf;
  END IF;

  RETURN NEW;
END;
$$;
