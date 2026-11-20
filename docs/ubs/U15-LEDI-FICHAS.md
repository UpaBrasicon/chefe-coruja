# U15, PR 3: fichas do LEDI APS 8.7.0

Este PR monta as fichas que vão ao PEC e-SUS APS do município: a Ficha de Atendimento Individual (FAI) e a Ficha de Procedimentos (FP). O código está em `src/interop/ledi/` e não lê o banco. A entrada é a carga do PR 2 (`ledi_carga_fai` e `ledi_carga_fp`). A saída é o arquivo `<uuidFicha>.esus` que a API do PEC recebe (`POST api/v1/recebimento/ficha`). Quem envia é o serviço do PR 4.

## Formato

- **Arquivo:** o `DadoTransporte`, serializado no Apache Thrift, protocolo binário. A ficha vai dentro dele, também serializada, no campo `dadoSerializado`.
- **Números dos campos:** são os do IDL oficial do Thrift, no repositório de exemplos da Bridge que a documentação do LEDI indica (`laboratoriobridge/esusaps-integracao`, commit 9316f280f526). Nos registros filhos (FAI e FP) e no `VariasLotacoesHeader`, esses números não são os "#N" dos dicionários. Na FAI, por exemplo, as medições são o 39 e os problemas o 40. A primeira versão do PR 3 usou os "#N" e foi corrigida antes de qualquer envio.
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
5. **Números dos campos.** Conferidos com o IDL oficial. A prova final é o PEC de homologação aceitar a ficha, no PR 4. O envio segue o exemplo oficial: login e ficha em `multipart/form-data`, e a ficha aceita volta com o código 201.

## Envio ao PEC (PR 4)

Quem envia é o serviço da RNDS no VPS (`services/rnds-envio`), num ciclo à parte (`src/ledi.ts`). Segue o exemplo oficial (`ExemploEnvioApi.java`):
1. Login em `POST <pec>/api/recebimento/login`, com `usuario` e `senha` em `multipart/form-data`. O serviço guarda o cookie `JSESSIONID`.
2. Envio em `POST <pec>/api/v1/recebimento/ficha`, com o campo `ficha` (arquivo `<uuidFicha>.esus`). O PEC responde 201 quando aceita.

| Resposta | Resultado na fila |
|---|---|
| 201 | enviado |
| 401, 403 ou redirecionamento | entra de novo uma vez; se repetir, reenviar |
| 400, ou 500 de desserialização | erro: o PEC recusou a ficha; não tenta de novo |
| outro 5xx, ou PEC fora do ar | reenviar: em 1, 2, 4… minutos, no máximo 1 hora; na 30ª tentativa vira erro |
| login recusado (400) | retido: credencial errada ou inativa; tenta de novo em 1 hora |

**Banco** (`20270415000023_ubs_u15_envio_pec.sql`):
- `ledi_pegar_lote`, `ledi_dados_ficha` e `ledi_registrar_resultado` são só da chave de serviço.
- `ledi_ligar_envio(unidade, ligado)` é do gestor da UBS, com segundo fator e auditoria. Ligar exige CNES, código IBGE e o endereço do PEC.

**No VPS**, o ciclo só roda com:
- `LEDI_INSTALACAO`: arquivo JSON com quem envia (`contraChave`, `uuidInstalacao`, `cpfOuCnpj` e `nomeOuRazaoSocial`, que é o CNPJ da empresa);
- `LEDI_CREDENCIAIS_DIR`: uma credencial da API do PEC por unidade (`<unidade_id>.json`, com `usuario` e `senha`), gerada pelo administrador da instalação do PEC do município.

Sem esses dois, o SISAB fica parado e a RNDS segue igual. Hoje nenhum dos dois está configurado. O primeiro envio real espera o município: PEC 5.5.26 ou superior, com HTTPS e a credencial da API.

## Ficha de Vacinação (vacina, PR 6)

Tipo 14, pelo IDL oficial `ficha_vacinacao.thrift` (mesmo commit). Montagem em `fichaFv` (`src/interop/ledi/fichas.ts`); carga em `private.ledi_carga_fv` (`20270415000030_ubs_u15_ficha_vacinacao.sql`).

- **Uma ficha por vacina registrada**, com o profissional que registrou no cabeçalho (UnicaLotacaoHeader). A vacina aplicada e a transcrita da caderneta (registro anterior) vão do mesmo jeito; a transcrita leva a data em `dataRegistroAnterior`.
- **Números do IDL, não do dicionário.** O fabricante vai no campo 19 (`coRndsFabricante`). O campo 5 (`fabricante`) é o antigo e fica vazio. A condição maternal vai no 15; os campos 9 e 10 (gestante e puérpera) são antigos e ficam vazios.
- **Retém:** profissional com CBO fora da Tabela 12 do LEDI; paciente sem CPF e sem motivo (VC7); vacina sem condição maternal fora do sexo masculino; BCG sem "comunicante de hanseníase"; vacina aplicada sem lote, fabricante, estratégia ou grupo.
- **Cancelada antes do envio:** a ficha é descartada. **Cancelada depois de enviada:** o LEDI 8.7.0 não documenta cancelamento pela API (`uuidFichaCancelada` está no IDL, mas não no dicionário nem nas regras da transmissão). A ficha fica na aba SISAB com o aviso "vacina cancelada no app depois do envio: exclua a ficha no PEC do município" (migration `20270415000032_ubs_u15_vacina_cancelada_enviada.sql`).
- Pesquisa clínica vai sempre "não": a sala de vacina não registra o protocolo da ANVISA.
