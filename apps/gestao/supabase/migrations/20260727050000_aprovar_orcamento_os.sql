-- Cliente aprova/recusa orçamento de OS em aguardando_aprovacao (portal do site).
-- Não libera UPDATE amplo em ordens_servico.

CREATE OR REPLACE FUNCTION public.aprovar_orcamento_os(
  p_os_id uuid,
  p_aprovar boolean
)
RETURNS public.ordens_servico
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_os public.ordens_servico;
  v_nome text;
  v_total numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_os
  FROM public.ordens_servico
  WHERE id = p_os_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de serviço não encontrada';
  END IF;

  IF v_os.status IS DISTINCT FROM 'aguardando_aprovacao' THEN
    RAISE EXCEPTION 'Esta OS não está aguardando aprovação';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.clientes c
    WHERE c.id = v_os.cliente_id
      AND c.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar esta OS';
  END IF;

  SELECT c.nome INTO v_nome
  FROM public.clientes c
  WHERE c.id = v_os.cliente_id;

  v_total := COALESCE(v_os.valor_aprovado, COALESCE(v_os.valor_mao_obra, 0) + COALESCE(v_os.valor_pecas, 0));

  IF p_aprovar THEN
    UPDATE public.ordens_servico
    SET
      status = 'em_execucao',
      aprovado = true,
      aprovado_por = COALESCE(v_nome, 'Cliente'),
      data_aprovacao = now(),
      valor_aprovado = v_total,
      updated_at = now()
    WHERE id = p_os_id
    RETURNING * INTO v_os;
  ELSE
    UPDATE public.ordens_servico
    SET
      status = 'avaliacao',
      aprovado = false,
      aprovado_por = COALESCE(v_nome, 'Cliente'),
      data_aprovacao = now(),
      updated_at = now()
    WHERE id = p_os_id
    RETURNING * INTO v_os;
  END IF;

  RETURN v_os;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_os(uuid, boolean) TO authenticated;

COMMENT ON FUNCTION public.aprovar_orcamento_os(uuid, boolean) IS
  'Portal do cliente: aprova (em_execucao) ou recusa (avaliacao) orçamento em aguardando_aprovacao.';
