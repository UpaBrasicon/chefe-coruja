# E3b: seções do Manual HCFMUSP na biblioteca

Trilha Hermes / Evidências. Achado do E3 (`docs/hermes/E3-INGESTAO-EVIDENCIA.md`). O RT pediu em 13/11/2026 para seguir os passos 1 (ajustar o leitor), 2 (reingerir na homologação e avaliar) e 3 (produção, com o "ok produção").

## 1. Leitor

O PDF do HCFMUSP, lido pelo `pymupdf4llm`:
- traz o capítulo como `# 13` e o nome dele na linha seguinte;
- traz os subtítulos como perguntas em maiúsculas ("COMO ESTRATIFICAR O RISCO DO PACIENTE DE SCA?"), às vezes com `#####` e às vezes sem;
- marca com `#####` também linhas de texto corrido.

O leitor antigo só aceitava `#` a `####`.

O leitor novo, `capitulo-numero` em `biblioteca/app/ingest.py`, vale só para o HCFMUSP, pelo campo `secoes: capitulo-numero` em `fontes.yaml`. O ICr e os outros PDFs seguem com o leitor antigo. A página sem título herda o capítulo e o último subtítulo, como no R2-14. Os testes estão em `biblioteca/app/test_ingest_secoes.py` (3 casos, rodados dentro do container da homologação).

## 2. Homologação (13/11/2026)

Reingestão só do HCFMUSP, na coleção `biblioteca_homolog` (`npm run biblioteca:homolog -- --ingerir-pdf=manual_hcfmusp_3ed_2022.pdf --avaliar`, das 01:53 às 03:00 UTC):

| | Produção (antes) | Homologação (depois) |
|---|---|---|
| Trechos do HCFMUSP | 1.467 | 1.947 |
| Trechos sem seção | 1.351 (92%) | 1 |
| Seções distintas | 116 | 834 |
| Trechos na coleção | 8.052 | 8.532 |

Há mais trechos porque o texto passou a ser cortado nos subtítulos, e cada trecho fica dentro de uma seção só.

**Evals contra a homologação:**

| Lista | Perguntas | Fonte esperada citada | Ferramenta esperada | Gate como esperado | p50 do 1º token |
|---|---|---|---|---|---|
| `perguntas-r2.yaml` | 31 | 100% (meta 85%) | — | 100% | 2,7 s |
| `perguntas.yaml` | 56 | 100% | 94,7% (meta 90%) | 100% | 2,5 s |
| `perguntas-falhas.yaml` | 81 | 95,2% | 97,1% | 100% | 2,5 s |

Nas três listas: nenhuma resposta sem citação, nenhuma citação inválida, nenhuma resposta vazia e nenhum erro. Todas as metas foram atingidas.

**As três perguntas reprovadas falham igual na produção, com a mesma busca.** São "preparo e dose de noradrenalina", "noradrenalina 0,1 mcg/kg/min em 80 kg, quantos ml/h" e "pancreatite aguda critérios de gravidade". Não vieram desta mudança. Os seis "cálculo suspeito" são perguntas-armadilha com peso do paciente, feitas para isso.

**Comparação lado a lado com a produção** (`/v1/ask`, mesma pergunta nas duas APIs):
- "terapia de reperfusão no IAM com supra de ST": as duas respondem com as mesmas metas de tempo. Na homologação, as fontes do HCFMUSP chegam com o capítulo e o subtítulo.
- "conduta na FA com instabilidade hemodinâmica": as duas dizem que o material não traz a conduta específica. Na homologação, as fontes vêm como "17 Fibrilação atrial — COMO EU TRATO A FA?".
- "tratamento da cetoacidose diabética no adulto": **as duas respondem "Não encontrei"**, embora o HCFMUSP tenha o capítulo 64 (Emergências hiperglicêmicas). A falha de busca já existia e não veio desta mudança. Fica registrada como achado à parte.

## 3. Produção

Só com o "ok produção":
1. guardar a etiqueta da imagem e um `.tgz` de `fontes.yaml` e `app/`;
2. `npm run biblioteca:sync` e depois `docker compose up -d api`;
3. reingerir só o HCFMUSP na coleção `biblioteca`, com `docker compose run --rm -T api python ingest.py manual_hcfmusp_3ed_2022.pdf`. Leva cerca de 1 hora.

Durante a reingestão, a busca da produção fica sem os trechos do HCFMUSP: a fonte é apagada antes de ser regravada. Por isso, fazer de madrugada.

**Rollback:** reingerir com o leitor antigo. Basta tirar `secoes` do `fontes.yaml` e rodar o mesmo comando.

**Feito em 13/11/2026, com o "ok produção" do RT:**
- versão anterior guardada: imagem `biblioteca-api:antes-e3b-20261113` e `/root/biblioteca-antes-e3b-20261113.tgz`;
- `biblioteca:sync` com 232 ferramentas indexadas; API reiniciada e saúde 200;
- reingestão das 03:14 às 04:08 UTC: `manual_hcfmusp_3ed_2022.pdf: 1947 chunks`, 8.532 trechos na coleção;
- conferido na coleção `biblioteca`: 1.947 trechos do HCFMUSP, 1 sem seção, 834 seções;
- `/v1/ask` na produção: "conduta na FA com instabilidade hemodinâmica" passou no corte, com a fonte "17 Fibrilação atrial — COMO EU TRATO A FA? p.245".

