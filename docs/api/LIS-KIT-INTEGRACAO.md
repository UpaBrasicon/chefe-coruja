# Kit de integração do laboratório (LIS) com o Chefe Coruja

Para o fornecedor do sistema de laboratório do hospital ou da rede parceira. SP2, decisão L5 = A do RT (18/11/2026). A porta é a FHIR R4 da Fase 5C; detalhes técnicos em `docs/api/README.md` (seção "Laboratório (LIS)") e no contrato `docs/api/openapi.yaml`.

## 1. Como funciona

1. **Pedidos.** O médico pede o exame no Chefe Coruja, pelo catálogo da unidade. O LIS busca os pedidos pendentes (`GET /fhir/ServiceRequest`), com o paciente contido: nome, nascimento, sexo, CNS ou CPF e prontuário.
2. **Coleta.** O LIS informa a coleta (`POST /fhir/Specimen`). A hora da coleta é a que conta no prontuário e nos escores (SOFA).
3. **Laudo.** O LIS devolve o laudo (`POST /fhir/DiagnosticReport`), com cada analito numa `Observation` contida e, se houver, o PDF.
   - `preliminary` põe o exame em análise.
   - `final` grava o laudo.
   - `amended` ou `corrected` grava uma versão nova.
   - `cancelled` cancela.
4. **Reenvio.** O mesmo laudo reenviado (mesmo `identifier` e mesmo conteúdo) não duplica.
5. **Sem pedido, não entra.** Laudo de exame que não foi pedido no Chefe Coruja é recusado com `404`. O gestor vê quantas recusas houve por semana.
6. **Resultado crítico.** Uma `interpretation` `HH`, `LL` ou `AA` marca o analito como crítico, e a equipe é avisada.

**Endereços:**
- homologação: `https://<projeto-de-homologação>.supabase.co/functions/v1/api/v1`;
- produção: `https://api.chefecoruja.com.br/v1`.

**Autenticação:** `Authorization: Bearer <chave>`. A chave de teste começa com `cc_test_`, e a de produção, com `cc_live_`. A chave só lê pedidos e só grava coleta, situação e laudo, das unidades liberadas. Cada chamada fica registrada.

## 2. Exames da sepse e LOINC

O gestor aplica estes exames ao catálogo da unidade em "Exames da unidade" → "Aplicar exames da sepse". O código SIGTAP e o LOINC foram conferidos nas tabelas oficiais carregadas no sistema em 18/11/2026.

| Exame (SIGTAP) | LOINC do pedido | Analitos que o laudo deve trazer (LOINC) |
|---|---|---|
| Hemograma completo (02.02.02.038-0) | 58410-2 | Plaquetas 777-3; Leucócitos 6690-2 |
| Creatinina (02.02.01.031-7) | 2160-0 | Creatinina 2160-0 |
| Bilirrubina total e frações (02.02.01.020-1) | 1975-2 | Total 1975-2; direta 1968-7; indireta 1971-1 |
| Gasometria arterial (02.02.01.073-2) | 24336-0 | PaO₂ 2703-7; PaCO₂ 2019-8 |
| Lactato (02.02.01.053-8) | 2524-7 | Lactato no soro ou plasma 2524-7, ou no sangue 32693-4 |
| Proteína C reativa (02.02.03.020-2) | 1988-5 | PCR 1988-5 |
| Hemocultura (02.02.08.015-3) | 600-7 | Bactérias identificadas no sangue 600-7 |

**Regras:**
- Mande o LOINC do analito em `code.coding` (`system: http://loinc.org`) e o nome em `code.text`.
- O número vai em `valueQuantity.value` como número JSON (ponto decimal, padrão FHIR), com a unidade em `unit` e, se possível, o código UCUM em `code`.
- Texto com vírgula (`"1,2"`), milhar (`"150.000"`) ou sinal (`"<0,5"`) também é lido.

## 3. Exemplos

**Coleta:**

