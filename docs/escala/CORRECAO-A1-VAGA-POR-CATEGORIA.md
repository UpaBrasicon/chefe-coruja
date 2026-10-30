# Correção do bug alto A1 — vaga de duas categorias na mesma faixa (29/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, item A1 (e B1, o erro
cru que o gestor lia). Autorização: RT, "Sim, A1 a A5", repassado pela sessão principal.

## Diagnóstico

O gestor não abria vaga de duas categorias na mesma faixa (ex.: médico e enfermeiro no PS de manhã).
A E2/E4 deu categoria à vaga (`escala_vagas.papel`), mas o índice único `escala_vagas_aberta`
(`20261012000001`) ficou `(setor_id, data, turno)`. A 2ª categoria batia em
`duplicate key value violates unique constraint "escala_vagas_aberta"`, mostrado cru na tela.
`marcar_vaga_escala` e a geração do mês já procuram a vaga existente pela categoria;
`escala_faixas` e `vagas_abertas` já lidam com várias vagas por faixa. Só o índice barrava.

**Produção, só esquema (29/10/2026):** `escala_vagas_aberta` é `(setor_id, data, turno)` sem
`papel`. **O bug existe na produção.**

## Banco — migration `20270208000003_escala_vaga_por_categoria.sql`

Índice novo `escala_vagas_aberta_categoria` em `(setor_id, data, turno, papel) NULLS NOT DISTINCT`,
nas vagas abertas marcadas pelo gestor: uma vaga aberta por categoria na faixa, e uma só sem
categoria. O índice antigo sai depois de o novo existir (o antigo é mais estrito; nenhum código usa o
nome dele nem `ON CONFLICT` nele). Idempotente (aplicada duas vezes seguidas sem erro). Rollback no
cabeçalho, com a conferência de duplicatas antes. Sem mudança de tela.

## Testes

`supabase/tests/escala_vaga_por_categoria.sql` (11 testes), rodado na homologação em transação
desfeita:

| Rodada | Resultado |
|---|---|
| Sem a migration | **falha**: `FALHOU: A1: vaga de enfermeiro na mesma faixa` |
| Com a migration | **11 de 11** |
| Suíte da escala com a migration (`escala_categoria`, `escala_da_unidade`, `escala_gestor_categorias`, `escala_pedidos_categorias`, `fase5c_erp_plantoes`, `escala_troca_forcada`, `escala_passagem_aprovada`) | todos passam |
| Rollback | migration + rollback devolvem os mesmos índices (`indexdef` iguais) |

## Homologação

Migration aplicada pelo SQL em 29/10/2026, versão `20270208000003` registrada. Como a Gestora E2E,
em transação desfeita, no PS da UPA E2E em 31/10 manhã:

| Passo | Resultado |
|---|---|
| Marca vaga de plantonista, enfermeiro, técnico, recepção e farmacêutico | 5 vagas, uma por categoria (antes: a 2ª dava "duplicate key") |
| Marca de novo a de enfermeiro | devolve a mesma vaga |
| Enfermeira E2E em `vagas_abertas` na faixa | vê 1 (a da sua categoria) |

## Produção

Nada aplicado. Ordem: "ok produção" do RT → migration pelo SQL, versão registrada → merge (sem tela).
