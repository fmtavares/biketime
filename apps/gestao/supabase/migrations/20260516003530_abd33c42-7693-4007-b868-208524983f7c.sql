CREATE TABLE public.pendencia_votos (
  pendencia_id uuid NOT NULL REFERENCES public.pendencias(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  coins smallint NOT NULL CHECK (coins BETWEEN 1 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (pendencia_id, user_id)
);

CREATE INDEX idx_pendencia_votos_pendencia ON public.pendencia_votos(pendencia_id);
CREATE INDEX idx_pendencia_votos_user ON public.pendencia_votos(user_id);

ALTER TABLE public.pendencia_votos ENABLE ROW LEVEL SECURITY;

CREATE POLICY pendencia_votos_select ON public.pendencia_votos
FOR SELECT TO authenticated USING (true);

CREATE POLICY pendencia_votos_insert ON public.pendencia_votos
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.pendencias p
    WHERE p.id = pendencia_id
      AND (p.privado = false OR p.created_by = auth.uid())
  )
);

CREATE POLICY pendencia_votos_update ON public.pendencia_votos
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY pendencia_votos_delete ON public.pendencia_votos
FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER trg_pendencia_votos_updated
BEFORE UPDATE ON public.pendencia_votos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: garantir que o usuário não ultrapasse 20 moedas no total
CREATE OR REPLACE FUNCTION public.check_pendencia_votos_budget()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total smallint;
BEGIN
  SELECT COALESCE(SUM(coins), 0) INTO total
  FROM public.pendencia_votos
  WHERE user_id = NEW.user_id
    AND (TG_OP = 'INSERT' OR pendencia_id <> NEW.pendencia_id);

  IF total + NEW.coins > 20 THEN
    RAISE EXCEPTION 'Limite de 20 moedas excedido (você já usou %).', total;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pendencia_votos_budget
BEFORE INSERT OR UPDATE ON public.pendencia_votos
FOR EACH ROW EXECUTE FUNCTION public.check_pendencia_votos_budget();