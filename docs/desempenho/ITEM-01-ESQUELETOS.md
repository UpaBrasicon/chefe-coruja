# Item 01 — Esqueleto ao carregar

Trilha de desempenho (kit de 31 passos). **Decisão do RT em 09/11/2026:** começar por Central do Plantonista, Observação, Internação da enfermagem, fila da Triagem e Regulação.

## Antes

| Tela | Carregamento |
|---|---|
| Central do Plantonista (cartão do turno) | texto "Carregando o turno…" no lugar do título |
| Observação (painel) | círculo girando numa caixa de 160 px |
| Internação da enfermagem (leitos) | círculo girando |
| Fila da Triagem | texto "Carregando a fila…" |
| Regulação (lista de pedidos) | círculo girando |

## Correção (só frontend)

- `src/components/ui/esqueleto-linhas.tsx` (`EsqueletoLinhas`): faixas cinzas na forma das linhas da lista (marca redonda + duas linhas de texto), com `role="status"` e o aviso "Carregando…" só para o leitor de tela. As faixas usam o `Skeleton` que já existia (`aria-hidden`, param de pulsar com `prefers-reduced-motion`).
- Observação, Internação da enfermagem, fila da Triagem e Regulação usam `EsqueletoLinhas` (4, 4, 3 e 5 linhas), com o rótulo de cada tela.
- No cartão do turno da Central, o carregamento fica dentro do título (um `<span>`): uma faixa `Skeleton` da largura do título, com o aviso para o leitor de tela.

A tela não pula quando os dados chegam, e quem espera vê a forma do que vem.

## Teste

`src/lib/esqueletos.test.ts`: as cinco telas não têm mais o carregamento antigo e usam esqueleto; o componente tem `role="status"`, o aviso `sr-only` e o `Skeleton`. Falha no master. Também passaram `npm run lint`, `npm run typecheck`, o padrão do frontend, `npm run build` e 486 testes de `src/lib`.

## Medição na tela logada

Pendente para quando o RT voltar ao computador. Esqueleto não muda o tempo de carga; muda o CLS (a tela pular), que o item 30 passa a medir.

## Próximas telas

As demais telas com spinner ou "Carregando…" (62 textos e 145 arquivos na auditoria) ganham esqueleto aos poucos, quando forem mexidas.
