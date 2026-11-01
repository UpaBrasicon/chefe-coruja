# Baixos da escala — propostas para o RT e registro (30/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, seção 5 ("Baixos").
Regra da sessão principal com o RT fora: o que exige decisão de comportamento vai como proposta; o
resto foi corrigido em PR próprio.

## Situação dos 12

| # | Situação |
|---|---|
| B1 | Resolvido pelo **A1** (#352, em produção): a vaga de outra categoria na mesma faixa não bate mais no índice; a da mesma categoria é devolvida pela RPC, sem erro cru. |
| B2 | Corrigido junto com o **M1** (#358, mesma função `vagas_abertas`): a vaga numa faixa em que eu já estou escalado não aparece. **Em produção** (30/10/2026). |
| B3 | Decisão do RT em 31/10 ("Aceita como retroativo"), corrigido no PR da migration `20270208000015`. |
| B4 | Corrigido e **em produção**: #367 (migration `20270208000012`, 30/10/2026). |
| B5 | Decisão do RT em 31/10 ("Completar a lista"), corrigido no PR da migration `20270208000019`. |
| B6 | Resolvido pelo **A4** (#357): rótulo "cancelada" da troca. Em produção (30/10/2026). |
| B7 | Resolvido pelo **A4** (#357): "Seus pedidos" mostra só as trocas que eu pedi. |
| B8 | Corrigido e **em produção**: #366 (só tela). |
| B9 | Resolvido pelo **A4** (#357): `aprovar_troca` não grava mais "erro" para desfazer em seguida (a troca vai por `efetivar_troca`), e a troca não se aplica mais na hora em `solicitar_troca`. O texto de erro da tela segue para trocas antigas. |
| B10 | Corrigido e **em produção**: #368 (migration `20270208000013`, 30/10/2026). |
| B11 | Decisão do RT em 31/10 ("Libera só a aba Escala"), corrigido no PR `fix/escala-b11-portao-aba-escala` (só tela). |
| B12 | Parte resolvida: plantão **encerrado** não se passa (M3, #360) nem se troca (B10, #368). O "agora" da tela que congela é igual em toda a aba (hora em que abriu) e não deixa passar nada que o banco recuse. O plantão **já iniciado**: decisão do RT em 31/10 ("Passa sim, troca não"), corrigido no PR da migration `20270208000014`. |

---

## B3 — Escalar em dia que já passou

`adicionar_plantao_escala` aceita dia passado (gravado 28/10 noite às 04 h de 29/10).

- **A (recomendada):** aceita, mas só o gestor, com aviso na tela ("Este plantão já passou; fica como
  acerto retroativo") e com o histórico marcando "retroativo". Serve para acertar a escala do mês (ERP,
  falta, presença).
- **B:** recusa dia passado; acerto só pelo super admin.

## B5 — Ordem do "papel mais forte"

`private.papel_na_unidade` (usada em quase toda a RLS) ordena admin, gestor, plantonista, telemedicina,
enfermeiro, técnico, farmacêutico, recepção. Regulador, NIR, faturamento e os papéis de rede ficam fora
da lista: entre dois deles, a ordem é indefinida.

- **A (recomendada):** completar a lista sem mexer nos que já estão: depois da recepção, regulador, NIR,
  faturamento e os papéis de rede, nessa ordem. Só muda o resultado para quem tem dois desses papéis
  (hoje indefinido).
- **B:** deixar como está e documentar que essa função não serve para quem tem dois papéis fora da lista.

Por mexer em autorização, a mudança vai com teste de cada par de papéis afetado.

## B11 — Quem perdeu a tolerância do check-in não abre a aba Escala

Quem passou da tolerância vê só o portão de check-in; a aba Escala não abre para justificar a falta.

- **A (recomendada):** o portão deixa abrir só a aba Escala (sem nada clínico), para justificar a falta
  ou ver os próximos plantões; o resto continua bloqueado até o check-in.
- **B:** o portão ganha um botão "Justificar falta deste plantão" que abre a janela da justificativa ali
  mesmo, sem abrir a aba.

## B12 — Passagem e troca de plantão já iniciado

Hoje o plantão em curso pode ser passado e trocado (quem sai no meio do plantão).

- **A (recomendada):** manter: passar o plantão em curso é o caso de quem precisa sair; a troca de
  plantão em curso fica bloqueada (não faz sentido trocar o que já começou).
- **B:** bloquear passagem e troca de plantão iniciado; quem precisa sair fala com a coordenação.

---

## Decisões do RT (31/10/2026)

| Item | Opção escolhida | O que acontece |
|---|---|---|
| B3 | **A, "Aceita como retroativo"** | PR próprio: dia passado só pelo gestor, com aviso na tela e o histórico marcando "retroativo". |
| B5 | **A, "Completar a lista"** | PR próprio: a ordem do papel mais forte ganha os papéis que faltam, depois da recepção, com teste de cada par afetado. |
| B11 | **A, "Libera só a aba Escala"** | PR próprio: quem perdeu a tolerância do check-in abre só a aba Escala; o resto segue bloqueado. |
| B12 | **A, "Passa sim, troca não"** | PR próprio: o plantão em curso continua podendo ser passado; a troca de plantão já iniciado fica bloqueada. |
