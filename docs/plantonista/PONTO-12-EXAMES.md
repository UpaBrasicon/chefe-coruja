# Ponto 12 — Exame laboratorial em pedido separado de imagem e ECG

Plano da tarefa, no formato do "Plano de Trabalho — comando por tarefa" do
`BACKLOG.md`. O RT pediu em 28/10/2026: "Começar ponto 12".

**Nada foi mudado no código nem no banco.** Este documento é o plano. A
implementação começa quando o RT responder às perguntas do fim.

```
Vamos trabalhar a tarefa: ponto 12, exame laboratorial em pedido separado de imagem e ECG.

Contexto:
Fase: Telas do plantonista (pedidos do RT em 27/10/2026)
Prioridade: P1 (sugerida no BACKLOG)
Objetivo comercial: o pedido chega certo a cada serviço (laboratório, imagem, ECG), sem a enfermagem separar à mão
Objetivo técnico: o leito passa a pedir exame pelo catálogo da unidade, ligado à internação, um pedido por grupo; o grupo fica gravado em cada exame
Módulos afetados: aba Exames do leito, pedido rápido da porta, exames_pedidos, catálogo de exames da unidade
Concorrentes que essa tarefa ajuda a enfrentar: PEPs com pedido de exame por serviço executor (MV, Tasy)
```

## 1. Diagnóstico do estado atual

O diagnóstico de 27/10 está desatualizado num ponto. Desde a Fase 5C (imagem
no sistema, `20261208000001`), o banco já sabe o tipo do exame. Abaixo, o
estado de hoje.

### 1.1 Leito: texto livre que mistura tudo

O arquivo é `src/components/internacao/documentos/ExamesTab.tsx`.

- **Botões que misturam os serviços (`:12-27`).** Juntam laboratório, raio-X
  de tórax, USG de abdome e ECG.
- **Um documento só (`:56-62`).** Cada clique acrescenta uma linha num texto
  livre. O texto vira **um** documento `pedido_exames` e **uma** folha, com
  `internacaoId: null`: o pedido não fica ligado à internação.
- **Dica falsa (`:108-109`).** A dica diz "use Enter", e o Enter não faz
  nada.

### 1.2 Banco: o tipo existe, mas o pedido do leito quase nunca tem

- **Uma linha por exame.** Quando o documento é emitido, o gatilho
  `private.pedido_emitido_vira_exames` (versão de `20261205000001`) cria uma
  linha por exame em `exames_pedidos`.
- **Código só por nome idêntico.** A linha só ganha código (procedimento do
  SIGTAP) quando o nome escrito é **igual** ao de um exame do catálogo da
  unidade.
- **O tipo vem do código.** `exames_pedidos.tipo` é calculado a partir dele
  (`20261208000001`):
  - `laboratorio` para o grupo 02.02 do SIGTAP;
  - `imagem` para 02.04 a 02.07 e para 02.11, que inclui o ECG;
  - nulo quando não há código.
- **O que a homologação mostra (28/10/2026):**
  - 96 exames pedidos;
  - **90 sem tipo**, porque o nome não bateu com o catálogo;
  - 83 sem ligação com a internação;
  - os 2 documentos de pedido misturam tipos.
- **Catálogo.** A UPA Homologação tem catálogo próprio (`exames_unidade`):
  14 exames de laboratório e 3 de imagem.

### 1.3 Porta: já tem o pedido certo, mas só para a porta

- **Pedido rápido.** A aba Exames da porta (`src/pages/plantao/porta/AbaExames.tsx`)
  pede pelo catálogo, com código, pela RPC `pedir_exames`. Cada exame vira
  uma linha com tipo, sem imprimir.
  - A RPC só aceita atendimento aberto na porta
    (`private.atendimento_aberto_na_porta`). Não serve para a internação.
  - Ela também deixa misturar laboratório e imagem no mesmo pedido.
- **Ferramenta de documento.** A ferramenta "Pedido de exames"
  (`src/pages/plantao/atendimento/PedidoExames.tsx`) já imprime uma folha
  por serviço: laboratório, radiologia/imagem e métodos gráficos. Mas
  continua sendo um documento só.

## 2. Subtarefas técnicas

