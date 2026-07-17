-- Após criar o usuário no Dashboard (Authentication → Users → Add user),
-- rode este SQL no SQL Editor substituindo o e-mail:

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'SEU_EMAIL_ADMIN@exemplo.com'
ON CONFLICT (user_id, role) DO NOTHING;
