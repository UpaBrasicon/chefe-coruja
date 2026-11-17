# LG4: inventário das operações de tratamento (diagnóstico, 17/11/2026)

Trilha de obrigatórios legais e regulatórios, item LG4 (P1). Base legal: LGPD, art. 37. Controlador e operador mantêm registro das operações de tratamento: que dado, para quê, onde fica, quem acessa e por quanto tempo.

**Decisão do RT, 17/11/2026: "Todas A"** (V1–V4).

**Feito:** o inventário ficou em `docs/regulatorio/inventario/operacoes.json`. O formato é JSON, e não YAML, porque o projeto não tem leitor de YAML e não vale trazer dependência nova só para isso. O documento legível é `LG4-INVENTARIO.md`.

Este documento não é parecer jurídico e não muda código nem banco.

## Como está hoje

- **Banco:** 298 tabelas na homologação, que tem o mesmo esquema da produção, em quatro esquemas:

  | Esquema | Tabelas |
  |---|---|
  | `public` | 257 |
  | `private` | 28 |
  | `terminologia` | 9 |
  | `e2e` | 4 |

  - 81 tabelas se ligam a um paciente (`paciente_id`) ou guardam documento (CPF ou CNS).
  - 84 guardam o autor ou o profissional.
  - 60 têm texto livre.
  - Cerca de 120 não têm dado pessoal aparente: catálogos, terminologias, configuração.
- **Prazos de guarda que existem:**
  - prontuário por 20 anos, no cofre com Object Lock (Lei 13.787/2018);
  - texto escrito para a IA apagado em 30 dias (LG6, I3);
  - backup do VPS por 14 dias.
  - Nenhuma outra tabela tem prazo nem rotina de descarte.
- **Documentos que ajudam:**
  - `produto/docs/seguranca-lgpd.md`, com fornecedores e controles;
  - Apêndice A do anexo de operador (LG1), com a lista de suboperadores;
  - RIPD da plataforma (LG3), com os riscos.
  - Nenhum deles lista as operações de tratamento com tabela, finalidade e prazo.
- **Registro de acesso:** `log_acesso_prontuario` e `private.acessos_historico` guardam quem abriu qual prontuário. A guarda de 6 meses pedida pelo Marco Civil (art. 15) é o LG9.

## O que a norma pede (leitura técnica)

Para cada operação de tratamento, o registro precisa dizer:
1. a finalidade;
2. a base legal;
3. as categorias de titulares e de dados, marcando o dado sensível;
4. quem acessa: papéis e suboperadores;
5. onde fica, incluindo transferência internacional;
6. o prazo de guarda e a forma de descarte;
7. as medidas de segurança.

A ANPD pode pedir esse registro a qualquer momento. O cliente controlador também pede a parte que lhe cabe, para montar o RIPD dele.

## Decisões para o RT

**V1. Formato**
- **A (recomendada):** um arquivo versionado no repositório, `docs/regulatorio/inventario/operacoes.yaml`.
  - Cada operação traz finalidade, base, titulares, dados, papéis, local, prazo e as tabelas dela.
  - Um script gera o documento legível (`LG4-INVENTARIO.md`) para o advogado e o cliente.
- **B:** uma planilha mantida à mão.

**V2. Granularidade**
- **A (recomendada):** por operação de tratamento, cerca de 25 grupos. Exemplos:
  - cadastro de paciente;
  - recepção e classificação;
  - atendimento e evolução;
  - prescrição e administração;
  - internação e leitos;
  - regulação;
  - UBS e programas;
  - exames;
  - documentos e anexos;
  - faturamento;
  - escala e presença;
  - login e acesso;
  - auditoria;
  - apoio por IA;
  - RNDS;
  - comunicação;
  - site comercial.

  Cada grupo lista as suas tabelas.
- **B:** tabela por tabela. São 298 linhas, difíceis de ler.

**V3. Prazos de guarda** (proposta técnica; o advogado confirma)
- **A (recomendada):**

  | Dado | Prazo | Base |
  |---|---|---|
  | Prontuário e o que o compõe (atendimento, prescrição, exames, documentos, internação) | 20 anos | Lei 13.787/2018 |
  | Auditoria e registro de acesso ao prontuário | 20 anos | integridade do prontuário. O mínimo de 6 meses do Marco Civil fica coberto |
  | Escala, presença e remuneração | 5 anos | prazo trabalhista |
  | Faturamento (AIH, APAC, BPA, contas) | 5 anos | prazo fiscal |
  | Texto escrito para a IA | 30 dias | já em vigor |
  | Contato pelo site e demonstração | 2 anos | legítimo interesse |

  Depois do prazo, o descarte é feito por rotina com registro.
- **B:** só registrar o prazo agora e decidir o descarte depois, com o advogado.

**V4. Guarda no CI**
- **A (recomendada):** um teste falha se aparecer tabela nova no banco que não está em nenhuma operação do inventário. É como o gate do LG10: o inventário não fica velho.
- **B:** sem guarda; revisão manual a cada trimestre.

## Plano depois das decisões

1. Montar o `operacoes.yaml` com os cerca de 25 grupos e as 298 tabelas classificadas, e o script que gera o documento.
2. Com V4 = A, um teste no CI: tabela nova sem classificação faz o CI falhar.
3. Juntar o resultado ao RIPD (LG3) e ao anexo de operador (LG1): a parte de cada cliente.
4. Descarte por prazo: fica para depois do advogado (V3). Cada rotina passa pelo fluxo de sempre: homologação, CI e "ok produção".
