# SP1: medir o alerta de sepse por regra (diagnóstico, 18/11/2026)

Trilha "Sepse com evidência", item SP1 (P1). **Decisões do RT: pendentes** (S1–S6). Este documento não muda código nem banco.

**Pergunta:**
- De cada 100 alertas, quantos eram sepse?
- De cada 100 sepses, quantas o alerta pegou, e com quantas horas de antecedência?
- Quantos alarmes caem sobre a equipe por plantão?

## Fontes

- **Definição de sepse:** Singer M, et al. The Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA. 2016;315(8):801–810 (PMID 26903338), já citada na ficha `sepse-adulto`. Sepse é infecção com aumento de 2 ou mais pontos no SOFA.
- **Como achar a sepse no prontuário eletrônico:** Seymour CW, et al. Assessment of Clinical Criteria for Sepsis. JAMA. 2016;315(8):762–774 (PMID 26903335, [doi](https://doi.org/10.1001/jama.2016.0288)), lido no texto completo (PMC5433435), seção "Defining a Cohort With Suspected Infection":
  - suspeita de infecção = antibiótico (oral ou parenteral) mais cultura de fluido corporal;
  - antibiótico primeiro: a cultura vem em até 24 h. Cultura primeiro: o antibiótico é pedido em até 72 h;
  - o início é o primeiro dos dois;
  - o SOFA é medido de 48 h antes a 24 h depois do início.
- **Vigilância por dado clínico:** Rhee C, et al. Incidence and Trends of Sepsis in US Hospitals Using Clinical vs Claims Data, 2009-2014. JAMA. 2017;318(13):1241–1249 (PMID 28903154, [doi](https://doi.org/10.1001/jama.2017.13836)). Pelo dado clínico, a sensibilidade foi de 69,7%; pelo código da alta, de 32,3%. Por isso o CID da alta não serve de padrão.
- **Escore de disfunção:** SOFA original, como decidido pelo RT para a ficha (H11 = A, 11/11/2026). O SOFA-2 fica de fora.

## Como está hoje

| Peça | Situação |
|---|---|
| Aviso da porta (atendimento, ≥ 14 anos, gatilho de infecção e NEWS2 ≥ 5) | **Registrado** em `avisos_sepse_atendimento`: exibido uma vez por episódio e nível, e dispensado com motivo (AV6). É o dado do SP1 |
| Alerta da internação (`public.alertas_sepse`) | **Calculado na hora e não registrado.** Não dá para saber depois quando disparou |
| Antibiótico | **Dá para identificar:** `private.eh_antimicrobiano` (lista de princípios ativos, usada na evolução estruturada). Há a prescrição e a checagem da enfermagem (`administracoes`) |
| Cultura | **Dá para identificar:** `exames_pedidos` (procedimento SIGTAP, LOINC e coleta). Falta a lista fechada dos códigos de cultura |
| SOFA: plaquetas, creatinina, bilirrubina, PaO₂/FiO₂ | **Só se o exame tiver resultado estruturado** (`exame_resultado_itens`, com LOINC). Sem laboratório integrado (SP2), depende de digitação |
| SOFA: pressão, vasopressor, Glasgow, diurese | **Dá para identificar:** sinais vitais (`observacao`), medicamento vasoativo na prescrição e balanço hídrico |
| Desfecho (óbito, transferência, CID da alta) | **Dá para identificar** |
| **Dados reais** | **Produção: 0 atendimentos e 0 internações** (contagem de 18/11/2026). Ainda não há o que medir |

**Resultado:** o mecanismo pode ser construído agora, mas o número do SP1 só existe quando um parceiro estiver em uso. Sem o laboratório integrado (SP2), o SOFA de cada caso sai incompleto. Esse é o maior risco à qualidade do número.

## Decisões para o RT

**S1. O que conta como sepse (o padrão)**
- **A (recomendada):** Sepsis-3 pelo método de Seymour 2016.
  - Suspeita de infecção: antimicrobiano e cultura na janela de 24 h ou 72 h.
  - Sepse: SOFA de 2 ou mais na janela de 48 h antes a 24 h depois do início.
  - Item do SOFA sem dado conta zero, como no estudo. O painel mostra quantos casos tinham cada item medido.
  - Só adulto (18 anos ou mais), como no estudo. Os casos de 14 a 17 anos ficam numa linha à parte.
- **B:** sepse = CID de sepse na alta (A40, A41, R65). É mais simples, mas pega só um terço dos casos (Rhee 2017).

**S2. Quais alertas medir**
- **A (recomendada):** os dois.
  - O aviso da porta, que já é registrado.
  - O alerta da internação, que passa a registrar o primeiro disparo de cada internação e de cada nível: data, hora, NEWS2, se era parcial, e quem viu primeiro. O registro é só de inclusão, e o alerta em si não muda.
- **B:** só o aviso da porta.

**S3. O que o painel mostra**
- **A (recomendada):** por unidade e por mês, com o número de casos por trás de cada percentual:
  - sensibilidade (sepses com alerta antes ou até 6 h depois do início);
  - valor preditivo (alertas que eram sepse);
  - alertas por 100 atendimentos;
  - antecedência em horas (mediana);
  - quantos alertas foram dispensados e por quê;
  - resultado com NEWS2 parcial separado do NEWS2 completo.
- **B:** só contagens (alertas, sepses e sepses com alerta), sem percentuais.

**S4. Quem vê e o quê**
- **A (recomendada):**
  - o gestor da unidade e o RT veem os números agregados, sem paciente;
  - só o RT abre a lista de casos para revisão (sepses sem alerta e alertas sem sepse), com motivo escrito e registro de acesso, como no histórico encerrado.
- **B:** só os números agregados, para todos.

**S5. Quando o número pode sair da empresa (o "atalho comercial")**
- **A (recomendada):** só com pelo menos 30 sepses no período e 50% ou mais dos casos com plaquetas e creatinina medidas.
  - Abaixo disso, o painel mostra "amostra pequena" ou "dados de laboratório insuficientes" e não oferece o texto pronto.
  - Publicação científica é outra coisa: vai pelo SP3, com o comitê de ética (CEP).
- **B:** sem trava; o número sai como estiver, com a ressalva escrita.

**S6. Quando fazer**
- **A (recomendada):** construir agora e validar na homologação com casos montados de resposta conhecida (sepse com alerta, sepse sem alerta, alerta sem sepse, criança, dado faltando). O número real começa a ser medido sozinho quando o primeiro parceiro entrar.
- **B:** esperar o parceiro para construir.

## Plano depois das decisões (com S1–S6 = A)

1. **Banco** (migration expand, com rollback):
   - registro do primeiro disparo do alerta da internação;
   - lista dos códigos de cultura (SIGTAP e LOINC), conferida com a tabela do SIGTAP;
   - função que monta, por episódio, a suspeita de infecção, o SOFA da janela e o alerta;
   - funções do painel e da lista de revisão do RT;
   - teste com os casos montados.
2. **Tela:** painel "Desempenho do alerta de sepse" (gestor e RT) e lista de revisão (RT).
3. **Documentos:**
   - nota do método, com Seymour, Sepsis-3 e os cortes do SOFA da ficha;
   - LG4, porque é tratamento para qualidade assistencial e não pesquisa;
   - LG11, porque o painel mede o desempenho de uma função do módulo clínico.
4. CI, homologação e o seu "ok produção".

**Riscos:**
- **SOFA incompleto sem laboratório integrado:** a sensibilidade e o valor preditivo saem distorcidos. Por isso o S5 trava o número.
- **Cultura pouco pedida no pronto-socorro:** a suspeita de infecção fica subcontada. O painel mostra quantos atendimentos tiveram antibiótico sem cultura.
- **O painel não é estudo clínico.** Serve para melhorar o alerta e conversar com o cliente. Prova de eficácia é o SP4 e o SP5.
