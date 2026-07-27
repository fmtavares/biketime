-- Cliente lê apenas as próprias bikes e OS.

CREATE POLICY "bikes_read_own"
  ON public.bikes FOR SELECT TO authenticated
  USING (
    cliente_id IN (
      SELECT c.id FROM public.clientes c WHERE c.user_id = auth.uid()
    )
  );

CREATE POLICY "os_read_own"
  ON public.ordens_servico FOR SELECT TO authenticated
  USING (
    cliente_id IN (
      SELECT c.id FROM public.clientes c WHERE c.user_id = auth.uid()
    )
  );
