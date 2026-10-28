# Aba Escala, ajuste da E4 — troca, passagem e vaga à vista

28/10/2026. Pedido do RT (pela sessão da revisão do plantonista), testando na homologação com
`teste.homolog@chefecoruja.com.br`: "só tem justificar falta, não tem troca ou aceitar plantão".

**O que aconteceu.** O RT tinha escolhido no calendário o 7/10, um plantão que já passou. Nesse caso a E4
mostra só "Justificar falta", de propósito: não se troca nem se passa plantão que já terminou. Trocar e
Passar aparecem só ao escolher um dia futuro, e "Candidatar-me" só no dia da vaga. Nada disso estava
à vista sem procurar no mês.

**Nada aplicado.** Três maquetes sobre a tela da E4 com dados fictícios (o 7/10 escolhido, hoje 28/10).

## Referências do Refero

| Tela | O que se aproveita |
|---|---|
| Fresha, gerenciar agendamento (`16360f89`) | As ações do próximo compromisso no próprio cartão dele |
| Fresha, próximos agendamentos (`a2354b30`) | Lista "Upcoming" com cada item e suas ações |
| Aboard, calendário de ausências (`3255dd44`) | Coluna ao lado com o que está pendente e o que dá para fazer |

## Opções (`maquetes/e4b-A|B|C-claro|escuro.jpg` e `-claro-celular.jpg`)

Em todas, o dia que já passou explica por que só há "Justificar falta".

- **A · ações no próximo plantão** (Fresha, gerenciar). O cartão "Próximo plantão" no alto ganha
  Trocar, Passar e Justificar falta. Ao lado, "Vagas abertas da sua categoria" com "Candidatar-me" em cada
  uma. No dia passado: a explicação e "Ir para o próximo plantão".
- **B · faixa dos próximos plantões** (Fresha, próximos). No alto, os próximos três plantões, cada um com
  Trocar, Passar e Justificar falta; ao lado, as vagas abertas com "Candidatar-me". O calendário fica para
  consultar.
- **C · a tela abre no próximo plantão** (Aboard). Muda o mínimo: ao abrir a Escala, o dia escolhido é o
  do próximo plantão, já com as ações; uma faixa no alto avisa das vagas abertas ("2 vagas abertas para
  enfermeiro · Ver as vagas"); o dia passado explica e leva ao próximo.

Nenhuma opção muda banco: são as mesmas RPCs da E4.

## Pergunta ao RT

Qual opção: A, B ou C?