| # | Subtarefa | Camada |
|---|---|---|
| 1 | Grupo do exame gravado em cada linha: laboratório, imagem ou ECG/métodos gráficos | banco |
| 2 | `pedir_exames_internacao`: o pedido pelo catálogo, ligado à internação | RPC |
| 3 | Regra: um pedido leva exames de um grupo só; misturar é recusado com a mensagem do que separar | RPC |
| 4 | Aba Exames do leito: pedido por grupo, pelo catálogo, no lugar do texto livre | tela |
| 5 | Folha impressa por pedido (um grupo por folha), sem criar os exames de novo | tela |
| 6 | A mesma regra no pedido rápido da porta (pergunta 3) | RPC e tela |

## 3. Alterações de banco (expand)

Migration `20270203000004_exames_por_grupo.sql`, na faixa reservada desta
sessão.

```sql
-- grupo do exame: do código quando há; informado pelo médico no texto livre
ALTER TABLE public.exames_pedidos ADD COLUMN IF NOT EXISTS grupo text
  CHECK (grupo IS NULL OR grupo IN ('laboratorio', 'imagem', 'grafico'));
-- gatilho BEFORE INSERT: com procedimento, o grupo sai do código
--   0202 → laboratorio; 0211 → grafico (ECG e outros); 0204-0207 → imagem
-- linhas antigas: preenche o grupo pelo código (as sem código ficam nulas)
```

- **Uma coluna nova.** A coluna `tipo` que já existe não muda: a enfermagem e
  o laboratório integrado usam a regra de dois valores dela. A coluna nova
  `grupo` separa o ECG da imagem.
- **Rollback:** `DROP TRIGGER` do novo gatilho, `DROP FUNCTION` das duas
  RPCs novas e `ALTER TABLE … DROP COLUMN grupo`. A coluna é nova: ninguém
  além desta tarefa lê dela.

## 4. Alterações de RPC

| RPC | Assinatura | Permissão | O que faz | Auditoria | Chamada repetida |
|---|---|---|---|---|---|
| `pedir_exames_internacao` | `(p_internacao uuid, p_itens jsonb, p_urgencia text, p_observacao text) RETURNS jsonb` | Médico que evolui a internação (`private.evoluo_internacao`, ponto 9) | Igual a `pedir_exames`, mas grava `internacao_id`. Cada item vem do catálogo (com código) ou é texto livre com o grupo escolhido. Todos os itens precisam ser do mesmo grupo. Devolve `{pedidos, grupo, ids}` | As linhas de `exames_pedidos` levam o autor (login). Nada se apaga | O exame igual ainda pendente na mesma internação não entra de novo, como na porta |
| `pedir_exames` (porta) | Mesma assinatura | Sem mudança | Passa a recusar mistura de grupos, se o RT aprovar a pergunta 3 | — | — |

Mensagem da recusa: "Laboratório, imagem e ECG vão em pedidos separados.
Este pedido tem laboratório e imagem: peça cada um à parte."

## 5. Alterações de frontend

**Aba Exames do leito** (`caderno/Documentos.tsx` → `ExamesTab`). O gerador
de texto livre sai e entra o pedido pelo catálogo da unidade, com a mesma
peça da porta:

- botões do catálogo;
- busca;
- urgência;
- observação;
- texto livre com o grupo escolhido.

As duas formas de separar estão na seção 12 (pergunta 2).

**Impressão.** Cada pedido imprime a folha do seu grupo, no modelo de folha
que já existe (`lib/folhas`, `pedidoExames`, uma folha por serviço).

- O documento impresso é ligado à internação.
- Ele não passa pelo gatilho que cria exames a partir do texto. Os exames já
  foram criados pela RPC, e a folha só os imprime.

**O que fica igual:**

- a lista "Exames pedidos e agravos" do leito, que já lê `exames_pedidos`;
- o resultado e o "realizado" da imagem.

## 6. Permissões e auditoria

- **Quem pede.** `pedir_exames_internacao` usa a mesma regra de quem evolui
  a internação (ponto 9, regra B).
- **Quem lê.** A leitura de `exames_pedidos` já tem RLS: gestor ou paciente
  no meu plantão. Não muda.
- **Autor.** Cada exame leva o autor (login) e a hora. Cancelar continua com
  motivo; nada se apaga.

## 7. Testes

