# Revisão das telas do plantonista — pedidos do RT em 27/10/2026

Diagnóstico dos 16 pontos que o RT levantou ao rever as telas do plantonista (Central do
Plantonista, Plantão e Internação). Mesmo formato da revisão do farmacêutico
(`docs/farmacia/REVISAO-FARMACEUTICO-2026-10.md`).

Fontes do diagnóstico:

- código do `master` em 27/10/2026 (commit `19a3354`): `src/pages/plantonista/`, `src/pages/plantao/`,
  `src/content/`, `src/components/internacao/`, `src/components/evolucao/`,
  `src/components/prescricao/`, `src/App.tsx`, `supabase/functions/clinical-search/` e
  `biblioteca/app/` (a API da busca no VPS);
- migrations em `supabase/migrations/`;
- homologação (`kswurfyxxvfydpjfrivy`), só metadados e números: colunas, a tabela
  `clinical_search_logs` (tempo e situação de cada pergunta, sem o texto) e os logs das Edge
  Functions. Nenhum dado de paciente;
- produção, só para o ponto 1 e com o ok do RT em 27/10: os tempos do `clinical_search_logs`
  (sem o texto) e os tempos do log da biblioteca e do Ollama no VPS;
- tempo de resposta do endereço público da biblioteca de homologação (`/homolog/health`);
- PubMed, para o ponto 15.

**Nada foi alterado no código nem no banco.** Este documento é proposta. Nenhum dos 16 pontos está no
`BACKLOG.md` hoje: cada um precisa da decisão do RT (entra ou não, com prioridade e fase) antes de
qualquer código.

## Resumo

Tipo: **bug** (algo que deveria funcionar e não funciona), **ajuste** (tela ou navegação, sem regra
nova) ou **nova** (funcionalidade ou regra nova).

| Ponto | O que o RT pediu | Diagnóstico em uma linha | Tipo | Prioridade sugerida |
|---|---|---|---|---|
| 1 | "Perguntar à IA" lento (mais de 30 s) | **Medido:** o modelo de busca do VPS sai da memória depois de 24 h sem pergunta, e voltar leva de 41 a 60 s ou mais; acima de 60 s a pergunta dá erro 500 (6 vezes na produção, 1 hoje na homologação). Depois vêm cerca de 10 s da reescrita pela IA | bug | P1 |
| 2 | Tirar "Ventilação mecânica — ajuste inicial" | É uma cópia: o mesmo conteúdo aparece em Emergências ("… ajuste inicial (adulto)") e em Ventilação Mecânica | ajuste | P2 |
| 3 | Check-in duplicado | O check-in já abre sozinho pela casca e pela faixa "Meu plantão"; o cartão "Meu plantão" em "Seções do plantão" repete | ajuste | P2 |
| 4 | Trocar "Atendimento na porta" por "Atendimento" | O cartão leva a 4 formulários soltos; o atendimento de verdade é a fila do PS (`/atendimento`) | ajuste | P2 |
| 5 | Internação mostra só os internados | Hoje abre uma página com 3 cartões. **Achado:** a "Impressão de prontuário" só se abre por esse cartão; tirar o cartão sem dar outro lugar a deixa sem entrada | ajuste | P2 |
| 6 | Resumo do leito em abas: pendências, histórico, regulações | Tudo está numa coluna só, em 9 blocos | ajuste | P2 |
| 7 | "Passar este paciente" e "Registrar intercorrência" junto de "Transferir de setor" | Os três estão em lugares diferentes. **Achado:** "Transferir de setor" aparece também para o gestor e para internação encerrada | ajuste + bug leve | P2 |
| 8 | Tirar a aba Classificação | A aba só lê a classificação da porta; serve também ao gestor | ajuste | P2 |
| 9 | Diagnóstico dentro de Evolução; "Evolução médica" não cria | A escrita exige plantão agora no **setor atual** da internação. Quando falta, a tela só mostra um texto, sem dizer o motivo. Também: depois da 1ª do dia, o formulário some e vira "corrigir" ou "complemento" | bug (tela) + ajuste | P1 |
| 10 | Admissão única ou que muda com o quadro | Uma por internação, garantida só pela função (o banco não tem trava). A correção existe no banco mas não na tela, e a correção não atualiza a ficha | nova (modelo) + bug leve | P2 |
| 11 | Busca de medicamento do "+ novo item" fraca, não adiciona | O clique escolhe o remédio, mas o item só entra com dose, via e frequência e com **peso deste atendimento gravado**. O campo "Peso (kg)" do leito não grava peso nenhum. A busca é só pelo princípio ativo, sem ordem por relevância, sem aviso de erro | bug + ajuste | P1 |
| 12 | Exame laboratorial separado de imagem e ECG | No leito, tudo vai num pedido só, em texto livre. Na porta já sai uma folha por serviço, mas ainda é um documento só | nova (regra) | P1 |
| 13 | Encaminhamento para outra unidade | O leito só encaminha dentro da unidade (5 serviços). O encaminhamento para fora existe só na porta | nova | P2 |
| 14 | Atestado dentro do leito | O botão do leito leva para a tela da porta, fora do leito, e o atestado sai sem ligação com a internação | ajuste | P2 (junto do 16) |
| 15 | Parecer, Termo de consentimento e Termo de cuidados paliativos em abas próprias | Parecer e termo de consentimento existem, juntos com escalas de enfermagem. Não há termo nem escala de cuidados paliativos | ajuste + nova | P2 |
| 16 | Alta com receita para casa, atestado e orientações | A aba tem a alta e o pacote de orientações. Não tem receita para casa, atestado nem sumário de alta escritos ali | nova | P1 |

