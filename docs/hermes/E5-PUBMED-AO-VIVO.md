# E5: PubMed ao vivo quando o material não responde

Trilha Hermes / Evidências, tarefa 5. Decisão do RT de 12/11/2026: E5 = A (`docs/hermes/HERMES-EVIDENCIAS-DIAGNOSTICO.md`). Quando o material não responde, a tela mostra uma lista de artigos do PubMed ao vivo, com título, revista, ano, tipo e link pelo PMID, e o aviso de que vem de fora do material. O modelo não escreve resposta a partir dos artigos, e nada é guardado.

## Como funciona

**Biblioteca** (`biblioteca/app/pubmed.py` e `main.py`)
1. A lista entra em dois casos:
   - a busca não passou do corte ("Não encontrei"), ou
   - o modelo respondeu que o material não traz a resposta.
2. O modelo reescreve a pergunta como busca do PubMed em inglês, só os termos. A pergunta usada é a já pseudonimizada (E2). É uma chamada curta, e o uso entra na conta do E6.
3. Na busca (E-utilities da NCBI, sem chave):
   - entram diretrizes, consensos, revisões sistemáticas, metanálises e revisões dos últimos 10 anos;
   - em pergunta de criança, entra também o filtro de criança;
   - dos 15 mais relevantes, mostra 5: primeiro as diretrizes, depois os consensos, depois as revisões sistemáticas e metanálises, e por fim as revisões. Dentro do mesmo tipo, vale a relevância do PubMed.
4. Sai a linha `{"type":"pubmed","origem":"PubMed ao vivo","busca":…,"artigos":[…]}`, antes do `done`.
5. Sem cache e sem gravar no corpus.

Se a NCBI ou a tradução falharem, a tela fica só com o "Não encontrei", como antes. As cópias da biblioteca para o VPS (`biblioteca-sync.mjs` e `biblioteca-homolog.mjs`) passaram a levar o `pubmed.py`.

**Tela** (`RespostaIa`)
- Bloco "PubMed ao vivo, fora do material de referência".
- Logo abaixo: "Artigos para ler na fonte. A IA não resumiu nem conferiu o conteúdo."
- Cada artigo leva título com link, revista, ano e tipo.
- O bloco aparece só quando o material não respondeu (`mostrarPubmed`).

## Testes

- `biblioteca/app/test_pubmed.py`, 6 casos:
  - lista com tipo, ano e link;
  - filtro de criança;
  - NCBI fora;
  - tradução e pergunta fora do escopo;
  - diretriz e consenso primeiro, no máximo 5;
  - evento.
- `src/lib/respostaIa.test.ts`: `mostrarPubmed`.

## Homologação (13/11/2026)

**Pela Edge, com a conta de teste `medico.observacao.f5`, "tratamento da cetoacidose diabética no adulto"**, que o material não cobre: o modelo respondeu "Não encontrei" e vieram 5 artigos. Duas rodadas, porque a busca em inglês varia um pouco a cada pergunta:

| Rodada | Artigos |
|---|---|
| 1 | diretriz de manejo da CAD no adulto (2022); diretriz do EHH no adulto (2023); os dois relatórios de consenso de 2024 sobre crises hiperglicêmicas no adulto (Diabetologia e Diabetes Care); consenso de diabetes tipo 1 no adulto (2021) |
| 2 | diretriz de manejo da CAD no adulto (2022); diretriz ISPAD da CAD na criança (2020); três metanálises de 2022 a 2024 sobre solução balanceada versus soro fisiológico |

Na rodada 2 veio uma diretriz pediátrica numa pergunta de adulto. A pergunta de adulto não leva filtro de idade, só a de criança.

**Outros resultados:**
- A linha de uso (E6) não chega à tela.
- "Conduta na infecção por vírus Oropouche na gestante": o modelo respondeu em parte com o material, então a lista não aparece.

**Evals contra a homologação:**
- todas as metas atingidas em `perguntas-r2.yaml` e `perguntas-falhas.yaml`;
- em `perguntas.yaml`, a ferramenta esperada ficou em 89,5%, contra a meta de 90%. A pergunta nova reprovada foi "ventilação mecânica na SDRA volume corrente": a ferramenta `sdra-ventilacao-adulto` caiu do topo.

A causa da SDRA está na reescrita da pergunta, que o E5 não muda. Na produção, a reescrita foi "SDRA, ventilação mecânica protetora, volume corrente" e a ferramenta veio em 1º. Na homologação, depois de limpar a memória, ela escreveu o nome por extenso, e a ferramenta não entrou nas 3 primeiras. É a variação da reescrita feita pelo modelo, não desta mudança. Fica registrada.

## Fica de fora

- O resumo dos artigos pelo modelo (opção B), que o RT não escolheu.
- Uma chave da NCBI, que subiria o limite de 3 para 10 chamadas por segundo. Com o volume de hoje não faz falta.
