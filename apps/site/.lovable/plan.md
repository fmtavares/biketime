## Objetivo
Transformar a seção de Depoimentos em um carrossel de rolagem lateral **contínua e automática** (efeito "infinito", sem botões, sem paradas) e refinar o visual dos cards com **glassmorphism**.

## Mudanças

### 1. Rolagem infinita automática (`src/components/testimonials-carousel.tsx`)
- Remover o `embla-carousel` + `embla-carousel-autoplay` desta seção (mantêm-se disponíveis no projeto para outros usos).
- Substituir por um **marquee CSS puro**:
  - Duplicar a lista de depoimentos lado a lado (`[...items, ...items]`) para criar o loop perfeito.
  - Aplicar `animation: marquee 40s linear infinite` (velocidade ajustada à quantidade de itens).
  - `translateX(0 → -50%)` garante emenda invisível.
  - Pausar no `hover` (`hover:[animation-play-state:paused]`) — opcional, elegante, mas sem depender do usuário.
  - Máscara lateral com `mask-image: linear-gradient(...)` para fade nas bordas (entra/sai suave).
- Sem setas, sem dots, sem drag — rolagem 100% automática e independente.

### 2. Glassmorphism nos cards
- Trocar `bg-surface/60` por fundo translúcido + blur:
  - `bg-white/5` (ou token equivalente já existente, ex.: `bg-foreground/5`)
  - `backdrop-blur-xl`
  - `border-white/10` para borda sutil luminosa
  - `shadow-[0_8px_32px_rgba(0,0,0,0.25)]` para profundidade
  - Brilho interno opcional via `before:` com gradiente radial bem sutil
- Ajustar o ícone `Quote` e o divisor para tons mais suaves, combinando com a transparência.
- Manter cores via tokens semânticos (sem hardcode de cores fora do que o Tailwind v4 + glass exige).

### 3. Keyframe do marquee
Adicionar em `src/styles.css`:
```css
@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
```

## Não muda
- Query do Supabase, ordenação, dados, admin de depoimentos.
- Demais seções da home.
- Componente `ui/carousel.tsx` (continua disponível para outros lugares).

## Detalhes técnicos
- Largura dos cards: fixa (ex.: `w-[340px] md:w-[380px]`) para o marquee ter passo previsível.
- `gap-6` entre cards, `flex w-max` no track.
- Acessibilidade: `aria-label="Depoimentos de clientes"` na seção; o conteúdo duplicado recebe `aria-hidden="true"` para não repetir em leitores de tela.
- Performance: animação só em `transform` (GPU), sem reflow.