---

## Central do plantonista

### Ponto 1 — "Perguntar à IA" está lento (mais de 30 s)

> **Aplicado em 27/10/2026, com "ok produção" do RT (PR #301).** O modelo de busca fica sempre
> carregado. Depois da mudança, a pergunta completa levou 4,3–6,0 s na homologação e 6,6 s na
> produção. Medição e reversão em `infra/biblioteca-ollama-quente.md`. O diagnóstico abaixo é o de antes
> da mudança.

**Onde está.**

- Tela: `src/pages/plantonista/PlantonistaHome.tsx:265` (botão) e `src/components/plantonista/RespostaIa.tsx`.
- Chamada: `src/lib/useClinicalAsk.ts:91-96` → Edge Function `clinical-search`
  (`supabase/functions/clinical-search/index.ts`) → API "biblioteca" no VPS
  (`biblioteca/app/main.py`, `/v1/ask`).

**O caminho de uma pergunta, em ordem (tudo em série).**

| Etapa | Onde | Limite de tempo no código |
|---|---|---|
| a. Navegador → Supabase (e "aquecimento" da função, quando parada) | Edge Function | — (1,3 s medido no aquecimento de hoje) |
| b. Confere login, vínculo e o limite de 30 perguntas por hora: 3 idas ao banco | `index.ts:79`, `:98`, `:106` | — |
| c. Carrega **todos** os nomes de pacientes ativos da unidade (até 20 mil), dos profissionais e do usuário, para tirar nome da pergunta | `index.ts:37-62`, `:113` | — |
| d. Supabase → VPS | `index.ts:127-136` | 120 s |
| e. Reescrita da pergunta pela IA (DeepSeek) nos termos do manual | `main.py:129-153`, `:398` | 8 s |
| f. Duas buscas por significado: o modelo bge-m3 no próprio VPS (Ollama) transforma a pergunta e a reescrita em números | `main.py:76-83`, `:158` | 60 s cada |
| g. Busca no Qdrant: ferramentas, trechos e palavras-chave | `main.py:159-185` | 30 s |
| h. Resposta escrita pela IA, que aparece aos poucos na tela | `main.py:456-470` | até 3.000 "pedaços de texto" (`LLM_MAX_TOKENS`) |

**O que foi medido (27/10/2026, com o ok do RT para ler só os tempos, sem o texto das perguntas).**

- Rede: do computador até o VPS da biblioteca, 0,1 s por pedido (3 medições no `/homolog/health`). A
  rede não é o problema.
- `clinical_search_logs.latency_ms` mede da entrada na Edge Function até o VPS começar a responder
  (etapas b a g, sem a h):

  | Ambiente | Perguntas "ask" | Com resposta | Metade abaixo de | 9 em 10 abaixo de | Erro por tempo |
  |---|---|---|---|---|---|
  | Produção, 28/09 a 14/10 (nenhuma pergunta depois de 14/10) | 32 | 25 | 1,2 s | 42,7 s | 6 com erro 500 entre 60,7 e 62,1 s |
  | Homologação, 13/10 a 27/10 | 34 | 31 | 1,0 s | 3,4 s | 1 com erro 500 em 67,9 s (27/10, 21h49) |

  Na produção, a busca sem IA ("search", as sugestões enquanto se digita) teve 9 erros 503 entre 45,2 e
  46,3 s: é o limite de 45 s da Edge Function (`index.ts:131`) estourando pelo mesmo motivo.
- Log da biblioteca no VPS (contêineres reiniciados em 23/10, 19h35 UTC; só tempos):
  - **Modelo de busca (Ollama, bge-m3):** em 7 dias houve 3 cargas do modelo e 3 pedidos de busca. Os
    três demoraram **41,2 s, 43,8 s e 60 s** (o de 60 s foi cortado). Agora o modelo não está na
    memória (`ollama ps` vazio). O Ollama está com `OLLAMA_KEEP_ALIVE=30m` e o VPS tem 2 processadores.
  - **Pergunta de hoje com erro 500:** às 00h48 UTC (21h48 de Brasília) o Ollama começou a carregar o
    modelo; a API estourou o limite de 60 s em `embed` (`main.py:79`, chamado de `buscar`, `main.py:158`):
    `httpx.ReadTimeout: timed out`.
  - **Pergunta de hoje que respondeu (homologação):** reescrita 9,9 s; busca até 20,9 s; 1º trecho da
    resposta em 21,7 s; fim em 22,9 s.
  - Na produção, o log desde 23/10 só tem pedidos do Hermes (`/v1/deid`); nenhuma pergunta do app.
- Memória do VPS: 5,5 GB livres de 7,9 GB; o Ollama usa 153 MB agora (modelo fora), com limite de 3,4 GB.
  Há espaço para deixar o modelo sempre carregado.

**Causa (confirmada pelos tempos).**

1. **O modelo de busca sai da memória quando ninguém pergunta, e voltar leva de 41 a 60 s ou mais.**
   A API pede ao Ollama que guarde o modelo por 24 h depois de cada busca (`main.py:80`; a variável
   `OLLAMA_KEEP_ALIVE` não está definida nos contêineres da API). Passado um dia sem pergunta, o
   modelo sai, e a 1ª pergunta seguinte espera a carga. Com 2 processadores, a carga
   passa do limite de 60 s da busca e a pergunta termina em erro; quando fica abaixo, a resposta demora
   40 s ou mais. Como o app é pouco usado hoje, quase toda pergunta pega o modelo frio. Homologação e
   produção usam **o mesmo** Ollama.
2. **A reescrita pela IA (DeepSeek) leva cerca de 10 s**, em série, antes de a busca começar (o limite
   do código é 8 s, `main.py:54`, e passou um pouco).
3. **Busca com o modelo carregado: cerca de 11 s** na pergunta de hoje, logo depois da carga. Precisa de
   nova medida com o modelo quente.
4. A etapa c (nomes da unidade) não apareceu como problema nos números; fica como risco quando a
   unidade crescer.

**Proposta.**

- **Primeiro (só configuração do VPS, sem código do app):** deixar o modelo sempre na memória
  (`OLLAMA_KEEP_ALIVE=-1` no `biblioteca/docker-compose.yml` e `keep_alive: -1` em `main.py:80`) e um
  aviso a cada 10 minutos pelo cron do VPS, que recarrega o modelo se o Ollama reiniciar. Atenção:
  homologação e produção dividem o Ollama, então isso vale para as duas ao mesmo tempo; precisa do "ok
  produção". Reverter: voltar o `30m` e tirar o cron.
- Depois, medir de novo com o modelo quente. Só se ainda passar de 10 s:
  - reescrita ao mesmo tempo que a 1ª busca, ou limite de 4 s para ela;
  - limite da busca de 60 s para 15 s; estourou, a busca segue só por palavras e a tela diz "busca
    parcial", em vez de erro;
  - a tela mostra a etapa ("buscando no material", "escrevendo a resposta").
- Medição permanente: a Edge Function grava o tempo de cada etapa no `clinical_search_logs` (colunas
  novas, expand). Sem texto da pergunta.
- Testes: os da biblioteca (`test_velocidade.py`) e as avaliações da homologação.

**Risco.** Manter o modelo carregado ocupa cerca de 1 a 2 GB de memória o tempo todo; há folga. Mudar a
reescrita ou a busca pode mudar a resposta: passa pelas avaliações da homologação
(`npm run biblioteca:homolog -- --avaliar`) antes da produção, como no Portão 2.

**Relação com o backlog.** A "Trilha Paralela — Hermes / Evidências" trata da busca, mas não tem item de
velocidade. É bug de produção se a medição confirmar o erro de 68 s também lá.

---

### Ponto 2 — Tirar "Ventilação mecânica — ajuste inicial"

**Onde está.** `src/content/registry.tsx:352`, ferramenta `suporte-ventilatorio` na seção Ventilação
Mecânica. É **o mesmo conteúdo** de `vm-ajuste-inicial-adulto` (`registry.tsx:189`, seção Emergências,
"Ventilação mecânica — ajuste inicial (adulto)"): as duas abrem `VmAjusteInicialAdulto`.

**Outros lugares que citam a ferramenta.** `biblioteca/ferramentas.json:3801` (a IA sugere essa rota),
`FRONTEND.md:432`. O índice das fichas clínicas (`src/clinico/indice.ts:122`) aponta para a de
Emergências.

**Proposta.**

- Tela: tirar a entrada `suporte-ventilatorio` da seção Ventilação Mecânica. Quem tinha a ferramenta em
  favoritos ou recentes vai para a de Emergências (redirecionamento da rota antiga).
- Gerar de novo o `ferramentas.json` (`scripts/ferramentas-json.mjs`) e reindexar as ferramentas na
  biblioteca da homologação, para a IA não sugerir uma rota que não existe mais.
- Banco e RPC: nada.

**Pergunta ao RT.** Tirar só a cópia da seção Ventilação Mecânica (a sugestão) ou tirar o conteúdo também
de Emergências?

**Risco.** Baixo.

---

## Plantão

### Ponto 3 — Check-in duplicado

**O que existe hoje.** O check-in já aparece sozinho de três formas:

- a tela da casca (`src/components/GateCheckIn.tsx`, usada em `src/components/AppShell.tsx:422` e
  `:513-516`): aviso de check-in pendente e, passada a tolerância, a tela que só deixa fazer o check-in
  ou sair; a justificativa de localização está no formulário comum
  (`src/components/checkin/FormularioCheckin.tsx:11-17`);
- a faixa "Meu plantão" no topo do Plantão (`src/pages/plantao/PlantaoHome.tsx:71-87`), com "Fazer
  check-in"/"Fazer check-out";
- e o cartão "Meu plantão" em "Seções do plantão" (`src/content/plantaoRegistry.tsx:59-72`), que abre a
  mesma página. **Este é o duplicado.**

**Proposta.** Tela: tirar o cartão das seções. Ficam a faixa do topo (que também é o caminho do
check-out) e a rota `/plantao/check-in`, porque `/meu-plantao` (`src/App.tsx:434-440`) e a faixa levam a
ela. Banco e RPC: nada.

**Risco.** Baixo. O check-out continua pela faixa.

---

### Ponto 4 — "Atendimento na porta" sai, entra "Atendimento"

**O que existe hoje.** O cartão "Atendimento na porta" (`plantaoRegistry.tsx:73-104`) abre 4 formulários
soltos: receituário, atestado, encaminhamento e pedido de exames. O atendimento de verdade da porta
(fila do PS e janela do paciente) é `/atendimento` (`src/pages/plantao/AtendimentoPorta.tsx`), que já
está no menu.

**Atenção.** As 4 rotas dos formulários continuam em uso: as pendências abrem os rascunhos nelas
(`src/components/documento/pendenciasPep.ts:38-43`), a aba Exames da porta leva ao pedido de exames
(`src/pages/plantao/porta/AbaExames.tsx:159`) e o leito leva ao atestado (ponto 14).

**Proposta.** Tela: trocar o cartão por "Atendimento", que leva a `/atendimento`. As rotas dos 4
formulários ficam (sem cartão). Banco e RPC: nada.

**Risco.** Baixo.

---

## Internação

### Ponto 5 — Clicar em Internação mostra só os internados

**O que existe hoje.** `/plantao/internacao` (`src/pages/plantao/PlantaoSectionHome.tsx:48-57`) mostra 3
cartões (`plantaoRegistry.tsx:105-132`): Pacientes internados, "Pendências e alertas" (`/pendencias-pep`)
e "Impressão de prontuário" (`/impressao-prontuario`), rotas em `src/App.tsx:307-308`, só do plantonista.

- **Pendências:** cada leito já mostra as suas na aba Resumo (`src/components/internacao/caderno/Pendencias.tsx`,
  usado em `LeitoAberto.tsx:304`), e a lista de internados mostra a primeira de cada paciente
  (`ListaInternados.tsx:106`, `:224-227`). A página `/pendencias-pep` também junta os rascunhos de
  documento a emitir de todos os pacientes; ela é aberta pelo aviso do check-out
  (`src/components/documento/AvisoRascunhosCheckout.tsx:21`).
- **Impressão de prontuário:** **só se abre por esse cartão.** Não há link no leito nem em Prontuários.

**Achado (bug leve).** O aviso de rascunhos do check-out também aparece no "Meu plantão" do gestor
(`src/pages/MeuPlantao.tsx:195`) e leva a `/pendencias-pep`, que o gestor não pode abrir.

**Proposta.**

- Tela: `/plantao/internacao` abre direto a lista de internados (seção de uma ferramenta só, como
  Observação).
- Impressão de prontuário: precisa de outro lugar antes de o cartão sair. Sugestão: botão "Imprimir
  prontuário" no leito (cabeçalho do paciente) e na ficha do paciente em Prontuários.
- `/pendencias-pep` fica como rota (o check-out leva a ela).
- Banco e RPC: nada.

**Pergunta ao RT.** Qual é o "local próprio" da impressão de prontuário que o RT tem em mente? Hoje não
existe outro.

---

### Ponto 6 — Resumo do leito em abas

**O que existe hoje.** A aba Resumo (`LeitoAberto.tsx:292-317`) empilha, numa coluna: gravidade e
tendência (`BlocoAcuidade`), sepse (só criança), pendências, passagem de plantão, passagens recebidas,
atendimentos encerrados do paciente (`HistoricoEncerrado`), regulações (`HistoricoRegulacao`), reentrada
de contingência e intercorrências. Acima, a trilha da internação (entradas, transferências de leito e
setor: `caderno/Trilha.tsx:31-48`).

**Proposta (tela).** Resumo com abas internas:

- **Agora:** gravidade, sepse, passagem e intercorrências;
- **Pendências;**
- **Histórico na unidade:** trilha da internação e atendimentos anteriores;
- **Regulações.**

Banco e RPC: nada. As opções de desenho saem de telas reais do Refero e são mostradas ao RT antes.

**Pergunta ao RT.** "Histórico na unidade" é a trilha desta internação, os atendimentos anteriores do
paciente, ou os dois?

---

### Ponto 7 — Três botões na mesma linha

**O que existe hoje.**

- "Transferir de setor": no canto do cabeçalho do paciente (`ListaInternados.tsx:244-248`, por
  `acoesTopo`).
- "Passar este paciente": no bloco de passagem, no meio do Resumo (`caderno/Passagem.tsx:41-43`).
- "Registrar intercorrência": no fim do Resumo (`src/components/prontuario/Intercorrencias.tsx:90`).

**Achado (bug leve).** "Transferir de setor" é passado sempre, também para o gestor e para internação
encerrada (`ListaInternados.tsx:244`). O banco recusa o que não pode, mas o botão não deveria aparecer.

**Proposta (tela).** Os três juntos no cabeçalho do paciente, só para quem cuida da internação ativa. O
formulário da passagem e o da intercorrência abrem na hora, sem sair do leito. Banco e RPC: nada.

---

### Ponto 8 — Tirar a aba Classificação

**O que existe hoje.** `caderno/Classificacao.tsx` lê a classificação da porta e o histórico
(`classificacoes_do_leito`), só leitura. A mesma tela de leito serve ao gestor (`/internacao`); a
enfermagem tem tela própria. A cor da classificação aparece no cabeçalho, e clicar nela abre essa aba
(`LeitoAberto.tsx:385` e `:438`).

**Proposta (tela).** Tirar a aba para o médico; o gestor continua com ela (decisão do RT). A cor fica no
cabeçalho; clicar nela mostra o histórico numa janela, sem aba. Banco e RPC: nada.

**Pergunta ao RT.** Tirar também do gestor?

---

### Ponto 9 — Diagnóstico dentro de Evolução; "Evolução médica" não cria

**O que existe hoje.**

- Aba Evolução (`src/components/evolucao/AbaEvolucao.tsx:20-24`), com 3 abas internas: Resumo
  evoluções, Evolução médica e Histórico. Aba Diagnóstico à parte (`caderno/Diagnostico.tsx`).
- O formulário da evolução só aparece quando `pode_registrar` vem verdadeiro do banco
  (`EvolucaoMedica.tsx:93`). Senão, a tela mostra só: "A evolução médica é registrada pelo médico de
  plantão no setor do paciente…" (`EvolucaoMedica.tsx:153-157`), sem botão e sem motivo.

**Causa.** `pode_registrar` exige, ao mesmo tempo (`supabase/migrations/20261119000004_internacao_vinda_da_observacao.sql:528-529`):

1. internação ativa;
2. que o médico tenha plantão **agora**, com check-in feito ou na tolerância, **no setor atual da
   internação** (`private.cuido_da_internacao`, `20260928000001`, e `setores_na_escala_agora`,
   `20261022000018:75`);
3. a permissão de evoluir do papel.

A lista de internados usa outra regra para mostrar o paciente (também gestor, super admin e o setor do
cadastro do paciente: `20260815000011:236-245`). Então o médico **vê** o paciente e não pode evoluir
quando: entrou como super admin ou gestor; o check-in daquele plantão está pendente; está escalado em
outro setor; ou o setor do cadastro do paciente é diferente do setor da internação.

Segundo caso: depois da 1ª evolução do dia, o formulário vira o aviso "Sua evolução de hoje foi
registrada…" com "Corrigir" e "Registrar complemento" (`EvolucaoMedica.tsx:160-178`). A regra é uma por
dia por profissional.

**Proposta.**

- Tela: a mensagem diz o motivo e o que fazer ("Check-in pendente: faça o check-in para evoluir";
  "Você está escalado em Enfermaria 1; este paciente está em Sala Vermelha"). O "Registrar evolução"
  aparece sempre que a escrita é possível.
- RPC: `contexto_evolucao` devolve o motivo junto do `pode_registrar` (expand, sem mudar o que existe).
- Diagnóstico vira aba interna de Evolução (só tela).
- **Pergunta ao RT (regra):** o médico de plantão em qualquer setor da unidade pode evoluir qualquer
  internado da unidade? Hoje só o do setor. Mudar a regra é migration (expand) com teste de banco.
- Para conferir a causa no caso do RT: com qual conta e em qual setor o RT tentou?

**Risco.** Só a mensagem: baixo. Abrir a regra para toda a unidade: médio (quem responde pela
evolução muda).

---

### Ponto 10 — Admissão: uma só ou que muda com o quadro

**O que existe hoje.**

- Ficha de admissão (`src/components/internacao/documentos/FichaAdmissao.tsx:147`) pela RPC
  `registrar_admissao` (`20261005000002_documentos_porta.sql:183-227`), que grava a evolução do tipo
  `admissao_anamnese` e a linha em `admissao_fichas`.
- "Uma por internação" só é garantido dentro de `registrar_evolucao` (`20261004000006:369-372`); a
  tabela `admissao_fichas` não tem trava de unicidade.
- O banco aceita corrigir a admissão (`corrigir_evolucao`, `20261004000006:421`), mas a tela só tem
  "Reimprimir" (`FichaAdmissao.tsx:211`). **Achado:** a correção não atualiza `admissao_fichas`, então
  a ficha impressa continuaria a antiga.
- O CID da admissão é texto livre (`dados.cid`), sem ligação com a aba Diagnóstico nem com o laudo de
  AIH, que tem os próprios campos (`LaudoAih.tsx:267-272`).

**Opções de modelo.**

- **A — Uma admissão, com correção.** A admissão fica única (é o documento da entrada e da AIH). Erro
  de registro é corrigido com justificativa, e a versão antiga fica guardada. A mudança de quadro vai
  para a Evolução e para a aba Diagnóstico (novo diagnóstico principal com data).
- **B — Uma admissão, com "reavaliação do quadro".** Como A, mais um documento próprio, ligado à
  admissão, para mudança importante do quadro (ex.: entrou por pneumonia, evoluiu com AVC): nova
  história, exame, hipóteses e CID, com data. A admissão original não muda; a tela mostra a original e
  as reavaliações em ordem.
- **C — Várias admissões.** Cada mudança vira uma admissão nova. Não sugerido: confunde a data de
  entrada, a AIH e a numeração da admissão.

**Sugestão: B.** Banco (expand): trava de unicidade da admissão por internação; tipo de documento
"reavaliação do quadro" ligado à admissão; a correção atualiza a ficha. RPC: `registrar_reavaliacao_quadro`
e o uso de `corrigir_evolucao` na tela. Tela: "Corrigir" e "Reavaliação do quadro" na aba Admissão.
Testes: pgTAP da unicidade, da correção e da reavaliação.

**Tipo.** Nova (modelo), com o achado da correção como bug leve.

---

### Ponto 11 — Prescrição: a busca do "+ novo item" é fraca e não adiciona

**O que existe hoje.**

- Caminho: aba Prescrição → `PrescricaoTab.tsx:11` → `src/components/prescricao/PrescricaoEstruturada.tsx`
  (`NovoItem`, `:244`).
- Busca (`PrescricaoEstruturada.tsx:271-281`): tabela `medicamento`, ativos da rede ou da unidade, pelo
  princípio ativo sem acento, a partir de 3 letras, em ordem alfabética, até 15 resultados. Não busca
  por apresentação nem por nome comercial; não põe primeiro o que começa com o que foi digitado; não
  mostra "buscando…" nem erro (um erro vira lista vazia).
- Escolha (`:426-436`): clicar no resultado só **escolhe** o remédio. O botão "Prescrever" fica apagado,
  sem dizer por quê, até haver dose, via e frequência (`:504`).
- O banco recusa todo medicamento sem idade e sem **peso deste atendimento** gravado nos sinais vitais
  (`20261121000001_prescricao_idade_peso.sql`, decisão do RT no Portão 2). O campo de peso do item só
  aparece depois da 1ª recusa (`:320`, `:379`), e o erro aparece longe do item, acima da "Prescrição
  vigente" (`:151`).
- **Achado:** o campo "Peso (kg)" da aba Prescrição do leito (`caderno/Documentos.tsx:28-35`) é só
  rascunho no navegador. Não grava o peso no atendimento e não chega à prescrição. O médico digita o
  peso ali e a prescrição continua recusada.

Não foi possível repetir o "não dá para clicar" só pelo código: a lista não tem nada que engula o
clique. **Pergunta ao RT:** o que acontece ao clicar? (a lista não aparece; aparece e nada acontece;
o remédio entra no topo mas o "Prescrever" não acende; ou aparece erro.)

**Proposta.**

- Tela: busca no padrão de lista de escolha do app (teclado, setas e Enter; "buscando…"; erro visível;
  o que começa com o texto primeiro; mostra apresentação e concentração; "não achou? avise a farmácia").
  O "Prescrever" diz o que falta ("falta a dose", "falta o peso deste atendimento"). O erro aparece
  dentro do item.
- Peso: o campo do leito grava o peso de verdade (aferido, estimado ou referido, como no Portão 2), ou
  sai e o peso fica só no item.
- RPC: busca de medicamento no banco (`buscar_medicamento`), com ordem por relevância e busca também por
  apresentação. Banco: índice para a busca (expand).
- Testes: teste de tela da lista e da mensagem do que falta; pgTAP da busca.

**Prioridade.** P1: atrasa a prescrição.

---

### Ponto 12 — Exames: laboratório não vai junto com imagem e ECG

**O que existe hoje.**

- Leito (`src/components/internacao/documentos/ExamesTab.tsx`): botões prontos que misturam laboratório,
  raio-X, USG e ECG (`:12-27`), todos somados num texto livre que vira **um** pedido e **uma** folha
  (`:56-70`), sem ligação com a internação (`internacaoId: null`, `:61`). A dica "use Enter" não tem
  Enter (`:108-109`).
- Porta (`src/pages/plantao/atendimento/PedidoExames.tsx`): já imprime uma folha por serviço
  (laboratório, imagem, métodos gráficos), mas ainda é **um** documento (`tipo pedido_exames`).
- Banco: o pedido emitido vira uma linha por exame em `exames_pedidos`
  (`20260929000007_fase4_exames_agravos.sql:41-60`), sem tipo. O catálogo `exames_unidade`
  (`20261205000001_catalogo_exames.sql:19`) só aceita exame de laboratório (SIGTAP 0202).

**Proposta.**

- Regra no banco (expand): o pedido de exames leva o grupo (laboratorial, imagem, ECG); emitir pedido
  com exames de grupos diferentes é recusado com a mensagem do que separar.
- Tela: o leito usa o mesmo pedido da porta (catálogo e folhas). Ao escolher exames de grupos
  diferentes, a tela já separa em um pedido por grupo, que o médico confere e emite.
- Banco: `exames_pedidos` ganha o grupo, para a enfermagem e o laboratório verem o tipo.
- Testes: pgTAP da recusa; teste da separação na tela.

**Pergunta ao RT.** São três pedidos (laboratório; imagem; ECG) ou dois (laboratório; imagem com ECG)?

---

### Ponto 13 — Encaminhamento dentro e fora da unidade

**O que existe hoje.**

- Aba do leito: `src/components/encaminhamento/AbaEncaminhamentoInterno.tsx`, **só dentro da unidade**
  (`encaminhar_interno`, tabela `encaminhamentos_internos`, 5 serviços). Fica travada enquanto houver
  exame sem resultado, medicação sem checagem ou pendência impeditiva (`:253-269`).
- Para fora: só o formulário da porta (`src/pages/plantao/atendimento/Encaminhamento.tsx`, folha
  SMS003a), com destino em texto livre (`:249`) e sem ligação com a internação (`:167`). O leito não
  leva a ele.

**Proposta.**

- Tela: a aba Encaminhamento ganha duas opções, "Dentro da unidade" (a de hoje) e "Para outra unidade"
  (o formulário SMS003a dentro do leito, ligado à internação).
- Banco e RPC: os de hoje (documento `encaminhamento`); só passa a gravar a internação.
- Atenção: transferir o internado para outra unidade é **regulação** (já existe), não encaminhamento.
  A tela deixa isso claro.

**Pergunta ao RT.** O destino "outra unidade" é texto livre (como na porta) ou escolhido da lista de
unidades da rede?

---

### Pontos 14 e 16 — Atestado e Alta e documentos

**O que existe hoje.**

- Aba Atestado (`caderno/Documentos.tsx:86-114`): lista os atestados e o "Emitir atestado" leva para a
  tela da porta, **fora do leito** (`:96`). O atestado sai sem ligação com a internação
  (`AtestadoMedico.tsx:189-191`).
- Aba Alta e documentos (`LeitoAberto.tsx:320-332`): alta (`dar_alta`), cancelar alta em 24 h e o pacote
  de alta com orientações marcadas, sinais de retorno e código de acesso (`caderno/Alta.tsx:20-30`). O
  texto diz que receita, atestado e outros documentos "entram automaticamente" (`Alta.tsx:292`), mas
  só os que foram emitidos em outro lugar.
- **Achado:** nenhuma tela escreve o sumário de alta; ele só é lido (`src/components/alta/DocumentosAlta.tsx:209`).

**Proposta.**

- Tela: a aba Atestado sai. Alta e documentos ganha, em ordem: receituário para casa, atestado médico,
  orientações (o pacote de hoje) e a alta.
  - Receituário para casa: o formulário do receituário dentro do leito, com o paciente fixo e ligado à
    internação. Pode partir dos itens da prescrição vigente, que o médico escolhe e ajusta; a dose é
    sempre a que o médico escreve (o sistema não sugere dose).
  - Atestado: o formulário dentro do leito, com o paciente fixo e ligado à internação.
- Banco: os documentos já existem; só passam a gravar a internação.
- **Pergunta ao RT:** o sumário de alta entra nesta tarefa?

**Risco.** Baixo para o atestado; médio para a receita (dose é dado clínico).

---

### Ponto 15 — Parecer, Termo de consentimento e Termo de cuidados paliativos

**O que existe hoje.** A aba "Parecer e termos" (`LeitoAberto.tsx:421-427`) junta três coisas:

- Parecer (`AbaParecer`): pedir, ver e cancelar (`solicitar_parecer`); a resposta é em `/pareceres`.
- Termo de consentimento (`AbaTermoConsentimento`): modelos da unidade (`emitir_termo_consentimento`).
- Escalas da enfermagem (`AbaAvaliacaoCrescimento`): NIPS, FLACC, Braden e Morse.

Não há termo de cuidados paliativos nem escala paliativa no app (PPS, PPI, PaP, Karnofsky, ECOG, SPICT e
NECPAL não aparecem em `src/`). O mais perto: a ficha "Dor, dispneia e sedação em cuidados paliativos —
adulto" (`src/content/registry.tsx:176`) e o PAINAD (`:180`).

**Pesquisa no PubMed (27/10/2026).** O que foi confirmado no texto da fonte:

| Escala | Para quê | Fonte | Confirmado no texto? |
|---|---|---|---|
| Pergunta surpresa ("ficaria surpreso se o paciente morresse em 12 meses?") | Achar quem precisa de cuidado paliativo (adulto) | Downar J et al. CMAJ 2017;189(13):E484-E493. PMID 28385893, [doi:10.1503/cmaj.160775](https://doi.org/10.1503/cmaj.160775) | Sim, no resumo: 16 estudos, 11.621 pacientes; sensibilidade 67%, especificidade 80% |
| PPS (Palliative Performance Scale) | Funcionalidade; também entra no prognóstico | Anderson F et al. J Palliat Care 1996;12(1):5-11. PMID 8857241. ESMO 2023 (abaixo) | Em parte: o resumo confirma que deriva do Karnofsky. **A tabela de níveis não está em texto do PubMed** |
| PPI (Palliative Prognostic Index) | Sobrevida em 3 e 6 semanas, **câncer avançado** (adulto) | Morita T et al. Support Care Cancer 1999;7(3):128-33. PMID 10335930, [doi:10.1007/s005200050242](https://doi.org/10.1007/s005200050242) | Em parte: 5 itens e os cortes (> 6: menos de 3 semanas; > 4: menos de 6 semanas). **Os pontos de cada item não estão em texto lido** |
| PaP (Palliative Prognostic Score) | Sobrevida em 30 dias, **câncer avançado** (adulto) | Maltoni M et al. J Pain Symptom Manage 1999;17(4):231-9. PMID 10203875, [doi:10.1016/s0885-3924(98)00145-6](https://doi.org/10.1016/s0885-3924(98)00145-6) | Em parte: 6 itens e os grupos A/B/C. **Os pesos não estão em texto lido**; precisa de leucograma |
| Diretriz que reúne as escalas | Prognóstico no câncer avançado (adulto) | Stone P et al. ESMO Open 2023;8(2):101195. PMID 37087198, [doi:10.1016/j.esmoop.2023.101195](https://doi.org/10.1016/j.esmoop.2023.101195), PMC10242351 (CC BY-NC-ND 4.0) | Sim (texto completo): o estado funcional é o fator de sobrevida mais firme |
| SPICT / SPICT-BR | Achar quem precisa de cuidado paliativo | Highet G et al. BMJ Support Palliat Care 2014. PMID 24644193. A validação brasileira (SPICT-BR) **não está no PubMed** | Só o resumo; a lista de indicadores não foi lida |
| NECPAL | Achar quem precisa de cuidado paliativo | Gómez-Batiste X et al. Palliat Med 2017;31(8):754-763. PMID 27815556 | Só o resumo: sensibilidade alta, especificidade baixa |
| PaPaS (Paediatric Palliative Screening Scale) | Criança de 1 ano ou mais: achar quem precisa de cuidado paliativo | Bergstraesser E et al. BMC Palliat Care 2013;12:20. PMID 23657092, [doi:10.1186/1472-684X-12-20](https://doi.org/10.1186/1472-684X-12-20), PMC3663726 (CC BY 2.0) | Sim (texto completo): 5 domínios, 11 itens com pontos. **Sem ponto de corte validado**; os autores chamam o trabalho de preliminar; sem validação brasileira |

O que **não** foi confirmado no texto: os pontos do PPI e do PaP, a tabela do PPS, a lista do SPICT e a
validação brasileira do SPICT-BR e do PPS. Antes de programar qualquer calculadora, é preciso o texto
completo da fonte original (editora ou SciELO), com a tabela de pontos e a página.

**Regras clínicas que valem aqui.**

- PPI e PaP só foram validados em **câncer avançado**. A tela não deve oferecê-los fora disso.
- Criança: nenhuma escala de prognóstico de sobrevida é validada. PPS, PPI e PaP **não** se usam na
  criança (nada de adulto para criança). Para criança, só a PaPaS, como apoio para achar quem precisa
  de cuidado paliativo, sem ponto de corte.

**Proposta.**

- Tela: três abas — **Parecer**, **Termo de consentimento** e **Cuidados paliativos**. As escalas da
  enfermagem (NIPS, FLACC, Braden, Morse) saem desta aba (pergunta ao RT: para onde?).
- Cuidados paliativos: o termo (modelo da unidade, como o de consentimento, com o que o médico e o
  paciente ou responsável decidiram: limites de tratamento, diretivas antecipadas) e as calculadoras:
  - adulto: pergunta surpresa; PPS; e, só com câncer avançado, PPI (sem exame de sangue) e PaP;
  - criança: PaPaS, sem corte.
- Cada calculadora entra pela fila de aprovação de fichas (`npm run fichas:sql`), com fonte e página.
- Banco: modelo de termo do tipo "cuidados paliativos" (a tabela `termos_modelos` já existe); o
  resultado das escalas gravado como avaliação (`avaliacoes_escala`, expand com os tipos novos).
- **Pendente antes do código:** o RT traz (ou autoriza buscar) o texto completo das fontes com a tabela
  de pontos; e o texto-base do termo de cuidados paliativos (sugestão: Resoluções CFM 1.805/2006 e
  1.995/2012, a conferir no texto oficial).

---

## Ordem sugerida

Cada item em branch e PR próprios, homologação antes, produção só com "ok produção".

| Ordem | Pontos | Por quê |
|---|---|---|
| 1 | 1 — modelo de busca sempre carregado | Medido em 27/10 (ok do RT). Só configuração do VPS; vale para homologação e produção juntas, precisa do "ok produção" |
| 2 | 11 — busca e peso da prescrição | Atrasa a prescrição; o peso do leito não grava |
| 3 | 9 — evolução médica | O médico não sabe por que não consegue evoluir |
| 4 | 12 — exames separados | Regra clínica nova, no banco |
| 5 | 14 + 16 — atestado e alta | Juntos, porque o atestado vai para a alta |
| 6 | 2, 3, 4, 5 — navegação do plantão | Pequenos, só tela; podem ir num PR só, se o RT aprovar |
| 7 | 6, 7, 8 — leito (Resumo, botões, Classificação) | Só tela; precisa das opções do Refero |
| 8 | 13 — encaminhamento para fora | Reaproveita o formulário da porta |
| 9 | 15 — parecer, termos e cuidados paliativos | Depende das fontes completas |
| 10 | 10 — modelo da admissão | Depende da escolha do modelo |
| — | 1 — reescrita e limite da busca | Depois de medir de novo com o modelo quente |

## Perguntas ao RT

1. Quais pontos entram no backlog, com qual prioridade e em qual fase? Vale a ordem acima?
2. Ponto 1: aprova deixar o modelo de busca sempre carregado no VPS (homologação e produção juntas)?
3. Ponto 2: tirar só a cópia da seção Ventilação Mecânica?
4. Ponto 5: onde fica a "Impressão de prontuário"?
5. Ponto 6: o que é o "histórico na unidade"?
6. Ponto 8: o gestor também perde a aba Classificação?
7. Ponto 9: com qual conta e setor tentou evoluir? O médico de plantão em qualquer setor pode evoluir
   qualquer internado da unidade?
8. Ponto 10: modelo A, B ou C?
9. Ponto 11: o que acontece exatamente ao clicar no remédio?
10. Ponto 12: três pedidos (laboratório; imagem; ECG) ou dois (laboratório; imagem com ECG)?
11. Ponto 13: destino em texto livre ou da lista de unidades da rede?
12. Ponto 16: o sumário de alta entra?
13. Ponto 15: para onde vão as escalas da enfermagem? Traz as fontes completas das escalas e do termo?
