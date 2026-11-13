# Trilha Hermes / Evidências (RAG clínico): diagnóstico

**Pedido.** RT, 12/11/2026: depois do pedido 8, seguir para o diagnóstico da "Trilha Paralela — Hermes / Evidências (RAG clínico)" do `BACKLOG.md`. A tabela da trilha tem seis tarefas e nenhuma tem estado registrado.

**Escopo.** Só diagnóstico. Nenhum código, migration, serviço ou segredo muda aqui. Levantamento no código do master e no banco da homologação, em 12/11/2026. O VPS não foi acessado.

## Resumo

A busca clínica com citação ("Pergunte à IA" do plantonista) já existe e está em uso desde o Portão 2 (outubro de 2026). Mas foi construída com outra arquitetura, diferente da que a trilha descreve:

| | O que o BACKLOG planeja | O que existe |
|---|---|---|
| Onde fica o corpus | Supabase, tabelas `evidence_sources` e `evidence_chunks` com pgvector | Qdrant no VPS do Hermes, coleção `biblioteca` (`biblioteca/app/ingest.py:44-50`) |
| Embeddings | não definido | Ollama `bge-m3`, local no VPS (sem custo de API) |
| Modelo de linguagem | não definido | DeepSeek (`DEEPSEEK_MODEL`, padrão `deepseek-v4-flash`, `biblioteca/app/main.py:39`) |
| Separação por cliente | RLS com `tenant_id` | filtro no código: trechos `global` ou da unidade (`main.py:104-107`) |
| Registro das fontes | coluna de licenciamento | `biblioteca/fontes.yaml` (título, editor, ano, licença, público, `tenant_id`) |

No banco da homologação não há a extensão `vector` nem coluna de embedding. Existem só `clinical_search_logs`, `clinical_search_feedback` e as tabelas do Hermes (`hermes_almanaque`, `hermes_resumo_unidade` e outras). A homologação usa a biblioteca da produção (`BACKLOG.md`, Portão 2).

O caminho de uma pergunta é:
1. A Edge `clinical-search` confere login, vínculo com a unidade e o limite de 30 perguntas por hora.
2. A Edge desidentifica a pergunta e recusa com 422 se sobrar identificação.
3. A biblioteca (`/v1/search` ou `/v1/ask`) faz uma busca híbrida, reescreve a pergunta e filtra pelo público (criança só com fonte pediátrica).
4. A resposta volta com as fontes citadas, com página.

## Estado por tarefa

| # | Tarefa | Estado | O que existe | O que falta para o critério de aceite |
|---|---|---|---|---|
| 1 | Schema e RLS do corpus | Parcial, em outra arquitetura | Coleção Qdrant com índices de `tenant_id`, `fonte_id` e `texto`; filtro global ou unidade; `fontes.yaml` | Não há teste que prove que a unidade A não lê trecho da unidade B. Hoje todas as fontes são `global`, então o risco é teórico |
| 2 | Pseudonimização obrigatória | Existe, com lacunas | Módulo `desidentificacao.ts` (Hermes e cópia em `supabase/functions/_shared/`, conferidas iguais por `scripts/gateway/copia.test.ts`); porta única `chamarIA` do Hermes com regex, NER obrigatório e falha fechada, auditada em `ia_gateway_log`; na busca clínica, a Edge desidentifica com os nomes da unidade e recusa com 422 o que sobrar (`clinical-search/index.ts:112-122`); a biblioteca pseudonimiza de novo (`pii.py`) | Ver "Lacunas da pseudonimização" abaixo |
| 3 | Ingestão dos 2 livros | Feita, a confirmar no VPS | `ingest.py` lê o PDF página a página, guarda capítulo, título e página (`secao_do_livro`), corta por título e em janelas de 380 palavras; a reingestão apaga a fonte e regrava com identificadores fixos, sem duplicar. Os dois livros estão em `fontes.yaml:100-115`. O R2-14 do Portão 2 corrigiu a seção herdada dos trechos do ICr, o que mostra que a ingestão rodou | Contagem de trechos por fonte no VPS. O `biblioteca/README.md` ainda diz que a ingestão dos livros "ficou para o usuário", o que não bate com o `fontes.yaml` |
| 4 | Busca e citações rastreáveis | Parcial | Fontes com título, editor, ano, seção, página e link; a tela mostra só as fontes citadas, com "p. N" (`RespostaIa.tsx`); logs e avaliação por gestor e admin | A resposta não devolve o identificador do trecho (as fontes são numeradas 1, 2, 3). A confiança é um corte só, passa ou não passa (`passa_gate`, 0,50 com palavra em comum e 0,58 sem). Não há alta, moderada ou baixa, nem aviso de fontes que divergem |
| 5 | PubMed sob demanda | Não existe | Nenhuma chamada ao PubMed em tempo de uso. O PubMed só aparece na revisão manual das ferramentas | Tudo |
| 6 | Operação | Parcial | `hermes-resumos` no pg_cron a cada 15 min (fotografia da unidade); relatório semanal do gestor (Gavião) pela fila do Hermes e pelo Nous, não pelo pg_cron; uso de tokens lido no Hermes (`llm.ts`) | Custo mensal conhecido: a busca clínica não registra modelo nem tokens, e nada soma o custo do DeepSeek |

