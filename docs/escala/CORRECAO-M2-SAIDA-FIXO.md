# Correção do M2 — saída do fixo aprovada encerra a fixa (31/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md` (médio M2). Decisões do RT
em 31/10/2026 (`docs/escala/PROPOSTAS-MEDIOS-M2-M7-M9.md`):

- falta justificada aprovada: opção B, "Só registra". Nada muda no código: a aprovação só muda o
  status, o plantão fica com a pessoa como falta justificada (o ERP conta certo) e o gestor abre a vaga
  à mão se quiser cobrir;
- saída do fixo aprovada: opção A, "Encerra a fixa". É este PR.

## Problema

Aprovar a saída do fixo só mudava o status: a fixa continuava gerando o mês. O banco também aceitava
"sair da fixa" num plantão que não veio da fixa.

## Correção

- Migration `20270208000016_escala_saida_fixo.sql`:
  - `private.linha_da_fixa(plantão)`: a linha ativa da fixa que gera o plantão (mesma pessoa, setor,
    dia da semana e turno). A geração do mês não guarda o vínculo, e esta é a mesma regra que gera.
  - `trg_sair_fixo_conferir` (BEFORE INSERT, tipo `sair_fixo`): sem linha da fixa, recusa ("Este
    plantão não veio da escala fixa; para sair dele, passe o plantão ou justifique a falta.").
  - `trg_sair_fixo_aprovado` (AFTER UPDATE OF status, pendente → aprovado): encerra a linha
    (`escala_fixa.ativo = false`) e grava `fixa_encerrada` no histórico da escala. Os meses ainda não
    gerados deixam de ter o plantão; os já gerados ficam com a pessoa, e o gestor decide cada um.
    Recusado, nada muda.
  - Expand: só funções e gatilhos novos; sem DROP/RENAME; idempotente.
- Tela (`Escala.tsx`): o pedido pendente de saída do fixo diz ao gestor "aprovar encerra a linha da
  fixa nos próximos meses; os plantões já gerados ficam"; a janela do profissional explica o mesmo.
- Teste do M5/M6 (`escala_avisos_decisoes.sql`) ajustado: o plantão do pedido de saída do fixo passa a
  vir de uma linha da fixa.

## Testes

`supabase/tests/escala_saida_fixo.sql` (9 testes), na homologação, em transação desfeita:

| Situação | Sem a migration | Com a migration |
|---|---|---|
| `escala_saida_fixo` | falha no 1º ("o pedido de saída do fixo não vale para plantão que não veio da fixa — passou sem erro") | FIM ok |
| `escala_avisos_decisoes` (M5/M6, ajustado) | FIM ok | FIM ok |
| `escala_aceite_colega`, `escala_atestado_falta`, `escala_gestor_categorias` | — | FIM ok |

Cobertos: o pedido de plantão avulso é recusado; o de plantão da fixa vale; aprovado, a linha é
encerrada, o plantão gerado fica com a pessoa e o histórico registra `fixa_encerrada`; recusado, a
linha continua; o mês seguinte não gera o plantão da linha encerrada e continua gerando o da outra.

Rollback testado (transação desfeita): migration aplicada duas vezes sem erro; o rollback do cabeçalho
remove os dois gatilhos e as três funções.

## Homologação

Aplicada pelo SQL em 31/10/2026, versão `20270208000016` registrada. Como as contas E2E, em transação
desfeita, na UPA E2E, com uma linha da fixa de 004: 004 pede saída do fixo de um plantão avulso →
"Este plantão não veio da escala fixa…"; 004 pede a do plantão da fixa → enviado; 009 (gestora) aprova
→ a linha da fixa fica inativa, o plantão gerado continua com 004 e o histórico traz `fixa_encerrada`
e `sair_fixo_aprovado`.

A tela da homologação fica atrás do login do Vercel; a tela não foi aberta no navegador.

## Produção

Nada aplicado. Ordem: "ok produção" do RT → migration pelo SQL, versão registrada → merge (publica a tela).
