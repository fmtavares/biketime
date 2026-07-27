-- Histórico de observações da aprovação (cliente/equipe) com data.
-- Cada novo comentário do portal é anexado, sem sobrescrever o anterior.

CREATE OR REPLACE FUNCTION public.append_observacao_aprovacao(
  p_existente text,
  p_autor text,
  p_texto text,
  p_em timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NULLIF(trim(COALESCE(p_texto, '')), '') IS NULL THEN p_existente
    ELSE
      NULLIF(
        trim(both E'\n' FROM concat_ws(
          E'\n\n',
          NULLIF(trim(COALESCE(p_existente, '')), ''),
          format(
            E'[Comentário %s — %s]\n%s',
            COALESCE(NULLIF(trim(p_autor), ''), 'Cliente'),
            to_char(
              COALESCE(p_em, now()) AT TIME ZONE 'America/Sao_Paulo',
              'DD/MM/YYYY HH24:MI'
            ),
            trim(p_texto)
          )
        )),
        ''
      )
  END;
$$;

COMMENT ON FUNCTION public.append_observacao_aprovacao(text, text, text, timestamptz) IS
  'Anexa uma entrada [Comentário Autor — data] ao histórico de observações da aprovação.';

-- Normaliza textos antigos (sem cabeçalho) para o formato de histórico.
UPDATE public.ordens_servico
SET observacoes_aprovacao = public.append_observacao_aprovacao(
  NULL,
  CASE
    WHEN observacao_aprovacao_origem = 'equipe' THEN 'Equipe'
    ELSE 'Cliente'
  END,
  observacoes_aprovacao,
  COALESCE(data_aprovacao, updated_at, now())
)
WHERE observacoes_aprovacao IS NOT NULL
  AND trim(observacoes_aprovacao) <> ''
  AND observacoes_aprovacao !~ '^\[Comentário ';

CREATE OR REPLACE FUNCTION public.aprovar_orcamento_os(
  p_os_id uuid,
  p_aprovar boolean,
  p_motivo text DEFAULT NULL
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
  v_motivo text;
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
  v_motivo := NULLIF(trim(COALESCE(p_motivo, '')), '');

  IF p_aprovar THEN
    UPDATE public.ordens_servico
    SET
      status = 'em_execucao',
      aprovado = true,
      aprovado_por = COALESCE(v_nome, 'Cliente'),
      data_aprovacao = now(),
      valor_aprovado = v_total,
      observacoes_aprovacao = CASE
        WHEN v_motivo IS NOT NULL THEN
          public.append_observacao_aprovacao(observacoes_aprovacao, 'Cliente', v_motivo, now())
        ELSE observacoes_aprovacao
      END,
      observacao_aprovacao_origem = CASE
        WHEN v_motivo IS NOT NULL THEN 'cliente'
        ELSE observacao_aprovacao_origem
      END,
      updated_at = now()
    WHERE id = p_os_id
    RETURNING * INTO v_os;
  ELSE
    IF v_motivo IS NULL THEN
      RAISE EXCEPTION 'Informe o motivo da recusa';
    END IF;

    UPDATE public.ordens_servico
    SET
      status = 'avaliacao',
      aprovado = false,
      aprovado_por = COALESCE(v_nome, 'Cliente'),
      data_aprovacao = now(),
      observacoes_aprovacao = public.append_observacao_aprovacao(
        observacoes_aprovacao,
        'Cliente',
        v_motivo,
        now()
      ),
      observacao_aprovacao_origem = 'cliente',
      updated_at = now()
    WHERE id = p_os_id
    RETURNING * INTO v_os;
  END IF;

  RETURN v_os;
END;
$$;

GRANT EXECUTE ON FUNCTION public.aprovar_orcamento_os(uuid, boolean, text) TO authenticated;

COMMENT ON FUNCTION public.aprovar_orcamento_os(uuid, boolean, text) IS
  'Portal do cliente: aprova ou recusa orçamento, anexando comentário ao histórico de observações.';

COMMENT ON COLUMN public.ordens_servico.observacoes_aprovacao IS
  'Histórico de observações da aprovação. Cada entrada: [Comentário Cliente|Equipe — DD/MM/YYYY HH:MM] + texto.';