### Lacunas da pseudonimização (tarefa 2)

1. **A biblioteca chama o DeepSeek direto** (`main.py:30`), fora da porta única `chamarIA` do Hermes. A regra do BACKLOG ("a chamada é obrigatória no pipeline") é cumprida pela Edge, que desidentifica antes de enviar, mas a auditoria fica pela metade.
2. **O NER da biblioteca deixa passar se falhar.** Sem o modelo spaCy, ou com `NER_DESLIGADO=1`, fica só a regex (`pii.py:5-10, 28-32`). No caminho clínico, a Edge já recusou o que a regex e os nomes da unidade pegaram. Um nome de pessoa fora da lista da unidade, escrito em texto corrido, pode passar.
3. **A Edge não usa o `/v1/deid`**, o NER que a própria biblioteca expõe para os gateways.
4. **O caminho clínico não grava em `ia_gateway_log`.** Grava só a pergunta mascarada em `clinical_search_logs`, sem a contagem do que foi substituído.
5. **Nenhum teste prova** que o caminho clínico sempre passa pela função.

## Achado fora das tarefas: licença dos livros

Os dois livros são obras comerciais da Manole, sem licença de uso (`licenca: "sem-licenca"` em `fontes.yaml`). Eles foram registrados pela decisão do RT de 28/09/2026, que retirou a regra R4 da biblioteca. Para o uso de hoje, numa rede só, a decisão é do RT. **Antes de vender o produto a outra rede, isso precisa de decisão**, porque trechos dos livros aparecem na tela de usuários de outro cliente. Ver a decisão E7.

