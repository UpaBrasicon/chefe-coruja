# Item 30: medição das telas logadas na homologação (16/11/2026)

Trilha de desempenho. Os itens 05 (resto), 23 e 26 esperavam medidas de uso real (item 30, Sentry). Como a produção ainda não tem equipe usando, o RT pediu para seguir medindo na homologação.

## Como foi medido

- **Ambiente:** Chrome do RT, `homolog.chefecoruja.com.br`, logado como médico da UPA Fase 5, com cada tela aberta do zero (recarga completa).
- **Medidas, pelas APIs do próprio navegador:**
  - maior pintura (LCP);
  - tarefas longas (> 50 ms);
  - número de chamadas à API e a mais lenta;
  - memória e tamanho da página.
- **Cliques e digitação:** pelo tempo de processamento de cada evento (Event Timing). O tempo total do evento sai inflado com o navegador controlado por automação (~200 ms de espera pela pintura em todos os eventos, até numa tecla). O que mostra o custo do app é o processamento.

## Resultado

| Tela | LCP | Tarefas longas | Chamadas à API | Mais lenta | Memória |
|---|---|---|---|---|---|
| Central do médico (`/plantonista`) | 0,9 s | 1 (207 ms, na carga) | 27 | `perfis`, 214 ms | 36 MB |
| Plantão (`/plantao`) | 1,7 s (3,4 s numa primeira carga fria) | 0 | 24 | `leitos`, 195 ms | 23 MB |
| Atendimento (`/atendimento`) | 1,1 s | 0 | 27 | `setores_na_escala_agora`, 205 ms | 24 MB |
| Prontuários (`/prontuarios`) | 1,2 s | 0 | 19 | `contexto_sem_conexao`, 119 ms | 43 MB |
| Regulação (`/regulacao`) | 1,3 s | 0 | 22 | `regulacao_lista`, 161 ms | 35 MB |

Interações na Central:
- **busca** (digitar "potassio"): processamento até 14 ms;
- **abrir a seção Escores:** 32 ms no total, 1 ms de processamento.

Todas as telas ficam dentro do "bom" do Google: LCP abaixo de 2,5 s e resposta abaixo de 200 ms. A exceção é uma primeira carga fria do Plantão, que não se repetiu.

## O limite desta medição

A homologação tem pouco dado:
- 1 conversa de chat na maior unidade;
- nenhum chamado técnico;
- 87 perfis;
- nenhuma diluição;
- 99 pacientes na maior unidade.

As quatro listas que o item 05 deixou inteiras (chat, chamados, pessoas e diluições) não podem ser julgadas aqui. Elas também não foram medidas no papel de gestor, porque o login usado foi o de médico.

**Estimativa para uma UPA em uso:**
- poucas centenas de conversas, chamados e pessoas por ano;
- algumas dezenas de diluições.

Contas na tela sobre algumas centenas de linhas custam poucos milissegundos.

## Proposta para o RT

**D1. Itens 05 (resto), 23 e 26**
- **A (recomendada):** fechar os três como "não se aplica por ora", com esta medição como evidência, e reabrir se uma destas acontecer:
  - o Sentry (item 30) mostrar INP p75 acima de 200 ms ou LCP p75 acima de 2,5 s numa tela;
  - uma das quatro listas passar de 1.000 linhas numa unidade.
- **B:** manter os três abertos até haver uso real na produção.

## Decisão do RT (16/11/2026)

**D1 = A.** O resto do 05, o 23 e o 26 estão fechados como "não se aplica por ora", com os gatilhos de reabertura acima.
