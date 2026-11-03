# Pontos 2 a 5 — Navegação do plantão

Plano da tarefa, no formato do "Plano de Trabalho — comando por tarefa" do
`BACKLOG.md`. O RT pediu em 29/10/2026: "Começar 2 a 5".

**Decisões do RT (29/10/2026): "Aprovo".** O RT aprovou as recomendações:

- **Pergunta 1:** sai só a cópia de Ventilação Mecânica.
- **Pergunta 2:** "Imprimir prontuário" fica no cabeçalho do leito e em Prontuários (opção A).
- **Pergunta 3:** Pendências e alertas fica só como destino do aviso do check-out.
- **Pergunta 4:** o aviso de rascunhos do gestor fica só em texto.

**Situação: em produção desde 29/10/2026.** O RT conferiu na homologação, e o PR #344 foi juntado ao master. É só tela, sem banco.

**Diferenças do plano:**

- **Biblioteca da IA:** do `ferramentas.json` saiu **só** a entrada `suporte-ventilatorio`. O arquivo do repositório estava desatualizado: regenerá-lo traria 22 ferramentas de outras sessões. **A reindexação ficou para depois.** A coleção `ferramentas` do Qdrant é a mesma da homologação e da produção, então reindexar mexe na produção. Até lá, se a IA sugerir a rota antiga, ela redireciona para a de Emergências.
- **Achado:** duas outras telas aparecem em duas entradas da Central: `DenguePed` e `SdraVentilacaoAdulto`. Ficaram como estão, listadas no teste `src/content/duplicadas.test.ts`, para o RT decidir.

```
Vamos trabalhar a tarefa: pontos 2 a 5, navegação do plantão (VM duplicada, check-in duplicado, Atendimento, Internação direto na lista).

Contexto:
Fase: Telas do plantonista (pedidos do RT em 27/10/2026)
Prioridade: P2 (sugerida no BACKLOG)
Objetivo comercial: menos cliques e nenhuma entrada repetida no plantão
Objetivo técnico: tirar duas entradas duplicadas, trocar o cartão da porta pelo Atendimento e abrir a Internação direto na lista, com a impressão de prontuário num lugar próprio
Módulos afetados: registro das ferramentas (Central), registro das seções do Plantão, leito, Prontuários, biblioteca da IA (ferramentas.json)
Concorrentes que essa tarefa ajuda a enfrentar: qualquer PEP com navegação curta no plantão
```

## 1. Diagnóstico do estado atual

Conferi no master de 29/10/2026. As referências mudaram pouco desde o
diagnóstico de 27/10.

| Ponto | Onde | O que acontece |
|---|---|---|
| 2 | `src/content/registry.tsx:352` | A ferramenta `suporte-ventilatorio` ("Ventilação mecânica — ajuste inicial", seção Ventilação Mecânica) abre o **mesmo** conteúdo de `vm-ajuste-inicial-adulto` (`:189`, seção Emergências). As duas abrem `VmAjusteInicialAdulto`. A IA também sugere a rota duplicada (`biblioteca/ferramentas.json:3801`). O índice das fichas clínicas aponta para a de Emergências (`src/clinico/indice.ts:122`) |
| 3 | `src/content/plantaoRegistry.tsx`, cartão `check-in` | O check-in já aparece de duas outras formas: a tela que bloqueia o app sem check-in (`GateCheckIn`) e a faixa "Meu plantão" no topo do Plantão, com check-in e check-out. O cartão "Meu plantão" nas seções é o terceiro caminho |
| 4 | `plantaoRegistry.tsx`, cartão `atendimento-porta` | "Atendimento na porta" abre 4 formulários soltos (receituário, atestado, encaminhamento, pedido de exames). O atendimento de verdade é `/atendimento` (fila do PS e janela do paciente). **As 4 rotas continuam em uso**: as pendências abrem os rascunhos nelas, e a porta tem links para elas (pedido impresso, receituário e atestado completos) |
| 5 | `plantaoRegistry.tsx`, seção `internacao` | `/plantao/internacao` mostra 3 cartões: Pacientes internados, "Pendências e alertas" (`/pendencias-pep`) e "Impressão de prontuário" (`/impressao-prontuario`). **A impressão de prontuário só abre por esse cartão.** As pendências de cada paciente já estão no leito (aba Resumo) e na lista de internados |

**Achado (bug leve, ponto 5).** O aviso de rascunhos no check-out também
aparece no "Meu plantão" do gestor e leva a `/pendencias-pep`, que o gestor
não pode abrir (`src/components/documento/AvisoRascunhosCheckout.tsx:21`).

**A impressão de prontuário** (`src/pages/prontuario/ImpressaoProntuario.tsx`)
já aceita o paciente pela URL (`useSearchParams`).

- O médico escolhe documentos e anexos e informa quem autorizou e quem
  recebe.
- A cópia fica registrada (protocolo PRO-…).
- Ou seja, um botão em outro lugar pode abrir a página com o paciente já
  escolhido.

## 2. Subtarefas técnicas

| # | Subtarefa | Camada |
|---|---|---|
| 1 | Ponto 2: tirar `suporte-ventilatorio` da seção Ventilação Mecânica; rota antiga redireciona para a de Emergências | tela |
| 2 | Ponto 2: gerar de novo o `ferramentas.json` e reindexar as ferramentas na biblioteca da homologação (e da produção, com "ok produção") | biblioteca |
| 3 | Ponto 3: tirar o cartão "Meu plantão" das seções; a rota `/plantao/check-in` fica | tela |
| 4 | Ponto 4: trocar o cartão "Atendimento na porta" por "Atendimento" → `/atendimento`; as 4 rotas dos formulários ficam, sem cartão | tela |
| 5 | Ponto 5: `/plantao/internacao` abre direto a lista de internados | tela |
| 6 | Ponto 5: botão "Imprimir prontuário" no leito e em Prontuários, abrindo `/impressao-prontuario?paciente=…` | tela |
| 7 | Ponto 5: o aviso de rascunhos não leva o gestor a uma página que ele não abre | tela |

