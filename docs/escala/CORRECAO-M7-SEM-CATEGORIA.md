# Correção do M7 — plantão sem categoria (31/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md` (médio M7). Decisão do RT
em 31/10/2026: opção A, "Categoria em comum", com o aviso "N plantões sem categoria" e o atalho no mês
do gestor (`docs/escala/PROPOSTAS-MEDIOS-M2-M7-M9.md`).

## Problema

O plantão sem categoria (`papel = NULL`, que a E1 deixa para quem tem duas categorias) pulava a trava
de troca e passagem dentro da categoria. Nenhuma tela forçava a escolha.

## Correção

- Migration `20270208000017_escala_sem_categoria.sql`:
  - `private.categoria_em_comum(unidade, a, b)`: as duas pessoas têm algum papel escalável em comum na
    unidade.
  - Os gatilhos da E1 (`private.troca_mesma_categoria`, `private.passagem_mesma_categoria`) ganham o
    ramo do plantão sem categoria: troca e passagem só com quem tem categoria em comum com o dono ("Plantão sem
    categoria: … Peça à coordenação para definir a categoria deste plantão."). O ramo com categoria
    não muda.
  - `public.definir_categoria_plantoes(plantões, papel)`: só o gestor da unidade (ou o super admin)
    define a categoria de um ou de vários plantões de uma vez; o gatilho da E1 confere que a pessoa
    tem o papel e o histórico registra a alteração.
  - Expand: funções novas e corpos novos das duas funções de gatilho; sem DROP/RENAME; idempotente.
- Tela: no mês do gestor (`EscalaMes.tsx`), o aviso "N plantões sem categoria" (`SemCategoria.tsx`,
  agrupados por `agruparSemCategoria`, `src/lib/semCategoria.ts`) abre a lista por pessoa: escolher a
  categoria e "Definir nos N", ou "Um por um" para cada plantão. Só aparecem as categorias que a pessoa
  tem na unidade.

## Testes

- `supabase/tests/escala_sem_categoria.sql` (9 testes), na homologação, em transação desfeita: falha
  sem a migration ("plantão sem categoria não passa para quem não tem categoria em comum — passou sem
  erro") e passa com ela. Com a migration passam também E1 (`escala_categoria`), E2
  (`escala_gestor_categorias`), E4 (`escala_pedidos_categorias`), A4, C1, A2, C2, M3 e B10.
- `src/lib/semCategoria.test.ts` (2 de 2).
- Rollback testado (transação desfeita): migration aplicada duas vezes sem erro; depois do rollback, as
  duas funções de gatilho voltam idênticas às da E1 (md5 sem `\r`).
- `tsc`, `eslint`, o guia do frontend e `migrations-destrutivas` passam.

## Homologação

Aplicada pelo SQL em 31/10/2026, versão `20270208000017` registrada. Como as contas E2E, em transação
desfeita, na UPA E2E, com 004 temporariamente plantonista e telemedicina (os dois plantões dele ficam
sem categoria): 004 passa um para 002 (enfermeira) → "Plantão sem categoria: …"; para 005
(plantonista) → pedido criado; 009 (gestora) define telemedicina no outro → 1 alterado, e o plantão
fica de telemedicina.

A tela da homologação fica atrás do login do Vercel; a tela não foi aberta no navegador.

## Produção

Nada aplicado. Ordem: "ok produção" do RT → migration pelo SQL, versão registrada → merge (publica a tela).