```json
{ "resourceType": "Specimen",
  "request": [{ "reference": "ServiceRequest/<id do pedido>" }],
  "collection": { "collectedDateTime": "2026-11-18T10:05:00-03:00" } }
```

**Laudo final de hemograma, com plaquetas críticas e PDF:**

```json
{ "resourceType": "DiagnosticReport", "status": "final",
  "basedOn": [{ "reference": "ServiceRequest/<id do pedido>" }],
  "identifier": [{ "value": "LAB-2026-000123" }],
  "conclusion": "Plaquetopenia.",
  "contained": [
    { "resourceType": "Observation", "id": "plaq", "status": "final",
      "code": { "coding": [{ "system": "http://loinc.org", "code": "777-3" }], "text": "Plaquetas" },
      "valueQuantity": { "value": 18000, "unit": "/mm³" },
      "referenceRange": [{ "low": { "value": 150000 }, "high": { "value": 450000 } }],
      "interpretation": [{ "coding": [{ "code": "LL" }] }] },
    { "resourceType": "Observation", "id": "leuco", "status": "final",
      "code": { "coding": [{ "system": "http://loinc.org", "code": "6690-2" }], "text": "Leucócitos" },
      "valueQuantity": { "value": 15800, "unit": "/mm³" },
      "interpretation": [{ "coding": [{ "code": "H" }] }] } ],
  "result": [{ "reference": "#plaq" }, { "reference": "#leuco" }],
  "presentedForm": [{ "contentType": "application/pdf", "title": "LAB-2026-000123.pdf", "data": "<PDF em base64, até 10 MB>" }] }
```

**Outros casos:**
- **Laudo corrigido:** o mesmo corpo, com `"status": "amended"` e a nota em `conclusion`. Vira a versão 2, e a versão 1 fica no histórico.
- **Em análise:** `{ "resourceType": "DiagnosticReport", "status": "preliminary", "basedOn": [...], "identifier": [...] }`.
- **Cancelado:** `"status": "cancelled"`.
- **Erro:** a resposta é um `OperationOutcome` com o motivo em `issue[0].diagnostics`.

## 4. Roteiro de homologação

Na homologação do Chefe Coruja, com a chave `cc_test_` e pacientes de teste, sem dado real. Cada item vira uma evidência (o registro da chamada) antes da chave de produção.

| # | Passo | Esperado |
|---|---|---|
| 1 | `GET /fhir/metadata` | 200, com a porta descrita |
| 2 | Pedir um hemograma no Chefe Coruja; `GET /fhir/ServiceRequest` | o pedido aparece, com o paciente contido |
| 3 | `POST /fhir/Specimen` | 200; a coleta aparece no prontuário com a hora enviada |
| 4 | `DiagnosticReport` `preliminary` | o exame fica "em análise" |
| 5 | `DiagnosticReport` `final` com LOINC, valores e PDF | o laudo aparece com os analitos e o PDF |
| 6 | Reenviar o mesmo laudo | não cria versão nova |
| 7 | `amended` | cria a versão 2, com o motivo |
| 8 | Analito com `LL` | aviso de crítico para a equipe |
| 9 | Laudo para um pedido inexistente | 404, e conta nas recusas do gestor |
| 10 | Os 7 exames da sepse | cada analito com o LOINC da tabela; o SOFA do painel de sepse lê os valores |
| 11 | `cancelled` | o pedido sai da fila |

O nosso lado pode ser simulado com `scripts/lis-simulador.mjs` (seção "Testar sem LIS real" do `docs/api/README.md`).

## 5. O que não está nesta porta

- **HL7 v2** (ORM/ORU) ou outro formato: entra como item próprio, decidido com o fornecedor (SP2, L1).
- **Exame feito sem pedido no Chefe Coruja:** é recusado (5a da Fase 5C; SP2, L4).
- **Dado do paciente para pesquisa:** vai pelo SP3, com o comitê de ética.
