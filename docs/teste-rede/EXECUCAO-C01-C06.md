# Execução dos cenários C01 a C06 na homologação

Bloco C do catálogo (`CENARIOS-C-farmacia-custos.md`): farmácia, faturamento, custos e ERP. É um teste de **fluxo**, com dados fictícios. Nenhuma dose foi escrita de memória: o medicamento vai pelo nome do catálogo, e a dose é o texto "conforme protocolo — dado fictício de teste de fluxo". Nada foi corrigido no produto durante a rodada.

## Data, hora e ambiente

- **Quando:** de 06/11/2026, 23h49, a 07/11/2026, 00h07 (horário de Brasília), no plantão da noite. Os seis cenários rodaram em sequência, um script por cenário, e cada script inteiro roda numa transação só.
- **Ambiente:** homologação, Supabase `kswurfyxxvfydpjfrivy`, conferido em `supabase/.temp/project-ref` antes de cada execução. A produção não foi tocada.
- **Como rodou:**
  1. `41_checkin_fase5.sql`, para o check-in dos plantões em curso;
  2. `70_cenario_c01.sql` a `75_cenario_c06.sql`, cada um preparado por `scripts/e2e/homolog/preparar.mjs` e executado com `npx supabase db query --linked -f`.
- **Como o papel roda:** cada passo roda **como a conta do papel** (role `authenticated` com as claims do JWT, RLS ligado), pelas mesmas RPCs das telas. A remuneração de plantão usa a mesma tabela que `Configuracao.tsx` grava. "banco" é conferência feita como postgres, de algo que a tela não mostra.
- **Ensaio antes de gravar:** cada cenário rodou uma vez "a seco", numa transação desfeita no fim, e só então de verdade. Os erros dos ensaios foram **do script** (nome de coluna, formato de retorno, tabela lida sem RLS) e foram corrigidos antes da rodada válida. Os ensaios não deixaram nada gravado.
  - Exceções em que o ensaio mostrou **regra do produto**, que entrou no script:
    - a APAC só fecha com o endereço SUS completo (P3-C4);
    - o ERP só leva plantão de plantonista (P3-C6).
- **Valores:** os valores em reais são os que o **sistema** calculou pelo SIGTAP carregado (competência 202609). Os valores fictícios do catálogo não foram gravados.
  - **Exceção:** a remuneração de plantão do C05. É um dado de configuração digitado pelo gestor, então foi preciso gravar valores. Eles são **FICTÍCIOS, SÓ PARA TESTE** (600, 1.200 e 500), e a tabela não tem marca de teste: a marca está neste relatório.
- **Contas e leitos:**
  - contas usadas: `f5_rec_upa`, `f5_enf_upa`, `f5_med_upa`, `f5_med_int`, `f5_fat`, `f5_ges_upa`, `f5_farm`, `f5_nir`, `f5_regulador`, `f5_fat_rede` e, para a borda de outra rede, `faturamento`;
  - nenhuma conta nova foi criada;
  - leito: **INT-04**, o último INT livre. OA-01, OA-02, CM-01 e CM-02 não foram usados.

## Resumo

| Cenário | ok | falha | lacuna | Resultado |
|---|---|---|---|---|
| C01: conta de porta, BPA-I/BPA-C, competência | 61 | 0 | 3 | Fluxo completo pelo caminho A (sem pendência bloqueante). Conta faturada com R$ 34,79; competência fechada, travada, reaberta, fechada de novo e reaberta. |
| C02: internação, AIH, glosas | 63 | 0 | 3 | AIH solicitada → aprovada; conta de internação com R$ 598,42; glosa da AIH recuperada e glosa do lançamento perdida. |
| C03: APAC | 54 | 0 | 2 | APAC solicitada → autorizada; duas execuções; competência fechada e reaberta; a APAC não entra no total (R$ 11,00) e só vira reais na glosa (R$ 122,00). |
| C04: farmácia | 77 | 0 | 4 | Alta vigilância sem liberação, devolução, item alterado, liberação; estoque com entrada, saída, devolução, avulsa e negativo; medicamento e material sem valor. |
| C05: ERP e plantões | 45 | 0 | 1 | Prévia de M com R$ 9.800,00 de valores fictícios; M-1 fechado, reaberto e fechado (v1 e v2); conta do C01 reaberta pelo gestor, v1 substituída e v2 com R$ 11,63. |
| C06: leitura pelo arquivo e pela API | 15 | 0 | 8 | Tela = arquivo do ERP em todas as contas, glosas e plantões. A API `/financeiro/*` ficou sem teste de dados: não há chave com o recurso `financeiro` (lacuna de ambiente). |
| **Total** | **315** | **0** | **21** | |

Nenhuma falha na rodada válida. As 21 lacunas:
- **10 do MAPA:**
  - valor de medicamento (C01);
  - valor de medicamento e material na conta (C04);
  - valor gravado na APAC;
  - TISS/TUSS;
  - SISAIH01;
  - retorno SIA/SIH;
  - diária automática;
  - dupla checagem sem tela;
  - lote, validade e preço;
  - webhook.
- **9 de ambiente ou escopo:**
  - API sem chave `financeiro` (C05.13, C06.03 a C06.07);
  - chave de outro recurso não usada (C06.08, ver C06);
  - técnico da UPA fora do PS (C04.99.tecnico);
  - Power BI sem o financeiro (C06.99, escopo).
- **2 "não precisou" ou "não exercida":**
  - liberação do gestor no C01;
  - número de APAC repetido.

**Achados:** nenhum P0 e nenhum P1. Há **2 P2** de produto (remuneração de plantão sem autor nem auditoria; execução de APAC em competência e data futuras) e P3 de produto, catálogo e ambiente.

## C01 — Conta de porta com BPA-I e BPA-C e fechamento da competência

**Paciente:** "Antônio C1 Corte na Mão", CNS fictício `700930000007079`, prontuário 2026.000008.
**Conta:** `A-2026.000009` (`ceb34334-…`).

**Resumo:**
- A conta nasceu com a ficha: aberta, pagador `sus`, 0 itens e total 0.
- Cada item apareceu **no momento do fato**:
  - classificação: item de acolhimento;
  - médico assume: consulta;
  - checagem "feito": medicação;
  - lançamento do faturamento: sutura, em nome do médico, com via `faturamento` e retirável.
- O código fora da lista foi recusado.
- Fechou sem liberação (caminho A). Os itens ficaram congelados com a mesma soma, e a versão 1 do ERP nasceu ao faturar.
- **Destinos no BPA:**
  - classificação, consulta e sutura em BPA-I;
  - medicação em BPA-C, com o motivo "Código marcado pela unidade como sempre BPA-C".
- **Competência 202611:**
  - fechada; o arquivo `BPA_9995028_202611.txt` traz as 3 linhas BPA-I do paciente (registro 03, 352 colunas, sem valor);
  - registrar procedimento com a competência fechada foi recusado, e fechar de novo e fechar competência futura também;
  - reaberta com motivo, fechada de novo (2º fechamento) e reaberta outra vez, para não travar os outros cenários da UPA.
- O "sempre BPA-C" da medicação foi desmarcado no fim (C01.17).

**Pré-condições aplicadas pelo faturamento (RPCs de `/faturamento`):**
- cabeçalho do BPA da UPA, com **valores fictícios**: órgão "Secretaria de Saúde F5 (teste)", sigla SMSF5, CNPJ `99999999000199`, destino M;
- 0401010058 na lista da unidade;
- "sempre BPA-C" na medicação durante o cenário.

O CNES já era 9995028, e os perfis já tinham CNS e CBO desde o 46.

**Planilha de conferência (valores do sistema):**

| Linha | Catálogo (fictício) | Sistema | Onde conferiu | Confere? |
|---|---|---|---|---|
| Acolhimento 0301060118 | 10,00 | **nulo** (SIGTAP sem `valor_sa`) | `conta_detalhe.itens` | estrutura sim; valor nulo (P3-5 do A01) |
| Consulta 0301060096 | 20,00 | 11,00 | idem | sim |
| Medicação 0301100012 (1 checagem) | 5,00 | 1 × 0,63 = 0,63 | idem | sim |
| Sutura 0401010058 (lista) | 30,00 | 23,16 | idem | sim |
| Dipirona administrada | sem valor | sem campo de valor (dispensado 0, administrado 1, aviso "Administrado sem nada dispensado") | `conta_detalhe.medicamentos` | sim |
| Soma dos 4 itens antes de fechar | 65,00 | **34,79** = Σ `valor_total` | `C01.09.soma` | sim |
| Soma depois de fechar | igual | 34,79 (4 congelados) | `contas.itens_congelados` | sim |
| Versão 1 do ERP | 65,00 | `total` 34,79 = `total_referencia` 34,79 (nenhuma linha "fora") | `conta_versoes_erp` | sim |
| Linhas do paciente no BPA | 3 BPA-I + 1 BPA-C | 3 BPA-I + 1 BPA-C | `conta_detalhe.itens[].destino` | sim |
| Fechamento da competência (UPA inteira) | `linhas = 3`, `linhas_bpa_c = 1` | `linhas` 16, `linhas_bpa_c` 8, folhas 3, controle 2118, excluídas 0, avisos 4, SIGTAP 202609 | `bpa_fechamentos` | estrutura sim. O fechamento conta a **unidade inteira**, não o paciente. A conferência mostrou 17 linhas (9 BPA-C) antes da consolidação do BPA-C. |
| Valor no arquivo BPA | nenhum | nenhuma linha do paciente traz 2316 nem 0000001100 | `arquivo_bpa.conteudo` | sim |

