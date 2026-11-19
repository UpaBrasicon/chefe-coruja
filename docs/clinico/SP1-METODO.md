# SP1: método do painel "Desempenho do alerta de sepse"

Versão 1, 18/11/2026. Decisões S1–S6 = A do RT (`docs/clinico/SP1-DESEMPENHO-ALERTA-SEPSE-DIAGNOSTICO.md`). Migration `20270418000095_sp1_desempenho_alerta_sepse.sql`.

## O caso

- **Unidade de análise:** um atendimento (episódio) que chegou no período, com 14 anos ou mais na chegada.
  - Adultos (18 anos ou mais) entram no painel principal.
  - Quem tem de 14 a 17 anos fica numa linha à parte: o alerta vale a partir dos 14, e o critério de Seymour foi feito em adultos.
  - A internação ligada ao episódio (`internacoes.episodio_id`) conta junto.
- **Suspeita de infecção** (Seymour CW, et al. JAMA 2016;315(8):762–774, PMID 26903335):
  - antimicrobiano pela lista `private.eh_antimicrobiano`, no horário da prescrição;
  - cultura (exame com "cultura" no nome, não cancelado), no horário da coleta ou, sem ela, do pedido;
  - antimicrobiano antes: a cultura vem em até 24 h. Cultura antes: o antimicrobiano vem em até 72 h;
  - o início é o primeiro dos dois.
- **Sepse:** SOFA original de 2 ou mais na janela de 48 h antes a 24 h depois do início (Singer M, et al. JAMA 2016;315(8):801–810, tabela 1; decisão H11 = A).
  - Item sem dado conta zero, como no estudo.
  - Respiratório: PaO₂/FiO₂, com a FiO₂ registrada até 6 h antes da gasometria (0,21 sem registro). Os pontos 3 e 4 só valem com ventilação não invasiva ou invasiva registrada.
  - Coagulação: plaquetas (LOINC 777-3 ou 26515-7, ou "plaquetas" no nome). Valores acima de 2.000 são lidos como por mm³ e divididos por 1.000.
  - Hepático: bilirrubina total (LOINC 1975-2). Em µmol/L, divide por 17,1.
  - Cardiovascular, **simplificado**, porque a dose por kg não é confiável no dado:
    - noradrenalina, adrenalina, vasopressina ou dopamina, ou o sinal vital "drogas vasoativas" de 1 ou mais = 3;
    - só dobutamina ou milrinona = 2;
    - PAM abaixo de 70 = 1.
  - Neurológico: menor Glasgow registrado.
  - Renal, **simplificado**: só a creatinina (LOINC 2160-0; em µmol/L, divide por 88,4). A diurese de 24 h fica de fora.

## O alerta

- **Aviso da porta:** `avisos_sepse_atendimento`, evento "exibido" (AV6).
- **Alerta da internação:** `alertas_sepse_internacao`, o primeiro exibido por internação e nível.
  - A tela chama `registrar_alerta_sepse_internacao` ao mostrar.
  - O servidor recalcula a regra; a tela não informa o nível.
  - Antes desta versão, o alerta da internação não deixava registro.
- **Contagem:** vale o primeiro alerta do atendimento.
- **Detectada:** sepse com alerta até 6 h depois do início (S3).
- **Antecedência:** horas entre o alerta e o início. O valor é positivo quando o alerta veio antes.

## O painel

| Número | Conta |
|---|---|
| Sepses que o alerta pegou | detectadas ÷ sepses |
| Alertas que eram sepse | alertas com sepse ÷ alertas |
| Alertas por 100 atendimentos | alertas × 100 ÷ atendimentos |
| Antecedência mediana | mediana entre as detectadas |
| NEWS2 parcial e completo | alertas que eram sepse, em cada grupo |
| Cobertura de laboratório | suspeitas com plaquetas e creatinina ÷ suspeitas |
| Antimicrobiano sem cultura | atendimentos com antimicrobiano e sem cultura: a suspeita fica subcontada |

Todo percentual sai com o número de casos ("50% (1 de 2)").

**Pode divulgar (S5):** 30 sepses ou mais e cobertura de laboratório de 50% ou mais. Antes disso, o painel diz o motivo e não mostra o texto pronto.

**Quem vê (S4):**
- gestor da unidade e RT: o agregado;
- só o RT, com o segundo fator e um motivo: a lista de casos (sepse sem alerta a tempo e alerta sem sepse), com o nome do paciente. Cada paciente da lista entra no registro de acesso ao prontuário com o motivo.

## Limites

- **Sem laboratório integrado (SP2),** os exames dependem de resultado estruturado digitado. O SOFA sai menor do que é, e a sepse é subcontada.
- **Cultura pouco pedida no pronto-socorro** subconta a suspeita de infecção.
- **Não é estudo clínico.** Serve para melhorar o alerta e conversar com o cliente. Publicação científica vai pelo SP3 (comitê de ética); prova de eficácia, pelo SP4 e SP5.
- **Validação:** feita com casos montados de resposta conhecida (`supabase/tests/sp1_desempenho_alerta_sepse.sql`): sepse com alerta, sepse com alerta tardio, alerta sem sepse dispensado, infecção sem disfunção, antimicrobiano sem cultura, fora da janela, adolescente e criança.