| Teste | Onde |
|---|---|
| Banco: o grupo sai do código (0202, 0211, 0204-0207); mistura é recusada; texto livre exige grupo; o pedido fica ligado à internação; o exame pendente igual não duplica; quem não cuida da internação é barrado | `supabase/tests/exames_por_grupo.sql` |
| Banco: a folha impressa não cria exames de novo | o mesmo arquivo |
| Tela: separação por grupo e montagem da folha | teste em node em `src/lib` |
| O RT pede laboratório, raio-X e ECG no leito, na homologação | registro neste documento |

## 8. Critérios de aceite

| Critério | Evidência |
|---|---|
| Laboratório, imagem e ECG saem em pedidos separados | Teste de banco da recusa e o RT conferindo na homologação |
| Cada exame do leito fica ligado à internação e com o grupo | Teste de banco e consulta à homologação depois do teste do RT |
| A folha impressa leva só um grupo | O RT confere a folha |
| Exames de antes continuam legíveis | A lista do leito mostra os antigos sem grupo |

## 9. Riscos

| Risco | Cuidado |
|---|---|
| Unidade sem catálogo próprio | Sem catálogo, a busca usa o SIGTAP, como na porta. O grupo vem do código |
| Exame fora do catálogo | Texto livre, com o grupo escolhido pelo médico. Sem código, ele não vai ao laboratório integrado (como hoje na porta) |
| Folha impressa duplicar exames pelo gatilho antigo | A folha nova usa outro tipo de documento, ou não usa o texto. O teste de banco prova que não duplica |
| Mudar a porta muda um fluxo que já está em produção | Só se o RT aprovar (pergunta 3). Se aprovar, a regra entra pela mesma RPC, com o mesmo teste |

## 10. Ordem de implementação

1. Migration e teste de banco: grupo, RPC e recusa da mistura.
2. Tela do leito: pedido por grupo.
3. Folha por pedido.
4. Porta, se aprovado.
5. Homologação, conferência do RT e produção com o "ok produção".

## 11. Como demonstrar comercialmente

"No leito, o médico marca os exames. Laboratório, imagem e ECG saem em
pedidos separados, cada um com a sua folha e ligado à internação. A
enfermagem e o laboratório veem só o que é deles."

## 12. Opções de tela (referências reais do Refero)

**Opção A, recomendada: três seções lado a lado, cada uma com o seu botão
"Pedir".** Laboratório, Imagem e ECG; cada seção é um pedido.

- [Superlist, lista com seções](https://refero.design/pages/472b8584-4ca1-4571-b03f-e2ad1abbebb9):
  uma lista de marcar dividida em seções com título, cada seção com os seus
  itens.
- [Column, escolha em duas colunas](https://refero.design/pages/b4445e9e-2efe-4e5c-8159-2ad5810c174b):
  categorias à esquerda e os itens marcáveis da categoria à direita.

**Opção B: uma lista só, e na conferência o sistema mostra os pedidos já
separados, para o médico emitir cada um.**

- [West Elm, entrega dividida](https://refero.design/pages/6f9364c9-27a3-40ad-a662-16d3daa7f781):
  os itens do carrinho agrupados por entrega antes de confirmar.
- [Walmart, opções de entrega](https://refero.design/pages/46807179-c010-46b2-bde5-90da1cf9bea5):
  painel lateral com os grupos de entrega.

A opção A deixa claro desde o começo que são pedidos diferentes. A B é mais
rápida para quem marca muitos exames de uma vez, mas a separação só aparece
no fim.

## 13. Perguntas ao RT

1. **Grupos:**
   - **três pedidos:** laboratório; imagem (raio-X, USG); ECG —
     **recomendado**, porque o ECG é outro grupo do SIGTAP (02.11) e já tem
     folha própria;
   - ou **dois pedidos:** laboratório; imagem com ECG.
2. **Tela:**
   - opção A: seções lado a lado, cada uma com o seu "Pedir";
   - ou opção B: uma lista só, separada na conferência.
3. **Porta.** A mesma regra vale no pedido rápido da porta (aba Exames do
   atendimento)?
4. **Folha impressa no leito.** Continua havendo uma folha por pedido? Ou o
   pedido fica só no sistema, como na porta, e imprime só quando preciso?
5. **Exame fora do catálogo** (texto livre): o médico escolhe o grupo na
   hora? Recomendo que sim.
