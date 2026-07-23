-- Showroom público: produtos elegíveis (sem custo)
CREATE OR REPLACE VIEW public.loja_produtos AS
SELECT
  id,
  nome,
  marca,
  modelo,
  categoria,
  descricao,
  preco_venda,
  fotos,
  observacoes
FROM public.produtos
WHERE ativo = true
  AND visivel_ecommerce = true;

COMMENT ON VIEW public.loja_produtos IS 'Catálogo público de acessórios do showroom (/loja).';

GRANT SELECT ON public.loja_produtos TO anon, authenticated;

INSERT INTO storage.buckets (id, name, public)
VALUES ('loja-produtos', 'loja-produtos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "loja_produtos_photos_read" ON storage.objects;
CREATE POLICY "loja_produtos_photos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'loja-produtos');

DROP POLICY IF EXISTS "loja_produtos_photos_insert_admin" ON storage.objects;
CREATE POLICY "loja_produtos_photos_insert_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'loja-produtos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "loja_produtos_photos_update_admin" ON storage.objects;
CREATE POLICY "loja_produtos_photos_update_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'loja-produtos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "loja_produtos_photos_delete_admin" ON storage.objects;
CREATE POLICY "loja_produtos_photos_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'loja-produtos' AND public.has_role(auth.uid(), 'admin'));
