-- Lista profiles da equipe da oficina (admin/vendedor/tecnico) para selects do Gestão.
-- SECURITY DEFINER: técnicos/vendedores não leem user_roles de terceiros via RLS.

CREATE OR REPLACE FUNCTION public.listar_profiles_equipe()
RETURNS TABLE (
  id uuid,
  full_name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email
  FROM public.profiles p
  WHERE EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role IN ('admin', 'vendedor', 'tecnico')
  )
  ORDER BY COALESCE(p.full_name, p.email);
$$;

COMMENT ON FUNCTION public.listar_profiles_equipe() IS
  'Retorna usuários com papel de equipe (admin/vendedor/técnico) para selects da oficina.';

GRANT EXECUTE ON FUNCTION public.listar_profiles_equipe() TO authenticated;
