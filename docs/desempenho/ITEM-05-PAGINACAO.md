# Item 05 — Paginar listas que crescem

Trilha de desempenho (kit de 31 passos). **Decisão do RT em 09/11/2026: A** — telas clínicas por janela de tempo (internação atual ou últimas 48 h, com "ver mais"); listas administrativas em páginas de 20 a 50, com "ver mais".

A auditoria (seção 3.2) achou 19 leituras sem limite. O item vai em partes, um PR por parte.

## 05a — telas clínicas que leem tabelas direto (sem migration)

| Leitura | Antes | Depois |
|---|---|---|
| Passagens de plantão do leito (`LeitoAberto.tsx`) | todas da internação | as 20 mais recentes. O bloco da tela usa só a pendente e a última, então não precisa de "ver mais" |
| Trilha do episódio: eventos ADT (`caderno/Trilha.tsx`) | todos da vida do paciente | os 50 mais recentes, em ordem do mais antigo para o mais novo, com "Ver eventos mais antigos" (mais 50 por vez); o resumo diz "últimos N eventos" quando há mais |
| Trilha do episódio: transferências | todas da vida do paciente | as 20 mais recentes, com "Ver transferências mais antigas" |

Conferidas e já na janela da decisão (internação atual), sem mudança: a série de sinais vitais (`getSeriesObservacao`, lida por internação), o painel de sinais (`getPainelInternacao`) e as pendências do leito.

Teste: `src/lib/janelasClinicas.test.ts` (as três leituras com limite e os botões de "ver mais"), falha no master.

## 05b — RPCs sem limite (com migration, próximo PR)

Avaliações, intercorrências, pareceres, procedimentos e documentos do paciente; AIH e APAC da unidade; painéis do Hiperdia, da puericultura e do pré-natal; conversas do chat; chamados técnicos; pessoas da organização; versões de diluição. Cada RPC ganha parâmetros de limite e de deslocamento com padrão, e a tela ganha "ver mais". A migration vai precisar de "ok produção" próprio.

## Medição na tela logada

Pendente para quando o RT voltar ao computador. Na homologação as listas têm poucos registros; o ganho aparece com uso real (o item 30 mede).
