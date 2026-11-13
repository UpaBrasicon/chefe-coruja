# E2: lacunas da pseudonimização no "Pergunte à IA"

Trilha Hermes / Evidências, tarefa 2. A decisão do RT, de 12/11/2026, foi E2 = A: fechar as cinco lacunas (`docs/hermes/HERMES-EVIDENCIAS-DIAGNOSTICO.md`).

## 1. Diagnóstico

O caminho de uma pergunta ao modelo era: Edge `clinical-search`, depois a biblioteca no VPS (`/v1/ask`), depois o DeepSeek. Havia cinco lacunas:

| # | Lacuna | Onde |
|---|---|---|
| L1 | A biblioteca chama o DeepSeek fora da porta única `chamarIA` do Hermes, e o caminho não deixava registro de gateway | `biblioteca/app/main.py` |
| L2 | O NER deixava passar quando falhava: sem o modelo spaCy, só a regex; com erro na chamada, `found` vinha vazio | `biblioteca/app/pii.py` |
| L3 | O `/v1/deid` respondia `ner_ativo: true` mesmo quando o NER tinha falhado naquela chamada | `biblioteca/app/main.py` |
| L4 | A Edge não usava o `/v1/deid` | `supabase/functions/clinical-search/index.ts` |
| L5 | Nenhum teste provava que a pergunta passa pela desidentificação antes de sair | — |

## 2. O que mudou

**Edge `clinical-search`**
- `liberar.ts`, novo: `liberarPergunta` é a única função que produz uma `PerguntaLiberada`. A chamada à biblioteca (`chamarBiblioteca`) só aceita esse tipo; o TypeScript recusa texto cru.
- A ordem é a mesma do `chamarIA` do Hermes:
  1. nomes conhecidos da unidade viram pseudônimos;
  2. sobrou resíduo com cara de identificador: bloqueia (422);
  3. no modo "ask", consulta o `/v1/deid`. Nome encontrado: bloqueia (422). NER fora do ar, sem o modelo carregado ou com resposta estranha: não sai (503).
- A busca simples (modo "search") não vai ao modelo e não consulta o NER, para cada tecla da busca não esperar.
- Cada pergunta ao modelo, enviada ou bloqueada, grava uma linha em `ia_gateway_log`, com origem `edge:clinical_search`, contagens por categoria, tipos do bloqueio e hash da entrada, nunca o texto. Isso fecha L1: o gateway do caminho clínico é a Edge (ADR 0006), e agora ele deixa o mesmo registro que o `chamarIA`.
- Pergunta bloqueada vai para `clinical_search_logs` como "[não enviada]", sem a versão mascarada.

**Biblioteca (VPS)**
- `pii.py`: `nomes_proprios_estrito` lança `NerIndisponivel` quando o modelo não está carregado ou o NER falha. `pseudonimizar(t, estrito=True)` usa essa função. A versão sem `estrito` continua deixando passar e serve à busca simples.
- `/v1/ask`: usa a versão estrita; sem NER responde 503 e não chama o modelo, nem para reescrever a pergunta.
- `/v1/deid`: se o NER falhar, responde `ner_ativo: false`, e o chamador não envia. Vale também para o Hermes, que já tratava `ner_ativo` diferente de true como indisponível.

## 3. Banco

Sem migration: `ia_gateway_log` (migrations `20260926000002` e `20261022000009`) já tem as colunas, e o serviço escreve com a chave de serviço.

## 4. Testes

- `supabase/functions/clinical-search/liberar.test.ts`, 9 casos, no CI:
  - pergunta limpa sai;
  - nome conhecido vira pseudônimo e não chega ao NER;
  - resíduo bloqueia antes do NER;
  - nome achado pelo NER bloqueia;
  - NER inativo, fora do ar, com tempo esgotado ou com resposta estranha: não sai;
  - a busca simples não consulta o NER;
  - pseudônimo e nome do sistema não contam como nome;
  - o hash não contém o texto.
- `biblioteca/app/test_pii.py`: 3 casos novos (sem o modelo, a versão estrita lança e a simples segue; NER que falha lança; com o modelo, mascara). Rodam com `BIBLIOTECA_DIR=.. python -m unittest test_pii`. Os 8 casos do arquivo passaram.

## 5. Critérios de aceite e evidência

| Critério do BACKLOG | Evidência |
|---|---|
| Nenhum prompt chega ao modelo sem passar pela função | Tipo `PerguntaLiberada` na Edge, `liberar.test.ts`, e a biblioteca recusa o `/v1/ask` sem NER (`test_pii.py`) |
| Auditar o que foi pseudonimizado, sem o original | Linhas de `ia_gateway_log` com origem `edge:clinical_search`, conferidas na homologação |

## 6. Publicação

1. Edge `clinical-search` na homologação.
2. Biblioteca no container da homologação (`npm run biblioteca:homolog`, porta 8711).
3. Na homologação: uma pergunta limpa, uma com nome de pessoa e a linha em `ia_gateway_log`.
4. Com o "ok produção": a Edge na produção e a biblioteca da produção (`npm run biblioteca:sync`).

**Rollback:** publicar de novo a Edge e a imagem da biblioteca do commit anterior.

## 7. Riscos

- **O NER da produção pode estar desligado.** Se `NER_DESLIGADO=1` ou o modelo spaCy não estiver na imagem, toda pergunta ao modelo passa a ser recusada com 503. Conferir pelo `/v1/deid` da produção (`ner_ativo`) antes de publicar.
- **Mais um passo no caminho.** Cada pergunta ao modelo ganha uma chamada ao `/v1/deid`, de 1 s ou menos, com limite de 8 s.
- **Falso positivo do NER.** Palavra que o NER toma por nome bloqueia a pergunta. O filtro de vocabulário clínico (decisão do RT de 15/10/2026) já reduz isso, e o 422 diz o que fazer.
