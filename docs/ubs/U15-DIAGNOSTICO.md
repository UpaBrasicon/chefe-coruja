# U15: transmissão da UBS ao SISAB e à RNDS (diagnóstico, 18/11/2026)

Pedido do RT em 17/11/2026, último item da trilha "Percurso da UBS por papel": "o sistema da UBS tem que transmitir dados para a RNDS e o SISAB". Este documento é só diagnóstico, sem código. Cada decisão tem opções A e B.

## Como o dado da APS chega ao Ministério

**SISAB (hoje SIAPS).** Um sistema próprio não envia direto ao SISAB.
- O caminho oficial é o **LEDI APS** (Layout e-SUS APS de Dados e Interface), hoje na versão 8.7.0, compatível com o PEC e-SUS APS 5.5.26 ou superior.
- O sistema próprio gera as fichas no LEDI (Apache Thrift ou XML) e as manda ao **PEC e-SUS APS do município**. O PEC envia ao SISAB.
- Há duas formas de entrega:
  - **API do PEC**, desde a versão 5.3.19:
    - POST `api/recebimento/login`, depois POST `api/v1/recebimento/ficha`, um arquivo `<uuidDadoSerializado>.esus` por ficha;
    - a instalação precisa de HTTPS;
    - o Administrador da Instalação gera as credenciais em "Transmissão de dados", com CPF ou CNPJ, e a senha aparece uma vez só;
    - o município é o responsável pelo script de envio.
  - **Arquivo importado à mão** no PEC ("Transmissão de dados", importação de lote).
- A ficha leva o CNES, o código IBGE do município, o CNS e o CBO do profissional e, opcionalmente, o INE da equipe. O profissional precisa ter vínculo no município.

**RNDS.** O app já tem a RNDS da Fase 5C na produção desde 29/10/2026:
- a fila (`interop_outbox`);
- o serviço de envio no VPS, com TLS mútuo;
- o cofre de certificados;
- o bloqueio do profissional sem CBO;
- a aba RNDS em Integrações.

Envia o RAC (porta), o Sumário de Alta e a regulação (MIRA). Nenhuma unidade tem o envio ligado: pela decisão do RT de 11/11/2026 (`docs/rnds/PILOTO-DIAGNOSTICO.md`), a RNDS espera a primeira unidade real em implantação.

## O que o app já registra na UBS e onde cabe

| Dado do app | SISAB (LEDI) | RNDS |
|---|---|---|
| Consulta de médico e enfermeiro: tipo de atendimento, problema/condição, CIAP2/CID-10, conduta, exames pedidos, peso, altura, pressão (U1, U6, U7, U10) | Ficha de Atendimento Individual (FAI). Os tipos do app são os mesmos do LEDI: 1 programada, 2 agendada, 4 escuta inicial, 5 no dia, 6 urgência | RAC |
| Procedimentos do técnico e do enfermeiro: curativo, glicemia, administração, testes rápidos, cito (U7, PR 5) | Ficha de Procedimentos | RAC (procedimento) |
| Pré-natal, puericultura, hiperdia | dentro da FAI (DUM, idade gestacional, medições) | RAC |
| Resultado de exame externo (U12) | FAI (exame avaliado) | O REL é do laboratório que executa, não da UBS |
| Vacina | Ficha de Vacinação; **o app não registra** (U6, P3 = B) | RIA (rotina); **o app não registra** |
| Cadastro individual e domiciliar, visita do ACS, atividade coletiva, saúde bucal | Fichas próprias; **o app não tem esses módulos** | — |

## Achados

1. **O RAC da UBS sairia como urgência.**
   - O banco monta o RAC de qualquer atendimento encerrado da porta com modalidade **06**, Atenção à Urgência/Emergência (`20270205000001_rnds_envio_banco.sql`).
   - Na UBS, o certo é **01**, Atenção Básica (CodeSystem BRModalidadeAssistencial).
   - O caráter também sai sempre 02 (urgência). A consulta programada ou agendada é eletiva (01).
   - Hoje não há envio ligado, por isso nada saiu errado. O erro aparece quando a primeira UBS ligar a RNDS.
2. **O enfermeiro assina o RAC na UBS (U6).** Conferir na credencial se o CBO 2235 é aceito como profissional do RAC, como o médico. Se não for, o documento fica retido e o gestor é avisado, pelo bloqueio que já existe.
3. **Faltam dados para o LEDI:**
   - o código IBGE do município da unidade: hoje só o paciente tem `municipio_ibge`, a unidade não;
   - o INE da equipe (opcional no LEDI);
   - a lista do problema/condição do app ligada ao CIAP2 (a FAI exige CIAP2 ou CID-10 em cada problema).
4. **Paciente sem CNS nem CPF.** A FAI aceita a justificativa de "não possui CPF". O app precisa pedir essa justificativa ou reter a ficha.
5. **Duplicidade a confirmar.** O PEC também pode mandar à RNDS o que recebe pelo LEDI. Se mandar, o RAC da UBS iria duas vezes. Isso só se confirma com o PEC do município ou com o DATASUS.

