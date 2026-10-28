# Ponto 11 — Prescrição do leito: busca de medicamento e peso

Plano da tarefa, no formato do "Plano de Trabalho — comando por tarefa" do
`BACKLOG.md`. Pedido do RT em 28/10/2026: "Comece pelo ponto 11".

**Decisões do RT (28/10/2026).** Plano aprovado, com a opção A de tela.

1. O clique no remédio: (b) ou (c). O RT confirma depois.
2. Tela: opção A.
3. Sinônimos: DCB, sim. Nome comercial, só quando o produto tem um único
   princípio ativo. O RT pediu a lista antes de gravar: está em
   `PONTO-11-SINONIMOS.md`.
4. `pg_trgm`, para aceitar erro de digitação: fica para depois.
5. O "Peso (kg)" do topo da aba do leito passa a gravar o peso de verdade.
6. Prioridade P1, em "Telas do plantonista".

**Ajuste depois da aprovação.** O cadastro tem cloreto de sódio a 0,9 % e a
20 %, e glicose a 5 % e a 50 %. Por isso "SF" e "SG" não podem valer para o
princípio ativo inteiro. A tabela de sinônimos ganha a coluna opcional
`concentracao`: quando ela está preenchida, o termo só acha a apresentação
daquela concentração.

```
Vamos trabalhar a tarefa: ponto 11, busca de medicamento e peso na prescrição do leito.

Contexto:
Fase: Telas do plantonista (pedidos do RT em 27/10/2026); falta o RT confirmar a fase
Prioridade: P1 (sugerida)
Objetivo comercial: o médico acha o remédio pelo nome que ele usa e prescreve sem tentar de novo
Objetivo técnico: a busca no servidor, com sinônimos, várias palavras e ordem por relevância; o que falta para prescrever aparece antes, perto do botão
Módulos afetados: prescrição estruturada (leito e porta), cadastro de medicamentos, peso do atendimento
Concorrentes que essa tarefa ajuda a enfrentar: PEPs com busca de medicamento por nome comercial e por sigla (MV, Tasy)
```

## 1. Diagnóstico do estado atual

**Onde fica.** Na aba Prescrição do leito, `AbaPrescricao`
(`src/components/internacao/caderno/Documentos.tsx:52-59`), aparecem duas
coisas, nesta ordem:

1. O bloco "Peso (kg)" e "Dieta" (`Documentos.tsx:27-46`).
2. O `PrescricaoTab`. Ele carrega o `PrescricaoEstruturada`, que tem os
   cartões "Prescrição vigente" e "Novo item"
   (`src/components/prescricao/PrescricaoEstruturada.tsx`).

O cartão "Novo item" (`NovoItem`, `:244`) também é usado na prescrição da
porta (`src/pages/plantao/porta/AbaPrescricao.tsx:115`).

### 1.1 Busca fraca

O código está em `PrescricaoEstruturada.tsx:271-281`.

| O que a busca faz hoje | Efeito |
|---|---|
| Procura só no princípio ativo (`principio_ativo_norm`) | Não acha por sigla, sinônimo ou nome comercial. "AAS" não traz o ácido acetilsalicílico. "Epinefrina" não traz a adrenalina, e "norepinefrina" não traz a noradrenalina. "Metamizol" não traz a dipirona. "SF 0,9%" e "soro fisiológico" não trazem o cloreto de sódio; "SG 5%" e "soro glicosado" não trazem a glicose. "Plasil" não traz a metoclopramida. O nome comercial (`anvisa_produto`) está vazio nos 65 itens da homologação. |
| Procura o texto inteiro, emendado (`ilike '%texto%'`) | Duas palavras só funcionam emendadas e na mesma ordem. "amoxi clav" não traz "Amoxicilina + clavulanato". |
| Não procura na apresentação | Para "dipirona gotas", a busca procura o texto "dipirona gotas" dentro do princípio ativo e não acha nada. A dipirona tem três apresentações. |
| Ordena em ordem alfabética e mostra no máximo 15 | O nome que começa com o texto digitado não vem primeiro. |
| Não tolera erro de digitação | "ondasetrona" não traz a ondansetrona. |
| Não mostra "buscando" nem erro | Quando a consulta falha, a lista some sem aviso, e nem aparece o "Nada no cadastro". |

O cadastro da homologação tem 65 medicamentos, todos da rede. Não li o
cadastro da produção, porque essa leitura não estava autorizada.

### 1.2 "Não dá para clicar e adicionar"

O clique na lista funciona: `onClick={() => setMed(m)}`, em `:429`. Ele
**escolhe** o remédio, que passa a aparecer num cartão com "Trocar". Mas o
clique **não adiciona** o remédio à prescrição. Para adicionar, o médico
ainda precisa de três coisas:

