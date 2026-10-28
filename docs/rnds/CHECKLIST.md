# Checklist da RNDS (Fase 3, tarefa 8)

Situação em 10/10/2026. Este documento deixa a integração com a RNDS pronta
para execução quando as credenciais chegarem. Nenhum envio acontece hoje: a
fila `interop_outbox` monta os documentos, e nada sai do status `pendente`.

Decisões do RT (10/10/2026), registradas no `BACKLOG.md`:

- **Escopo:** RAC (porta), Sumário de Alta (internação), RIA (vacina) e REL (exame laboratorial).
- **Saída:** pelo VPS que já existe.
- **Credencial:** uma por gestor. O Chefe Coruja aparece como sistema integrador.
- **Identificação:** CPF primeiro e CNS na falta, como recomenda o DATASUS.
- **Profissional sem CBO no CNES:** o sistema não envia em nome dele e avisa o gestor.

Fontes (tudo com página ou URL):

- `produto/docs/pesquisa/rnds-manuais-oficiais.md`: leitura dos manuais oficiais baixados.
- `produto/docs/pesquisa/rnds-credenciamento-checklist.md`: páginas públicas do DATASUS e do guia.
- `produto/docs/pesquisa/rnds-rac-sumario-alta.md`: perfis FHIR e normas.
- `produto/docs/pesquisa/rnds-oficial/`: os arquivos oficiais, com `SHA256SUMS.txt`.

## 1. Portfólios no escopo

| Modelo | Para quem | Onde pedir (portal antigo) | Observação |
|---|---|---|---|
| RAC — Registro de Atendimento Clínico | porta (PA/UPA), presencial e teleconsulta | https://servicos-datasus.saude.gov.br/detalhe/mvOq2Eteys | Portaria GM/MS 8.347/2025 |
| SA — Sumário de Alta | internação e observação | https://servicos-datasus.saude.gov.br/detalhe/90MmHuJ441 | Portaria GM/MS 8.026/2025 |
| RIA — Registro de Imunobiológico Administrado (rotina e campanha) | unidade que vacina | https://servicos-datasus.saude.gov.br/detalhe/urB3hXWTee | Prazo de análise publicado: 72 h úteis |
| REL — Resultado de Exame Laboratorial | laboratório da unidade | portal novo: https://portalservicos-datasus.saude.gov.br/portfolio/m4Ta3IqNf2 | **Restrito a COVID-19 e Monkeypox** (https://rnds-guia.saude.gov.br/docs/rel/objetivo-rel/). Só vale para unidade cujo laboratório faz esses exames. |

O pedido de credencial é **por portfólio**. O portal novo (v2.6) ainda manda
para a versão anterior na hora de pedir.

## 2. Pendências externas (gestor de cada unidade e DATASUS)

| # | Item | Quem | Observação |
|---|---|---|---|
| E1 | CNES válido da unidade. Unidades da mesma UF podem entrar como "filhos" na mesma credencial | gestor | modelo de planilha de CNES filhos em `rnds-oficial/ria/template-cnes-filhos.xlsx` |
| E2 | Certificado ICP-Brasil **A1** (`.pfx` + senha), e-CNPJ da unidade ou e-CPF do gestor. Anotar a validade | gestor | o A3 não aparece em nenhum manual; o servidor precisa do arquivo A1 |
| E3 | Conta gov.br do gestor, com CPF ou CNS cadastrado no CNES | gestor | |
| E4 | Profissionais que assinam o envio com vínculo e **CBO autorizado** no CNES da unidade | gestor (SCNES) | senão a RNDS recusa (EHR-ERR906) |
| E5 | Pedir a credencial de **homologação** de cada portfólio, preenchendo os campos da seção 4 | gestor, com os dados técnicos que o Chefe Coruja fornece | se a homologação for negada, é preciso pedir de novo |
| E6 | Guardar o **identificador do solicitante** que vem com a aprovação | gestor → Chefe Coruja | entra em `Bundle.identifier.system` (`BRRNDS-{id}`) |
| E7 | Pedir **produção** em "Gerenciar Credenciais > Homologação > Solicitar acesso ao ambiente de produção", com a evidência da seção 6 | gestor | |
| E8 | Perguntas sem resposta pública, por chamado no WEB Atendimento (o e-mail `rnds@saude.gov.br` não é atendido desde 2022) | Chefe Coruja | ver seção 8 |

## 3. Pendências internas (Chefe Coruja)

