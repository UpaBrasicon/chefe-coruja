# Correção dos bugs M1 (médio) e B2 (baixo) — quem vê a vaga (30/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, item M1. Ordem da
sessão principal (RT fora): médios na ordem da seção 7.

## Diagnóstico

A vaga sem categoria aparecia em `vagas_abertas` para todos os papéis, e a candidatura recusava quem
não é plantonista ("Esta vaga é de plantonista"). A regra já decidida está em `candidatar_vaga`
(E4, `20270202000004`): vaga sem categoria é do plantonista. Só a lista não seguia a regra.

**Produção, só esquema (30/10/2026):** `vagas_abertas` com `v.papel IS NULL OR …` (mostra a todos);
`candidatar_vaga` com `coalesce(v.papel, 'plantonista')`. **O bug existe na produção.**

**B2 (baixo, mesma função):** `vagas_abertas` mostrava a vaga numa faixa em que a pessoa já está
escalada (em outro setor); a candidatura depois recusava ("Você já tem plantão nesse horário").

## Correção — migration `20270208000007_escala_vaga_sem_categoria.sql`

`vagas_abertas` passa a filtrar por `coalesce(v.papel, 'plantonista')`, como a candidatura, e
(B2) a esconder a vaga numa faixa em que eu já tenho plantão, em qualquer setor. Corpo de
`20270202000003`; muda só o filtro. Mesma assinatura e retorno (as permissões ficam). Sem tela.
Idempotente; rollback (reaplicar o corpo antigo) **testado**: corpo, ACL e configuração voltam iguais.

## Testes

| Teste | Resultado |
|---|---|
| `supabase/tests/escala_vaga_sem_categoria.sql` sem a migration | **falha**: `M1: a enfermeira não vê a vaga sem categoria` |
| Com a migration | **5 de 5** (inclui o B2) |
| B2 sem a parte nova (homologação já com a 1ª versão do M1) | **falha**: `B2: o plantonista não vê a vaga na faixa em que já está escalado` |
| `escala_pedidos_categorias`, `escala_gestor_categorias`, `escala_vaga_por_categoria` com a migration | passam |
| `porte_gestor_parte2` | depende do seed local; falha igual sem a migration na homologação; fica com o CI |

## Homologação

Aplicada pelo SQL em 30/10/2026, versão `20270208000007` registrada. Como as contas E2E, em transação
desfeita: a gestora marca vaga sem categoria no PS em 02/11 tarde; a enfermeira, o técnico e a recepção
veem 0; o plantonista vê 1.

## Produção

Migration `20270208000007` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 30/10/2026, com o "ok produção" do RT, pela sessão principal; versão registrada e conferida (gatilhos e grants: RPCs com execute para `authenticated`, não para `anon`). PR #358 mesclado em 30/10/2026, com o arquivo da migration idêntico ao aplicado. Concluído.
