# Pontos 6 a 8 — Resumo do leito em abas, botões juntos, sem aba Classificação

Plano da tarefa, no formato do "Plano de Trabalho — comando por tarefa" do
`BACKLOG.md`. O RT pediu em 29/10/2026: "Começar 6 a 8".

**Estado (29/10/2026):** o RT aprovou o plano como recomendado (seção 14).
A implementação está no PR #346 (branch `fix/leito-resumo-abas`), publicada
na homologação e aguardando a conferência do RT. Não há banco: o merge publica.

```
Vamos trabalhar a tarefa: pontos 6 a 8, Resumo do leito em abas, os três botões juntos e sem a aba Classificação.

Contexto:
Fase: Telas do plantonista (pedidos do RT em 27/10/2026)
Prioridade: P2 (sugerida no BACKLOG)
Objetivo comercial: o médico acha o que precisa no leito sem rolar uma coluna longa
Objetivo técnico: o Resumo dividido em sub-abas; as três ações do paciente juntas no cabeçalho; a classificação só na cor do cabeçalho
Módulos afetados: caderno do leito (LeitoAberto, ListaInternados, Passagem, Intercorrencias, Classificacao)
Concorrentes que essa tarefa ajuda a enfrentar: PEPs com o resumo do leito organizado por assunto (MV, Tasy)
```

## 1. Diagnóstico do estado atual

Conferi no master de 29/10/2026. Todos os três pontos são só de tela.

### 1.1 Ponto 6 — Resumo é uma coluna longa

A aba Resumo (`src/components/internacao/LeitoAberto.tsx:304-326`) empilha
nove blocos numa coluna só:

1. gravidade e tendência (`BlocoAcuidade`);
2. sepse (só para criança, `BlocoSepse`);
3. pendências (`BlocoPendencias`);
4. passagem de plantão (`BlocoPassagem`);
5. passagens recebidas (`PassagensDoPlantao`);
6. atendimentos encerrados do paciente (`HistoricoEncerrado`);
7. regulações (`HistoricoRegulacao`);
8. reentrada de contingência (`ReentradaContingencia`);
9. intercorrências (`Intercorrencias`).

Logo abaixo vem a trilha da internação (`TrilhaEpisodio`, `:421`): entradas e
transferências de leito e de setor.

### 1.2 Ponto 7 — Os três botões estão em três lugares

| Botão | Onde está hoje |
|---|---|
| "Transferir de setor" | Canto do cabeçalho do paciente (`ListaInternados.tsx:244-246`, por `acoesTopo`) |
| "Passar este paciente" | Dentro do bloco de passagem, no meio do Resumo (`caderno/Passagem.tsx:42`) |
| "Registrar intercorrência" | No fim do Resumo (`src/components/prontuario/Intercorrencias.tsx:90`); o formulário já abre numa janela |

**Achado (bug leve).** "Transferir de setor" aparece para todos, inclusive
para o gestor e para internação encerrada (`ListaInternados.tsx:244`). O
banco recusa o que não pode, mas o botão não deveria aparecer.

### 1.3 Ponto 8 — Aba Classificação

A aba (`caderno/Classificacao.tsx`) só lê a classificação da porta e o
histórico (`classificacoes_do_leito`).

- A cor da classificação já aparece no cabeçalho, e clicar nela abre essa
  aba (`LeitoAberto.tsx:403` e `:456`).
- A mesma tela do leito serve ao gestor. Para ele, a aba Classificação é uma
  das abas de leitura (`ABAS_LEITURA`, `:87`).
- A enfermagem tem tela própria de classificação. Esta não é a dela.

## 2. Subtarefas técnicas

| # | Subtarefa | Camada |
|---|---|---|
| 1 | Resumo com sub-abas: Agora, Pendências, Histórico na unidade, Regulações | tela |
| 2 | Os três botões juntos no cabeçalho do paciente, só para quem cuida da internação ativa | tela |
| 3 | "Passar este paciente" abre o formulário numa janela, como a intercorrência | tela |
| 4 | "Transferir de setor" some para o gestor e para internação encerrada | tela |
| 5 | Sai a aba Classificação; clicar na cor abre o histórico numa janela | tela |

## 3. Alterações de banco

Nenhuma.

## 4. Alterações de RPC

Nenhuma. As mesmas RPCs: passagem, intercorrência, transferência e
`classificacoes_do_leito`.

## 5. Alterações de frontend

**Resumo em sub-abas** (opção A da seção 12, a mesma peça de sub-abas da
Evolução):

| Sub-aba | O que mostra |
|---|---|
| **Agora** (abre primeiro) | gravidade e tendência, sepse, passagens recebidas, reentrada de contingência e intercorrências |
| **Pendências** | o bloco de pendências de hoje |
| **Histórico na unidade** | a trilha desta internação e os atendimentos encerrados do paciente (pergunta 1) |
| **Regulações** | as regulações do paciente na rede |

**Os três botões no cabeçalho do paciente:** "Transferir de setor", "Passar
este paciente" e "Registrar intercorrência".

- Só aparecem para quem escreve no leito (`escreve`) e com a internação
  ativa.
- A passagem passa a abrir o formulário numa janela, como a intercorrência.
- No Resumo continuam a lista das passagens e a das intercorrências, sem os
  botões.

