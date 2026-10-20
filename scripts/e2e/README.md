# Teste de ponta a ponta do fluxo assistencial

Scripts do portão antes da Fase 5 (BACKLOG). Eles criam uma rede de teste isolada
("Rede E2E", CNES fictícios) e percorrem o fluxo de 15 pacientes simulados, da
recepção ao gestor, com uma conta por papel. Cada passo roda como o papel, com RLS
ligado, e o resultado fica em `e2e.resultados`.

**Use só no ambiente local ou na homologação. Nunca em produção.**

Relatório da rodada de 11/10/2026: `produto/docs/teste-e2e/RELATORIO_E2E_2026-10-11.md`.

## Ordem

| Arquivo | O que faz |
|---|---|
| `01_rede_e2e.sql` | Organização, unidades (UPA, hospital, maternidade, UTI, central), setores, leitos, 14 contas, escala de ontem a depois de amanhã |
| `02_catalogo_e2e.sql` | Catálogo de medicamentos do teste (nome e apresentação, sem dose) |
| `03_checkin_agora.sql` | Check-in dos plantões em curso. Rode no começo de cada sessão, senão a escala fecha a porta depois de 30 min |
| `04_framework_e2e.sql` | Esquema `e2e`: `e2e.passo`, `e2e.lacuna`, `e2e.ajuste` e utilitários |
| `10_coorte_porta.sql` | Coorte, recepção e triagem |
| `11_coorte_atendimento.sql` | Atendimento, prescrição, exames e negativas de permissão |
| `12_coorte_desfecho.sql` | Reclassificação, altas, documentos, observação e internação |
| `13_coorte_internacao.sql` | Observação, internação, farmácia, checagem, enfermagem e passagem de plantão |
| `14_coorte_regulacao_alta.sql` | AIH, APAC, regulação, transferência, óbito, alta e casos-limite de cadastro |
| `15_gestor_transversais.sql` | Gestor, auditoria, concorrência, evasão, alta a pedido e avisos |
| `16_carga.sql` | 60 internados a mais e o tempo de cada tela |
| `17_correcao_t1_desfecho.sql` a `23_correcao_t7_avisos.sql` | Regressão das correções do portão (tarefas 1 a 7), uma por script |
| `30_rede_coorte2.sql` | Rodada 2: seis unidades novas (infantil, alto risco, psiquiátrico, queimados, trauma, CIATox), seis contas de médico e a escala |
| `31_coorte2_catalogo.sql` | Rodada 2: medicamentos que a coorte 2 prescreve (sem dose) |
| `32_coorte2_porta.sql` | Rodada 2: coorte 2 (#16 a #34) na recepção, triagem, atendimento e desfecho; rode `03` antes |
| `33_coorte2_internacao.sql` | Rodada 2: observação, internação, notificações, identidade, retorno, paliativo, isolamento, regulação e transferência |
| `34_coorte2_extras.sql` | Rodada 2: troca de unidade, segundo fator, `perguntar_gestao`, lote de 40 fichas e exportações |
| `99_limpar_rede_e2e.sql` | Apaga a Rede E2E e tudo o que foi gravado nela |

Na homologação os scripts são colados no SQL do plugin do Supabase, que não entende os
comandos do psql (`\set`) nem a variável `:'senha'`. `homolog/preparar.mjs` gera a versão
para colar: tira os comandos e troca a senha pelo hash bcrypt passado em `HASH_E2E` (o hash
não fica no repositório). Ordem na homologação: `01`, `02`, `03`, `04`, `10` a `16`, `17` a
`23`, `30`, `31`, `03` de novo, `32`, `33`, `34`.

## Como rodar (local)

A senha das contas de teste entra por variável e não fica gravada nos arquivos:

```bash
docker exec -i supabase_db_chefe-coruja psql -U postgres -q -v senha="$SENHA" < scripts/e2e/01_rede_e2e.sql
```

Os demais rodam sem variável, na ordem acima:

```bash
docker exec -i supabase_db_chefe-coruja psql -U postgres -q < scripts/e2e/02_catalogo_e2e.sql
```

Resultado:

```sql
SELECT situacao, count(*) FROM e2e.resultados GROUP BY 1;
SELECT * FROM e2e.resultados WHERE situacao <> 'ok' ORDER BY id;
```

## Pré-requisitos

- CID-10 (`supabase/homolog/partes/cid10_parte1..5`), SIGTAP
  (`data/terminologia/sigtap/sql/`) e compatibilidade SIGTAP × CID carregados. Na
  homologação essas tabelas já existem.
- Na homologação, as contas de teste são criadas pelo responsável técnico.

## Situação dos passos

- `ok`: o resultado bateu com o esperado (incluindo negativas que deviam ser recusadas).
- `falha`: o resultado não bateu. A mensagem do banco fica em `detalhe`.
- `lacuna`: a função esperada não existe no produto.
- `ajuste`: preparo do cenário feito como `postgres` (por exemplo, envelhecer uma espera).