- **Escrever dose, via e frequência e apertar "Prescrever"** (`:504`). O
  botão fica cinza até os três campos estarem preenchidos, sem dizer o que
  falta.
- **Ter peso e idade deste atendimento.** O servidor recusa o item sem eles
  (`private.falta_para_prescrever`, em
  `supabase/migrations/20261121000001_prescricao_idade_peso.sql:69-80`).
  - A recusa aparece no **topo da página** (`:151`), acima do cartão
    "Prescrição vigente", longe do botão que o médico apertou.
  - O campo do peso só aparece **depois** dessa recusa (`:320` e `:379`).
- **Lidar com o "Último peso" (`:361-365`).** O cartão mostra o último peso
  do paciente, de qualquer época. O servidor só aceita o peso deste
  atendimento (`private.peso_do_atendimento`, `:61-67`). Por isso o médico
  vê "Último peso: 70 kg" e mesmo assim recebe "falta peso deste
  atendimento".

Não consegui reproduzir pela tela, por dois motivos. O projeto não tem teste
de tela (não há testing-library). E o login da homologação é do RT. Pelo
código, a explicação mais provável para "não dá para clicar e adicionar" é
uma destas duas: o botão cinza sem motivo, ou a recusa por peso, que aparece
longe do botão. A pergunta 1, no fim, confirma qual das duas.

### 1.3 Dois campos de peso

O "Peso (kg)" do topo da aba (`Documentos.tsx:31-34`) é **rascunho do
navegador**: dura 12 h, existe só naquela máquina e não grava peso nenhum.

- Ele vai para as folhas impressas do leito (`dadosPaciente.peso`, em
  `rascunhoLeito.ts:66`).
- O servidor não o enxerga.

O médico escreve o peso ali, aperta "Prescrever" e recebe "falta peso deste
atendimento".

## 2. Subtarefas técnicas

| # | Subtarefa | Camada |
|---|---|---|
| 1 | Tabela de sinônimos por princípio ativo, com a lista inicial aprovada pelo RT | banco |
| 2 | RPC `buscar_medicamento`: várias palavras, sinônimo, apresentação, ordem por relevância e filtro da unidade | RPC |
| 3 | RPC `o_que_falta_para_prescrever`: expõe a regra que já existe, para a tela perguntar antes | RPC |
| 4 | Lista de resultados acessível: teclado, destaque do texto achado, "buscando", erro e "nada encontrado" | tela |
| 5 | Depois de escolher o remédio, o cursor vai para a dose; o botão diz o que falta; o erro do servidor aparece dentro do cartão | tela |
| 6 | Peso e idade pedidos antes do primeiro item; "Último peso" só deste atendimento | tela |
| 7 | "Peso (kg)" do topo da aba grava o peso de verdade, e as folhas usam o peso gravado | tela |
| 8 | A mesma busca nas outras telas que procuram medicamento (receituário, alergia, farmácia), se o RT quiser | tela, depois |

## 3. Alterações de banco (expand, sem mudar o que existe)

Migration `<data>_busca_medicamento.sql`:

```sql
-- expand: sinônimos por princípio ativo (vale para todas as apresentações)
CREATE TABLE IF NOT EXISTS public.medicamento_sinonimo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  principio_ativo_norm text NOT NULL,
  concentracao text,                   -- nulo = todas; preenchida = só esta (SF 0,9%)
  termo text NOT NULL,                 -- como aparece na tela ("AAS")
  termo_norm text NOT NULL,            -- private.norm_medicamento(termo)
  tipo text NOT NULL CHECK (tipo IN ('sigla', 'sinonimo', 'comercial')),
  fonte text NOT NULL,                 -- de onde veio (ex.: DCB)
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (principio_ativo_norm, concentracao, termo_norm)
);
ALTER TABLE public.medicamento_sinonimo ENABLE ROW LEVEL SECURITY;
-- leitura para quem está logado; escrita só pela RPC (nesta tarefa, só a carga inicial)
```

- A carga inicial vai na própria migration, com `ON CONFLICT DO NOTHING`.
  São só nomes (siglas e sinônimos da DCB), sem dose. A lista vai ao RT antes
  (pergunta 3).
- Não muda nenhuma coluna de `medicamento`.
- Não instala `pg_trgm`, que não está na homologação. Sem ele, a busca não
  tolera erro de digitação (pergunta 4).
- **Rollback:** `DROP FUNCTION public.buscar_medicamento(uuid, text)`,
  `DROP FUNCTION public.o_que_falta_para_prescrever(uuid)` e
  `DROP TABLE public.medicamento_sinonimo`. Nada mais depende delas.

## 4. Alterações de RPC

