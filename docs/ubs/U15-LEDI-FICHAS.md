# U15, PR 3: fichas do LEDI APS 8.7.0

Este PR monta as fichas que vão ao PEC e-SUS APS do município: a Ficha de Atendimento Individual (FAI) e a Ficha de Procedimentos (FP). O código está em `src/interop/ledi/` e não lê o banco. A entrada é a carga do PR 2 (`ledi_carga_fai` e `ledi_carga_fp`). A saída é o arquivo `<uuidFicha>.esus` que a API do PEC recebe (`POST api/v1/recebimento/ficha`). Quem envia é o serviço do PR 4.

## Formato

- **Arquivo:** o `DadoTransporte`, serializado no Apache Thrift, protocolo binário. A ficha vai dentro dele, também serializada, no campo `dadoSerializado`.
- **Números dos campos:** são os "#N" dos dicionários de dados do LEDI 8.7.0.
- **Tipos:** String vira `string`, Long vira `i64`, Integer vira `i32`, Boolean vira `bool`, Double vira `double` e List vira `list`.
- **Cabeçalho do transporte:**
  - tipo 4 (FAI) ou 7 (FP);
  - CNES e IBGE da unidade, e o INE quando houver;
  - versão 8.7.0;
  - quem envia e quem digitou (`DadoInstalacao`), que vêm da configuração do serviço de envio.
- **Origem:** `tpCdsOrigem` = 3 (sistemas terceiros).
- **Identificação da ficha:** o `uuidFicha` vem da fila, com o CNES na frente.

## Tradução do app para o LEDI

| Dado | Regra |
|---|---|
| Tipo de atendimento | programada 1, agendada 2, escuta inicial 4, no dia 5, urgência 6. O pré-natal do parceiro não tem código e a ficha fica retida |
| Conduta | as 12 condutas do app têm código próprio na tabela CondutaEncaminhamento, sem repetir |
| Problema/condição | toda CID (sem ponto) e toda CIAP2 do atendimento, e os 5 códigos AB que o LEDI 8.7.0 ainda tem: saúde sexual e reprodutiva, saúde mental, reabilitação, rastreamento do colo e rastreamento da mama |
| Exames pedidos | código SIGTAP, situação "S" (solicitado) |
| Medições | pressão (só com sistólica e diastólica juntas), frequências, temperatura, saturação, glicemia (tipo 3, "não especificado"), peso, altura e perímetro cefálico, nas faixas do dicionário |
| Cidadão | CPF ou CNS, nunca os dois. Data de nascimento em Epoch ms, à meia-noite de Brasília. Sexo: M 0, F 1, os outros 4 |
| Local e turno | local 1 (UBS). Turno pela hora de Brasília: manhã antes das 12, tarde até as 18, noite depois |
| Procedimento (FP) | um código SIGTAP por ficha. O LEDI não repete o código: com quantidade maior que 1, a ficha leva o código uma vez e registra um aviso |

A ficha fica retida, com o motivo, quando falta:
- CNES ou IBGE;
- tipo de atendimento do LEDI;
- conduta;
- CID ou CIAP;
- CNS ou CPF do paciente.

## Em aberto

1. **Lista de problemas sem CIAP2.** O LEDI 8.7.0 tirou os códigos AB de quase todos os problemas da lista do app. Ficaram cinco. Os problemas asma, diabetes, hipertensão, DPOC e os demais não viram código sozinhos. A ficha vai com a CID ou a CIAP2 que o profissional registrou, e o problema sem código gera um aviso. Para traduzir o problema em CIAP2, é preciso uma fonte oficial, que ainda falta.
2. **Escuta inicial.** Ela vai como FAI tipo 4. Escuta encerrada sem conduta fica retida. No PEC, a escuta inicial também pode ir como Ficha de Procedimentos (`statusEscutaInicialOrientacao`). Isso será conferido com o PEC de homologação no PR 4.
3. **Paciente só com CNS.** Ele vai com `stCidadaoNaoPossuiCpf` = falso. A justificativa de "não possui CPF" só serve para os casos da lista do LEDI (recém-nascido, indígena sem CPF e outros), que o app não registra.
4. **CBO.** O app não confere a tabela de CBOs de cada ficha (Tabelas 3 e 6). O PEC confere e devolve erro. O médico, o enfermeiro e o técnico de enfermagem já estão nas notas da SAPS.
5. **Números dos campos.** Os números do Thrift seguem os "#N" dos dicionários. A conferência final é o PEC de homologação aceitar a ficha, no PR 4.
