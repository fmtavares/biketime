## Problema

A página `/relatorios` está redirecionando para `/` mesmo para usuários admin.

**Causa:** em `src/lib/auth-context.tsx`, `loading` vira `false` assim que a sessão é carregada, **antes** do fetch de `user_roles` terminar (a chamada é assíncrona e `setTimeout(..., 0)`). Nesse intervalo, `isAdmin` é `false`, e `_app.relatorios.tsx` faz:

```tsx
if (loading) return ...carregando...
if (!isAdmin) return <Navigate to="/" />;
```

→ redireciona o admin para a home antes dos roles chegarem.

## Correção

Ajustar `src/lib/auth-context.tsx` para só marcar `loading = false` depois que os roles do usuário tiverem sido carregados (ou confirmado que não há usuário). Assim qualquer guarda baseada em `isAdmin` funciona corretamente em todas as páginas (Relatórios, e qualquer outra que use `isAdmin`).

Mudanças pontuais:
- Tornar `fetchRoles` retornar uma Promise e fazer `setLoading(false)` no `.finally`.
- No `onAuthStateChange`, quando não há sessão, também limpar roles e garantir `loading=false`.

Sem alterações em `_app.relatorios.tsx`.
