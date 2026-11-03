# 5A, tarefa 7: programas básicos (hiperdia, pré-natal, puericultura)

Fase 5A, UBS Mínima, do `BACKLOG.md`. Prioridade: **P2**. Começada em 03/11/2026, a pedido do RT ("Sim, diagnóstico 7"), depois da tarefa 6 concluída.

O aceite do backlog é: "Pelo menos um programa básico funcional". O backlog pede hiperdia, pré-natal e puericultura, na ordem da prioridade comercial.

Este documento é o diagnóstico. As decisões do RT (J1 a J5) estão na seção 3, ainda **pendentes**.

## 1. A régua do Ministério da Saúde (conferida na fonte)

O cofinanciamento federal da APS (Portaria GM/MS nº 3.493/2024) tem um componente de qualidade, medido por indicadores de "boas práticas" por pessoa vinculada à equipe. Cada pessoa soma até 100 pontos. As notas metodológicas da SAPS/MS foram assinadas em 19 a 22/06/2026 e estão publicadas em [gov.br/saude › SAPS › fichas técnicas › eAP e eSF](https://www.gov.br/saude/pt-br/composicao/saps/publicacoes/fichas-tecnicas/equipe-de-atencao-primaria-e-saude-da-familia). Os quadros abaixo foram lidos nos PDFs dessas notas, em 03/11/2026.

**C5, cuidado da pessoa com hipertensão** (elegível pelo CID-10 ou pela CIAP-2 K86 ou K87):

| Boa prática | Pontos |
|---|---|
| (A) 1 consulta de médico ou enfermeiro nos últimos 6 meses | 25 |
| (B) 1 aferição de pressão arterial nos últimos 6 meses | 25 |
| (C) 1 registro simultâneo de peso e altura nos últimos 12 meses | 25 |
| (D) 2 visitas domiciliares do ACS/TACS, com 30 dias de intervalo, nos últimos 12 meses | 25 |

**C4, cuidado da pessoa com diabetes** (elegível pelo CID-10 ou pela CIAP-2 T89 ou T90):

| Boa prática | Pontos |
|---|---|
| (A) 1 consulta de médico ou enfermeiro nos últimos 6 meses | 20 |
| (B) 1 aferição de pressão arterial nos últimos 6 meses | 15 |
| (C) 1 registro de peso e altura nos últimos 12 meses | 15 |
| (D) 2 visitas domiciliares do ACS/TACS, com 30 dias de intervalo, nos últimos 12 meses | 20 |
| (E) 1 hemoglobina glicada solicitada ou avaliada nos últimos 12 meses | 15 |
| (F) 1 avaliação dos pés nos últimos 12 meses | 15 |

**C3, cuidado na gestação e puerpério:**

| Boa prática | Pontos |
|---|---|
| (A) 1ª consulta de médico ou enfermeiro até a 12ª semana | 10 |
| (B) 7 consultas na gestação | 9 |
| (C) 7 aferições de pressão arterial na gestação | 9 |
| (D) 7 registros simultâneos de peso e altura na gestação | 9 |
| (E) 3 visitas do ACS/TACS depois da 1ª consulta | 9 |
| (F) vacina dTpa a partir da 20ª semana | 9 |
| (G) testes de sífilis, HIV e hepatites B e C no 1º trimestre | 9 |
| (H) testes de sífilis e HIV no 3º trimestre | 9 |
| (I) 1 consulta no puerpério | 9 |
| (J) 1 visita do ACS/TACS no puerpério | 9 |
| (K) 1 atividade de saúde bucal na gestação | 9 |

**C2, cuidado no desenvolvimento infantil (até 2 anos):**

| Boa prática | Pontos |
|---|---|
| (A) 1ª consulta presencial até o 30º dia de vida | 20 |
| (B) 9 consultas até os 2 anos | 20 |
| (C) 9 registros simultâneos de peso e altura até os 2 anos | 20 |
| (D) 2 visitas do ACS/TACS: até 30 dias e até 6 meses | 20 |
| (E) vacinas (difteria, tétano, coqueluche, hepatite B, Hib, pólio, tríplice viral, pneumocócica) com todas as doses | 20 |

## 2. Diagnóstico do estado atual

**O que o app já registra (tarefas 2 a 6):**
- **Consulta da UBS por médico ou enfermeiro:** a Ficha de Atendimento Individual com o problema/condição avaliada. A lista já tem `hipertensao_arterial`, `diabetes`, `pre_natal`, `puericultura` e `puerperio` (`episodios.problemas_aps`), além do CID-10 e da CIAP-2 da consulta.
- **Sinais com data e hora** (`observacao`): pressão arterial, peso, estatura e perímetro cefálico.
- **Gestação na classificação:** tipo, G/P/A, DUM, IG e DPP calculadas pela regra de Naegele (`private.normalizar_gestacao`).
- **Pedido de exames:** a hemoglobina glicada está no catálogo do pedido ("HbA1c") e na SIGTAP (02.02.01.050-3).
- **Agenda da UBS (tarefa 3):** marca a consulta programada de cuidado continuado.

**O que não existe:**
- **Cadastro no programa:** não há uma lista de quem é hipertenso, diabético, gestante ou criança em acompanhamento, nem o "em dia / atrasado" de cada um. Hoje o problema fica só na consulta em que foi marcado.
- **Vínculo à equipe (adscrição):** o MS conta "pessoas vinculadas à equipe". O app não tem equipe nem território; o que existe é o cadastro do paciente na UBS.
- **ACS e visita domiciliar:** não há o papel de ACS/TACS. As boas práticas de visita (C5-D, C4-D, C3-E/J, C2-D) não têm onde ser registradas.
- **Vacinação:** não há registro de vacina (C3-F e C2-E).
- **Saúde bucal:** não há dentista nem TSB (C3-K).
- **Avaliação dos pés:** não é um campo estruturado da consulta (C4-F).
- **Curvas de crescimento da OMS:** a puericultura precisaria delas para mostrar peso e altura por idade.

**O que o app cobre de cada programa sem módulo novo:**
- **Hiperdia:** hipertensão 3 de 4 boas práticas (75 de 100 pontos); diabetes 4 de 6 (65 pontos), ou 5 de 6 (80 pontos) com a avaliação dos pés.
- **Pré-natal:** 6 de 11 boas práticas (A, B, C, D, I e os exames de G/H).
- **Puericultura:** 3 de 5 boas práticas, e sem as curvas.

## 3. Decisões do RT (J1 a J5): pendentes

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| J1 | Qual programa primeiro (o aceite pede pelo menos um) | **A)** Hiperdia (hipertensão e diabetes, C5 e C4). **B)** Pré-natal (C3). **C)** Puericultura (C2) | A: é o que o app mais cobre (até 80 de 100 pontos), atinge a maior parte dos pacientes da UBS e usa só dados que a consulta já registra. O pré-natal e a puericultura dependem de ACS, vacina e saúde bucal |
| J2 | Como o paciente entra no programa | **A)** sozinho, pela consulta: problema "hipertensão" ou "diabetes", ou CID-10/CIAP-2 elegível da nota (K86, K87, T89, T90 e os CID correspondentes). Médico e enfermeiro também incluem à mão; a saída é à mão, com motivo. **B)** só à mão | A: é a mesma regra de elegibilidade do MS |
| J3 | O que a tela mostra | **A)** painel "Hiperdia" da UBS: lista nominal com cada boa prática do MS em dia, atrasada ou sem registro no app, com as datas; filtro "atrasados"; "Agendar" pela agenda (busca ativa); pontuação da unidade como a nota calcula. **B)** só a lista, sem pontuação | A |
| J4 | Avaliação dos pés e visita do ACS | **A)** a consulta da UBS ganha o registro "avaliação dos pés" (feita, com alteração ou sem). A visita do ACS fica fora (não há ACS no app) e aparece como "não registrada no app", sem pontuar. **B)** os dois fora | A |
| J5 | Quem vê o painel | **A)** médico, enfermeiro, técnico de enfermagem e gestor da UBS. A recepção não vê, porque é dado clínico; ela agenda pela agenda, como hoje. **B)** todos da UBS | A |

