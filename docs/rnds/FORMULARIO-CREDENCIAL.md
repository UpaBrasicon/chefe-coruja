# Formulário da credencial da RNDS: o que o gestor copia (5C-5.5a)

O pedido de credencial é feito pelo gestor no Portal de Serviços do DATASUS, um pedido por portfólio. A primeira leva é **RAC** e **Sumário de Alta** (decisão do RT, 5.5 "b a"). O MIRA espera a resposta do chamado (`CHAMADO-DATASUS.md`).

Campos conforme o manual de apoio, p. 9–24 (`docs/rnds/CHECKLIST.md`, seção 4). Os campos do **sistema** são iguais para todas as unidades. Os de **operação** saem dos números da unidade piloto (`volumes-unidade.sql`).

## Responsável (o gestor preenche)

- **Origem da solicitação:** Outros.
- **Certificado:** o `.pfx` (ou `.cer`) do certificado A1 da unidade: e-CNPJ da unidade ou e-CPF do gestor. É o mesmo que vai depois na aba RNDS, em Integrações.
- **Estabelecimento:** CNES (ou CNPJ), telefone e e-mail da unidade.
- **CNES filhos:** as outras unidades da mesma UF que usam a mesma credencial, se houver. Modelo de planilha: `produto/docs/pesquisa/rnds-oficial/ria/template-cnes-filhos.xlsx`.
- **Gestor:** CPF ou CNS cadastrado no CNES, com a conta gov.br.

## Sistema (igual para todas as unidades)

| Campo | Valor |
|---|---|
| Nome do sistema | Chefe Coruja |
| Versão | 0.1.0 |
| Linguagem | TypeScript (React 19 no navegador; Node.js 24 no serviço de envio) |
| Arquitetura | Aplicação web (SaaS). O navegador fala com o banco por API autenticada; o envio à RNDS sai de um serviço próprio num servidor com IP fixo, com TLS mútuo e o certificado da unidade |
| Banco de dados | PostgreSQL |
| Versão do banco | 17 |
| Aplicação web | Sim |
| Faixa de IP | inicial `179.199.128.141`, final `179.199.128.141` (IP fixo do servidor de envio; ver `CHECKLIST.md`, item I1) |
| Tipo de equipe | Equipe de desenvolvimento própria (empresa fornecedora do sistema) |
| Integrações com outros sistemas do Ministério | nenhuma em produção até o pedido; a RNDS é a primeira |

**Resumo (333 de 400 caracteres):**

> Chefe Coruja: prontuário eletrônico web para UPA e pronto-atendimento, com recepção, classificação de risco, atendimento médico e de enfermagem, observação, internação, regulação e faturamento SUS. Envia à RNDS o RAC, o Sumário de Alta e a regulação (MIRA) por um serviço próprio com IP fixo, TLS mútuo e o certificado A1 da unidade.

## Operação (da unidade piloto)

Preenchidos com o resultado de `volumes-unidade.sql`, rodado na produção para a unidade piloto. A consulta devolve só contagens, nenhum dado de paciente.

| Campo | De onde vem |
|---|---|
| Atendimentos já registrados e data da contagem | `atendimentos_registrados`, `contado_em` |
| Mínimo e máximo de atendimentos por dia | `atendimentos_dia_min`, `atendimentos_dia_max` (últimos 90 dias) |
| Acessos no horário de pico | `documentos_hora_pico`: o máximo de documentos (RAC e altas) numa hora, que é quantos envios à RNDS saem no pico |
| Períodos de maior acesso | `hora_de_pico` |
| Datas de início e fim | início: o dia do pedido; fim: em branco (sem prazo) |
| Serviços e métodos | `POST /api/fhir/r4/Bundle` (envio e substituição); token no EHR Auth (`/api/token`) |

## Finalização

O gestor confere o resumo e aceita o termo de uso.

## Depois da aprovação

O gestor guarda o **identificador do solicitante** e o informa na aba RNDS (Integrações → RNDS → Editar a credencial), com o certificado A1.
