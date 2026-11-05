# 5A, tarefa 7 (continuação): pré-natal e puericultura

Pendência da tarefa 7. O hiperdia foi entregue em 03/11/2026 (PRs #429 e #430), e o RT pediu as pendências da 5A em 05/11/2026.

Este documento é o diagnóstico. **Decisões do RT em 05/11/2026: A em K1 a K6** ("todas A"): o pré-natal vem primeiro, e a puericultura logo depois.

## 1. A régua do Ministério da Saúde

A régua é a mesma da tarefa 7: as notas metodológicas da SAPS/MS de junho de 2026, lidas na fonte em 03/11/2026. Os quadros estão em `TAREFA7-PROGRAMAS-DIAGNOSTICO.md`, seção 1.

**C3, gestação e puerpério** (11 boas práticas, 100 pontos):
- (A) 1ª consulta até a 12ª semana, 10 pontos;
- (B) 7 consultas, (C) 7 pressões e (D) 7 registros de peso e altura na gestação;
- (E) 3 visitas do ACS;
- (F) dTpa a partir da 20ª semana;
- (G) testes de sífilis, HIV e hepatites B e C no 1º trimestre;
- (H) testes de sífilis e HIV no 3º trimestre;
- (I) 1 consulta no puerpério;
- (J) 1 visita do ACS no puerpério;
- (K) 1 atividade de saúde bucal.

As práticas de B a K valem 9 pontos cada.

**C2, desenvolvimento infantil até 2 anos** (5 boas práticas, 20 pontos cada):
- (A) 1ª consulta até o 30º dia;
- (B) 9 consultas e (C) 9 registros de peso e altura até os 2 anos;
- (D) 2 visitas do ACS;
- (E) vacinas com todas as doses.

**Janelas conferidas na fonte em 05/11/2026** (nota C3, assinada em 19 a 22/06/2026, e o Caderno de Atenção Básica nº 32, que a nota cita):
- **Idade gestacional:** pela DUM ou pela IG informada (nota, seção 4.1).
- **Fim da gestação:** a data de desfecho; sem ela, DUM + 294 dias, ou 42 semanas (nota, item 17).
- **Puerpério:** até 42 dias depois do fim da gestação (nota, itens 5 e 17).
- **Prática A, "até a 12ª semana":** até 12s6d, ou DUM + 90 dias.
- **1º trimestre:** até a 13ª semana, ou DUM + 97 dias (CAB 32: "primeiro trimestre da gestação (até a 13ª semana)").
- **3º trimestre:** a partir de 28s0d, ou DUM + 196 dias (CAB 32: sífilis e HIV repetidos no 3º trimestre, "com 28 semanas").
- **Testes de G e H:** valem igualmente o teste rápido realizado e o exame com resultado ("testes rápidos ou exames avaliados"). Os códigos SIGTAP são os 23 do item 24-h da nota; o HTLV da lista não entra em G nem em H. O pedido sem resultado não conta.
- **Entrada:** pelos CID-10 e CIAP-2 de gestação do item 24-f.
- **Saída:** a mudança de território ou de equipe e o aborto, pelos CID-10 e CIAP-2 do item 24-g, interrompem o acompanhamento (item 15).

A nota não fixa em dias os limites dos trimestres. Por isso, os cortes de 13s6d e 28s0d seguem o CAB 32 e ficam escritos na migration.

## 2. O que o app já tem

- **Programa:** `programa_participantes`, com entrada pela consulta ou à mão, saída com motivo, painel e "Agendar". Hoje o CHECK aceita só `hipertensao` e `diabetes`.
- **Consulta da UBS:** o problema avaliado já tem `pre_natal`, `puericultura` e `puerperio` (`episodios.problemas_aps`), mais CID-10 e CIAP-2.
- **Gestação:** a classificação de risco guarda tipo, G/P/A, DUM, IG e DPP (Naegele, `private.normalizar_gestacao`). A consulta da UBS não pede DUM hoje.
- **Sinais com data:** pressão, peso, estatura (agora também no adulto, F5-T2) e perímetro cefálico.
- **Pedido de exames:** pelo catálogo da unidade sobre o grupo 02.02 da SIGTAP, e resultado estruturado vindo do laboratório (5C-1).
- **Pediatria:** a idade em dias, meses e anos (`rotuloIdade`) e a curva de crescimento da pediatria.

## 3. O que falta

| Boa prática | Pré-natal (C3) | Puericultura (C2) |
|---|---|---|
| Consultas e prazos | A, B, I: consulta da UBS com o problema; falta a data de início da gestação na consulta | A, B: consulta da UBS e a data de nascimento |
| Pressão, peso e altura | C, D: já registrados | C: já registrados |
| Exames | G, H: pedido e resultado existem; falta casar o código com a régua | — |
| Vacina | F: **não existe registro de vacina** | E: **não existe registro de vacina** |
| ACS | E, J: **não existe o papel de ACS** | D: **não existe o papel de ACS** |
| Saúde bucal | K: **não existe dentista nem TSB** | — |

**Teto sem módulo novo:**
- pré-natal: 64 pontos (A, B, C, D, G, H, I);
- puericultura: 60 pontos (A, B, C).

## 4. Decisões do RT

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| K1 | Qual primeiro | **A)** Pré-natal. **B)** Puericultura. **C)** Os dois juntos | A: tem o teto maior sem módulo novo (64), reaproveita gestação, exames e o hiperdia, e é o que a gestão cobra mais (sífilis congênita, 1ª consulta precoce) |
| K2 | Como a gestante entra e sai | **A)** Entra pela consulta com o problema "pré-natal" e a DUM, que passa a ser pedida na consulta. O médico ou o enfermeiro também incluem à mão. Sai sozinha ao fim do puerpério, ou à mão com motivo (aborto, mudança de unidade). **B)** Só à mão | A, como no hiperdia |
| K3 | Vacina, ACS e saúde bucal | **A)** Mostrar "não registrado no app", como a visita do ACS no hiperdia. **B)** Um registro simples à mão ("feito em", data e quem registrou), sem estoque nem lote | A agora. A vacina de verdade (lote, dose, SI-PNI) é um módulo próprio e fica registrada no backlog |
| K4 | O que a tela mostra | **A)** Painel "Pré-natal" igual ao do hiperdia: lista com IG, DPP, cada boa prática em dia ou atrasada, pontuação e "Agendar"; e o bloco "Pré-natal" na consulta. **B)** Um painel único "Programas", com abas por programa | A. As telas saem de referências do Refero e o RT escolhe |
| K5 | Quem vê | **A)** Médico, enfermeiro, técnico e gestor da UBS, como no hiperdia | A |
| K6 | Puericultura | **A)** Logo depois do pré-natal, com as mesmas regras. **B)** Só quando houver vacina e ACS | A: os 60 pontos sem módulo novo já servem à busca ativa |