## Decisões para o RT

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| E1 | Arquitetura do corpus | **A.** Fica o Qdrant no VPS, como está. O BACKLOG passa a descrever o que existe, e a tarefa 1 fecha com o teste de separação por unidade. **B.** Migrar o corpus para pgvector no Supabase, como o BACKLOG planejou | **A.** O Qdrant funciona desde outubro, os embeddings são locais e sem custo, e não pesa no banco compartilhado. Migrar refaz a busca inteira sem ganho para o plantonista |
| E2 | Lacunas da pseudonimização | **A.** Fechar as cinco: a biblioteca recusa a pergunta quando o NER não está disponível; a Edge chama o `/v1/deid` antes de enviar; o caminho clínico registra a contagem do que foi substituído, sem o original; teste que prova o caminho. **B.** Só o teste e o registro | **A.** É a regra de IA do BACKLOG e é segurança de dado de paciente |
| E3 | Ingestão | **A.** Conferir no VPS a contagem de trechos de cada livro, registrar a evidência e corrigir o README. **B.** Reingerir os livros com hash por trecho | **A.** Os identificadores fixos já evitam duplicar; o hash por trecho não muda nada para quem usa |
| E4 | Confiança e identificador do trecho | **A.** A resposta passa a devolver o identificador de cada trecho, e a confiança passa a ter três níveis: alta com dois ou mais trechos de fontes diferentes acima do corte, moderada com uma fonte só, baixa abaixo do corte (não responde, como hoje). A tela mostra o nível. **B.** Só o identificador | **A**, com os números do corte de hoje. O aviso de fontes que divergem fica para depois, porque pede uma segunda leitura pelo modelo |
| E5 | PubMed quando o corpus não responde | **A.** Lista de artigos do PubMed ao vivo (título, revista, ano, link pelo PMID), com o aviso "PubMed ao vivo, fora do corpus", sem resposta escrita pelo modelo e sem guardar nada. **B.** O modelo resume os resumos dos artigos. **C.** Não fazer | **A.** O plantonista ganha caminho quando o corpus não tem a resposta, e o modelo não escreve conduta a partir de resumo em inglês |
| E6 | Operação | **A.** O relatório semanal fica no Hermes, como está, e o BACKLOG registra isso. A busca clínica passa a guardar modelo e tokens em `clinical_search_logs` (migration expand), e o painel do admin mostra o custo do mês. **B.** Mover o relatório para o pg_cron | **A.** O relatório já roda; o que falta é saber o custo |
| E7 | Livros sem licença, antes de vender a outra rede | **A.** Os trechos dos livros ficam só para a rede atual (`tenant_id` da rede em vez de `global`) até haver licença. **B.** Pedir licença à Manole. **C.** Manter como está | Decisão do RT. O código de A é pequeno: muda o `tenant_id` no `fontes.yaml` e reingere |

**Decisão do RT em 12/11/2026:** E1 a E6 = A, as recomendações ("Aceito E1–E6"). A E7 fica em aberto, com o RT.

## Ordem de implementação

1. **E2**, segurança. Mudança na biblioteca (VPS) e na Edge `clinical-search`, com teste. Sem migration, exceto se a contagem for para uma tabela nova.
2. **E3**, só conferência e documento.
3. **E1**, teste de separação por unidade e texto do BACKLOG.
4. **E4**, biblioteca, tela da resposta e testes.
5. **E6**, migration expand em `clinical_search_logs`, a biblioteca devolvendo os tokens e o cartão de custo no painel do admin.
6. **E5**, rota nova na biblioteca e bloco novo na tela.

Cada item vai em branch e PR próprios, pela homologação. A biblioteca roda no VPS e serve a homologação e a produção juntas. **Toda mudança na biblioteca chega às duas ao mesmo tempo**, então pede o "ok produção" antes de ser publicada no VPS, com o rollback escrito (voltar a imagem anterior do Docker Compose).

## Riscos

- **Biblioteca única para os dois ambientes.** Não há biblioteca de homologação. Um erro publicado no VPS chega ao plantonista na hora. Mitigação: subir a versão nova numa porta separada do VPS, testar pela homologação apontando para ela e só então trocar.
- **Fechar o NER sem cuidado bloqueia o plantão.** Se o modelo spaCy cair, toda pergunta passa a ser recusada. A mensagem tem de dizer que a busca está indisponível, e o aviso tem de chegar ao admin.
- **PubMed (E5).** A NCBI limita as chamadas sem chave a 3 por segundo, e a resposta vem em inglês.

## Como demonstrar comercialmente

"Pergunte à IA" com a fonte e a página de cada afirmação, o nível de confiança visível e a garantia de que a pergunta não sai com identificação do paciente, com o registro do que foi mascarado. A comparação com os concorrentes fica na matriz competitiva da Fase 1, sem afirmação nova aqui.
