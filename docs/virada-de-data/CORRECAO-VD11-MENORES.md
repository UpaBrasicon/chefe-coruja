# VD11 — Menores

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P3**. O RT mandou seguir até o VD12 em 01/11/2026.

## Diagnóstico

O banco roda em UTC. Das 21h às 24h de Brasília, `current_date` e `timestamptz::date` já dão amanhã. Na tela, `toISOString().slice(0, 10)` faz o mesmo.

| Item | Onde | O que acontecia |
|---|---|---|
| Treinamento da implantação | `public.implantacao_treinar` | Aceitava a data de amanhã. Sem data informada, gravava amanhã. |
| Primeiro acesso | `private.aplicar_primeiro_acesso` | A idade mínima de 16 anos e a máxima de 100 aceitavam um dia antes. |
| Idade na alta | `private.conteudo_pacote_alta` | Usava `data_alta::date`, o dia UTC. Na alta das 21h às 24h, o paciente fazia aniversário um dia antes. |
| Logs da busca | `public.resumo_busca_ia` | Os baldes diários usavam o dia UTC, e a janela era de 24 h corridas. |
| Censo | `public.censo_recente`, `public.gerar_censo_todas_unidades` | A janela e o dia padrão usavam `current_date`. |
| Fim do dia do censo | `private.gerar_censo_diario` | O dia terminava em `23:59:59-03`, comparado com `<=`. O que acontecia depois de 23:59:59,000000 não entrava em nenhum dia. |
| "Último atendimento" | `src/pages/recepcao/CadastrosDuplicados.tsx` | A tela mostrava o dia UTC da chegada (`slice(0, 10)`). |
| CSV de auditoria | `src/pages/InternacaoPainel.tsx` | O nome do arquivo saía com a data UTC. |
| Cancelamento tardio do Hermes | `hermes/src/agent/sentinela.ts` e `hermes/deploy/nous-vigias/vigias/sentinela.py` | O fim do dia do plantão era `T23:59:59` sem fuso. No contêiner (UTC), isso é 20:59:59 em Brasília, e repasses ficavam marcados como tardios até 3 h antes da hora certa. |
| "D+N" da evolução | `src/components/observacao/GraficoEvolucao.tsx` | Contava blocos de 24 h a partir da admissão. Quem foi internado às 23h ainda estava em D+1 às 8h do dia seguinte. |

## Correção

**Banco.** Migration `20270209000008_menores_datas.sql`. Cada troca é feita na definição atual da função, lida sem o CR do fim de linha, como em `20270209000003`.
- **Dia de Brasília:** `current_date` passa a ser `private.data_atual()`, e o dia de um instante passa a ser `(… AT TIME ZONE 'America/Sao_Paulo')::date`.
- **Logs da busca:** a janela passa a ser hoje mais os `p_dias - 1` dias anteriores, contados em Brasília.
- **Censo:** o dia passa a ir até a meia-noite seguinte, exclusiva (`< v_dia_fim`).
- Assinatura, dono e grants iguais. Idempotente.

**Tela.**
- O último atendimento usa `dataIso()`.
- O CSV de auditoria usa `dataIso()`.
- O "D+N" passa a contar dias do calendário de Brasília. A conta fica em `src/lib/diaInternacao.ts`, no mesmo padrão de `diaDeUso`.

**Hermes.**
- `fimDoDiaDoPlantao()` usa `T23:59:59-03:00`.
- O espelho em Python segue a mesma regra.

Rollback:
- **Banco:** as mesmas trocas invertidas.
- **Tela e Hermes:** reverter o commit.

## Testes

- **Banco:**
  - `supabase/tests/vd11_menores.sql`: as nove trocas estão nas funções, e o fim do dia do censo pega 23:59:59,5 mas não pega a meia-noite seguinte;
  - `fase3_implantacao.sql`: com o relógio de Brasília em 01/01/2001, o treinamento de 02/01/2001 é recusado como data futura.
- **Tela:** `src/lib/diaInternacao.test.ts`. Quem foi internado às 23h já está em D+2 às 8h do dia seguinte; o teste também cobre a virada do ano e a aferição antes da admissão. A conta antiga dava D+1.
- **Hermes:** `fimDoDiaDoPlantao('2026-11-01')` dá 02/11 02:59:59 UTC (`sentinela.test.ts`).

Evidência:
- **Homologação:**
  - sem a migration, falha: `implantacao_treinar` sem `data_atual`;
  - com a migration, passa;
  - rollback testado em transação desfeita: migration duas vezes; md5, ACL e dono voltam.
- **Local:**
  - `tsc`, `eslint` e o padrão do frontend passam: nada piorou;
  - o passo `src/lib` passa inteiro (221);
  - Hermes: `sentinela.test.ts` passa (6), e o typecheck e o lint passam;
  - os testes do `nous-vigias` passam.

## Homologação

Aplicada pelo SQL em 01/11/2026, com a versão `20270209000008` registrada.

## Produção

Migration `20270209000008` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 01/11/2026, com o "ok produção" do RT e depois do CI verde. Conferido depois de aplicar: versão registrada; as sete funções com md5 igual ao da homologação; ACL igual.

PR mesclado em seguida. Concluído.

## Riscos

- **"D+N":** pode mudar o rótulo de aferições antigas no gráfico, porque o dia agora vira à meia-noite.
- **Logs da busca:** o resumo mostra dias inteiros. Antes, o dia mais antigo aparecia só em parte.