**Aba Classificação.**

- Sai das abas de quem escreve (o médico).
- Clicar na cor do cabeçalho abre o histórico numa janela, com a mesma peça
  de hoje (`AbaClassificacao`).
- Para o gestor, a decisão é da pergunta 2.

## 6. Permissões e auditoria

Nada muda no banco.

- A passagem, a intercorrência e a transferência seguem com as mesmas regras
  e o mesmo registro de autor.
- O botão escondido do gestor só corrige a tela: o banco já recusava.

## 7. Testes

| Teste | Onde |
|---|---|
| Os três botões só aparecem com a internação ativa e para quem escreve | Teste em node da regra (função que decide as ações do cabeçalho) |
| O RT navega pelo Resumo, passa um paciente e registra uma intercorrência na homologação | Registro neste documento |

## 8. Critérios de aceite

| Critério | Evidência |
|---|---|
| Resumo em quatro sub-abas | O RT confere |
| Os três botões numa linha, no cabeçalho | O RT confere |
| O gestor e a internação encerrada não veem "Transferir de setor" | O RT confere com o perfil de gestor |
| A aba Classificação sumiu; a cor abre o histórico | O RT confere |

## 9. Riscos

| Risco | Cuidado |
|---|---|
| Algo importante escondido numa sub-aba que ninguém abre | A sub-aba "Agora" abre primeiro, com o que muda no plantão; a contagem de pendências aparece no nome da sub-aba |
| Passagem em janela muda um fluxo que já é usado | O formulário é o mesmo; só o lugar onde ele abre muda |

## 10. Ordem de implementação

1. Os botões no cabeçalho, com a passagem em janela e o "Transferir" escondido
   de quem não pode.
2. As sub-abas do Resumo.
3. A aba Classificação sai, e a cor abre a janela.
4. Homologação e conferência do RT. Depois, o merge, que publica, porque não há banco.

## 11. Como demonstrar comercialmente

"No leito, o médico vê primeiro o que importa agora. As ações do paciente
ficam juntas no topo, e o histórico fica a um clique."

## 12. Opções de tela (referências reais do Refero)

**Resumo em sub-abas.**

- **Opção A, recomendada:** sub-abas no topo do Resumo, como as da Evolução.
  - [Attio, ficha da empresa](https://refero.design/pages/cbbee303-d2de-4099-84f4-660c869ad2fa):
    abas no topo do painel da ficha e as ações da ficha à vista.
  - [Aboard, documentos](https://refero.design/pages/ed707e21-3e6f-4218-9c55-42e690d96676):
    abas de segundo nível dentro de uma seção.
- **Opção B:** a gravidade sempre visível à esquerda, e as outras partes em
  abas à direita.
  - [Fibery, ficha de contato](https://refero.design/pages/c868628b-c4d1-4caf-8b57-8add54187bc4):
    conteúdo principal e um painel lateral fixo.
  - Ocupa mais largura. Por isso recomendo a A, que repete o que o médico já
    conhece da Evolução.

**Botões no cabeçalho:** a mesma referência da Attio, com as ações da ficha
juntas no topo.

## 13. Perguntas ao RT

1. **"Histórico na unidade"** é:
   - (a) a trilha desta internação (entradas e transferências);
   - (b) os atendimentos anteriores do paciente;
   - (c) os dois — **recomendado**.
2. **O gestor também perde a aba Classificação?** Recomendo que sim: para ele
   também, clicar na cor abre o histórico numa janela.
3. **Passar o paciente numa janela,** como a intercorrência, em vez de abrir
   o formulário no meio do Resumo?
4. **Tela:** opção A (sub-abas no topo) ou B (gravidade fixa ao lado)?

## 14. Respostas do RT (29/10/2026) e implementação

O RT respondeu "Aprovo" ao plano como recomendado:

1. Histórico na unidade: (c), a trilha desta internação e os atendimentos
   anteriores do paciente.
2. O gestor também perde a aba Classificação; a cor abre a janela para ele.
3. A passagem abre numa janela.
4. Opção A: sub-abas no topo do Resumo.

Implementação (PR #346):

- `src/lib/acoesLeito.ts` (com teste): quais botões o cabeçalho mostra, a
  sub-aba inicial, a contagem de pendências e o endereço antigo `?aba=classif`.
- `LeitoAberto.tsx`: `ResumoEmAbas`; os três botões no cabeçalho; as janelas
  de classificação, passagem e intercorrência. A prop `acoesTopo` virou
  `onTransferir`.
- `caderno/Passagem.tsx`: `DialogoPassagem`; o bloco do Resumo fica só com a
  situação (`semBotao`). O modo simples (observação) segue com o botão.
- `Intercorrencias.tsx`: `semBotao` e `DialogoIntercorrencia` exportada.
- `caderno/Classificacao.tsx`: `DialogoClassificacao`.
- Com passagem aguardando aceite, o botão de passar fica desligado, com o
  motivo no título.
- Internação encerrada abre o Resumo em Histórico na unidade.

Checagens: `tsc -b`, eslint e `padrao-frontend --ci` ok; `src/lib` 194/194;
`test:clinico` 1102/1102.