| RPC | Assinatura | Permissão | Estados | Auditoria | Chamada repetida |
|---|---|---|---|---|---|
| `buscar_medicamento` | `(p_unidade uuid, p_termo text) RETURNS jsonb` | `authenticated`. `SECURITY INVOKER`: vale a RLS de `medicamento`. Filtro da unidade dentro (`unidades_locais IS NULL OR p_unidade = ANY(...)`) | Só leitura. Devolve até 20 itens `{id, principio_ativo, apresentacao, concentracao, alta_vigilancia, casou_por}` | Nenhuma (leitura) | Mesmo resultado |
| `o_que_falta_para_prescrever` | `(p_paciente uuid) RETURNS jsonb` → `{falta: ["peso", "idade"], peso_atendimento: {valor, metodo, em} \| null}` | Mesma regra de quem pode ver a prescrição do paciente | Só leitura. Usa `private.falta_para_prescrever` e `private.peso_do_atendimento`, sem copiar a regra | Nenhuma | Mesmo resultado |

**Como `buscar_medicamento` busca:**

- Quebra o texto em palavras (com `private.norm_medicamento`).
- Cada palavra precisa aparecer em algum destes lugares: princípio ativo,
  apresentação, concentração ou sinônimo.
- A ordem é esta: (1) o princípio ativo começa com o texto; (2) bate por
  sinônimo; (3) bate no meio do nome. Depois disso, ordem alfabética.
- `casou_por` traz o sinônimo usado, por exemplo "AAS". A tela mostra
  "AAS = Ácido acetilsalicílico" e nunca troca o nome do cadastro.

**Teste de guarda.** O `src/lib/medicamentoCadastro.test.ts` passa a aceitar
a chamada a `buscar_medicamento` como busca filtrada pela unidade.

## 5. Alterações de frontend

O visual sai de telas reais do Refero (seção 12). Mudanças em
`PrescricaoEstruturada.tsx` (`NovoItem`), que valem para o leito e para a
porta:

- **Lista de resultados.** Usa a peça que já existe, `OpcaoLista`
  (`role="listbox"` e `option`), a mesma do CID e do SIGTAP.
  - Teclado: ↑ e ↓ escolhem, Enter confirma.
  - Destaque das letras achadas.
  - Linha do sinônimo ("AAS = Ácido acetilsalicílico").
  - Estados "buscando…" e "não foi possível buscar, tente de novo".
  - "Nada no cadastro com esse nome. Peça o cadastro ao farmacêutico."
- **Depois de escolher o remédio,** o cursor vai para "Dose".
- **Botão "Prescrever"** sempre visível. Se faltar algo, uma linha logo
  abaixo diz o quê, por exemplo "Falta: frequência". O erro do servidor
  aparece **dentro do cartão "Novo item"**, junto do botão, e não no topo da
  página.
- **Peso e idade antes.** Ao abrir o cartão, a tela chama
  `o_que_falta_para_prescrever`. Se faltar peso ou idade, o campo aparece
  antes da busca, com o motivo: "Para prescrever medicamento, registre o
  peso deste atendimento".
- **"Último peso"** mostra o peso deste atendimento. Se só houver peso
  antigo, mostra "Peso de outro atendimento (data): registre o de hoje".
- **Aba do leito** (`Documentos.tsx`). O "Peso (kg)" do rascunho vira o
  registro de peso de verdade: o mesmo `registrarPeso`, com "Aferido",
  "Estimado" ou "Referido". O `dadosPaciente.peso` das folhas passa a usar o
  peso gravado. A dieta continua como está.

## 6. Permissões e auditoria

- A busca e o "o que falta" só leem. Não geram evento na cadeia de hash.
- O registro de peso já existe (`gravarRegistros` → `observacao`), com o
  autor sendo quem está logado. Não muda.
- RLS da nova tabela: `SELECT` para `authenticated`. Sem `INSERT`, `UPDATE`
  ou `DELETE` direto. Teste: um usuário comum não consegue gravar sinônimo.

## 7. Testes

| Teste | Onde |
|---|---|
| Banco: "AAS" traz o ácido acetilsalicílico; "amoxi clav" traz amoxicilina + clavulanato; "dipirona gotas" traz só as gotas; o item local de outra unidade não aparece; o que começa com o texto vem primeiro; o sinônimo não grava; o rollback deixa o banco como antes | `supabase/tests/buscar_medicamento.sql`, na homologação |
| Banco: `o_que_falta_para_prescrever` diz "peso" sem peso deste atendimento e não diz com peso de hoje | o mesmo arquivo |
| Destaque do texto achado e montagem do "Falta: …" | teste em node, em `src/lib` |
| Guarda: toda busca no cadastro passa pela unidade | `medicamentoCadastro.test.ts`, ajustado |
| Tela: o RT prescreve na homologação, no leito e na porta | registro em `docs/plantonista/` |

## 8. Critérios de aceite