## 3. Alterações de banco

Nenhuma.

## 4. Alterações de RPC

Nenhuma. A impressão de prontuário continua com `registrar_impressao_prontuario`
e o protocolo de sempre.

## 5. Alterações de frontend

- **`src/content/registry.tsx`.** Sai a entrada `suporte-ventilatorio`. A
  rota `/plantonista/ventilacao-mecanica/suporte-ventilatorio` passa a
  redirecionar para `/plantonista/emergencias/vm-ajuste-inicial-adulto`.
  Assim, favorito ou recente salvo continua abrindo.
- **`src/content/plantaoRegistry.tsx`:**
  - sai o cartão `check-in`;
  - o cartão `atendimento-porta` vira "Atendimento", levando a
    `/atendimento`;
  - a seção `internacao` passa a ter uma ferramenta só, a lista, como a
    Observação.
  - As rotas antigas (`/plantao/check-in`, as 4 dos formulários,
    `/pendencias-pep`) **ficam**, porque outros lugares levam a elas.
- **Impressão de prontuário** (opção A da seção 12): botão "Imprimir
  prontuário" no cabeçalho do leito e na ficha do paciente em Prontuários.
- **Aviso de rascunhos do gestor:** o link vira texto, ou leva a uma página
  que o gestor abre (pergunta 4).
- **`FRONTEND.md`:** tirar `suporte-ventilatorio` da lista.

## 6. Permissões e auditoria

Nada muda.

- A impressão de prontuário continua com as mesmas regras: só o paciente
  que a pessoa pode atender, o registro do acesso e o protocolo da cópia.
- O botão novo só leva à página que já existe.

## 7. Testes

| Teste | Onde |
|---|---|
| Nenhuma ferramenta da Central aponta para o mesmo componente em duas seções, salvo as marcadas como atalho de propósito | Teste em node sobre o `registry.tsx` |
| A rota antiga da VM redireciona | Teste em node da tabela de redirecionamentos |
| O `ferramentas.json` não tem `suporte-ventilatorio` | O teste do `ferramentas.json` que já existe (gerado do registro) |
| O RT navega pelo Plantão na homologação | Registro neste documento |

## 8. Critérios de aceite

| Critério | Evidência |
|---|---|
| Uma entrada só de "Ventilação mecânica — ajuste inicial" | O RT confere na Central; o teste de duplicados |
| O check-in aparece só na faixa do topo (e na tela de bloqueio) | O RT confere |
| O cartão "Atendimento" leva à fila do PS | O RT confere |
| Clicar em Internação abre a lista | O RT confere |
| A impressão de prontuário abre pelo leito e por Prontuários, com o paciente escolhido | O RT confere |
| A IA não sugere mais a rota duplicada | Reindexação da biblioteca registrada |

## 9. Riscos

| Risco | Cuidado |
|---|---|
| Favorito ou recente salvo com a rota da VM antiga | Redirecionamento |
| Link antigo para os formulários soltos (pendências, porta) | As rotas ficam; só o cartão sai |
| Perder o único caminho da impressão de prontuário | O botão novo entra antes de o cartão sair |
| Reindexar a biblioteca mexe na produção da IA | Primeiro na homologação; na produção só com "ok produção" |

## 10. Ordem de implementação

1. Botão "Imprimir prontuário" no leito e em Prontuários.
2. As seções do Plantão: tirar o check-in, trocar o Atendimento e abrir a
   Internação direto na lista.
3. A ferramenta da VM duplicada, com o redirecionamento.
4. O aviso do gestor.
5. Homologação e conferência do RT. Depois, o merge, que publica, porque
   não há banco. A reindexação da biblioteca na produção espera o "ok
   produção".

## 11. Como demonstrar comercialmente

"O plantão tem um caminho para cada coisa: Atendimento abre a fila, e
Internação abre os internados. O prontuário é impresso de dentro do leito."

## 12. Opções de tela (referências reais do Refero)

**Para o botão "Imprimir prontuário" no leito:**

- **Opção A, recomendada:** botão visível no cabeçalho do paciente, ao lado
  das ações que já existem.
  - [Attio, ficha da empresa](https://refero.design/pages/cbbee303-d2de-4099-84f4-660c869ad2fa):
    as ações da ficha ficam no topo, à vista.
- **Opção B:** dentro de um menu "Mais ações" no cabeçalho.
  - [PayPal, detalhe da fatura](https://refero.design/pages/77200ad5-7b79-442c-8eff-9b5173365fbe):
    ações secundárias num menu suspenso.
- A impressão de prontuário é rara no plantão, mas o RT pediu um lugar
  próprio e fácil de achar. Por isso recomendo a A.

## 13. Perguntas ao RT

1. **Ponto 2.** Tiro só a cópia da seção Ventilação Mecânica e mantenho a
   de Emergências? Recomendo que sim.
2. **Ponto 5, impressão de prontuário.** O "local próprio" é:
   - o botão no cabeçalho do leito e em Prontuários — **recomendado**;
   - ou outro lugar que você tenha em mente?
3. **Ponto 5, "Pendências e alertas".** A página `/pendencias-pep` junta os
   rascunhos de documento a emitir de todos os pacientes. Ela deixa de ter
   cartão e fica só como destino do aviso do check-out. Pode ser?
4. **Gestor.** O aviso de rascunhos dele vira só texto, sem link, já que a
   página não é dele?
