# Rascunho cifrado na triagem: diagnóstico

O pedido é o achado guardado de 07/10/2026, aberto pelo RT em 05/11/2026 como item 2 do lote de segurança ("Sim, nessa ordem").

## O problema

A tela de classificação (`src/pages/enfermagem/triagem/Classificar.tsx`) mantém tudo só na memória do React. Se a página recarrega, a conexão cai e o navegador fecha, ou a bateria acaba, perde-se tudo o que a enfermeira já digitou:
- a queixa e o grupo trocado (adulto ou pediátrico);
- o fluxograma e o discriminador;
- os sinais vitais;
- a avaliação (AVDI, Glasgow, tempo de sintomas, comorbidades, medicações);
- a dor (escala e itens);
- o oxigênio;
- a gestação;
- a cor escolhida;
- o motivo da reclassificação e a justificativa de cor abaixo da sugerida.

## O que já existe

- **O mecanismo do item 13 da Fase 0** está pronto e já é usado na evolução, nos documentos da internação, na ficha de admissão, na AIH e no SMS003a:
  - `src/lib/cofreLocal.ts` cifra com AES-256-GCM, usando a chave da sessão que vem do servidor (`chave_rascunho`) e que é apagada quando a sessão acaba;
  - `src/lib/rascunho.ts` grava e lê o envelope com hora, e o hook `useRascunho`.
- **Garantias que já vêm junto:**
  - sem a chave, nada é gravado em texto claro;
  - o rascunho expira em 12 h;
  - o logout apaga todos os rascunhos (`limparTodosRascunhos`);
  - a chave do rascunho tem a pessoa e a unidade, então outra pessoa no mesmo computador não lê nem recupera.
- **Não precisa de migration nem de RPC nova.**

## Decisões para o RT

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| M1 | O que o rascunho guarda | Tudo o que a enfermeira digitou, inclusive a cor escolhida. A cor continua sendo dela: só ela, com o mesmo login, recupera. | Tudo, menos a cor: ela escolhe de novo ao voltar. |
| M2 | Validade do rascunho da triagem | 2 h, a mesma janela do modo sem conexão. Sinal vital de triagem envelhece rápido, e um rascunho mais velho é descartado. | 12 h, como os outros rascunhos. |
| M3 | Aviso ao recuperar | Uma faixa no topo: "Rascunho das HH:MM recuperado. Confira os sinais vitais antes de registrar.", com o botão "Descartar rascunho". | Recuperar sem aviso. |
| M4 | De quem é o rascunho | Um por atendimento, pessoa e unidade. Se a reclassificação for do mesmo atendimento, ela tem rascunho próprio, separado da classificação. | Um por atendimento, só. |
| M5 | Quando apagar | Ao registrar a classificação, ao descartar, no logout e quando vencer a validade. Cancelar ou trocar de paciente não apaga. | Apagar também ao cancelar. |

## Plano (com A em tudo)

1. **Teste antes.** Um teste puro do recorte: o que entra no rascunho, o que fica fora (busca, listas abertas, `tentou`), a validade de 2 h e a chave com a reclassificação. Mais um teste de fonte mostrando que a `Classificar.tsx` usa o cofre e apaga o rascunho no `onSuccess`.
2. **`src/lib/rascunhoTriagem.ts`.** Fica com o tipo do rascunho, o `carregar` com validade de 2 h e a chave `triagem:<episódio>[:reclass]`. Ele aproveita `salvarEnvelope` e `carregarEnvelope`, e o `rascunho.ts` passa a aceitar uma validade por chamada.
3. **`Classificar.tsx`.**
   - O estado inicial vem do rascunho, quando houver, e é gravado com espera de 500 ms.
   - A tela mostra a faixa de aviso com a hora e o botão "Descartar rascunho".
   - O rascunho é apagado no `onSuccess`.
4. **Homologação.** Conferir no Chrome como enfermeiro de teste: digitar, recarregar a página, ver a faixa, conferir que o rascunho no `localStorage` está cifrado (prefixo `ccr1:`), registrar e ver o rascunho sumir.
5. **Entrega.** BACKLOG e PR próprio.

## Riscos

- **Aba nova sem conexão.** Sem a chave, o rascunho não é gravado; esse é o comportamento atual, de propósito. O item 3 do lote (recarga sem conexão) cuida disso depois.
- **Sinal vital velho.** M2 e M3 cobrem: a faixa mostra a hora e pede para conferir.
