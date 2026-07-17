# BikeTime

Monorepo do site institucional e do app de gestao da oficina.

## Apps

- `apps/site` — site institucional (biketime.com.br)
- `apps/gestao` — gestao de oficina (gestao.biketime.com.br)

## Supabase

Os dois apps usam o mesmo projeto **Site Bike Time** (`zzgfyksiktejlyenasvo`):
- Site: `past_events`, `testimonials`, admin CMS
- Gestao: `clientes`, `bikes`, `ordens_servico`, estoque, vendas, etc.

## Desenvolvimento

```bash
npm install
npm run dev:site     # http://localhost:8080
npm run dev:gestao   # porta do Vite da gestao
```

Cada app tem seu `.env` (veja `.env.example`).

## Vercel

Crie dois projetos no mesmo repo:

1. Site — Root Directory `apps/site`
2. Gestao — Root Directory `apps/gestao` + dominio `gestao.biketime.com.br`
# biketime
