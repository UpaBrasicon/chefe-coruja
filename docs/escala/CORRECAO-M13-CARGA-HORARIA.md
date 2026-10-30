# Correção do bug médio M13 — carga horária do gestor (30/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, item M13.
Ordem da sessão principal (RT fora): médios na ordem da seção 7.

## Diagnóstico

`resumo_carga_plantonistas` (aba Carga horária do gestor) contava 12 h por dia com diurno e 12 h por
dia com noturno: a manhã de 6 h virava 12 h, enquanto o contador do plantonista conta 6 h. E todas as
categorias apareciam sob o título "Plantonista".

**Produção, só esquema (30/10/2026):** o corpo tem `COUNT(*) FILTER (WHERE d.tem_diurno) * 12`;
sem coluna de categoria. **O bug existe na produção.**

## Correção

- **Banco — migration `20270208000011_escala_carga_horaria.sql`:** as horas passam a ser a soma da
  duração real dos plantões (`duracao_min`; vale para o fracionado e o diurno de 12 h). Diurnos,
  noturnos e dias continuam iguais. Coluna nova no fim, `categorias`. A troca do retorno pede
  DROP + CREATE da mesma função no arquivo; as colunas antigas ficam iguais (a tela antiga lê por nome).
  Mesmas permissões. Rollback (reaplicar a versão de `20260926000001`) **testado**: corpo, retorno e
  ACL voltam iguais.
- **Tela (`Escala.tsx`):** "Profissional" no lugar de "Plantonista", coluna Categoria, rodapé explica as
  horas. `database.ts` com a coluna.

## Testes

| Teste | Resultado |
|---|---|
| `supabase/tests/escala_carga_horaria.sql` sem a migration | **falha**: `M13: manhã (6 h) + noite (12 h) = 18 h (antes 24 h)` |
| Com a migration | **4 de 4** |
| `tsc`, `eslint`, guia do frontend | limpos |

## Homologação

Aplicada pelo SQL em 30/10/2026, versão `20270208000011` registrada. Como a gestora E2E, em transação
desfeita: 004 de manhã em 07/11 e de noite em 08/11; 002 à tarde em 07/11 → "Plantonista E2E: 18 h, 1
diurno, 1 noturno, plantonista"; "Enfermeira E2E: 6 h, 1 diurno, enfermeiro".

## Produção

Migration `20270208000011` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 30/10/2026, com o "ok produção" do RT, pela sessão principal; versão registrada e conferida (gatilhos e grants: RPCs com execute para `authenticated`, não para `anon`). PR #364 mesclado em 30/10/2026 (publica a tela), com o arquivo da migration idêntico ao aplicado. Concluído.
