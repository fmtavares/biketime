-- Portal do cliente: vínculo Auth ↔ clientes, role cliente e RLS.

-- 1) Coluna de vínculo com auth.users
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON public.clientes(user_id);

-- 2) Role cliente (portal do site)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'cliente'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'cliente';
  END IF;
END $$;

-- 3) Equipe (gestão) vs cliente (site)
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'vendedor', 'tecnico')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;

-- 4) Trigger: meta tipo=cliente → role cliente; senão vendedor (equipe)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  IF COALESCE(NEW.raw_user_meta_data->>'tipo', '') = 'cliente' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'cliente')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'vendedor')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- 5) RLS clientes: equipe vê/edita tudo; cliente só o próprio cadastro
DROP POLICY IF EXISTS "clientes_read" ON public.clientes;
DROP POLICY IF EXISTS "clientes_insert" ON public.clientes;
DROP POLICY IF EXISTS "clientes_update" ON public.clientes;

CREATE POLICY "clientes_read_staff"
  ON public.clientes FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "clientes_read_own"
  ON public.clientes FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "clientes_insert_staff"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "clientes_update_staff"
  ON public.clientes FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "clientes_update_own"
  ON public.clientes FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 6) Dados sensíveis da oficina/financeiro: só equipe
DROP POLICY IF EXISTS "bikes_read" ON public.bikes;
DROP POLICY IF EXISTS "bikes_insert" ON public.bikes;
DROP POLICY IF EXISTS "bikes_update" ON public.bikes;
CREATE POLICY "bikes_read_staff" ON public.bikes FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "bikes_insert_staff" ON public.bikes FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "bikes_update_staff" ON public.bikes FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "os_read" ON public.ordens_servico;
DROP POLICY IF EXISTS "os_insert" ON public.ordens_servico;
DROP POLICY IF EXISTS "os_update" ON public.ordens_servico;
CREATE POLICY "os_read_staff" ON public.ordens_servico FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "os_insert_staff" ON public.ordens_servico FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "os_update_staff" ON public.ordens_servico FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "hist_read" ON public.historicos;
DROP POLICY IF EXISTS "hist_insert" ON public.historicos;
DROP POLICY IF EXISTS "hist_update" ON public.historicos;
CREATE POLICY "hist_read_staff" ON public.historicos FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "hist_insert_staff" ON public.historicos FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "hist_update_staff" ON public.historicos FOR UPDATE TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