| # | Item | Situação |
|---|---|---|
| I1 | **IP fixo de saída:** VPS `179.199.128.141` | IPv4 de datacenter da Hostinger (bloco `179.199.128.0/19`, LACNIC/RDAP, consultado em 10/10/2026). Fica fixo enquanto o VPS existir. Recriar ou migrar o VPS pode trocar o IP, e a faixa só se altera com a credencial **já em produção**. O RT confere no painel da Hostinger que o IP é dedicado. Declarar inicial = final = `179.199.128.141` (início igual ao fim é inferência: o manual não proíbe nem confirma) |
| I2 | **Serviço de envio no VPS:** lê `interop_outbox`, pede o token com TLS mútuo e o certificado da unidade, envia o Bundle e grava `id_rnds`, `enviado_em`, `tentativas` e `ultimo_erro` | 5C-5.3: o banco (fila, carga e conferência noturna) está pronto na 5.3a; o serviço e o simulador, na 5.3b (`ENVIO.md`); a subida no VPS é a 5.3c |
| I3 | **Cofre de certificados no VPS:** um `.pfx` por unidade, cifrado, fora do repositório e do Supabase. Senha em segredo do serviço. Aviso de vencimento ao gestor | a construir |
| I4 | **Endereços:** Auth homologação `ehr-auth-hmg.saude.gov.br`; EHR homologação `ehr-services-hmg.saude.gov.br` (com hífen desde 09/07/2024; o manual RAC e o guia ainda trazem o antigo); Auth produção `ehr-auth.saude.gov.br`; EHR produção `{uf}-ehr-services.saude.gov.br`, pela UF do CNES | configurar no serviço de envio |
| I5 | **Header `Authorization`:** CNS do profissional logado (`usuario()`), nunca fixo no código. O header pede CNS; dentro do documento vai o CPF | regra |
| I6 | **Bloqueio do profissional sem CBO no CNES:** não enfileirar em nome dele e avisar o gestor | a construir com o envio |
| I7 | **Corrigir os documentos gerados** (`src/interop/fhir/`): havia divergências com os exemplos e o validador oficiais (seção 7) | feito na 5C-5.2 (28/10/2026): RAC e SA passam no validador oficial sem erro |
| I8 | **Validador local:** baixado (seção 6) | roda desde a 5C-5.2, num contêiner sem rede, só com documentos de teste (`VALIDADOR.md`) |
| I9 | **Modelos RIA e REL:** o código atual só monta RAC e SA | a construir quando houver unidade que vacina ou laboratório no escopo do REL |

## 4. Dados que o formulário de credencial pede

Manual de apoio, p. 9–24 (`rnds-oficial/rac/manual-apoio-credenciais-rac.pdf`;
o do RIA é igual). O Chefe Coruja deixa pronta a parte técnica para o gestor
colar:

- **Responsável:** origem da solicitação ("Outros"); certificado (`.cer` ou `.pfx` A1); CNES ou CNPJ, telefone e e-mail; CNES filhos da mesma UF; gestor por CPF ou CNS.
- **Sistema** (o Chefe Coruja fornece):
  - nome, versão, linguagem, arquitetura, banco e versão do banco;
  - resumo de até 400 caracteres;
  - se é aplicação web (sim);
  - **faixa de IP** (item I1);
  - tipo de equipe;
  - atendimentos já registrados e a data da contagem;
  - integrações com outros sistemas do Ministério;
  - períodos de maior acesso.
- **Operação:** mínimo e máximo de atendimentos por dia, acessos no pico, datas de início e fim, serviços e métodos.
- **Finalização:** resumo e aceite do termo de uso (o gestor aceita).

Regras da faixa de IP (p. 18–19):

- vale o IP **público**, com um só par de campos, inicial e final;
- `0.0.0.0`, IP privado, inexistente ou fora do Brasil é bloqueado e pode levar à exclusão do acesso;
- o manual não diz se aceita IPv6.

## 5. Autenticação e envio

- **Token:** pedido ao Auth com **TLS mútuo** e o certificado da unidade. Vale 30 min e deve ser reaproveitado nesse prazo. O manual RAC mostra POST; o manual SA e as duas coleções do Postman mostram GET. Testar na homologação.
- **Headers no EHR:** `X-Authorization-Server: Bearer {token}`, `Authorization: {CNS do profissional}`, `Content-Type: application/json`.
- **Envio e substituição:** `POST /api/fhir/r4/Bundle`. O id da RNDS vem nos headers `Location` e `Content-Location` e é guardado para substituir o documento depois (nota técnica de exclusão e substituição em `rnds-oficial/ria/`).
- **`Bundle.timestamp`:** a data e hora do envio, não a da alta (erros EHR-ERR807 e 808).

## 6. Validação e evidência para produção