**Passos (rodada válida).** "banco" = conferência como postgres.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| C01.00.cabecalho | f5_fat | Faturamento preenche o cabeçalho do BPA (valores fictícios de teste) | ok | (sem retorno: void) | ok |
| C01.00.lista_sutura | f5_fat | Faturamento põe 0401010058 (excisão e/ou sutura de ferimento, registro 02) na lista da UPA | ok | 866392ac-4639-40cb-96e4-f27bf5715462 | ok |
| C01.00.associacoes | banco | Códigos vigentes da UPA por fonte (classificação, consulta, medicação, lista) | ok | atendimento_medico 0301060096; classificacao 0301060118; lista 0401010058; medicacao 0301100012 | ok |
| C01.00.id_medicacao | banco | Associação vigente da medicação (a tela lista; o id vai para marcar "sempre BPA-C") | ok | 9f1d767a-3cb9-4235-b038-dfc28d51ebf6 | ok |
| C01.00.sempre_bpa_c | f5_fat | Faturamento marca a medicação 0301100012 como "sempre BPA-C" (só durante o cenário) | ok | (sem retorno: void) | ok |
| C01.00.cnes | banco | CNES da UPA já é 9995028 (definir_cnes_unidade não precisou) | ok | ok: CNES 9995028 | ok |
| C01.00.perfis | banco | Médico e enfermeiro da UPA com CNS válido e CBO (pré-condição 4) | ok | ok: 07 CBO 223505, 08 CBO 225125 | ok |
| C01.01.ficha | f5_rec_upa | Recepção cadastra Antônio (sexo, nascimento, raça/cor, CNS) e abre a ficha no PS | ok | ec7e401e-afc9-4685-9326-7c77c9a63b41 | ok |
| C01.01.paciente | banco | Paciente da ficha | ok | fa0720f2-8b1f-424b-87b0-2156787c55d4 | ok |
| C01.01.conta | f5_fat | A conta ambulatorial nasce com a ficha: aberta, nº A-AAAA.nnnnnn, pagador sus, sem itens e total 0 | ok | ceb34334-1831-4827-8719-509c61bf989d | ok |
| C01.01.conta_banco | banco | Conta ligada ao episódio, número e pagador | ok | ok: nº A-2026.000009, pagador sus, status aberta | ok |
| C01.01.recepcao_sem_contas | f5_rec_upa | Recepção não lê as contas (deve ser recusado) | erro:Acesso negado | recusado: Acesso negado: contas são do faturamento e do gestor da unidade. | ok |
| C01.02.chamar | f5_enf_upa | Enfermeiro chama para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| C01.02.classificar | f5_enf_upa | Classifica verde (escolha do enfermeiro de teste), sinais crus, fluxograma adulto "Alterações cutâneas", discriminador escrito pelo enfermeiro | ok | 34f48666-c272-4c5d-9d42-bde530da85df | ok |
| C01.02.cor | banco | A cor gravada é a do enfermeiro | ok | ok: cor verde, discriminador Ferimento cortante pequeno na mão, sangramento controlado | ok |
| C01.02.item_classificacao | f5_fat | Item "acolhimento com classificação" (0301060118) nasce na conta no momento da classificação | ok | ok: nº A-2026.000009, aberta, pagador sus; total_referencia 0; itens: classificacao 0301060118 qt 1 × nulo = nulo [bpa_i]; pendências 2 (bloqueantes 0) | ok |
| C01.03.iniciar | f5_med_upa | Plantonista assume o paciente | ok | (sem retorno: void) | ok |
| C01.03.atendimento_medico | banco | episodios.atendimento_medico_id preenchido com o login do médico | ok | ok: médico 08 | ok |
| C01.03.item_consulta | f5_fat | Item "consulta médica" (0301060096) nasce na conta quando o médico assume | ok | ok: nº A-2026.000009, aberta, pagador sus; total_referencia 11.00; itens: atendimento 0301060096 qt 1 × 11.00 = 11.00 [bpa_i]; classificacao 0301060118 qt 1 × nulo = nulo [bpa_i]; pendências 2 (bloqu… | ok |
| C01.04.peso | f5_med_upa | Médico registra o peso referido pelo paciente (valor cru) | ok | 1 sinais gravados | ok |
| C01.04.soap | f5_med_upa | SOAP com CID de ferimento da mão (S61.9) | ok | 4bede4cd-5d09-4d03-b73e-67c449ed7763 | ok |
| C01.05.prescrever | f5_med_upa | Dipirona sódica injetável, "Agora"; dose = texto de teste | ok | 29a63c93-83b0-4d6f-900a-6525496e0b4b | ok |
| C01.06.aprazar | f5_enf_upa | Enfermeiro apraza a dose "Agora" para o horário atual | ok | (sem retorno: void) | ok |
| C01.06.checar | f5_enf_upa | Checa "feito" no horário | ok | adc64754-f7ff-4065-bf02-b6df882aa65e | ok |
| C01.06.administracao | banco | administracoes.situacao = feito, autor = login do enfermeiro | ok | ok: situação feito, por 07 | ok |
| C01.06.item_medicacao | f5_fat | Item "administração de medicamentos" (0301100012) nasce na checagem, destino BPA-C | ok | ok: nº A-2026.000009, aberta, pagador sus; total_referencia 11.63; itens: atendimento 0301060096 qt 1 × 11.00 = 11.00 [bpa_i]; classificacao 0301060118 qt 1 × nulo = nulo [bpa_i]; medicacao 030110001… | ok |
| C01.07.fora_da_lista | f5_fat | Código fora da lista da unidade (0301100284, curativo simples) é recusado | erro:Procedimento fora da lista da unidade | recusado: Procedimento fora da lista da unidade. | ok |
| C01.07.sutura | f5_fat | Lança 0401010058 em nome do médico (quem fez), quantidade 1 | ok | 4d23f751-7e0a-4bdd-a7c8-c3b9b4796836 | ok |
| C01.07.registro | banco | procedimentos_realizados: via faturamento, profissional = médico, registrado_por = faturamento | ok | ok: via faturamento, profissional 08, registrado por 10, CBO 225125 | ok |
| C01.07.retiravel | f5_fat | Item da sutura com origem registro e retiravel = true | ok | ok: registro retirável | ok |
| C01.08.desfecho | f5_med_upa | Desfecho alta (CID do SOAP) | ok | (sem retorno: void) | ok |
| C01.08.encerrado | banco | Episódio encerrado com desfecho_em | ok | ok: etapa encerrado, desfecho alta | ok |
| C01.09.detalhe | f5_fat | Conta com os itens, o total de referência e as pendências | ok | nº A-2026.000009, aberta, pagador sus; total_referencia 34.79; itens: atendimento 0301060096 qt 1 × 11.00 = 11.00 [bpa_i]; classificacao 0301060118 qt 1 × nulo = nulo [bpa_i]; registro 0401010058 qt … | ok |
| C01.09.soma | f5_fat | total_referencia = Σ itens[].valor_total; 4 itens; medicamento fora da soma | ok | ok: itens 4, total 34.79 | ok |
| C01.09.total | banco | Total de referência antes de fechar (guardado para a conferência) | ok | 34.79 | ok |
| C01.09.pendencias | f5_fat | Painel de pendências por grupo | ok | paciente/endereco: Endereço incompleto (CEP, município IBGE, tipo de logradouro, endereço / paciente/nacionalidade: Nacionalidade ausente. / medicamento/medicamento: Dipirona sódica solução injetável… | ok |
| C01.09.medicamento_sem_valor | f5_fat | Dipirona aparece em medicamentos, sem campo de valor | ok | ok: [{"aviso": "Administrado sem nada dispensado pela farmácia.", "item_id": "29a63c93-83b0-4d6f-900a-6525496e0b4b", "liquido": 0, "fora_por": null, "devolvido": 0, "dispensado": 0, "prescricao": "co… | ok |
| C01.10.conferencia | f5_fat | aberta → em_conferencia | ok | em_conferencia | ok |
| C01.11.fechar | f5_fat | Faturamento fecha (caminho A: sem pendência bloqueante) | ok | fechada | ok |
| C01.11b.liberar | f5_ges_upa | Caminho B (liberação do gestor) | existir | não precisou: a conta fechou pelo caminho A | lacuna |
| C01.11.congelado | banco | itens_congelados com valor_unitario e valor_total; soma igual à de antes; congelada_em e pendências guardadas | ok | ok: congelados 4, soma 34.79 (antes 34.79) | ok |
| C01.11.auditoria | banco | log_auditoria conta_fechada e conta_eventos fechada | ok | ok: auditoria e evento | ok |
| C01.12.faturar | f5_fat | fechada → faturada | ok | faturada | ok |
| C01.12.erp_v1 | banco | conta_versoes_erp versão 1 vigente; total (só faturáveis) e total_referencia; evento erp_disponivel | ok | ok: versão 1, vigente, total 34.79, total_referencia 34.79, conciliação pendente | ok |
| C01.12.fat_nao_reabre | f5_fat | Faturamento não reabre conta faturada (deve ser recusado) | erro:Reabrir conta fechada é do gestor | recusado: Reabrir conta fechada é do gestor da unidade. | ok |
| C01.13.destinos | f5_fat | Destino de cada linha do paciente: classificação, consulta e sutura em BPA-I; medicação em BPA-C | ok | ok: atendimento → bpa_i; classificacao → bpa_i; registro → bpa_i; medicacao → bpa_c | ok |
| C01.13.conferencia | f5_fat | Conferência da competência: linha da medicação do paciente com o motivo "sempre BPA-C"; totais da UPA | ok | UPA: total 17, bpa_i 8, bpa_c 9, com crítica 0; por origem {"registro": 1, "medicacao": 3, "atendimento": 7, "classificacao": 6}; paciente: classificacao bpa_i; atendimento bpa_i; registro bpa_i; med… | ok |
| C01.14.fechar_competencia | f5_fat | Fecha a competência do mês (processamento = mês) | ok | dbfe4b4a-4bdb-46a3-9693-cd6fa6c66411 | ok |
| C01.14.fechamento | banco | bpa_fechamentos: linhas, linhas_bpa_c, folhas, controle, excluídas, avisos, SIGTAP | ok | linhas 16, linhas_bpa_c 8, folhas 3, controle 2118, excluídas 0, avisos 4, sigtap 202609, situação fechada | ok |
| C01.14.arquivo | f5_fat | Arquivo BPA_9995028_AAAAMM.txt: o CNS do paciente aparece; nenhuma coluna de valor | ok | ok: BPA_9995028_202611.txt, 3356 caracteres, 18 linhas; linhas do paciente: 03 (352 col.), 03 (352 col.), 03 (352 col.) | ok |
| C01.14.arquivo_sem_valor | banco | O leiaute do arquivo não tem campo de valor: a linha do paciente não traz 2316 (R$ 23,16 da sutura) nem 1100 (R$ 11,00) | ok | ok: sem valor nas linhas do paciente | ok |
| C01.14.auditoria | banco | log_auditoria bpa_competencia_fechada e bpa_arquivo_baixado | ok | ok: bpa_arquivo_baixado, bpa_competencia_fechada | ok |
| C01.15.trava | f5_fat | Lançar outro procedimento com a competência fechada (deve ser recusado) | erro:A competência | recusado: A competência 202611 já foi fechada pelo faturamento; peça a reabertura. | ok |
| C01.15.fechar_de_novo | f5_fat | Fechar de novo a mesma competência (deve ser recusado) | erro:Competência já fechada | recusado: Competência já fechada. Reabra com motivo para gerar de novo. | ok |
| C01.15.futura | f5_fat | Fechar competência futura (deve ser recusado) | erro | recusado: Não dá para fechar: Competência no futuro. | ok |
| C01.16.motivo_curto | f5_fat | Reabrir com motivo curto (deve ser recusado) | erro:Escreva o motivo | recusado: Escreva o motivo (mínimo de 10 letras). | ok |
| C01.16.reabrir | f5_fat | Reabre com motivo | ok | (sem retorno: void) | ok |
| C01.16.reaberta | banco | situação reaberta, motivo gravado, auditoria bpa_competencia_reaberta | ok | ok: situação reaberta, motivo: Teste C01: reabertura para conferir o refechamento | ok |
| C01.16.refechar | f5_fat | Fechar de novo gera outro fechamento | ok | b750fe91-1682-4771-8662-b7676bf91446 | ok |
| C01.16.dois_fechamentos | banco | Dois fechamentos da competência: o 1º reaberto, o 2º fechado | ok | ok: reaberta 16 linhas; fechada 16 linhas | ok |
| C01.16.reabrir_de_novo | f5_fat | Reabre de novo, para não travar os outros cenários da UPA no mês | ok | (sem retorno: void) | ok |
| C01.17.desmarca_bpa_c | f5_fat | Faturamento desmarca "sempre BPA-C" da medicação (volta ao que era) | ok | (sem retorno: void) | ok |
| C01.99.valor_medicamento | f5_fat | Valor de medicamento na conta | existir | Lacuna (MAPA): a Dipirona aparece só com quantidades (C01.09.medicamento_sem_valor). | lacuna |
| C01.99.tiss | f5_fat | TISS/TUSS e tabela de convênio | existir | Lacuna (MAPA): trocar_pagador_conta muda só o rótulo; o valor segue SIGTAP (não exercido aqui). | lacuna |

## C02 — Internação com AIH, pré-auditoria e glosa com recurso

**Paciente:** "Benedita C2 Pneumonia", CNS `700930000014075`, prontuário 2026.000009.
**Contas:**
- A (porta): `A-2026.000010`;
- I (internação): `I-2026.000002` (`ca94ea7a-…`).

**Resumo:**
- **Na porta:** ficha → classificação amarela (escolha do enfermeiro de teste) → SOAP J18.9 → desfecho internação no **INT-04**.
- **Conta I:** nasceu ligada à A. A I mostra `origem` = A, e a A mostra a I em `derivadas`.
- **Na Internação** (`medico.internacao.f5`): admissão, diagnóstico primário J18.9, conferência do laudo e laudo de AIH com 0303140151. A AIH nasceu `solicitada`, com o evento.
- **Pendência:** na conta I, "AIH ainda não aprovada pelo regulador." apareceu bloqueante e sumiu depois da aprovação.
- **NIR:** viu `aih_sem_decisao` e cobrou; não decide a AIH.
- **Regulador** (vínculo na UPA desde o 46): recusou 12 dígitos e a rejeição com motivo curto; aprovou com o número fictício `3526117000001` e a competência 202611; decidir de novo foi recusado.
- **Lançamento especial:** 0802010040 (diária de acompanhante de idoso, registro 04), quantidade 2, sem crítica.
- **Fechamento:**
  - fechar antes da alta foi recusado;
  - alta melhorada sem impeditivos;
  - a conta fechou sem bloqueante, com 2 itens congelados;
  - faturada, com `dados.conta_origem` = A-2026.000010.
- **Glosas:**
  - Glosa 1 (AIH, motivo `cid`): recurso com competência anterior recusado; recurso em 202612; valor recuperado maior que o glosado recusado; recuperada.
  - Glosa 2 (lançamento, motivo `quantidade`): repetir no mesmo item recusado; o faturamento não marca perdida; o gestor marca.
- A conta I seguiu `faturada`.

**Desvio do catálogo, de propósito:** o catálogo pede recuperação parcial (240 de 300). Digitar um valor recuperado seria inventar valor. O faturamento deixou o campo vazio, e o sistema assumiu o valor glosado (582,42). A recuperação parcial **não foi exercida**. A borda "valor maior que o glosado" foi provada.

**Planilha de conferência (valores do sistema):**

| Linha | Catálogo (fictício) | Sistema | Onde conferiu | Confere? |
|---|---|---|---|---|
| Conta I antes do lançamento | 300,00 | **582,42** = SH 504,07 + SP 78,35 de 0303140151 | `conta_detalhe` (1 item `aih`) | sim |
| Conta I depois do lançamento | 350,00 | **598,42** (+ 2 × 8,00 de 0802010040) | idem (2 itens) | sim |
| Conta A (porta) | só classificação + consulta | 11,00 (consulta 11,00 + acolhimento nulo); nenhum item `aih` ou `lancamento`; segue `aberta` | `conta_detalhe` da A | sim |
| Versão 1 do ERP da conta I | 350,00 | 598,42; `conta_origem` A-2026.000010 | `conta_versoes_erp` | sim |
| Glosa 1 (AIH, `cid`) | 300 / recuperado 240 | valor 582,42 = sugerido; recuperado **582,42** (campo vazio) | `conta_glosas` | estrutura sim; recuperação parcial não exercida |
| Glosa 2 (lançamento, `quantidade`) | 50 / perdida | valor 16,00 = sugerido; `perdida` | idem | sim |
| Painel, competência 202611: glosado / recuperado / perdido / em andamento | 350 / 240 / 50 / 0 | **598,42 / 582,42 / 16,00 / 0** | `glosas_da_unidade(UPA, NULL, 202611).totais` | sim |
| Por motivo | `cid` 300/240; `quantidade` 50/0 | `cid` 582,42/582,42; `quantidade` 16,00/0 | `por_motivo` | sim |
| Valor gravado na AIH | nenhum | `aihs` não tem coluna de valor | `information_schema` | sim |

**Passos (rodada válida).** "banco" = conferência como postgres.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| C02.00.regulador_na_upa | banco | regulador.f5 tem vínculo regulador na UPA (pré-condição 2, dada pelo 46) | ok | ok: vínculo regulador na UPA | ok |
| C02.00.criticas_aih | banco | Críticas da AIH da UPA: padrão do catálogo (nenhuma regra própria da unidade) | ok | regras próprias da UPA: 0 | ok |
| C02.01.ficha | f5_rec_upa | Recepção cadastra Benedita e abre a ficha no PS | ok | 7a5400db-796b-474d-8f08-4232ed243d91 | ok |
| C02.01.paciente | banco | Paciente da ficha | ok | 32f22f22-fd64-4e8a-a7e1-aa186a8d5e8c | ok |
| C02.01.conta_a | f5_fat | Conta ambulatorial A aberta com a ficha | ok | f3254179-3ab4-48dc-afd0-c58915bb7c86 | ok |
| C02.02.chamar | f5_enf_upa | Enfermeiro chama para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| C02.02.classificar | f5_enf_upa | Classifica amarelo (escolha do enfermeiro de teste), sinais crus, fluxograma "Queixas respiratórias", discriminador escrito pelo enfermeiro | ok | 334fa977-8b1c-49d7-b4d7-9fa1c44f837f | ok |
| C02.03.iniciar | f5_med_upa | Plantonista do PS assume | ok | (sem retorno: void) | ok |
| C02.03.peso | f5_med_upa | Peso referido pela paciente (valor cru) | ok | 1 sinais gravados | ok |
| C02.03.soap | f5_med_upa | SOAP com CID de pneumonia (J18.9) | ok | 338573ae-e5bf-4dac-9ad7-eefacc8605d4 | ok |
| C02.03.conta_a_itens | f5_fat | Conta A com classificação e consulta | ok | nº A-2026.000010, aberta, pagador sus; total_referencia 11.00; itens: atendimento 0301060096 qt 1 × 11.00 = 11.00 [bpa_i]; classificacao 0301060118 qt 1 × nulo = nulo [bpa_i]; pendências 2 (bloqueant… | ok |
| C02.04.leitos | f5_med_upa | leitos_para_ocupar da Internação: escolhe o último INT livre | ok | 110ed8fb-7630-4dbe-a53b-1b8ff41d5cbb | ok |
| C02.04.internar | f5_med_upa | Desfecho internação no leito INT escolhido | ok | (sem retorno: void) | ok |
| C02.04.internacao | banco | Internação criada (id do desfecho) | ok | 40e31dac-88b1-461a-90ae-f708fb04a175 | ok |
| C02.04.leito_banco | banco | Internação com internado_em, leito ocupado | ok | ok: leito INT-04 ocupado, internação internado | ok |
| C02.04.conta_i | f5_fat | Conta de internação I nasce ligada à conta A (origem) | ok | ca94ea7a-8ee3-40ff-89a7-054f3bb56981 | ok |
| C02.04.origem_derivadas | f5_fat | Conta I aponta a A (origem) e a A mostra a I em derivadas | ok | ok: I nº I-2026.000002 ← origem A-2026.000010; derivadas da A: [{"id": "ca94ea7a-8ee3-40ff-89a7-054f3bb56981", "numero": "I-2026.000002", "status": "aberta"}] | ok |
| C02.05.admissao | f5_med_int | Médico da Internação registra a admissão | ok | 9c42b7e3-3123-4e2e-a2f3-dd5eaa60d176 | ok |
| C02.05.diagnostico | f5_med_int | Diagnóstico primário confirmado J18.9 | ok | 3d53025d-e730-4a48-84f9-d70d1c0c027d | ok |
| C02.06.conferir | f5_med_int | Conferência do laudo: 0303140151 (tratamento de pneumonias) com J18.9 | ok | {"nota": "Críticas da AIH: as bloqueantes impedem emitir o laudo; os avisos vão para o regulador. O gestor define o que bloqueia. Fonte: SIGTAP (DATASUS) e CID-10 carregados no banco.", "avisos": [],… | ok |
| C02.06.laudo | f5_med_int | Emite o laudo de AIH com o procedimento principal 0303140151 | ok | 3e80f712-6f87-4de6-9327-cc32710d8cd0 | ok |
| C02.06.aih | banco | AIH nasce solicitada pelo gatilho do laudo; evento solicitada | ok | a24fb53e-d54e-4a6b-a828-742198b20480 | ok |
| C02.06.aih_sem_valor | banco | aihs não tem coluna de valor | ok | ok: sem coluna valor em aihs | ok |
| C02.07.item_aih | f5_fat | Item origem aih com valor = SH + SP do SIGTAP; pendência bloqueante "AIH ainda não aprovada" | ok | ok: nº I-2026.000002, aberta, pagador sus; total_referencia 582.42; itens: aih 0303140151 qt 1 × 582.42 = 582.42; pendências 2 (bloqueantes 1) / documento/aih (BLOQ): AIH ainda não aprovada pelo regu… | ok |
| C02.07.total_antes | banco | Total da conta I antes do lançamento (1 item) | ok | 582.42 | ok |
| C02.08.nir_ve | f5_nir | NIR vê a pendência aih_sem_decisao | ok | ok: {"agora": "2026-11-07T02:52:52.284412+00:00", "itens": [{"tipo": "aih_sem_aih", "desde": "2026-11-03T19:17:28.852351+00:00", "grupo": "aih", "ref_id": "1e6bb6f1-9ff9-445c-8322-f5afb8ade9cb", "tit… | ok |
| C02.08.nir_cobra | f5_nir | NIR cobra a AIH sem decisão | ok | 1 | ok |
| C02.08.nir_nao_decide | f5_nir | NIR tenta decidir a AIH (deve ser recusado) | erro | recusado: A decisão da AIH é do médico regulador da unidade. | ok |
| C02.09.lista | f5_regulador | A AIH está na lista da UPA para o regulador | ok | ok: na lista | ok |
| C02.09.doze_digitos | f5_regulador | Número com 12 dígitos (deve ser recusado) | erro:Número da AIH | recusado: Número da AIH: 13 dígitos. | ok |
| C02.09.rejeita_curto | f5_regulador | Rejeitar com motivo curto (deve ser recusado) | erro | recusado: Rejeitar exige motivo (mínimo de 10 letras). | ok |
| C02.09.aprovar | f5_regulador | Regulador aprova com número fictício de 13 dígitos e competência do mês | ok | (sem retorno: void) | ok |
| C02.09.aprovada | banco | AIH aprovada, número, competência, evento aprovada | ok | ok: status aprovada, número 3526117000001, competência 202611 | ok |
| C02.09.decidir_de_novo | f5_regulador | Decidir de novo (deve ser recusado) | erro:Só se decide AIH solicitada | recusado: Só se decide AIH solicitada (esta está aprovada). | ok |
| C02.09.pendencia_some | f5_fat | Aprovada, a pendência "AIH ainda não aprovada" some | ok | ok: sem pendência de AIH | ok |
| C02.10.lancar | f5_fat | Lança 0802010040 (diária de acompanhante de idoso, especial da AIH) quantidade 2, em nome do médico da internação | ok | 44aa0cb8-4989-46cd-be97-e2d6fe17b810 | ok |
| C02.10.item | f5_fat | Item lançamento: valor_total = 2 × (SH + SP), retirável, críticas do lançamento | ok | ok: qt 2 × 8.00 = 16.00, críticas [] | ok |
| C02.10.evento | banco | conta_eventos lancamento e conta_lancamentos com CBO do médico | ok | ok: lançamento 0802010040 qt 2, CBO 225125, lançado por 10 | ok |
| C02.10.total_depois | banco | Total da conta I depois do lançamento (2 itens) | ok | 598.42 | ok |
| C02.12.conferencia | f5_fat | aberta → em_conferencia | ok | em_conferencia | ok |
| C02.12.fechar_antes_alta | f5_fat | Fechar antes da alta (deve ser recusado) | erro:A internação ainda não teve alta | recusado: A internação ainda não teve alta: a conta fecha depois da alta. | ok |
| C02.11.impeditivos | f5_med_int | Impeditivos da alta | ok | [] | ok |
| C02.11.alta | f5_med_int | Alta melhorada com CID J18.9 | ok | (sem retorno: void) | ok |
| C02.12.fechar | f5_fat | Fechar a conta I (AIH aprovada, sem bloqueante) | ok | fechada | ok |
| C02.12.congelado | banco | itens_congelados com 2 itens e a mesma soma | ok | ok: congelados 2, soma 598.42 | ok |
| C02.12.faturar | f5_fat | fechada → faturada | ok | faturada | ok |
| C02.12.erp_v1 | banco | Versão 1 do ERP: total; dados.conta_origem = número da conta A | ok | ok: versão 1, total 598.42, conta_origem A-2026.000010, gerada 2026-11-07 02:52:52.284412+00, alterada 2026-11-07 02:52:52.284412+00 | ok |
| C02.12.conta_a_sem_aih | f5_fat | A conta A (porta) não traz a AIH: só classificação e consulta | ok | ok: nº A-2026.000010, aberta, pagador sus; total_referencia 11.00; itens: atendimento 0301060096 qt 1 × 11.00 = 11.00 [bpa_i]; classificacao 0301060118 qt 1 × nulo = nulo [bpa_i]; pendências 2 (bloqu… | ok |
| C02.13.glosaveis | f5_fat | Itens glosáveis da conta I com valor sugerido | ok | conta: Conta inteira = 598.42 (202611) / aih: AIH (principal) · 0303140151 · TRATAMENTO DE PNEUMONIAS OU INFLUENZA (GRIPE) = 582.42 (202611) / lancamento: Lançado (especial) · 0802010040 · DIARIA DE … | ok |
| C02.13.glosa_aih | f5_fat | Glosa 1 no item da AIH, motivo cid, competência do mês, valor sugerido aceito | ok | 9b8f4ffb-16ba-4f50-8b09-d3063169ad01 | ok |
| C02.13.g1_banco | banco | Glosa 1 aberta: valor = valor_sugerido = SH + SP; rótulo; evento registrada; auditoria | ok | ok: valor 582.42, sugerido 582.42, rótulo AIH (principal) · 0303140151 · TRATAMENTO DE PNEUMONIAS OU INFLUENZA (GRIPE), competência 202611 | ok |
| C02.13.erp_alterada | banco | Gatilho trg_erp_glosa: a versão do ERP marca alterada_em (no mesmo instante da transação) | ok | ok: gerada 2026-11-07 02:52:52.284412+00, alterada 2026-11-07 02:52:52.284412+00 | ok |
| C02.14.recurso_antes | f5_fat | Recurso com competência anterior à da produção (deve ser recusado) | erro:A competência do recurso não pode ser a… | recusado: A competência do recurso não pode ser anterior à da produção glosada. | ok |
| C02.14.recurso | f5_fat | Glosa 1 → em recurso, competência do recurso = mês seguinte | ok | em_recurso | ok |
| C02.15.recuperado_maior | f5_fat | Valor recuperado maior que o glosado (deve ser recusado) | erro:Valor recuperado entre zero | recusado: Valor recuperado entre zero e o valor glosado. | ok |
| C02.15.recuperada | f5_fat | Glosa 1 → recuperada, sem digitar valor (o sistema assume o valor glosado) | ok | recuperada | ok |
| C02.16.glosa_lanc | f5_fat | Glosa 2 no lançamento especial, motivo quantidade | ok | 8b7bd5fd-6a2c-49f8-9332-643741ea2717 | ok |
| C02.16.repetida | f5_fat | Registrar de novo no mesmo item (deve ser recusado) | erro:Já há glosa em andamento | recusado: Já há glosa em andamento para este item. | ok |
| C02.17.fat_nao_perde | f5_fat | Faturamento marca perdida (deve ser recusado) | erro:Só o gestor | recusado: Só o gestor marca a glosa como perdida. | ok |
| C02.17.perdida | f5_ges_upa | Gestor marca a glosa 2 como perdida | ok | perdida | ok |
| C02.18.painel_conta | f5_fat | Glosas da conta I no painel: glosado, recuperado, perdido, em andamento | ok | glosado 598.42, recuperado 582.42, perdido 16.00, em andamento 0; cid recuperada 582.42; quantidade perdida 16.00 | ok |
| C02.18.painel_unidade | f5_fat | Totais da UPA na competência do mês e por motivo | ok | totais {"glosado": 598.42, "perdido": 16.00, "quantidade": 2, "recuperado": 582.42, "em_andamento": 0}; por motivo [{"motivo": "cid", "glosado": 582.42, "quantidade": 1, "recuperado": 582.42}, {"moti… | ok |
| C02.18.conta_segue | banco | A conta I continua faturada (a glosa não muda a etapa) | ok | ok: status faturada | ok |
| C02.99.sisaih01 | f5_fat | Exportação da AIH (SISAIH01) | existir | Lacuna (MAPA): não existe; conferido aihs e a conta. | lacuna |
| C02.99.retorno_sih | f5_fat | Importação do retorno SIA/SIH | existir | Lacuna (MAPA): glosa à mão. | lacuna |
| C02.99.diaria_leito | f5_fat | Diária de leito, permanência com valor e honorário automáticos | existir | Lacuna (MAPA): nada nasce sozinho; a diária de acompanhante só entra lançada à mão pelo faturamento (passo 10). | lacuna |

## C03 — APAC com competências executadas

**Paciente:** "Cícero C3 Sessões", CNS `700930000021071`, prontuário 2026.000011.
**Conta:** `A-2026.000012`.
**APAC:** `2611300000001` (fictício), procedimento 0301130051 (acompanhamento multiprofissional em DRC estágio 04 pré-diálise), CID N18.0. É o único CID da lista do SIGTAP para esse código. CBO 225125 aceito, `qt_maxima` 1.

**Resumo:**
- **Solicitação:**
  - enfermeiro recusado ("A APAC é solicitada pelo médico");
  - tipo 2 sem anterior recusado;
  - CID fora do formato recusado;
  - o médico solicitou: crítica só de aviso (SIGTAP 09/2026), evento e auditoria `apac_solicitada`.
- **Na conta:** a APAC aparece em `documentos_sus` com o aviso "APAC ainda não autorizada.", não bloqueante, e sem item de valor.
- **NIR:** viu e cobrou.
- **Regulador:** recusou a validade invertida e a rejeição com motivo curto; autorizou com validade de 01/11/2026 a 31/01/2027; decidir de novo foi recusado.
- **Execuções:**
  - recusadas: competência fora da validade, procedimento sem registro 06/07, quantidade acima do máximo e quantidade 0;
  - gravadas: 202611 e 202612.
- **Competência:**
  - fechar o mês anterior foi recusado ("Nenhuma APAC sem crítica com execução");
  - 202611 fechou com 1 APAC e controle 1840;
  - arquivo `APAC_9995028_202611.txt` com o número da APAC e sem valor;
  - fechar de novo e lançar execução na competência fechada foram recusados;
  - reaberta.
- **Conta:** fechada e faturada sem item `apac`.
- **Glosa:** registrada na APAC com valor sugerido = `valor_sa` (122,00). A competência foi **202612**, a maior executada. Depois de cancelar a execução de 202612, a competência glosável voltou para 202611.

**Ajuste no meio do ensaio (regra do produto):** no primeiro ensaio, a APAC não fechou. A linha tinha crítica de endereço incompleto (logradouro, número, CEP, município IBGE) e de nacionalidade ausente. A ficha da recepção (`registrar_ficha`) só grava endereço, município e UF. O resto vem do "Endereço SUS" (`salvar_endereco_sus`, componente `EnderecoSus.tsx` da recepção). O script ganhou o passo `C03.01.endereco_sus`, com dados fictícios (CEP 01000000, IBGE 355030, logradouro 081, número 303, bairro "Bairro Teste", nacionalidade 010). Ver P3-C4.

**Planilha de conferência (valores do sistema):**

| Linha | Catálogo (fictício) | Sistema | Onde conferiu | Confere? |
|---|---|---|---|---|
| Conta A antes e depois das execuções | 30,00 | **11,00** (consulta 11,00 + acolhimento nulo), igual antes e depois | `conta_detalhe.total_referencia` | sim |
| APACs no fechamento de 202611 | 1 | 1 (controle 1840, excluídas 0) | `apac_fechamentos` | sim |
| Execuções válidas | 2 antes do passo 14; 1 depois | 2 → 1 (202612 cancelada) | `apac_execucoes` | sim |
| Valor sugerido da glosa da APAC | `valor_sa` | **122,00** (`valor_sa` de 0301130051); competência 202612 no registro, 202611 depois do cancelamento | `conta_glosas`, `glosaveis` | sim |
| Valor no arquivo APAC | nenhum | 12200 não aparece | `arquivo_apac.conteudo` | sim |
| Item `apac` em `itens_congelados` | nenhum | nenhum (atendimento 11,00 e classificação nulo); ERP v1 com total 11,00 | `contas.itens_congelados` | sim |

**Passos (rodada válida).** "banco" = conferência como postgres.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| C03.00.busca | f5_med_upa | Busca SIGTAP da APAC (registro 06) acha 0301130051 | ok | ok: [{"nome": "ACOMPANHAMENTO MULTIPROFISSIONAL EM DRC ESTÁGIO 04 PRÉ DIÁLISE", "codigo": "0301130051"}] | ok |
| C03.00.sigtap | banco | O procedimento no SIGTAP carregado: valor_sa, qt_maxima, CID aceito, CBO 225125 aceito | ok | valor_sa 122.00, qt_maxima 1, CIDs N18.0, CBO 225125 true | ok |
| C03.01.ficha | f5_rec_upa | Recepção cadastra Cícero e abre a ficha no PS | ok | 5f51ef98-208f-483c-bf06-c3b58a51f35c | ok |
| C03.01.paciente | banco | Paciente da ficha | ok | 47488edc-6266-465c-b723-78d8344e36c9 | ok |
| C03.01.endereco_sus | f5_rec_upa | Recepção completa o endereço SUS (CEP, município IBGE, tipo de logradouro, número, bairro, nacionalidade; dados fictícios de teste): a APAC exige | ok | (sem retorno: void) | ok |
| C03.01.conta | f5_fat | Conta A aberta | ok | ba416921-078e-4108-bcd9-01d1ae29eaa4 | ok |
| C03.01.chamar | f5_enf_upa | Enfermeiro chama para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| C03.01.classificar | f5_enf_upa | Classifica verde (escolha do enfermeiro de teste), sinais crus, fluxograma "Mal-estar geral", discriminador escrito pelo enfermeiro | ok | b09afe79-6c02-438e-aff7-1efd9a9b245f | ok |
| C03.01.iniciar | f5_med_upa | Plantonista assume | ok | (sem retorno: void) | ok |
| C03.01.soap | f5_med_upa | SOAP com o CID da lista do procedimento (N18.0) | ok | 9fdafc6e-9132-4ce7-8feb-d1bd4ac67a8c | ok |
| C03.02.enfermeiro_nao | f5_enf_upa | Enfermeiro (sem CRM) tenta solicitar (deve ser recusado) | erro | recusado: A APAC é solicitada pelo médico (CRM no cadastro). | ok |
| C03.02.tipo2_sem_anterior | f5_med_upa | Tipo 2 (continuidade) sem APAC anterior (deve ser recusado) | erro:APAC de continuidade | recusado: APAC de continuidade pede o número da APAC anterior (13 dígitos). | ok |
| C03.02.cid_invalido | f5_med_upa | CID fora do formato (deve ser recusado) | erro:CID principal | recusado: CID principal ausente ou fora do formato (ex.: C50.9). | ok |
| C03.02.solicitar | f5_med_upa | Médico pede APAC tipo 1, caráter 01, 0301130051, N18.0, ligada ao episódio | ok | d69eab84-7d51-49be-b96f-1718353a8928 | ok |
| C03.02.banco | banco | APAC solicitada, críticas sem bloqueante, SIGTAP da competência, evento e auditoria | ok | ok: status solicitada, sigtap 202609, críticas [{"campo": "28", "texto": "Tabela SIGTAP carregada é da competência 09/2026: atualize a tabela (administração).", "codigo": "sigtap_desatualizado", "blo… | ok |
| C03.02.sem_valor_apac | banco | Valor gravado na APAC | existir | Lacuna (MAPA): apacs e apac_execucoes não têm coluna de valor; a glosa é o único lugar em que a APAC vira reais (passo 13). | lacuna |
| C03.03.conta | f5_fat | APAC nos documentos SUS com aviso "APAC ainda não autorizada." não bloqueante; nenhum item apac | ok | ok: nº A-2026.000012, aberta, pagador sus; total_referencia 11.00; itens: atendimento 0301060096 qt 1 × 11.00 = 11.00 [bpa_i]; classificacao 0301060118 qt 1 × nulo = nulo [bpa_i]; pendências 1 (bloqu… | ok |
| C03.04.nir_ve | f5_nir | NIR vê a pendência apac_sem_decisao | ok | ok: na lista do NIR | ok |
| C03.04.nir_cobra | f5_nir | NIR cobra a APAC sem decisão | ok | 1 | ok |
| C03.05.fim_antes | f5_regulador | Validade com o fim antes do início (deve ser recusado) | erro:Validade | recusado: Validade: início e fim, com o fim depois do início. | ok |
| C03.05.rejeita_curto | f5_regulador | Rejeitar com motivo curto (deve ser recusado) | erro:Escreva o motivo da rejeição | recusado: Escreva o motivo da rejeição (mínimo de 10 letras). | ok |
| C03.05.autorizar | f5_regulador | Autoriza com número fictício de 13 dígitos e validade do mês até M+2 | ok | (sem retorno: void) | ok |
| C03.05.banco | banco | APAC autorizada com número, validade e evento | ok | ok: status autorizada, nº 2611300000001, validade 2026-11-01 a 2027-01-31 | ok |
| C03.05.decidir_de_novo | f5_regulador | Decidir de novo (deve ser recusado) | erro:Só APAC solicitada é decidida | recusado: Só APAC solicitada é decidida (está autorizada). | ok |
| C03.06.alta | f5_med_upa | Desfecho alta | ok | (sem retorno: void) | ok |
| C03.07.orgao_emissor | f5_fat | Faturamento define o órgão emissor da APAC (código fictício de teste) | ok | (sem retorno: void) | ok |
| C03.07.fora_validade | f5_fat | Execução em competência fora da validade (deve ser recusado) | erro:Competência fora da validade | recusado: Competência fora da validade da APAC (11/2026 a 01/2027). | ok |
| C03.07.sem_instrumento | f5_fat | Procedimento sem registro 06/07 (0301060096) na execução (deve ser recusado) | erro:O SIGTAP não registra | recusado: O SIGTAP não registra 0301060096 em APAC. | ok |
| C03.07.qt_maxima | f5_fat | Quantidade acima do qt_maxima do SIGTAP (deve ser recusado) | erro:Quantidade de | recusado: Quantidade de 0301130051 acima do máximo do SIGTAP. | ok |
| C03.07.sem_principal | f5_fat | Execução com quantidade 0 (deve ser recusado) | erro:Quantidade inválida | recusado: Quantidade inválida para 0301130051. | ok |
| C03.07.execucao_m | f5_fat | Execução da competência do mês: executante = médico, procedimento principal qt 1 | ok | baca63c3-91b4-4632-bc33-a13fab58eb42 | ok |
| C03.08.execucao_m1 | f5_fat | Execução da competência seguinte (dentro da validade; data de ocorrência no mês seguinte) | ok | 5e10a596-4775-469f-a40e-d2134096abaf | ok |
| C03.08.execucoes | banco | Duas execuções válidas, sem valor; eventos execucao_registrada | ok | ok: 202611 [{"quantidade": 1, "procedimento": "0301130051"}] (data 2026-11-06); 202612 [{"quantidade": 1, "procedimento": "0301130051"}] (data 2026-12-07); eventos 2 | ok |
| C03.09.conferencia | f5_fat | Conferência da competência do mês: linha da APAC e globais | ok | globais []; linha: {"numero": "2611300000001", "apac_id": "d69eab84-7d51-49be-b96f-1718353a8928", "criticas": [], "paciente": "Cícero C3 Sessões", "execucao_id": "baca63c3-91b4-4632-bc33-a13fab58eb42… | ok |
| C03.09.outra_rede | faturamento | Faturamento de outra rede lê a conferência da UPA F5 (deve ser recusado) | erro | recusado: BPA da unidade: faturamento ou gestor. | ok |
| C03.10.sem_execucao | f5_fat | Fechar competência sem execução (mês anterior) (deve ser recusado) | erro | recusado: Nenhuma APAC sem crítica com execução nesta competência. | ok |
| C03.10.fechar | f5_fat | Fecha a competência da APAC do mês | ok | 7eb2779a-e654-4409-b5bd-b2790a5bbc54 | ok |
| C03.10.fechamento | banco | apac_fechamentos: apacs, controle, excluídas, SIGTAP | ok | apacs 1, controle 1840, excluídas 0, sigtap 202609, situação fechada | ok |
| C03.10.arquivo | f5_fat | Arquivo APAC_9995028_AAAAMM.txt com o número da APAC; sem valor (12200 não aparece) | ok | ok: APAC_9995028_202611.txt, 816 caracteres, 5 linhas | ok |
| C03.10.auditoria | banco | log_auditoria apac_competencia_fechada e apac_arquivo_baixado | ok | ok: apac_arquivo_baixado, apac_competencia_fechada | ok |
| C03.10.fechar_de_novo | f5_fat | Fechar de novo (deve ser recusado) | erro:Competência da APAC já fechada | recusado: Competência da APAC já fechada. Reabra com motivo para gerar de novo. | ok |
| C03.10.execucao_fechada | f5_fat | Nova execução na competência fechada (deve ser recusado) | erro:A competência | recusado: A competência 202611 da APAC já foi fechada pelo faturamento; peça a reabertura. | ok |
| C03.11.reabrir | f5_fat | Reabre a competência com motivo | ok | (sem retorno: void) | ok |
| C03.11.banco | banco | situação reaberta e motivo | ok | ok: situação reaberta, motivo Teste C03: reabertura da competência da APAC | ok |
| C03.12.conferencia | f5_fat | aberta → em_conferencia | ok | em_conferencia | ok |
| C03.12.fechar | f5_fat | Fechar (o aviso da APAC não bloqueia) | ok | fechada | ok |
| C03.12.faturar | f5_fat | fechada → faturada | ok | faturada | ok |
| C03.12.congelado | banco | itens_congelados só com classificação e consulta; nenhuma origem apac; total igual ao de antes | ok | ok: congelados: atendimento 11.00, classificacao nulo; ERP v1 total 11.00 | ok |
| C03.13.glosaveis | f5_fat | Glosáveis: "APAC <nº> · código · nome" com valor = valor_sa e competência = maior executada (M+1) | ok | ok: APAC 2611300000001 · 0301130051 · ACOMPANHAMENTO MULTIPROFISSIONAL EM DRC ESTÁGIO 04 PRÉ DIÁLISE = 122.00 (202612) | ok |
| C03.13.glosa | f5_fat | Glosa na APAC, motivo documento, valor sugerido aceito | ok | 96e0ec18-0f3d-43dd-b8fe-4c039f3b4a35 | ok |
| C03.13.glosa_banco | banco | conta_glosas.valor_sugerido = valor_sa; competência da glosa | ok | ok: valor 122.00, sugerido 122.00, competência 202612, rótulo APAC 2611300000001 · 0301130051 · ACOMPANHAMENTO MULTIPROFISSIONAL EM DRC ESTÁGIO 04 PRÉ DIÁLISE | ok |
| C03.14.cancelar | f5_fat | Cancela a execução de M+1 com motivo | ok | (sem retorno: void) | ok |
| C03.14.banco | banco | cancelado_em, motivo, evento execucao_cancelada; 1 execução válida | ok | ok: cancelada em 2026-11-07 02:56:50.399763+00, motivo Execução lançada por engano (teste C03) | ok |
| C03.14.competencia_volta | f5_fat | A competência glosável da APAC volta ao mês | ok | ok: APAC 2611300000001 · 0301130051 · ACOMPANHAMENTO MULTIPROFISSIONAL EM DRC ESTÁGIO 04 PRÉ DIÁLISE (202611) | ok |
| C03.14.total_conta | f5_fat | O total da conta A não mudou com a APAC | ok | nº A-2026.000012, faturada, pagador sus; total_referencia 11.00; itens: atendimento 0301060096 qt 1 × 11.00 = 11.00 [bpa_i]; classificacao 0301060118 qt 1 × nulo = nulo [bpa_i]; pendências 0 (bloquea… | ok |
| C03.99.numero_repetido | f5_regulador | Borda "número de APAC repetido" | existir | Não exercida: pediria uma segunda APAC só para isso; a trava está em decidir_apac ("Este número de APAC já foi usado."). | lacuna |

## C04 — Farmácia: validação, alta vigilância, dispensação, estoque e conta sem valor

**Paciente:** "Dalva C4 Observação", CNS `700930000028076`, prontuário 2026.000013.
**Conta:** `A-2026.000014`.
**Itens:**
- Dipirona sódica injetável, ampola 2 mL, "Agora";
- Enoxaparina sódica, seringa 0,4 mL, "24/24h", alterada para "12/12h".

**Resumo:**
- **Pré-condições:** a enoxaparina é alta vigilância ("Antitrombóticos", exige) e a dipirona não. As unidades de consumo já estavam no cadastro.
- **Peso:** prescrever sem peso foi recusado.
- **Fila do farmacêutico:** os dois itens, a enoxaparina marcada `alta_vigilancia` (posições 2 e 6 na fila da UPA, junto com itens de outros cenários).
- **Validação:** o enfermeiro foi recusado; o farmacêutico validou a dipirona.
- **Enoxaparina sem liberação:**
  - checar sem motivo foi recusado;
  - com justificativa, a checagem passou com `sem_liberacao = true` e entrou na lista do farmacêutico;
  - o farmacêutico devolveu (o motivo curto foi recusado): 1 aviso ao prescritor, e a administração saiu da lista.
- **Item alterado:** o médico alterou a enoxaparina, e o item novo (2') entrou na fila sem validação. O farmacêutico validou (`liberado_pela_farmacia` = true). A checagem passou sem motivo, e a tela recebe "confere · Farmacêutico F5". `duplas_checagens` ficou vazia.
- **Estoque da dipirona:**
  - documento de 2 letras recusado;
  - entrada de 10 (NF-TESTE-C04-1);
  - dispensa de 2;
  - devolver 3 recusado; devolução de 1;
  - extrato com 3 linhas.
- **Retirada sem farmacêutico:** o enfermeiro sem justificativa foi recusado; com justificativa, a retirada passou, com saldo −1 e estoque negativo. O farmacêutico conferiu; conferir de novo foi recusado.
- **Bordas:**
  - avulsa pelo enfermeiro recusada; avulsa pelo farmacêutico ok (`saida_avulsa`);
  - ajuste com o saldo atual recusado ("nada a ajustar");
  - ajuste com motivo curto recusado.
- **Material:** "Gaze estéril 7,5 cm (teste C04)" criada; 1 pacote lançado e retirado; 3 pacotes lançados.
- **Medicamento fora da conta:** a enoxaparina saiu e voltou (eventos `medicamento_fora` e `medicamento_volta`).
- **Fechamento:** alta após medicação; a conta fechou com avisos de medicamento e de material, sem bloqueante, e foi faturada com medicamentos e materiais congelados.

**Planilha de conferência (valores do sistema):**

| Linha | Catálogo | Sistema | Onde conferiu | Confere? |
|---|---|---|---|---|
| Saldo da Dipirona depois dos passos 12 a 14 | 9 | 0 → 10 → 8 → **9**; depois da avulsa (borda), **8** | `movimentos_estoque`, `extrato_estoque`, `farmacia_estoque` | sim |
| Saldo da Enoxaparina depois do passo 16 | −1 | **−1** | resposta de `dispensar_item`, `dispensacoes_da_unidade.estoque_negativo` | sim |
| Movimentos da Dipirona | 3 | 3 (`entrada` +10 → 10, `saida_prescricao` −2 → 8, `devolucao` +1 → 9) + 1 avulsa da borda (−1 → 8) | `movimentos_estoque` | sim |
| Dipirona na conta | 2 / 1 / 1 / 1 | dispensado 2, devolvido 1, líquido 1, administrado 1 | `conta_detalhe.medicamentos` | sim |
| Enoxaparina na conta | dispensado 1 / líquido 1 / administrado 2 / sem farmacêutico | **duas linhas** (item alterado = item novo): item 2 com dispensado 0 e administrado 1 (aviso "Administrado sem nada dispensado"); item 2' com dispensado 1, líquido 1, administrado 1 e sem farmacêutico | idem | estrutura sim; o catálogo somava as duas linhas (P3-C5) |
| Campo de valor em medicamentos, materiais e ERP | não existe | não existe | `conta_detalhe.medicamentos[]`, `materiais[]`, `conta_versoes_erp.dados.medicamentos[]` | sim |
| `total_referencia` | 35,00 (3 itens) | **12,89** = 11,00 + acolhimento nulo + 3 × 0,63 (uma linha de medicação do enfermeiro no dia, qt 3) | `conta_detalhe` | sim |
| Administrações sem liberação para o farmacêutico | 1 → 0 | 1 depois do passo 6; 0 depois do passo 7 | `administracoes_sem_liberacao` | sim |

**Passos (rodada válida).** "banco" = conferência como postgres.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| C04.00.alta_vigilancia | f5_farm | A enoxaparina é alta vigilância ("exige") na UPA | ok | ok: [{"id": "053c61f1-90f3-40d5-85df-cde00d30c862", "exige": true, "regra": "Antitrombóticos", "ajuste": null, "cadastro": true, "apresentacao": "solução injetável, seringa 0,4 mL", "concentracao": "… | ok |
| C04.00.dipirona_comum | f5_farm | A dipirona injetável não é alta vigilância | ok | ok: dipirona sem exigência | ok |
| C04.00.unidade_consumo | banco | Unidade de consumo das duas já definida no cadastro (definir_unidade_consumo não precisou) | ok | ok: Dipirona sódica: ampola; Enoxaparina sódica: seringa_preenchida | ok |
| C04.00.saldos | banco | Saldos antes do cenário (podem ter movimento de outros cenários) | ok | dipirona 0, enoxaparina 0 | ok |
| C04.01.ficha | f5_rec_upa | Recepção cadastra Dalva e abre a ficha no PS | ok | 2d18171f-6b02-44a3-ac88-d596193499b0 | ok |
| C04.01.paciente | banco | Paciente da ficha | ok | c5f2193f-c252-46f2-abbc-730d792ebd11 | ok |
| C04.01.conta | f5_fat | Conta A aberta | ok | 65ea9f74-71ca-455b-8ddd-906d0cf7a625 | ok |
| C04.01.chamar | f5_enf_upa | Enfermeiro chama para a Triagem 1 | ok | {"aviso": false, "numero": 1} | ok |
| C04.01.classificar | f5_enf_upa | Classifica amarelo (escolha do enfermeiro de teste), sinais crus, fluxograma "Dor na coluna", discriminador escrito pelo enfermeiro | ok | 9a864da2-f867-470d-b631-b77f3fdb5b04 | ok |
| C04.01.iniciar | f5_med_upa | Plantonista assume | ok | (sem retorno: void) | ok |
| C04.02.sem_peso | f5_med_upa | Prescrever antes do peso (deve ser recusado) | erro:Falta para prescrever | recusado: Falta para prescrever: peso deste atendimento (aferido ou estimado). | ok |
| C04.01.peso | f5_med_upa | Peso referido pela paciente (valor cru) | ok | 1 sinais gravados | ok |
| C04.01.soap | f5_med_upa | SOAP com CID de dor lombar (M54.5) | ok | ec6eacfe-00c4-4311-b05e-a4772d2874fb | ok |
| C04.02.item1 | f5_med_upa | Item 1: Dipirona sódica injetável, "Agora"; dose = texto de teste | ok | 26e535f3-8394-4983-94e1-d6fe0c47fdec | ok |
| C04.02.item2 | f5_med_upa | Item 2: Enoxaparina sódica, "24/24h"; dose = texto de teste | ok | 0797d312-ba78-4783-8db4-dfc28a29fcea | ok |
| C04.02.selo | banco | O item 2 leva a regra de alta vigilância do cadastro (selo) | ok | regra de alta vigilância do medicamento: Antitrombóticos | ok |
| C04.03.fila | f5_farm | Fila de validação: os dois itens; o item 2 com alta_vigilancia = true | ok | ok: Enoxaparina sódica solução injetável, seringa 0,4 mL [alta vigilância true, posição 2]; Dipirona sódica solução injetável, ampola 2 mL [alta vigilância false, posição 6] | ok |
| C04.04.enf_nao_valida | f5_enf_upa | Enfermeiro tenta validar (deve ser recusado; não há técnico na UPA para esta borda) | erro:A validação é do farmacêutico | recusado: A validação é do farmacêutico da unidade. | ok |
| C04.04.validar1 | f5_farm | Farmacêutico valida o item 1 (confere) | ok | (sem retorno: void) | ok |
| C04.05.sem_motivo | f5_enf_upa | Checar o item 2 sem liberação e sem motivo (deve ser recusado) | erro:Alta vigilância sem liberação | recusado: Alta vigilância sem liberação da farmácia: escreva a justificativa (mínimo de 10 letras). O farmacêutico confere depois. | ok |
| C04.05.selo_tela | f5_enf_upa | liberacao_farmacia do item 2: sem liberação | ok | [{"em": null, "por": null, "regra": "Antitrombóticos", "motivo": null, "item_id": "0797d312-ba78-4783-8db4-dfc28a29fcea", "situacao": null}] | ok |
| C04.06.com_motivo | f5_enf_upa | Checa o item 2 "feito" com justificativa de 10+ letras | ok | a54aaa51-dfef-4aba-8833-b18ff0cc2d0a | ok |
| C04.06.marcada | banco | administracoes.sem_liberacao = true com o motivo | ok | ok: sem_liberacao true, motivo Dor intensa e farmácia sem resposta no momento (teste C04) | ok |
| C04.06.farm_ve | f5_farm | A administração aparece em administracoes_sem_liberacao para o farmacêutico | ok | ok: na lista | ok |
| C04.07.devolver_curto | f5_farm | Devolver com motivo curto (deve ser recusado) | erro | recusado: Devolver para correção exige motivo (mínimo de 10 letras). | ok |
| C04.07.devolver | f5_farm | Devolve o item 2 para correção com motivo | ok | (sem retorno: void) | ok |
| C04.07.banco | banco | validacoes_prescricao devolvido; aviso ao prescritor em notificacoes_plantonista | ok | ok: devolvido; avisos ao prescritor com o item: 1 | ok |
| C04.07.sai_da_lista | f5_farm | A administração do passo 6 sai de administracoes_sem_liberacao (há validação depois dela) | ok | ok: fora da lista | ok |
| C04.08.alterar | f5_med_upa | Médico altera o item 2 (frequência 12/12h): vira item 2' | ok | 991ec609-bdff-412b-a160-dce5e135fbc2 | ok |
| C04.08.fila | f5_farm | O item 2' aparece na fila sem validação | ok | ok: item novo na fila | ok |
| C04.09.validar2b | f5_farm | Farmacêutico valida o item 2' (confere = liberação da alta vigilância) | ok | (sem retorno: void) | ok |
| C04.09.liberado | banco | private.liberado_pela_farmacia(item 2') = true | ok | ok: liberado | ok |
| C04.10.checar | f5_enf_upa | Enfermeiro checa o item 2' "feito" sem motivo | ok | e7daf834-8155-4f5b-a25f-7229f7032fd7 | ok |
| C04.10.sem_liberacao_false | banco | sem_liberacao = false | ok | ok: sem_liberacao false | ok |
| C04.10.selo | f5_enf_upa | A tela mostra "Liberado pela farmácia" (liberacao_farmacia: confere e por) | ok | [{"em": "2026-11-07T03:00:20.171548+00:00", "por": "Farmacêutico F5", "regra": "Antitrombóticos", "motivo": null, "item_id": "991ec609-bdff-412b-a160-dce5e135fbc2", "situacao": "confere"}] | ok |
| C04.11.dupla_vazia | banco | duplas_checagens fica vazia para os itens do cenário | ok | ok: sem dupla checagem | ok |
| C04.11.dupla_checagem | f5_enf_upa | Dupla checagem com tela | existir | Lacuna (MAPA 2.7): conferir_alta_vigilancia, estado_dupla_checagem e duplas_pendentes sem tela; substituídas pela liberação da farmácia. | lacuna |
| C04.12.doc_curto | f5_farm | Entrada com documento de 2 letras (deve ser recusado) | erro:Informe o documento | recusado: Informe o documento da entrada (nota fiscal, requisição ou transferência). | ok |
| C04.12.entrada | f5_farm | Entrada de 10 ampolas de Dipirona com documento fictício | ok | 10 | ok |
| C04.12.movimento | banco | movimentos_estoque: entrada +10 com documento; auditoria entrada_estoque | ok | ok: entrada 10 → saldo 10, documento NF-TESTE-C04-1 | ok |
| C04.13.a_dispensar | f5_farm | itens_para_dispensar traz o item 1 com sugestão e saldo | ok | {"via": "ENDOVENOSA", "dose": "conforme protocolo — dado fictício de teste de fluxo", "setor": "Pronto Socorro", "item_id": "26e535f3-8394-4983-94e1-d6fe0c47fdec", "paciente": "Dalva C4 Observação", … | ok |
| C04.13.dispensar | f5_farm | Dispensa 2 ampolas do item 1 | ok | 20b26041-4db0-4156-a5f5-2a9b335a04c2 | ok |
| C04.13.banco | banco | dispensacoes: prescricao, qt 2, sem_farmaceutico false; movimento saida_prescricao −2 ligado; auditoria dispensar | ok | ok: tipo prescricao, qt 2, sugestão {"notas": ["Não deu para comparar a dose com a apresentação: conferir quantas unidades por vez."], "vezes": 1, "por_vez": 1, "explicacao": "dose única × 1 por vez"… | ok |
| C04.14.devolver_demais | f5_farm | Devolver 3 de 2 (deve ser recusado) | erro:Quantidade a devolver entre 1 e 2 | recusado: Quantidade a devolver entre 1 e 2 (o que ainda não voltou). | ok |
| C04.14.devolver | f5_farm | Recebe a devolução de 1 ampola com motivo | ok | {"resta": 1, "saldo": 9} | ok |
| C04.15.extrato | f5_farm | Extrato da Dipirona: entrada, saída por prescrição e devolução, com saldo depois | ok | devolucao 1 → 9 (Dalva C4 Observação); saida_prescricao -2 → 8 (Dalva C4 Observação); entrada 10 → 10 | ok |
| C04.15.movimentos | banco | movimentos_estoque da Dipirona neste cenário (só inserção) | ok | entrada 10 → 10; saida_prescricao -2 → 8; devolucao 1 → 9 | ok |
| C04.15.saldo | f5_farm | farmacia_estoque: saldo da Dipirona | ok | saldo 9 (antes do cenário 0) | ok |
| C04.16.sem_justificativa | f5_enf_upa | Enfermeiro retira sem justificativa (deve ser recusado) | erro:Retirada sem farmacêutico | recusado: Retirada sem farmacêutico: escreva a justificativa (mínimo de 10 letras). | ok |
| C04.16.retirar | f5_enf_upa | Enfermeiro retira 1 seringa do item 2' com justificativa | ok | {"id": "b7e382d4-3317-4da4-9577-cb3c94916b35", "saldo": -1, "estoque_negativo": true, "sem_farmaceutico": true} | ok |
| C04.16.disp2 | banco | Dispensação sem_farmaceutico = true; estoque_negativo na resposta | ok | b7e382d4-3317-4da4-9577-cb3c94916b35 | ok |
| C04.16.lista | f5_farm | dispensacoes_da_unidade: a conferir e estoque negativo da enoxaparina | ok | a_conferir 1; estoque_negativo [{"saldo": -2, "medicamento": "Sulfato de magnésio solução injetável, ampola 10 mL"}, {"saldo": -2, "medicamento": "Hidralazina solução injetável, ampola 1 mL"}, {"sald… | ok |
| C04.17.conferir | f5_farm | Farmacêutico confere a retirada sem farmacêutico | ok | (sem retorno: void) | ok |
| C04.17.de_novo | f5_farm | Conferir de novo (deve ser recusado) | erro:Já conferida | recusado: Já conferida. | ok |
| C04.17.banco | banco | conferida_em e conferida_por = farmacêutico | ok | ok: conferida por 14 | ok |
| C04.98.avulso_enf | f5_enf_upa | Dispensação avulsa pelo enfermeiro (deve ser recusado) | erro | recusado: Acesso negado: a dispensação avulsa é do farmacêutico. | ok |
| C04.98.avulso | f5_farm | Dispensação avulsa pelo farmacêutico (destino e motivo): saida_avulsa | ok | {"id": "d3ad383c-9d1e-434b-a225-2aeeaab21024", "saldo": 8, "estoque_negativo": false} | ok |
| C04.98.ajuste_igual | f5_farm | Ajuste de inventário com o saldo atual (deve ser recusado: nada a ajustar) | erro | recusado: O saldo contado é igual ao saldo atual: nada a ajustar. | ok |
| C04.98.ajuste_motivo | f5_farm | Ajuste com motivo curto (deve ser recusado) | erro | recusado: Escreva o motivo do ajuste (mínimo de 10 letras). | ok |
| C04.18.checar1 | f5_enf_upa | Enfermeiro checa o item 1 "feito" | ok | 5c8257b3-febf-4a99-abd9-c6a9114e5997 | ok |
| C04.19.material | f5_fat | Faturamento cadastra "Gaze estéril 7,5 cm (teste C04)", unidade de consumo pacote, sem SIGTAP | ok | 24d0cdbd-0577-4c2f-8ba0-078d40661a8d | ok |
| C04.20.lancar_errado | f5_fat | Lança 1 pacote por engano (para provar a retirada) | ok | {"id": "65ea9f74-71ca-455b-8ddd-906d0cf7a625", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T03:00:19.902897+00:00", "cbo": "225125", "cid": null, "nome": "ATENDIMENTO MEDICO EM UNIDADE DE PRO… | ok |
| C04.20.id_errado | banco | Lançamento a retirar | ok | 37f3e66c-cfc6-416a-a8fd-a7d00fa1f350 | ok |
| C04.20.retirar | f5_fat | Retira o lançamento com motivo | ok | {"id": "65ea9f74-71ca-455b-8ddd-906d0cf7a625", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T | ok |
| C04.20.lancar | f5_fat | Lança 3 pacotes, observação "curativo" | ok | {"id": "65ea9f74-71ca-455b-8ddd-906d0cf7a625", "tipo": "ambulatorial", "itens": [{"em": "2026-11-07T | ok |
| C04.20.eventos | banco | conta_eventos material_lancado (2) e material_retirado (1); retirado_em gravado | ok | ok: lançados 2, retirados 1 | ok |
| C04.21.medicamentos | f5_fat | Medicamentos da conta: dispensado, devolvido, líquido, administrado; nenhum campo de valor | ok | ok: Dipirona sódica solução injetá: disp 2, dev 1, líq 1, adm 1, sem_farm false / Enoxaparina sódica solução inj: disp 0, dev 0, líq 0, adm 1, sem_farm false, aviso: Administrado sem nada dispensado … | ok |
| C04.21.materiais | f5_fat | Materiais da conta: 3 pacotes ativos, sem valor | ok | ok: Gaze estéril 7,5 cm (teste C04) 1.00 pacote (retirado); Gaze estéril 7,5 cm (teste C04) 3.00 pacote | ok |
| C04.21.total | f5_fat | total_referencia só com os procedimentos (classificação, consulta, medicação) | ok | nº A-2026.000014, aberta, pagador sus; total_referencia 12.89; itens: atendimento 0301060096 qt 1 × 11.00 = 11.00 [bpa_i]; classificacao 0301060118 qt 1 × nulo = nulo [bpa_i]; medicacao 0301100012 qt… | ok |
| C04.22.fora | f5_fat | Marca a enoxaparina (item 2') fora da conta com motivo | ok | {"id": "65ea9f74-71ca-455b-8ddd-906d0cf7a625", "tipo": "ambulatorial", "itens": | ok |
| C04.22.volta | f5_fat | Traz a enoxaparina de volta com motivo | ok | {"id": "65ea9f74-71ca-455b-8ddd-906d0cf7a625", "tipo": "ambulatorial", "itens": | ok |
| C04.22.eventos | banco | Eventos medicamento_fora e medicamento_volta; voltou_em gravado | ok | ok: fora e volta | ok |
| C04.23.alta | f5_med_upa | Desfecho alta após medicação | ok | (sem retorno: void) | ok |
| C04.24.conferencia | f5_fat | aberta → em_conferencia | ok | em_conferencia | ok |
| C04.24.pendencias | f5_fat | Pendências: avisos de medicamento e de material sem SIGTAP, nenhum bloqueante | ok | paciente/endereco: Endereço incompleto (CEP, município IBGE, tipo de logradouro, endereço / paciente/nacionalidade: Nacionalidade ausente. / medicamento/medicamento: Enoxaparina sódica solução injetá… | ok |
| C04.24.fechar | f5_fat | Fecha (avisos não bloqueiam) | ok | fechada | ok |
| C04.24.faturar | f5_fat | fechada → faturada | ok | faturada | ok |
| C04.24.congelados | banco | medicamentos_congelados e materiais_congelados gravados; ERP com medicamentos sem valor | ok | ok: medicamentos congelados 3, materiais congelados 2; ERP v1 total 12.89, medicamentos no ERP [{"liquido": 1, "devolvido": 1, "dispensado": 2, "medicamento": "Dipirona sódica solução injetável, ampo… | ok |
| C04.99.lote_validade_preco | f5_farm | Lote, validade, preço e custo do medicamento; estoque de materiais e OPME | existir | Lacuna (MAPA): movimentos_estoque só com quantidade. | lacuna |
| C04.99.valor_conta | f5_fat | Valor de medicamento, material e exame na conta (CMED fora) | existir | Lacuna (MAPA): conferido que os campos de valor não existem (C04.21 e C04.24). | lacuna |
| C04.99.tecnico | f5_tec_upa | Técnico da UPA validando item | existir | Ambiente: há técnico da UPA desde o 46, mas está escalado na Observação Adulto; a borda foi provada com o enfermeiro (C04.04.enf_nao_valida). | lacuna |

## C05 — ERP: remuneração de plantões, versões da conta e reabertura pelo gestor

**Remuneração de plantão gravada (VALORES FICTÍCIOS, SÓ PARA TESTE)**, pelo gestor, na mesma tabela que a tela de configuração grava:

| Linha | Valor de teste |
|---|---|
| Pronto Socorro + manhã | 600 |
| todos os setores + noite | 1.200 |
| todos os setores + todos os turnos | 500 |

- O turno `madrugada` foi recusado pelo CHECK da tabela.
- A linha PS + manhã foi desativada na borda e cadastrada de novo. A tabela ficou com 3 linhas ativas e 1 inativa.

**Resumo:**
- **Prévia de M (202611):**
  - 126 plantões de plantonista (a escala da UPA só tem manhã, tarde e noite), 11 realizados, 115 sem presença, 4 sem checkout;
  - total **R$ 9.800,00**;
  - precedência conferida em todos os 126 (PS manhã 600, qualquer setor à noite 1.200, o resto 500);
  - `valor` = `valor_referencia` só nos realizados; Σ `valor` = total.
- **Recusas:** o faturamento não abre a prévia; fechar o mês corrente; fechar um mês sem plantão.
- **M-1 (202610):** o gestor escalou o `medico.upa.f5` no PS, manhã de 31/10 (acerto retroativo). O ERP só leva plantão de plantonista, ver P3-C6.
  - prévia: 1 plantão sem presença, referência 600, valor 0;
  - fechado (v1 vigente, total 0,00, conciliação pendente, auditoria);
  - reabrir com motivo curto recusado; reaberto (v1 substituída, por gestor); reabrir de novo recusado;
  - fechado outra vez (v2 vigente, total igual).
- **Download dos plantões:** o gestor baixou (2 versões, com o campo CPF, que veio **nulo**: P3-C7). O faturamento foi recusado, e o mês não fechado também.
- **Borda da remuneração:** desativar PS + manhã muda a prévia de M-1 para 500, e a versão vigente segue com 600.
- **Conta do C01:**
  - a lista do ERP mostrou a v1 vigente só com o prontuário;
  - o faturamento não reabre; o gestor reabriu (congelado nulo, liberação desfeita, v1 substituída, eventos e auditoria);
  - o faturamento retirou a sutura (evento `retirada`, procedimento cancelado);
  - conferência, fechamento e faturamento geraram a v2 vigente.
- **Retorno do ERP pela API:** lacuna de ambiente (sem chave `financeiro`).

**Planilha de conferência (valores do sistema; remuneração fictícia de teste):**

| Linha | Catálogo (fictício) | Sistema | Onde conferiu | Confere? |
|---|---|---|---|---|
| Prévia de M: `total` | Σ `valor` dos realizados | **9.800,00** = 500 + 500 + 1.200 + 1.200 + 600 + 500 + 500 + 1.200 + 1.200 + 1.200 + 1.200 (11 realizados: Internação e PS, 03/11 a 06/11, e Observação Adulto e Observação Pediátrica, na noite de 06/11) | `plantoes_erp_previa(UPA, 202611)` | sim |
| Prévia de M: realizados + sem presença + faltas | = plantões | 11 + 115 + 0 = 126 | `totais` | sim |
| Madrugada | cai no genérico | a escala não tem madrugada; `plantao_erp_valor(…, 'madrugada', …)` = 500 (genérico) | banco | sim |
| Fracionado | 6 h noite = 1.200 × 360/720 | 6 h noite = **600**; 12 h numa manhã = **1.200** (base 360); 6 h numa manhã = 600 | `private.plantao_erp_valor` | anotado para o RT (P3-C10) |
| Versão 1 de M-1 | Σ `valor`; 0 se só sem presença | **0,00** | `plantao_versoes_erp` | sim |
| Versão 2 de M-1 | igual à 1 | **0,00** | idem | sim |
| Conta do C01: versão 1 / versão 2 | 65,00 / 35,00 | **34,79 / 11,63** (−23,16 da sutura) | `conta_versoes_erp.total`, `dados.total_referencia` | sim |
| Conciliação depois do retorno | conciliada ou divergente | **pendente** (sem chave `financeiro`) | `conta_versoes_erp.conciliacao` | lacuna de ambiente |

**Passos (rodada válida).** "banco" = conferência como postgres.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| C05.01.ps_manha | f5_ges_upa | Gestor cadastra Pronto Socorro + manhã = 600 (FICTÍCIO, teste) | ok | 466285ca-56d0-49bb-8e02-c9fe557275ae | ok |
| C05.01.noite | f5_ges_upa | Gestor cadastra todos os setores + noite = 1.200 (FICTÍCIO, teste) | ok | 8d90fdb2-3750-447f-9792-46ab899c6cf2 | ok |
| C05.01.geral | f5_ges_upa | Gestor cadastra todos os setores + todos os turnos = 500 (FICTÍCIO, teste) | ok | a5f99bdd-5332-423c-a4d7-7e8ba3c27277 | ok |
| C05.01.madrugada | f5_ges_upa | Turno "madrugada" na remuneração (deve ser recusado pelo CHECK; a tela só oferece manhã, tarde e noite) | erro | recusado: new row for relation "remuneracoes_plantao" violates check constraint "remuneracoes_plantao_turno_check" | ok |
| C05.01.lista | f5_ges_upa | Linhas ativas da remuneração (como a tela lê) | ok | todos os setores + todos os turnos = 500; Pronto Socorro + manha = 600; todos os setores + noite = 1200 | ok |
| C05.01.criado_por | banco | criado_por das linhas novas (a tela manda nulo) | ok | nulo, nulo, nulo | ok |
| C05.02.previa_m | f5_ges_upa | Prévia do mês corrente: totais, total e mês ainda aberto | ok | plantões 126, realizados 11, sem_presenca 115, faltas_justificadas 0, realizados_sem_valor 0, sem_checkout 4; total 9800.00; mes_encerrado false; fechado false | ok |
| C05.02.precedencia | f5_ges_upa | valor_referencia por setor e turno (precedência setor+turno → setor → turno → geral) | ok | Internação manha → 500.00; Internação noite → 1200.00; Internação tarde → 500.00; Observação Adulto manha → 500.00; Observação Adulto noite → 1200.00; Observação Adulto tarde → 500.00; Observação Ped… | ok |
| C05.02.precedencia_confere | f5_ges_upa | PS manhã = 600; qualquer setor à noite = 1.200; PS tarde = 500 (geral) | ok | ok: 126 plantões conferidos | ok |
| C05.02.valor_por_situacao | f5_ges_upa | valor = valor_referencia só em realizado; 0 em sem_presenca e falta_justificada; Σ valor = total | ok | ok: sem_presenca: 115 plantões, Σ valor 0; realizado: 11 plantões, Σ valor 9800.00 | ok |
| C05.02.amostra | f5_ges_upa | Uma linha de plantão realizado (campos que vão ao ERP) | ok | {"data": "2026-11-03", "setor": {"id": "f5300000-0000-4000-8000-000000000013", "nome": "Internação"}, "turno": "tarde", "valor": 500.00, "inicio": "2026-11-03T16:00:00+00:00", "situacao": "realizado"… | ok |
| C05.02.turnos_da_escala | banco | Turnos da escala da UPA em M (há "madrugada"?) | ok | manha, noite, tarde | ok |
| C05.03.fat_nao_ve | f5_fat | Faturamento abre a prévia dos plantões (deve ser recusado) | erro:Acesso negado: os plantões para o ERP s… | recusado: Acesso negado: os plantões para o ERP são do gestor da unidade. | ok |
| C05.04.fechar_m | f5_ges_upa | Fechar o mês corrente (deve ser recusado) | erro:O mês só fecha depois de acabar | recusado: O mês só fecha depois de acabar. | ok |
| C05.05.sem_plantao | f5_ges_upa | Fechar um mês sem plantão na escala (deve ser recusado) | erro:Não há plantão na escala deste mês | recusado: Não há plantão na escala deste mês. | ok |
| C05.05.escalar | f5_ges_upa | Gestor escala o medico.upa.f5 no PS, manhã do último dia de M-1 (acerto retroativo; o ERP só leva plantão de plantonista) | ok | 035a5a36-c36c-4a0c-ac87-3de57910f745 | ok |
| C05.05.previa_m1 | f5_ges_upa | Prévia de M-1: o plantão escalado fica sem_presenca, valor 0 | ok | plantões 1, total 0.00, mes_encerrado true; linhas: manha sem_presenca ref 600.00 valor 0 | ok |
| C05.05.fechar_m1 | f5_ges_upa | Gestor fecha M-1: versão 1 vigente | ok | [{"total": 0.00, "versao": 1, "situacao": "vigente", "gerada_em": "2026-11-07T03:04:26.515453+00:00", "gerada_por": "Gestora UPA F5", "conciliacao": "pendente", "valor_lancado": null, "substituida_em… | ok |
| C05.05.v1_banco | banco | plantao_versoes_erp v1: vigente, total = Σ valor, conciliação pendente; auditoria plantoes_erp_fechados | ok | ok: versão 1, vigente, total 0.00, conciliação pendente | ok |
| C05.06.motivo_curto | f5_ges_upa | Reabrir com motivo curto (deve ser recusado) | erro:Diga por que o mês é reaberto | recusado: Diga por que o mês é reaberto (mínimo de 10 letras). | ok |
| C05.06.reabrir | f5_ges_upa | Gestor reabre M-1 com motivo | ok | [{"total": 0.00, "versao": 1, "situacao": "substituida", "gerada_em": "2026-11-07T03:04:26.515453+00:00", "gerada_por": "Gestora UPA F5", "conciliacao": "pendente", "valor_lancado": null, "substituid… | ok |
| C05.06.de_novo | f5_ges_upa | Reabrir mês não fechado (deve ser recusado) | erro:Os plantões deste mês não estão fechados | recusado: Os plantões deste mês não estão fechados. | ok |
| C05.06.v1_substituida | banco | v1 substituída, motivo e substituida_por = gestor; auditoria plantoes_erp_reabertos | ok | ok: versão 1 substituida, motivo Teste C05: plantão conferido de novo | ok |
| C05.07.fechar_de_novo | f5_ges_upa | Gestor fecha M-1 de novo: versão 2 vigente, a 1 segue como substituída | ok | [{"total": 0.00, "versao": 1, "situacao": "substituida", "gerada_em": "2026-11-07T03:04:26.515453+00:00", "gerada_por": "Gestora UPA F5", "conciliacao": "pendente", "valor_lancado": null, "substituid… | ok |
| C05.07.duas_versoes | banco | Duas versões de M-1; total da v2 igual ao da v1 | ok | ok: v1 substituida total 0.00; v2 vigente total 0.00 | ok |
| C05.08.baixar | f5_ges_upa | Gestor baixa os plantões de M-1: versões e CPF do profissional | ok | 2 versões; profissional da 1ª linha: {"id": "f5200000-0000-4000-8000-000000000008", "cbo": "225125", "cpf": null, "nome": "Médico UPA F5", "conselho": null, "registro": "950008", "registro_uf": "SP"} | ok |
| C05.08.auditoria | banco | log_auditoria erp_baixado da UPA (o payload passa pela lista de chaves permitidas de private.payload_auditoria) | ok | ok: {} | ok |
| C05.08.fat_nao_baixa | f5_fat | Faturamento baixa os plantões (deve ser recusado) | erro:Acesso negado: os plantões para o ERP s… | recusado: Acesso negado: os plantões para o ERP são do gestor da unidade. | ok |
| C05.08.nao_fechado | f5_ges_upa | Baixar mês não fechado (deve ser recusado) | erro:Os plantões deste mês ainda não foram f… | recusado: Os plantões deste mês ainda não foram fechados. | ok |
| C05.98.id_ps_manha | banco | Linha PS + manhã ativa (a tela lista; o id vai para "remover") | ok | 466285ca-56d0-49bb-8e02-c9fe557275ae | ok |
| C05.98.desativar | f5_ges_upa | Gestor remove (desativa) a linha PS + manhã | ok | false | ok |
| C05.98.previa_muda | f5_ges_upa | A prévia de M-1 passa a mostrar o valor geral (500) no plantão PS manhã; a versão fechada não muda | ok | ok: prévia 500.00, versão vigente 600.00 | ok |
| C05.98.recadastrar | f5_ges_upa | Gestor cadastra de novo PS + manhã = 600 (FICTÍCIO, teste), para a tabela voltar a ter as três linhas | ok | 8d7b4a55-6c3a-4632-8dae-20eb8935b023 | ok |
| C05.98.fracionado | banco | Fracionado (private.plantao_erp_valor): 6 h de noite (base 720) e 12 h numa manhã (base 360), para o RT decidir | ok | noite 360 min: 600.00; PS manhã 720 min: 1200.00; PS manhã 360 min: 600.00; madrugada (sem linha própria): 500.00 | ok |
| C05.09.lista_versoes | f5_fat | Lista das versões: conta do C01 v1 vigente, total, itens com competência, medicamentos sem valor, glosas [], conciliação pendente, só o prontuário do paciente | ok | ok: v1 vigente, total 34.79, total_referencia 34.79, competências 202611, prontuário 2026.000008, chaves id,tipo,itens,total,glosas,numero,versao,pagador,retorno,unidade,conta_id,situacao,gerada_em,f… | ok |
| C05.10.fat_nao_reabre | f5_fat | Faturamento reabre a conta faturada (deve ser recusado) | erro:Reabrir conta fechada é do gestor | recusado: Reabrir conta fechada é do gestor da unidade. | ok |
| C05.10.reabrir | f5_ges_upa | Gestor reabre a conta faturada do C01 com motivo | ok | aberta | ok |
| C05.10.banco | banco | itens_congelados nulo, liberação desfeita, v1 substituída; eventos reaberta e erp_substituida; auditoria conta_reaberta e conta_erp_substituida | ok | ok: status aberta; v1 substituida; auditoria: conta_erp_substituida, conta_reaberta | ok |
| C05.11.retirar | f5_fat | Faturamento retira o procedimento lançado (sutura) com motivo | ok | nº A-2026.000009, aberta, pagador sus; total_referencia 11.63; itens: atendimento 0301060096 qt 1 × 11.00 = 11.00 [bpa_i]; classificacao 0301060118 qt 1 × nulo = nulo [bpa_i]; medicacao 0301100012 qt… | ok |
| C05.11.evento | banco | conta_eventos retirada; procedimento cancelado | ok | ok: retirada e cancelado | ok |
| C05.12.conferencia | f5_fat | aberta → em_conferencia | ok | em_conferencia | ok |
| C05.12.fechar | f5_fat | Fechar | ok | fechada | ok |
| C05.12.faturar | f5_fat | Faturar de novo | ok | faturada | ok |
| C05.12.v2 | banco | v2 vigente com o total novo; v1 substituída; evento erp_disponivel "Versão 2" | ok | ok: v1 substituida total 34.79 (ref 34.79); v2 vigente total 11.63 (ref 11.63) | ok |
| C05.13.chave_financeiro | banco | Chave da API com o recurso financeiro, ativa, na homologação | ok | chaves ativas com financeiro: 0 | ok |
| C05.13.retorno_api | ERP | POST /financeiro/contas/{conta}/versoes/2/retorno (lancada → conciliada) | existir | Lacuna de ambiente: não há chave ativa com o recurso financeiro na homologação (a única, "ERP teste ponta a ponta", foi revogada em 27/10/2026); por instrução, nenhuma chave foi criada. A versão 2 fi… | lacuna |

## C06 — Leitura dos números pela API e pelo arquivo do ERP

Só leitura: nenhum paciente novo.

**Resumo:**
- **Arquivo JSON do faturamento** (7 versões da UPA em 13 meses): tem as versões do bloco C com `total`, `total_referencia`, itens (`valor_unitario`, `valor_total`, `faturavel`, `competencia`), medicamentos sem valor, glosas e conciliação.
- **Dado do paciente** (5 versões do bloco C): só o `prontuario`. Nenhum nome, CPF, CNS ou CID, e nenhuma chave `cid`, `cpf` ou `cns` em todo o JSON.
- **Tela × arquivo:**
  - nas 4 contas vigentes: `total_referencia` da tela = do arquivo = Σ itens, e `total` = Σ faturáveis;
  - glosas da conta I: tela = arquivo, com o estado atual;
  - plantões de M-1: arquivo = versões da tela.
- **Fechamentos de BPA:** `bpa_fechamentos_da_unidade` mostra os dois fechamentos do C01, reabertos.
- **`/rede`:** o `faturamento.rede.f5` (desde o 46) leu `rede_faturamento` da Secretaria F5. A AIH aprovada do hospital aparece. O BPA da UPA aparece nulo, porque a competência foi reaberta.
- **API `/financeiro/*`**, chamadas fora do SQL, na homologação (`…/functions/v1/api/v1`):
  - sem `Authorization`: **401** "Mande a chave no cabeçalho Authorization: Bearer <chave>." (contas e plantões);
  - Bearer fora do formato: **401**, com a mesma mensagem (P3-C11);
  - chave **bem formada e inexistente**, criada só para o teste e sem ser chave de verdade: **401** "A chave não existe.", gravado em `api_acessos` (`financeiro_contas`, 401, `chave_id` nulo; requisição `fde6e444-…`).
- **API, o que não foi exercido:**
  - **sem chave ativa com o recurso `financeiro` na homologação.** A única ("ERP teste ponta a ponta") foi revogada em 27/10/2026, e nenhuma foi criada, por instrução. Por isso listas, `desde`, conta, plantões e retornos viraram lacuna de ambiente;
  - **403 com chave de outro recurso:** a chave de teste do Power BI, em `scripts/powerbi/.chave-homolog`, não foi usada. A permissão desta sessão barrou o uso do arquivo. Pelo código, `api_v1_financeiro` devolve 403 "A chave não libera o recurso financeiro.".

**Planilha de conferência (as fontes têm de ser iguais):**

| Objeto | Tela | Arquivo (`erp_baixar`) | API | Catálogo (fictício) |
|---|---|---|---|---|
| Conta do C01, v2, `total` | 11,63 | 11,63 | lacuna | 35,00 |
| Conta do C01, v2, Σ `itens[].valor_total` | 11,63 | 11,63 (= `total_referencia`; nenhum item "fora") | lacuna | 35,00 |
| Conta do C01, v1 | substituída, 34,79 | substituída, 34,79 | lacuna | 65,00 |
| Conta I do C02, `total` | 598,42 | 598,42 | lacuna | 350,00 |
| Conta I, glosa 1: `valor` / `valor_recuperado` | 582,42 / 582,42 (recuperada) | idem | lacuna | 300 / 240 |
| Conta I, glosa 2: situação | perdida (16,00) | perdida (16,00) | lacuna | perdida |
| Conta do C03, `total` | 11,00, nenhum item `apac` | 11,00, nenhum item `apac`; glosa da APAC (122,00, aberta) em `glosas[]` | lacuna | 30,00 |
| Medicamentos da conta do C04 | quantidades | `medicamentos[]` sem valor | lacuna | sem campo de valor |
| Plantões de M-1, v2, `total` | `versoes[1].total` 0,00 | 0,00 (v1 substituída e v2 vigente, 1 linha cada) | lacuna | Σ dos realizados |
| Dado do paciente | nome na tela | só `prontuario` | lacuna | só `prontuario` |
| Totais de glosas da UPA (todas as competências) | glosado 720,42; recuperado 582,42; perdido 16,00; em andamento 122,00 | — | — | — |

**Passos (rodada válida).** "banco" = conferência como postgres.

| Passo | Papel | O que faz | Esperado | Obtido | Situação |
|---|---|---|---|---|---|
| C06.01.baixar_json | f5_fat | Faturamento baixa as versões das contas (13 meses) | ok | 7 versões no arquivo | ok |
| C06.01.c01 | f5_fat | Conta do C01: v1 substituída e v2 vigente | ok | ok: A-2026.000009 v1 substituida: total 34.79, total_referencia 34.79, Σ itens 34.79, Σ faturáveis 34.79, itens 4, medicamentos 1, glosas 0, conciliação pendente / A-2026.000009 v2 vigente: total 11.… | ok |
| C06.01.c02 | f5_fat | Conta I do C02: v1 com 2 itens e 2 glosas (valor, recuperado, situação) | ok | ok: I-2026.000002 v1 vigente: total 598.42, total_referencia 598.42, Σ itens 598.42, Σ faturáveis 598.42, itens 2, medicamentos 0, glosas 2, conciliação pendente; conta_origem A-2026.000010; glosas [… | ok |
| C06.01.c03 | f5_fat | Conta A do C03: nenhum item apac; a glosa da APAC aparece em glosas[] | ok | ok: A-2026.000012 v1 vigente: total 11.00, total_referencia 11.00, Σ itens 11.00, Σ faturáveis 11.00, itens 2, medicamentos 0, glosas 1, conciliação pendente; glosas [{"id": "96e0ec18-0f3d-43dd-b8fe-… | ok |
| C06.01.c04 | f5_fat | Conta A do C04: medicamentos[] só com quantidades, sem campo de valor | ok | ok: A-2026.000014 v1 vigente: total 12.89, total_referencia 12.89, Σ itens 12.89, Σ faturáveis 12.89, itens 3, medicamentos 3, glosas 0, conciliação pendente; medicamentos Dipirona sódica solu disp 2… | ok |
| C06.02.paciente | f5_fat | Dado do paciente nas versões do bloco C: só prontuário; nenhum nome, CPF, CNS ou CID | ok | ok: 5 versões conferidas; prontuários 2026.000008, 2026.000009, 2026.000011, 2026.000013 | ok |
| C06.02.auditoria | banco | log_auditoria erp_baixado da UPA nesta leitura (payload filtrado pela lista de chaves permitidas) | ok | registros 6, payload {} | ok |
| C06.03.chave | banco | Chave ativa com o recurso financeiro na homologação | ok | chaves ativas com financeiro: 0 | ok |
| C06.03.api_contas | ERP | GET /financeiro/contas?unidade_id=<UPA> (lista paginada igual ao JSON) | existir | Lacuna de ambiente: sem chave ativa com o recurso financeiro; nenhuma foi criada (instrução da rodada). | lacuna |
| C06.04.api_desde | ERP | GET /financeiro/contas?desde=<alterada_em da conta I> | existir | Lacuna de ambiente: sem chave com o recurso financeiro. | lacuna |
| C06.05.api_conta | ERP | GET /financeiro/contas/{conta do C01} (v1 substituída, v2 vigente) | existir | Lacuna de ambiente: sem chave com o recurso financeiro; o arquivo (C06.01.c01) mostra as duas versões. | lacuna |
| C06.06.api_plantoes | ERP | GET /financeiro/plantoes?competencia=M-1 | existir | Lacuna de ambiente: sem chave com o recurso financeiro; o arquivo (C06.09) mostra as versões. | lacuna |
| C06.07.api_plantoes_retorno | ERP | POST /financeiro/plantoes/{versao}/retorno (lancada → conciliada) | existir | Lacuna de ambiente: sem chave com o recurso financeiro; a v2 de M-1 fica pendente. | lacuna |
| C06.08.api_403 | ERP | Chave de outro recurso em /financeiro/contas → 403 | existir | Não exercido: a chave de teste do Power BI (atendimentos, leitos, producao) está em scripts/powerbi/.chave-homolog, e o uso dela foi barrado pela permissão desta sessão. O código (api_v1_financeiro) … | lacuna |
| C06.08.api_401 | banco | GET /financeiro/contas com chave bem formada e inexistente: 401 gravado em api_acessos (chave_id nulo, recurso financeiro_contas) | ok | ok: acessos 401 sem chave conhecida na última hora: 1, última requisição fde6e444-74c4-412e-b704-a31f42074261 | ok |
| C06.09.plantoes | f5_ges_upa | Arquivo dos plantões de M-1 = versões da tela (mesmos total e linhas; CPF do profissional no arquivo) | ok | ok: arquivo v1 substituida total 0.00 linhas 1 cpf presente: true; v2 vigente total 0.00 linhas 1 cpf presente: true | ok |
| C06.10.contas | f5_fat | Para cada conta: total_referencia da tela = do arquivo = Σ itens; total = Σ faturáveis | ok | ok: A-2026.000009: tela 11.63 / arquivo 11.63 / total 11.63; A-2026.000012: tela 11.00 / arquivo 11.00 / total 11.00; A-2026.000014: tela 12.89 / arquivo 12.89 / total 12.89; I-2026.000002: tela 598.… | ok |
| C06.10.glosas | f5_fat | Glosas da conta I: tela (glosas_da_unidade) = arquivo (glosas[] da versão), estado atual | ok | ok: tela recuperada 582.42 rec 582.42, perdida 16.00 rec - / arquivo {"id": "8b7bd5fd-6a2c-49f8-9332-643741ea2717", "item": "Lançado (especial) · 0802010040 · DIARIA DE ACOMPANHANTE DE IDOSOS C/ PERN… | ok |
| C06.10.totais_glosas | f5_fat | Totais de glosas da UPA (todas as competências) | ok | {"glosado": 720.42, "perdido": 16.00, "quantidade": 3, "recuperado": 582.42, "em_andamento": 122.00}; por competência [{"glosado": 122.00, "perdido": 0, "quantidade": 1, "recuperado": 0, "competencia… | ok |
| C06.11.bpa_unidade | f5_fat | Fechamentos de BPA da UPA (os dois do C01, reabertos) | ok | [{"id": "dbfe4b4a-4bdb-46a3-9693-cd6fa6c66411", "folhas": 3, "linhas": 16, "controle": 2118, "situacao": "reaberta", "excluidas": 0, "fechado_em": "2026-11-07T02:49:35.332539+00:00", "competencia": "… | ok |
| C06.11.rede | f5_fat_rede | faturamento.rede.f5 lê o faturamento da rede na competência (Secretaria F5) | ok | [{"aih": {"aprovada": 1}, "bpa": null, "apac": null, "unidade": {"id": "f5100000-0000-4000-8000-000000000003", "cnes": "9995036", "nome": "Hospital Fase 5"}, "apacs_status": {}}, {"aih": {}, "bpa": n… | ok |
| C06.99.powerbi | ERP | Modelo do Power BI com o financeiro | existir | Escopo (PR #479, decisão B2): o modelo não lê /financeiro; conferido pelo arquivo do ERP. | lacuna |
| C06.99.webhook | ERP | Webhook de conta, glosa ou ERP; SISAIH01; retorno SIA/SIH | existir | Lacuna (MAPA): o ERP busca pela API. | lacuna |

## Achados

Nenhum P0 e nenhum P1. Cada achado diz se é **produto**, **ambiente** (rede F5) ou **catálogo** (especificação ou MAPA).

### P2-C1 — Remuneração de plantão sem autor e sem auditoria (produto)
- **Reproduzir:** como gestor, cadastrar uma linha em `/unidade?aba=configuracoes` → "Remuneração de plantão". A tela faz `insert` direto em `remuneracoes_plantao` com `criado_por: null`. Depois, remover a linha (`update … set ativo = false`).
- **Obtido:**
  - `criado_por` ficou **nulo** nas 4 linhas gravadas (`C05.01.criado_por`: "nulo, nulo, nulo"; a 4ª, de `C05.98.recadastrar`, também);
  - a tabela não tem gatilho (`pg_trigger`: nenhum), e `log_auditoria` não tem nenhum registro de `remuneracoes_plantao`;
  - quem criou, mudou ou desativou o valor que vai ao ERP de pagamento não fica registrado. Isso fere a regra "o autor é o login".
- **Atenuante:** a versão fechada do mês guarda o valor usado (`plantao_versoes_erp.dados`). Por isso a mudança depois do fechamento não altera o que foi ao ERP (`C05.98.previa_muda`).
- **Sugestão (para o RT decidir):** preencher `criado_por` com o login no servidor (padrão ou gatilho) e auditar inclusão e desativação.

### P2-C2 — Execução de APAC aceita competência e data de ocorrência no futuro (produto)
- **Reproduzir:** `registrar_execucao_apac(apac, '202612', '01', '21', '2026-12-07', médico, …)` em 07/11/2026.
- **Obtido:**
  - aceito (`C03.08.execucao_m1`). A RPC só confere se a competência está dentro da validade da APAC e se não está fechada; não confere se o mês já começou nem se a data está no futuro;
  - a glosa registrada depois herdou a competência **202612** (`C03.13.glosa_banco`), uma produção que ainda não existe.
- **Efeito:** o faturamento pode registrar produção de APAC antes de ela acontecer.
- **Sugestão:** recusar competência maior que a atual e `data_ocorrencia` no futuro, como `registrar_procedimento` já faz com a data.

### P3-C3 — Auditoria das exportações sem o que foi exportado (produto)
- **Obtido:** o `payload` de `log_auditoria` sai `{}` em `erp_baixado`, `bpa_competencia_fechada`, `conta_fechada`, `glosa_registrada` e outros (`C05.08.auditoria`, `C06.02.auditoria`).
- **Causa:** `private.payload_auditoria` só deixa passar uma lista de chaves (LGPD), e `conjunto`, `competencia`, `versoes` e `formato` não estão nela.
- **Efeito:** fica registrado quem baixou e quando, mas não **qual mês** dos plantões, que trazem CPF.
- **Observação:** essas chaves não são dado de pessoa.

### P3-C4 — APAC só fecha com o endereço SUS completo, e a ficha da recepção não o grava (catálogo)
- **Obtido:** no ensaio, `fechar_competencia_apac` recusou ("Nenhuma APAC sem crítica…"). A linha tinha crítica de endereço (logradouro, número, CEP, município IBGE) e de nacionalidade.
- **Por quê:** `registrar_ficha` grava só endereço, município e UF. Os campos do SUS vêm de `salvar_endereco_sus` ("Endereço SUS" na recepção). No BPA os mesmos campos são **aviso**; na APAC, **crítica**.
- **Ajustar no catálogo:** pôr o "Endereço SUS" como pré-condição do C03 e do cadastro da recepção.

### P3-C5 — Catálogo do C04: item alterado aparece em duas linhas na conta (catálogo)
- **Obtido:** a enoxaparina aparece em duas linhas, a do item 2 (administrado 1, nada dispensado, com aviso) e a do item 2' (dispensado 1, administrado 1).
- **Por quê:** `conta_medicamentos` agrupa por item de prescrição, e o item alterado é item novo.
- **Ajustar no catálogo:** o esperado "administrado 2 numa linha" vira duas linhas.

### P3-C6 — Catálogo do C05: o ERP de plantões só leva plantonista (catálogo)
- **Obtido:** `private.plantoes_erp_linhas` filtra `papel = 'plantonista'` (decisão E2 do RT, 28/10/2026). No ensaio, o plantão de M-1 da enfermeira não entrou ("Não há plantão na escala deste mês."). O script passou a escalar o médico.
- **Efeito:** a prévia de M tem 126 plantões, só de médicos.
- **Ajustar no catálogo:** passo 2 ("uma linha por plantão da escala") e passo 5 (o plantão de M-1 é de plantonista).

### P3-C7 — Perfis F5 sem CPF nem conselho (ambiente)
- As linhas de plantão saem com `cpf` e `conselho` nulos. O registro e a UF vêm do CRM; o CBO está preenchido.
- A pré-condição 3 do C05 avisa. Não bloqueia, mas o ERP real recusaria pagar sem CPF.

### P3-C8 — MAPA: "diária não existe" é parcial (catálogo)
- As diárias do SIGTAP (grupo 08.02, registro 04) entram na conta de internação como **lançamento especial à mão** pelo faturamento. O C02 lançou 0802010040 (diária de acompanhante de idoso), 2 × R$ 8,00.
- O que não existe é a diária **automática** pelo tempo de leito.

### P3-C9 — Glosa: recuperação parcial não exercida (decisão do teste)
- O valor recuperado é digitado pelo faturamento a partir do retorno do SUS. Para não inventar valor, o campo ficou vazio, e o sistema assumiu o glosado.
- A borda "maior que o glosado" foi provada. A recuperação parcial fica para a tela, com um retorno fictício definido pelo RT.

### P3-C10 — Fracionado de 12 h num turno de manhã vale o dobro (pergunta para o RT)
- **Obtido:** `plantao_erp_valor(UPA, PS, 'manha', 720, true)` = **1.200** com a tabela de 600, porque a base é 360 min fora da noite. 6 h de noite = 600 (base 720).
- É o item 5 do README. Fica anotado para o RT dizer se é o esperado.

### P3-C11 — API: chave fora do formato recebe "Mande a chave no cabeçalho" (produto)
- **Obtido:** com `Authorization: Bearer <texto fora do formato cc_(live|test)_+48 hex>`, a resposta é a mesma da falta de cabeçalho. A mensagem engana quem mandou uma chave copiada errado.
- A chave bem formada e inexistente recebe "A chave não existe.", como deve.

### Continuam valendo (do A01)
- **P3-5:** `0301060118` com `valor_sa` nulo. O item de acolhimento sai com valor **nulo** (não R$ 0,00) nas 4 contas de porta. A soma o ignora.
- **P3-4:** contas de porta abertas. A conta A do C02 (`A-2026.000010`) fica `aberta`, e a do paciente internado só fecha se o faturamento a conduzir.

### Observações sem achado
- **BPA:** a conferência contou 17 linhas da UPA (9 BPA-C), e o fechamento gravou 16 (8 BPA-C), porque o BPA-C é consolidado no arquivo. A lista `linhas` da conferência só mostra linhas "fora", BPA-C ou com aviso, por desenho.
- **"Sempre BPA-C":** muda o destino da linha da medicação na conta **ainda aberta** e na conferência. Na conta do C01, a v1 congelou a medicação em `bpa_c`; depois de desmarcado, a v2 congelou em `bpa_i`.
- **NIR:** viu `aih_sem_decisao` e `apac_sem_decisao` logo depois da solicitação, sem esperar prazo, e a cobrança gravou.
- **Pré-auditoria:** a conta I do C02 mostrou o aviso "Tabela SIGTAP carregada é da competência 09/2026", não bloqueante (P3-8 do A01).

## O que só se confere na tela (fica para o Chrome)
- **`/faturamento/contas`:**
  - painel de pendências por grupo;
  - "Lançar procedimento" com a busca da lista;
  - "Lançar material" e "Retirar";
  - "Fora da conta" do medicamento;
  - o botão "Reabrir" só para o gestor;
  - o "nulo" do acolhimento na coluna de valor (P3-5).
- **`/faturamento` (BPA):**
  - cabeçalho;
  - lista com o "sempre BPA-C";
  - conferência com o motivo da linha BPA-C;
  - baixar o `.txt`;
  - "Reabrir" com motivo.
- **`/faturamento/glosas`:**
  - modal "Registrar glosa", com a lista de glosáveis e o valor sugerido;
  - "Em recurso" com a competência;
  - "Recuperada", com o campo de valor e uma recuperação parcial (P3-C9);
  - "Perdida" só para o gestor;
  - os totais do painel.
- **`/aih` e `/apac`:**
  - a decisão do regulador;
  - a aba Arquivo da APAC;
  - o "Registrar execução", com os códigos de 2 dígitos;
  - o faturamento sem rota para `/aih` (A01).
- **Recepção:** o "Endereço SUS" (`EnderecoSus.tsx`) depois da ficha (P3-C4).
- **Farmácia, `/farmacia` (fila):**
  - a ordem da fila (alta vigilância antes);
  - o selo de alta vigilância na prescrição (`SeloAltaVigilancia.tsx`).
- **Farmácia, `/checagem`:**
  - "alta vigilância · liberação da farmácia";
  - a justificativa;
  - "Liberado pela farmácia: Farmacêutico F5".
- **Farmácia, `/dispensacao`:**
  - "farmácia fechada" para a enfermagem;
  - o aviso de estoque negativo;
  - "a conferir".
- **Farmácia, `/farmacia` (estoque):** o extrato com o paciente na saída.
- **`/unidade?aba=configuracoes`:**
  - "Remuneração de plantão" só com manhã, tarde e noite;
  - "remover" desativa;
  - não mostra quem cadastrou (P2-C1).
- **`/faturamento/erp`:**
  - as abas de contas e de plantões;
  - "Baixar CSV/JSON". O CSV das contas (`csvContas`) é montado na tela;
  - "Fechar" desabilitado no mês corrente;
  - as versões substituídas na lista.
- **`/rede`:** a tela de faturamento da rede para `faturamento.rede.f5`.
- **Segundo fator:** cada conta passa pelo 2FA na tela. No banco, a sessão é simulada.

## O que ficou gravado na homologação

**Esperado pela rodada** (dados fictícios, nomes de teste):
- **Pacientes na UPA F5:** "Antônio C1 Corte na Mão", "Benedita C2 Pneumonia", "Cícero C3 Sessões" e "Dalva C4 Observação", com episódios encerrados.
- **Contas:**
  - `A-2026.000009` faturada: v1 substituída (34,79) e v2 vigente (11,63);
  - `A-2026.000010` **aberta**;
  - `I-2026.000002` faturada (598,42), com 2 glosas (recuperada e perdida);
  - `A-2026.000012` faturada (11,00), com 1 glosa **aberta** da APAC (122,00, competência 202612);
  - `A-2026.000014` faturada (12,89).
  - Todas as versões do ERP ficaram com conciliação **pendente**.
- **AIH** `3526117000001` aprovada (202611).
- **APAC** `2611300000001` autorizada (11/2026 a 01/2027), com a execução de 202611 válida e a de 202612 cancelada.
- **Fechamentos de competência de 202611 na UPA:**
  - 2 de BPA, ambos `reaberta`;
  - 1 de APAC, `reaberta`.
- **Farmácia da UPA:**
  - validações, dispensações (1 conferida), devolução e avulsa;
  - estoque da **Dipirona injetável = 8** e da **Enoxaparina = −1**;
  - entrada `NF-TESTE-C04-1`.
- **Plantões:**
  - versões de 202610: v1 substituída e v2 vigente, total 0,00;
  - plantão do `medico.upa.f5` no PS, manhã de 31/10/2026 (`035a5a36-…`), como acerto retroativo.

**Configuração da UPA F5 que fica (pelas RPCs e telas do produto):**
- **cabeçalho do BPA:** órgão "Secretaria de Saúde F5 (teste)", sigla SMSF5, CNPJ fictício `99999999000199`, destino M;
- **órgão emissor da APAC:** `F5TESTE`, fictício;
- **lista da UPA:** código 0401010058;
- **"sempre BPA-C" da medicação:** marcado e desmarcado; terminou como antes (`false`);
- **remuneração de plantão, VALORES FICTÍCIOS DE TESTE:**
  - ativas: PS + manhã 600, todos + noite 1.200, todos + todos 500;
  - 1 linha PS + manhã 600 inativa;
  - todas com `criado_por` nulo;
- **material:** "Gaze estéril 7,5 cm (teste C04)".

**De forma inesperada, ou que precisa de atenção:**
- **Leito INT-04 em higienização,** depois da alta da Benedita. Fica indisponível até alguém liberar.
- **A remuneração fictícia está ativa na UPA F5.** Ela muda a tela de vagas (`Vagas.tsx`) e qualquer prévia de plantões da UPA. Se o RT preferir, o gestor F5 remove as três linhas pela tela.
- **O estoque negativo da UPA ganhou a Enoxaparina (−1).** Já estavam negativos, de outros cenários: sulfato de magnésio, hidralazina, ceftriaxona, Ringer e noradrenalina.
- **Cabeçalho do BPA e órgão emissor da APAC:** passaram a existir na UPA F5, com valores fictícios.
- **`api_acessos`:** 1 registro 401 de chave inexistente (`financeiro_contas`).

**Esquema `e2e` (só ele):**
- funções novas: `c`, `c_banco`, `c_confere`, `c_falhar`, `c_guardar`, `c_cns`, `c_sinais`, `c_resumo_conta` e `c_versao`;
- variáveis `c01_*` a `c06_*` em `e2e.vars`;
- 336 linhas em `e2e.resultados`, com os passos `C01.*` a `C06.*`.

**O que não foi tocado:**
- nenhuma migration nem função de produto foi alterada;
- nenhuma chave de API foi criada;
- nenhuma senha foi escrita;
- os scripts 46, 47 e 48 não foram alterados, e o `49c_ambiente_bloco_c.sql` não foi preciso.

## Arquivos
- `scripts/e2e/70_cenario_c01.sql`: C01. Repetível: cada rodada cria um paciente novo ("… B"). Reabre a competência no fim.
- `scripts/e2e/71_cenario_c02.sql`: C02. Repetível; usa o último INT livre.
- `scripts/e2e/72_cenario_c03.sql`: C03. Repetível; número de APAC por rodada.
- `scripts/e2e/73_cenario_c04.sql`: C04. Repetível; reaproveita o material se já existir.
- `scripts/e2e/74_cenario_c05.sql`: C05. Depende do C01. **Não se repete sobre a mesma conta:** a sutura já foi retirada, então para repetir rode o 70 de novo. A remuneração não se duplica.
- `scripts/e2e/75_cenario_c06.sql`: C06. Só leitura; repetível.
