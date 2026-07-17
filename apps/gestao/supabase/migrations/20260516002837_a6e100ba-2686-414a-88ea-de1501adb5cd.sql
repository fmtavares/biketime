DROP POLICY IF EXISTS pendencias_update ON public.pendencias;
DROP POLICY IF EXISTS pendencias_delete ON public.pendencias;

CREATE POLICY pendencias_update ON public.pendencias
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (responsavel_id IS NOT NULL AND responsavel_id = auth.uid())
  OR (responsavel_id IS NULL AND created_by = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR (responsavel_id IS NOT NULL AND responsavel_id = auth.uid())
  OR (responsavel_id IS NULL AND created_by = auth.uid())
);

CREATE POLICY pendencias_delete ON public.pendencias
FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR (responsavel_id IS NOT NULL AND responsavel_id = auth.uid())
  OR (responsavel_id IS NULL AND created_by = auth.uid())
);