- **Validador local:** `rnds-oficial/validador/SOA-RNDS_ValidadorLocal_Aplicativo.zip` (65,7 MB).
  - É um aplicativo Java, sem assinatura conferível, montado em 2020 sobre o HAPI FHIR 5.1.0.
  - As definições por modelo estão em `sa/definicoes-validador-sa.zip` e `ria/definicoes-validador-ria.zip`.
  - Roda desde a 5C-5.2 (decisão do RT): num contêiner sem rede, só com documentos de teste, pelo `npm run fhir:validar` (ver `VALIDADOR.md`).
- **Evidência** (manual de apoio, p. 30–33; manual RAC §4.2): um único arquivo **PDF ou PNG de até 10 MB**, com três prints:
  - o validador local sem erro;
  - o header da resposta 201;
  - o Bundle enviado.

  Nenhum manual fala em número de cenários.

## 7. Divergências entre o código atual e o oficial

Detalhe em `rnds-manuais-oficiais.md`, seção 6. Resumo do que precisa mudar
antes da homologação (item I7). **Corrigido na 5C-5.2**, com o validador oficial; o que vale
hoje está em `VALIDADOR.md`. A lista fica como registro:

1. **Bundle:**
   - falta `fullUrl` em `urn:uuid`, e as referências são relativas;
   - leva Patient, Organization e Practitioner como entradas, que os exemplos oficiais não têm;
   - os recursos não têm `meta.profile`;
   - o `timestamp` vem errado (é a data da alta);
   - falta o `identifier`.
2. **Composition:**
   - `subject` e `author` devem ir por `identifier`, e o autor é a unidade (CNES);
   - falta `category`, que é obrigatória;
   - `encounter` é proibido.
3. **Seções:**
   - os títulos têm de seguir o perfil, com uma entrada por seção;
   - RAC e SA exigem ao menos um Procedure, e "Procedimentos" vazia com `emptyReason` é proibida;
   - no SA, a evolução vai num ClinicalImpression `BRResumoEvolucaoClinica`;
   - a prescrição aponta para a Composition de prescrição (RPM).
4. **Encounter:**
   - `class` com `BRModalidadeAssistencial`;
   - faltam `priority`, `hospitalization` (procedência e desfecho) e `diagnosis` com `BRFinanciamento`;
   - sem `type` nem `reasonCode` no SA;
   - o participante vai com identifier e CBO.
5. **Observation:** o system do LOINC é `https://loinc.org/`. Frequência cardíaca e temperatura não estão no ValueSet `BRTipoObservacao-1.0`.
6. **Organization:** o system do CNES é o perfil `BREstabelecimentoSaude-1.0`, não um CodeSystem inventado.
7. **Fixture:** o CBO tem 6 dígitos.

O que já está igual ao oficial:

- `Bundle.type` "document";
- os canônicos e os títulos de RAC e SA;
- `BRTipoDocumento`;
- os systems `BRIndividuo`, `BREstabelecimentoSaude` e `BRProfissional`;
- `BRCID10`, `BRTabelaSUS` e `BRCBO`.

Os materiais oficiais também divergem entre si:

- **Profissional:** o modelo do RAC pede CPF; o do SA, CNS; os exemplos RAC usam `BRLotacaoProfissional-1.0`.
- **Validador:** o do SA proíbe o `Encounter.type` que o RAC v2.0 usa para teleconsulta.
- **Exemplo do SA:** `exemplo-sa.json` tem referências quebradas.

Seguir o validador e confirmar por chamado.

## 8. Perguntas para o chamado no WEB Atendimento

1. Uma faixa de IP pode ser um IP só (inicial igual ao final)? Aceita IPv6?
2. Como trocar a faixa de IP ainda em homologação? E como trocar o certificado vencido?
3. Um fornecedor SaaS com várias unidades sem vínculo entre si: confirmar que é uma credencial por unidade, todas com o mesmo IP de saída.
4. O header `Authorization` aceita CPF do profissional, já que o comunicado prioriza o CPF?
5. RAC: qual perfil de profissional vale, `BRProfissional-1.0` com CPF ou `BRLotacaoProfissional-1.0` com CNS e CNES? E o token é GET ou POST?
6. Prazo de análise para RAC e SA.

## 9. Ordem de execução quando as credenciais chegarem

1. O gestor junta E1 a E4 e o Chefe Coruja preenche a parte técnica (seção 4).
2. Pedir homologação do RAC e do SA (e do RIA ou REL, se a unidade tiver).
3. Construir I2, I3 e I6 e corrigir I7, com teste contra o validador (I8).
4. Na homologação: token, envio, 201 e `Location`, substituição.
5. Montar a evidência (seção 6) e pedir produção.
6. Ligar o envio por unidade, com o painel "Fila da RNDS" (Plataformas) acompanhando pendentes e erros.
