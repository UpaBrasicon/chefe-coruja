# Correção do bug médio M1 — vaga sem categoria só do plantonista (30/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, item M1. Ordem da
sessão principal (RT fora): médios na ordem da seção 7.

## Diagnóstico

A vaga sem categoria aparecia em `vagas_abertas` para todos os papéis, e a candidatura recusava quem
não é plantonista ("Esta vaga é de plantonista"). A regra já decidida está em `candidatar_vaga`
(E4, `20270202000004`): vaga sem categoria é do plantonista. Só a lista não seguia a regra.

**Produção, só esquema (30/10/2026):** `vagas_abertas` com `v.papel IS NULL OR …` (mostra a todos);
`candidatar_vaga` com `coalesce(v.papel, 'plantonista')`. **O bug existe na produção.**

## Correção — migration `20270208000007_escala_vaga_sem_categoria.sql`

`vagas_abertas` passa a filtrar por `coalesce(v.papel, 'plantonista')`, como a candidatura. Corpo de
`20270202000003`; muda só o filtro. Mesma assinatura e retorno (as permissões ficam). Sem tela.
Idempotente; rollback (reaplicar o corpo antigo) **testado**: corpo, ACL e configuração voltam iguais.

## Testes

| Teste | Resultado |
|---|---|
| `supabase/tests/escala_vaga_sem_categoria.sql` sem a migration | **falha**: `M1: a enfermeira não vê a vaga sem categoria` |
| Com a migration | **4 de 4** |
| `escala_pedidos_categorias`, `escala_gestor_categorias`, `escala_vaga_por_categoria` com a migration | passam |
| `porte_gestor_parte2` | depende do seed local; falha igual sem a migration na homologação; fica com o CI |

## Homologação

Aplicada pelo SQL em 30/10/2026, versão `20270208000007` registrada. Como as contas E2E, em transação
desfeita: a gestora marca vaga sem categoria no PS em 02/11 tarde; a enfermeira, o técnico e a recepção
veem 0; o plantonista vê 1.

## Produção

Nada aplicado. Ordem: "ok produção" do RT → migration pelo SQL, versão registrada → merge (sem tela).
