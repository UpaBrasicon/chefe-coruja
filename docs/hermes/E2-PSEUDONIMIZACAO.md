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

## 5a. Evidência na homologação (13/11/2026, com o ok do RT)

- Edge `clinical-search` publicada na homologação; biblioteca da branch no container `biblioteca-api-homolog` (`npm run biblioteca:homolog`, saúde 200, 212 ferramentas indexadas). No container da homologação, `nomes_proprios_estrito` existe e o NER está ativo; o da produção seguiu sem mudança.
- Sessão da conta de teste `medico.observacao.f5@teste.local` (UPA Fase 5 24h) por link mágico, sem senha:

| Pergunta | Resposta |
|---|---|
| "conduta na crise de asma grave no adulto" (ask) | 200, com 6 fontes citadas |
| "a Joana Pereira do leito 4 está em crise de asma, qual a conduta?" (ask) | 422, "A pergunta parece ter o nome de uma pessoa…" |
| "salbutamol" (search) | 200, sem consulta ao NER |

- `ia_gateway_log`: duas linhas com origem `edge:clinical_search`, uma enviada (sem substituições, latência 4,8 s) e uma bloqueada (`tipos_bloqueio` = 1 "nome próprio (NER)"), as duas com o hash em sha256 e sem texto.
- `clinical_search_logs`: a pergunta bloqueada ficou como "[não enviada]".
- Os logs do VPS mostram as chamadas (`/v1/deid` duas vezes, `/v1/ask` e `/v1/search`) no container da homologação, e nenhuma na API da produção. A Edge da homologação usa a biblioteca da homologação.
- O NER da produção está ativo (`NER_DESLIGADO` vazio, modelo carregado): a mudança não recusa as perguntas da produção.

## 5b. Produção (13/11/2026, com o "ok produção" do RT)

- Antes de publicar:
  - a imagem da API da produção ganhou a etiqueta `biblioteca-api:antes-e2-20261113`;
  - os arquivos foram guardados em `/root/biblioteca-antes-e2-20261113.tgz`, com `app/*.py`, `fontes.yaml`, `ferramentas.json`, o vocabulário, o corpus e as evals.
- `npm run biblioteca:sync`: imagem refeita e 232 ferramentas indexadas. Depois, `docker compose up -d api`.
- Conferido no VPS, dentro do container da produção, com a chave lida do próprio container e sem imprimi-la:
  - saúde 200, com 8.052 trechos;
  - `nomes_proprios_estrito` presente e NER ativo;
  - `/v1/deid` achou "Joana Pereira", com `ner_ativo: true`;
  - `/v1/ask` "conduta na crise de asma grave no adulto": 200, com 6 fontes.
- Edge `clinical-search` publicada na produção. Ela sobe sem erro e recusa quem não está logado (401 "não autenticado").
- A pergunta pela tela da produção fica para o RT, porque não há conta de teste na produção.

**Rollback da biblioteca:** `docker tag biblioteca-api:antes-e2-20261113 biblioteca-api:latest && docker compose up -d api`, e restaurar o `.tgz` se o corpus ou as ferramentas precisarem voltar.

## 6. Publicação

1. Edge `clinical-search` na homologação.
2. Biblioteca no container da homologação (`npm run biblioteca:homolog`, porta 8711).
3. Na homologação: uma pergunta limpa, uma com nome de pessoa e a linha em `ia_gateway_log`.
4. Com o "ok produção": guardar a imagem atual da API da produção com outra etiqueta, para o rollback; publicar a biblioteca da produção (`npm run biblioteca:sync`, que copia e reconstrói a imagem, e depois `docker compose up -d api`, porque o script não reinicia o container); publicar a Edge na produção.

**Rollback:** publicar de novo a Edge e a imagem da biblioteca do commit anterior.

## 7. Riscos

- **O NER da produção pode estar desligado.** Se `NER_DESLIGADO=1` ou o modelo spaCy não estiver na imagem, toda pergunta ao modelo passa a ser recusada com 503. Conferir pelo `/v1/deid` da produção (`ner_ativo`) antes de publicar.
- **Mais um passo no caminho.** Cada pergunta ao modelo ganha uma chamada ao `/v1/deid`, de 1 s ou menos, com limite de 8 s.
- **Falso positivo do NER.** Palavra que o NER toma por nome bloqueia a pergunta. O filtro de vocabulário clínico (decisão do RT de 15/10/2026) já reduz isso, e o 422 diz o que fazer.

## E2b: o histórico da busca simples guardava nomes (13/11/2026)

**Achado.** No teste do RT na homologação (conta `medico.upa.f5`), a pergunta à IA com "a Maria Souza está com asma" foi bloqueada, como deveria. Mas a busca simples da mesma tela gravou o texto inteiro em `clinical_search_logs`, com o nome. A busca simples não passava pelo NER, e a máscara do histórico só tira documentos, contatos, datas e os nomes cadastrados na unidade. Isso vinha de antes do E2. O texto não ia ao modelo, mas o nome ficava no banco.

**Correção, com o ok do RT:**
- a busca simples também consulta o `/v1/deid`, com limite de 3 s;
- o nome achado vira `[PESSOA]` antes de sair para a biblioteca e no histórico;
- sem o NER, a busca segue (não vai ao modelo), mas o histórico guarda "[não registrada]" no lugar do texto.

A pergunta ao modelo não muda.

**Testes:** 12 casos em `liberar.test.ts` (3 novos para a busca simples e 1 para `mascararNomes`).

**Homologação (13/11/2026):** Edge publicada e testada com a conta `medico.observacao.f5`, por link mágico. A busca "a Maria Souza está com asma" respondeu 200, e o histórico gravou "a [PESSOA] está com asma". A busca "broncoespasmo" respondeu 200 e foi gravada como está. A linha do teste do RT, de antes da correção, continua com o nome fictício.

**Fora desta correção:** as 67 linhas antigas de `clinical_search_logs` na produção (até 13/10/2026) não foram lidas, porque podem conter nome de paciente. Limpar ou não esse histórico é decisão do RT.