**Fora desta tarefa (ficam registrados):**
- pré-natal (C3) e puericultura (C2), que vêm depois do hiperdia e pedem vacina, ACS e saúde bucal;
- envio do indicador ao SISAB/e-SUS (espera a integração);
- equipe e território (adscrição).

## 4. Proposta técnica (com as recomendações)

Três partes, cada uma com o próprio PR:

| Parte | Entrega |
|---|---|
| 7.1 banco | `programa_participantes` (paciente da UBS, programa hipertensão ou diabetes, origem automática ou manual, entrada, saída com motivo). Gatilho na consulta da UBS que encerra: o problema ou o CID/CIAP elegível inclui. RPC das boas práticas por paciente (datas da última consulta, PA, peso e altura, HbA1c pedida, avaliação dos pés) e da pontuação da unidade pela regra da nota. Avaliação dos pés como campo da conduta da UBS. Leitura só por médico, enfermeiro, técnico e gestor. |
| 7.2 telas | Painel "Hiperdia" com lista, filtros e "Agendar". Campo da avaliação dos pés na consulta. Selo "Hiperdia" e o que está atrasado na janela da consulta. |
| 7.3 fecho | Teste de ponta a ponta na homologação e registro no BACKLOG. |

**Riscos:**
- **Não é o cálculo oficial.** O painel segue a regra das notas, mas a pontuação que vale é a do SISAB, que lê o e-SUS. O painel diz isso e mostra a versão da nota.
- **Visita do ACS:** sem ela, o teto do app é 75 pontos na hipertensão e 80 no diabetes. O painel mostra o item como "não registrado no app".
- **Produção:** nenhuma UBS em uso, então nada muda para quem usa hoje.

## Fontes

- MS/SAPS. Nota Metodológica C5 - Cuidado da pessoa com hipertensão. 2026. [Link](https://www.gov.br/saude/pt-br/composicao/saps/publicacoes/fichas-tecnicas/equipe-de-atencao-primaria-e-saude-da-familia/nota-metodologica-c5-cuidado-da-pessoa-com-hipertensao/view)
- MS/SAPS. Nota Metodológica C4 - Cuidado da pessoa com diabetes. 2026. [Link](https://www.gov.br/saude/pt-br/composicao/saps/publicacoes/fichas-tecnicas/equipe-de-atencao-primaria-e-saude-da-familia/nota-metodologica-c4-cuidado-da-pessoa-com-diabetes/view)
- MS/SAPS. Nota Metodológica C3 - Cuidado na gestação e puerpério. 2026. [Link](https://www.gov.br/saude/pt-br/composicao/saps/publicacoes/fichas-tecnicas/equipe-de-atencao-primaria-e-saude-da-familia/nota-metodologica-c3-cuidado-na-gestacao-e-puerperio/view)
- MS/SAPS. Nota Metodológica C2 - Cuidado no desenvolvimento infantil. 2026. [Link](https://www.gov.br/saude/pt-br/composicao/saps/publicacoes/fichas-tecnicas/equipe-de-atencao-primaria-e-saude-da-familia/nota-metodologica-c2-cuidado-no-desenvolvimento-infantil/view)