## Decisões para o RT

**V1. Caminho ao SISAB**
- **A:** LEDI 8.7.0 pela API do PEC do município. Cada atendimento encerrado vira ficha na fila e o serviço de envio do VPS manda ao PEC. Como reserva, o gestor baixa o lote para importar à mão quando o PEC estiver fora do ar.
- **B:** só o lote para baixar e importar à mão no PEC, sem envio automático.

**V2. Fichas da primeira leva**
- **A:** Ficha de Atendimento Individual e Ficha de Procedimentos, que são o que o app registra.
- **B:** também o Cadastro Individual, montado a partir do cadastro da recepção. Ele não é exigido para a FAI e duplicaria o cadastro do ACS no PEC.

**V3. Vacina**
- **A:** registro de vacina no app: imunobiológico, dose, lote, estratégia e quem aplicou. Vai na Ficha de Vacinação (SISAB) e no RIA de rotina (RNDS), e conta nos painéis (dTpa da gestante, vacinas da criança, influenza do idoso, HPV). É um bloco próprio, com vários PRs.
- **B:** a vacina continua fora do app. A sala de vacina registra no PEC do município, como hoje.

**V4. RNDS na UBS**
- **A:** corrigir o RAC da UBS:
  - modalidade 01;
  - caráter eletivo na consulta programada e agendada;
  - o enfermeiro como profissional.
  O envio continua desligado até a implantação, pela decisão de 11/11/2026.
- **B:** nada muda na RNDS agora. A correção fica para quando a primeira UBS entrar em uso.

**V5. Duplicidade RNDS × PEC**
- **A:** uma chave por unidade: "a RNDS do atendimento da APS vai pelo app" ou "vai pelo PEC". Nasce "pelo app" e o gestor troca na implantação, depois de confirmar com o município.
- **B:** a UBS manda à RNDS só pelo PEC: o app não envia RAC de atendimento da UBS.

## Plano em PRs (se V1 a V5 = A)

1. **RAC da UBS (V4, V5):**
   - no banco, a modalidade, o caráter, o enfermeiro e a chave por unidade;
   - teste da carga.
2. **Fila do LEDI (V1, V2):**
   - `interop_outbox` com os tipos `ledi_fai` e `ledi_fp`;
   - a configuração por unidade: IBGE, INE, endereço do PEC, credencial no cofre e envio ligado (nasce desligado);
   - a carga de cada ficha e o que retém (falta CNS ou CPF, CIAP/CID ou CBO);
   - a conferência noturna.
3. **Montagem das fichas:**
   - o mapper do LEDI 8.7.0 em `src/interop/ledi/`, com Thrift;
   - os testes contra as regras da FAI e da Ficha de Procedimentos (campos obrigatórios, tipos 1, 2, 4, 5 e 6, uma CIAP ou CID por problema, CNS ou CPF exclusivos).
4. **Serviço de envio:** reaproveita o serviço da RNDS no VPS: login na API do PEC, uma ficha por vez, resultado na fila (enviado, retido, reenviar, erro).
5. **Tela:** aba "SISAB" em Integrações, com a situação da fila, os retidos com o motivo e o lote para baixar.
6. **Vacina (se V3 = A):** plano próprio, depois desses.

Tudo nasce desligado, como a RNDS. O envio real depende do município: PEC com HTTPS, credencial da API, CNES, IBGE, INE e profissionais com CNS e vínculo. Por isso, como a RNDS, o primeiro envio real fica para a primeira UBS em implantação.

## Fontes

- [LEDI APS, versões e compatibilidade com o PEC](https://integracao.esusaps.bridge.ufsc.tech/ledi/index.html)
- [LEDI APS 8.7.0, documentação](https://integracao.esusaps.bridge.ufsc.tech/ledi/documentacao/index.html): [Ficha de Atendimento Individual](https://integracao.esusaps.bridge.ufsc.tech/ledi/documentacao/estrutura_arquivos/dicionario-fai.html), [cabeçalhos de lotação](https://integracao.esusaps.bridge.ufsc.tech/ledi/documentacao/estrutura_arquivos/header-transport.html)
- [API de transmissão de registros no formato LEDI (manual do PEC)](http://sisaps.saude.gov.br/sistemas/esusaps/docs/manual/APOIO/API_transmissao/)
- [RNDS, estrutura e modelos de informação](https://www.gov.br/saude/pt-br/composicao/seidigi/rnds/estrutura-do-projeto)
- [Modelos informacionais do REL, RAC e teleinterconsulta (MS, 2025)](https://www.gov.br/saude/pt-br/centrais-de-conteudo/apresentacoes/2025/modelos-informacionais-do-rel-rac-e-teleinterconculta.pdf)
- [CodeSystem BRModalidadeAssistencial](https://simplifier.net/redenacionaldedadosemsaude/codesystem-brmodalidadeassistencial): 01 Atenção Básica; 06 Urgência/Emergência
- RNDS no app: `docs/rnds/ENVIO.md`, `docs/rnds/PILOTO-DIAGNOSTICO.md`
