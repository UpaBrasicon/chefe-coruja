# Médios da escala que dependem de decisão do RT — M2, M7 e M9 (30/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, seção 5 ("Médios").
Regra da sessão principal com o RT fora: médio que exige decisão de comportamento não é codificado;
vai como proposta. Cada item tem a recomendação em primeiro lugar.

Registrados sem código: **M4** (quem pede a troca não cancelava) fica resolvido pelo A4 (#357,
`cancelar_troca`, botão Cancelar em "Seus pedidos" e "Minhas trocas"), quando ele for à produção.
**M12** (farmacêutico e faturamento em `PAPEIS_POR_ESCALA`) foi adiado de propósito na E3 ("Pendente,
em passo próprio: farmacêutico e faturamento entrarem pela escala, depois que o gestor escalar os
dois", BACKLOG): não é bug; espera o gestor escalar os dois.

---

## M2 — O que a aprovação de falta e de saída do fixo faz

Hoje aprovar só muda o status. Falta aprovada: o plantão continua ativo e nenhuma vaga abre (o envio ao
ERP já conta como "falta justificada"). Saída do fixo aprovada: a fixa continua gerando o mês. E o banco
aceita "sair da fixa" num plantão que não veio da fixa e já está em curso.

### Falta justificada aprovada

- **A (recomendada):** se o plantão ainda não começou, a aprovação **abre uma vaga** da mesma categoria
  e faixa e avisa a categoria (como `marcar_vaga_escala`); o plantão fica com a pessoa, marcado como falta
  justificada (o ERP continua contando certo), e sai da cobertura. Se o plantão já passou, só registra
  (como hoje).
- **B:** só registra (como hoje); o gestor abre a vaga à mão se quiser cobrir.

### Saída do fixo aprovada

- **A (recomendada):** a aprovação **encerra a linha da fixa** (mesma pessoa, setor, dia da semana e
  faixa) para os meses ainda não gerados; os plantões já gerados ficam, e o gestor decide cada um. O
  pedido só pode ser feito de plantão que veio da fixa.
- **B:** só registra; o gestor tira a pessoa da fixa à mão na aba Fixa.

## M7 — Plantão sem categoria pula a trava de categoria

Plantão com `papel = NULL` (a E1 deixa nulo para quem tem duas categorias, para o gestor escolher) pula
a trava de troca e passagem dentro da categoria. Na homologação, os 24 plantões do "Teste Homologação"
estão assim; não há tela que force a escolha.

- **A (recomendada):** enquanto o plantão não tiver categoria, troca e passagem só para quem tem **alguma
  categoria em comum** com o dono na unidade; e a escala do mês do gestor mostra um aviso "N plantões sem
  categoria" com um atalho para escolher a categoria de cada um (ou de todos de uma pessoa de uma vez).
- **B:** troca e passagem ficam **bloqueadas** para plantão sem categoria até o gestor escolher, com a
  mensagem "Peça à coordenação para definir a categoria deste plantão".

## M9 — Gestor que também está escalado aprova o próprio pedido

O gestor que também é plantonista (ou de outra categoria) aprova a própria passagem ou troca (hoje sem
2º fator).

- **A (recomendada):** pode aprovar, mas com **2º fator** (como `aprovar_candidatura`) e com o registro
  dizendo "aprovou o próprio pedido" no histórico e na auditoria (o M6 já grava a decisão). Resolve a
  unidade com um gestor só.
- **B:** **não** pode aprovar o próprio pedido: precisa de outro gestor ou do super admin. Mais rígido;
  trava a unidade com um gestor só.

---

Cada decisão vira um PR próprio, com teste primeiro, migration expand/contract e homologação, como os
outros itens da trilha.

---

## Decisões do RT (31/10/2026)

| Item | Opção escolhida | O que acontece |
|---|---|---|
| M2 — falta justificada aprovada | **B, "Só registra"** | Nada muda no código: a aprovação só muda o status; o plantão continua com a pessoa, marcado como falta justificada (o ERP conta certo), e o gestor abre a vaga à mão se quiser cobrir. Decisão registrada; sem PR. |
| M2 — saída do fixo aprovada | **A, "Encerra a fixa"** | PR próprio: a aprovação encerra a linha da fixa para os meses ainda não gerados; o pedido só vale para plantão que veio da fixa. |
| M7 | **A, "Categoria em comum"** | PR próprio: troca e passagem de plantão sem categoria só com quem tem categoria em comum com o dono, mais o aviso "N plantões sem categoria" e o atalho no mês do gestor. |
| M9 | **A, "Pode, com 2º fator"** | PR próprio: o gestor aprova o próprio pedido com 2º fator, e o registro diz "aprovou o próprio pedido". |
