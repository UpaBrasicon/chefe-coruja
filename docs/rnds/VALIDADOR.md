# Validador local oficial da RNDS

`npm run fhir:validar` confere os documentos gerados (RAC e Sumário de Alta)
com o validador local oficial da RNDS. Ele roda num contêiner **sem rede** e
recebe só documentos de teste (decisão do RT, 5C-5.2). Nada é enviado.

## Como funciona

- **O aplicativo oficial só tem tela.** O `SOA-RNDS_ValidadorLocal_Aplicativo.zip`
  abre uma janela (`ui.FhirValidacaoWindow`). O `main` de linha de comando dele
  tem caminhos fixos da máquina de quem o fez. O motor é público:
  `fhir.val.ExecutarValidacao.executar(definicoes, json, saida, detalhar, tela, resumir)`.
  `tools/rnds/validador/ValidarRnds.java` só chama esse motor, um arquivo por
  vez, e sai com 1 se algum falhar.
- **Arquivos oficiais fora do repositório.** O aplicativo e as definições
  ficam na pesquisa (`produto/docs/pesquisa/rnds-oficial/`). O script confere o
  SHA-256 registrado em `SHA256SUMS.txt` e só então extrai para
  `tools/rnds/.cache/`, que fica no `.gitignore`.
- **Definições usadas:** as do portfólio SA (`sa/definicoes-validador-sa.zip`,
  07/2026). Elas trazem os perfis do RAC e do SA, os CodeSystems e os ValueSets.
- **Contêiner:** `eclipse-temurin:17-jre`, fixado por digest
  (`sha256:4faa9eaf440514dd4f7ef71fecb92526e13679aea039bed5d2fc98e885c60dee`,
  baixado em 28/10/2026). Ele roda com `--network none`, `--read-only` e todas
  as pastas montadas só para leitura.

## Como usar

Precisa do Docker ligado e de um JDK no PATH (`javac`, para compilar a classe).

```bash
npm run fhir:validar
```

Sem argumentos, o script valida os snapshots de `scripts/interop/__snapshots__/`.
Para validar outro arquivo:

```bash
npm run fhir:validar -- --arquivo caminho/do/bundle.json
```

Se a pesquisa estiver em outro lugar, informe os zips em `RNDS_VALIDADOR_ZIP`
e `RNDS_DEFINICOES_ZIP`. O CI não roda o validador, porque não tem os
arquivos oficiais nem o Docker. O CI roda os testes de estrutura
(`scripts/interop/tests/bundles.test.ts`), que cobram as mesmas regras.

## Resultado (28/10/2026)

| Arquivo | Antes da 5.2 | Depois |
|---|---|---|
| `rac-alta-para-casa.json` | 46 erros | sem erro |
| `rac-com-evasao.json` | 37 erros | sem erro |
| `sumario-alta-para-casa.json` | 45 erros | sem erro |
| `sumario-alta-transferencia.json` | (novo) | sem erro |

Relatório em `docs/rnds/evidencia/5.2-validador.txt`.

Os exemplos oficiais também falham, por defeitos nos próprios dados:

| Exemplo | Erros |
|---|---|
| `exemplo_bundle_rac.json` | 12 |
| `exemplo_bundle_rac_teleconsulta.json` | 14 |
| `examplebundleBRegistroAtendimentoClinico_1990316558.json` | 12 |
| `exemplo-sa.json` | 45 |

Os erros dos exemplos do RAC vêm de três fontes:
- **Número de autorização:** o do procedimento (`AUTH`) não segue a máscara da regra `cmd-1`. Esse erro reprova o procedimento e, em cascata, o contato assistencial e as duas seções obrigatórias.
- **Código CATMAT:** o medicamento usa um código fora do CodeSystem.
- **Teleconsulta:** o exemplo traz `Encounter.type`, que o perfil proíbe.

O do SA tem JSON quebrado e referências soltas. Os exemplos servem de guia de
estrutura, mas a regra que vale é a do validador.

## Regras que o validador cobra (e os testes repetem)

- **Bundle:**
  - `document` com `identifier` (`bdl-9`), na forma `BRRNDS-{id do solicitante}`;
  - `timestamp` com a hora do envio;
  - entradas em `urn:uuid`, a Composition primeiro;
  - paciente, estabelecimento e profissional vão por `identifier`, não como entradas.
- **Composition:**
  - `category` com a modalidade;
  - sem `encounter`;
  - seções **sem título**: a base `BRConjuntoMinimoDados-1.1` o proíbe e recusa até os títulos fixos do perfil SA;
  - uma entrada por seção, sem `text` nem `emptyReason`.
- **Seções obrigatórias:**
  - contato assistencial e procedimento, nos dois documentos;
  - diagnóstico, no RAC;
  - resumo da evolução clínica (`ClinicalImpression`), no SA.
- **Encounter (`BRContatoAssistencial-1.0`):**
  - modalidade, caráter, procedência e desfecho;
  - o procedimento em `diagnosis`, com o financiamento;
  - o profissional por CPF, com o CBO;
  - sem `type` e sem `reasonCode`.
- **Codificações:** sem `display`, CID-10 sem ponto e LOINC em `https://loinc.org/`.
  As medidas aceitas são só as da lista `BRTipoObservacao-1.0`.