| Critério | Evidência |
|---|---|
| A busca acha por sigla e sinônimo da lista aprovada | `buscar_medicamento.sql` passando na homologação |
| A busca aceita duas palavras em qualquer ordem e a apresentação | o mesmo teste |
| Escolher o remédio leva à dose; o botão diz o que falta | o RT confere na homologação |
| A falta de peso ou idade aparece antes, e não depois de apertar "Prescrever" | o RT confere na homologação, com um paciente sem peso |
| O peso do topo da aba grava e serve para prescrever | o RT registra o peso ali e prescreve sem recusa |
| Nada muda na regra do servidor: sem peso, ele continua recusando | o teste de banco que já existe continua passando |

## 9. Riscos

| Risco | Cuidado |
|---|---|
| Sinônimo errado leva ao remédio errado | A linha mostra sempre o nome e a apresentação do cadastro. O sinônimo aparece como "AAS = Ácido acetilsalicílico". O RT aprova a lista. Nome comercial só quando ele corresponde a um único princípio ativo. |
| O `NovoItem` também é a prescrição da porta | A mudança vale nos dois lugares, e o teste na homologação cobre os dois |
| O cadastro da produção pode ser maior que o da homologação | A RPC limita a 20 itens e usa o índice do nome. Medir na homologação com cópia do tamanho real, se o RT autorizar a contagem |
| As folhas impressas do leito mudam de origem do peso | Sem peso gravado, a folha sai com o peso em branco, como uma folha sem rascunho sai hoje |
| Erro de digitação continua sem resultado | Só se resolve com `pg_trgm` (pergunta 4) |

## 10. Ordem de implementação

1. Migration e RPCs, com o teste de banco, na homologação.
2. Tela: busca e lista (subtarefas 4 e 5).
3. Tela: peso e idade antes, e o peso da aba do leito (subtarefas 6 e 7).
4. Publicação na homologação e conferência do RT.
5. Produção, com o "ok produção" do RT.

Cada passo vai num commit. Tudo vai no branch `fix/prescricao-busca-peso`,
com um PR na base master.

## 11. Como demonstrar comercialmente

"Digite AAS, adrenalina ou SF: o remédio aparece pelo nome que o médico usa.
Escolha, escreva a dose e prescreva. Se faltar o peso, o sistema avisa antes,
no mesmo lugar, e o peso vale para a prescrição e para as folhas."

## 12. Opções de tela (referências reais do Refero)

**Opção A, recomendada: lista logo abaixo do campo, dentro do cartão.**

- [Raycast](https://refero.design/pages/d907406e-b209-461b-a53a-bf87e3c406b6):
  linhas com o nome em negrito e um subtítulo apagado, que no nosso caso é a
  apresentação; teclado ↑, ↓ e Enter.
- [Parallel](https://refero.design/pages/70112ca9-9a48-4f62-916c-d8b874343b43):
  o texto achado destacado em cada linha.
- [Excalidraw](https://refero.design/pages/90a2b441-419f-4b7d-be25-a0ec0b55c3bd):
  o estado "nada encontrado" dentro da própria lista.
- [Zendesk](https://refero.design/pages/f814c404-4250-4881-af01-311a94560db5)
  e [Appwrite](https://refero.design/pages/e6ffa53b-f302-41c9-a731-0d19f5d64be1):
  o erro escrito logo abaixo do campo e do botão, e não no topo da página.

**Opção B: busca numa janela por cima da tela, e o formulário depois.**

- [Clay](https://refero.design/pages/1d153123-4fce-43d1-9481-dfd4efbe589e):
  busca e escolha numa janela.
- [Cal.com](https://refero.design/pages/1ab01fd6-ed5e-40cd-974d-75a2f50feb67):
  resultados agrupados por tipo, com atalhos de teclado.
- A janela tira o médico da página da prescrição a cada item. Por isso
  recomendo a A.

## 13. Perguntas ao RT

1. Ao clicar no remédio, o que acontecia?
   - (a) Nada.
   - (b) O remédio ficava escolhido, mas o "Prescrever" ficava cinza.
   - (c) Aparecia "Falta para prescrever: peso…" no topo da página.
2. Tela: opção A (lista abaixo do campo) ou B (janela)?
3. Sinônimos:
   - Aprova começar pelas siglas e sinônimos da DCB dos 65 itens (por
     exemplo AAS, epinefrina, norepinefrina, metamizol, SF 0,9%, SG 5%)?
     Mando a lista completa antes de gravar.
   - Inclui nome comercial (por exemplo Plasil e Rocefin)? Só quando ele
     corresponde a um único princípio ativo.
4. Tolerância a erro de digitação ("ondasetrona"): exige instalar a extensão
   `pg_trgm` no banco, primeiro na homologação e depois na produção. Entra
   agora ou depois?
5. O "Peso (kg)" do topo da aba do leito passa a gravar o peso de verdade,
   que também vai para as folhas. Aprova?
6. Fase e prioridade: P1, dentro de "Telas do plantonista"?