## 5. Partes (se as decisões forem A)

1. **Banco** (migration `20270222000001_pre_natal.sql`, teste `supabase/tests/5a_pre_natal.sql`):
   - a tabela própria `pre_natal_gestacoes`, uma linha por gestação, com a DUM, o desfecho (parto ou aborto) e a saída com motivo. O hiperdia (`programa_participantes`) não muda.
   - a saída do painel 42 dias depois do fim, sem rotina noturna;
   - a entrada pela consulta, com a DUM da classificação, e o aborto pela consulta;
   - o painel e o bloco da paciente.
   - Em seguida, a homologação com o rollback testado e o ok de produção do RT.
2. **Telas:**
   - DUM e IG na consulta da UBS com o problema "pré-natal";
   - bloco "Pré-natal" na consulta;
   - painel `/pre-natal`, com a opção que o RT escolher.
3. **Puericultura (K6):** mesmo caminho, com a idade em dias e as nove consultas.

## 6. Riscos

- **Não é o cálculo oficial:** quem vale é o SISAB. O painel diz isso, como o do hiperdia.
- **Janelas da régua:** se a régua for lida errada, a gestante aparece "em dia" sem estar. Por isso a seção 1 pede conferir na fonte antes da parte 1.
- **Regras clínicas:** o app não sugere conduta nem dose. Só mostra o que foi registrado e o prazo da régua.
