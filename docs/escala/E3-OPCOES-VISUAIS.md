# Aba Escala, entrega E3 — opções visuais

28/10/2026. A E3 dá a aba **Escala**, só de leitura, aos papéis que ainda não têm: enfermeiro, técnico
de enfermagem, recepção, regulador, farmacêutico, faturamento, NIR, telemedicina e os papéis de rede.
Gestor e administrador ficam de fora. O plantonista continua com a "Minha agenda" dele.

Já decidido pelo RT em 27/10:
- cada um vê a própria escala e a da equipe inteira da sua categoria (resposta 2);
- a aba abre também fora do plantão (resposta 3);
- farmacêutico e faturamento passam a entrar pela escala (resposta 7);
- a "Minha agenda" da telemedicina vira a aba Escala comum (resposta 10).

**Nada aplicado.** As maquetes usam os componentes do app com dados fictícios: uma enfermeira olhando
a escala da enfermagem (página de teste, fora do repositório).

## Referências do Refero

| Tela | O que se aproveita |
|---|---|
| Cron, dia ao lado do mês (`0e4d878a`) | Mês à esquerda e o dia escolhido num painel estreito, como a Escala do gestor (3.9) |
| Missive, mês (`d90906b7`) | Itens do dia escritos na própria célula do mês |
| Luma, eventos (`3c6cf3f9`) | Lista do que vem pela frente, com o dia à esquerda e o cartão à direita |
| Aboard, férias da equipe (`19f4c24f`) | Uma linha por pessoa e uma coluna por dia, para ver quem está quando |
| Wrike, carga da equipe (`57711471`) | Grade pessoa × dia com fim de semana sombreado |

## Opções (`maquetes/e3-A|B|C-claro|escuro.jpg` e `-claro-celular.jpg`)

Em todas: no topo, o **próximo plantão** (o mesmo cartão da tela "Fora do seu horário"); dos colegas,
só nome, setor e horário; nenhum dado de paciente; nenhuma ação (troca, passagem, falta e vaga ficam para
a E4).

- **A · o mês com o dia ao lado** (Cron, Missive). O mesmo desenho da Escala do gestor, só de leitura.
  No mês, os dias em que eu trabalho trazem a faixa e o setor ("Noite · Pronto-Socorro"; no celular,
  só a letra). Ao lado, o dia escolhido com a equipe da minha categoria, setor por setor, e "você" no meu
  nome. Quem já conhece a tela do gestor reconhece esta.
- **B · agenda em lista** (Luma). Duas abas: "Meus plantões", uma lista do mês com o dia à esquerda e,
  em cada plantão, setor, horário e quem da minha categoria está comigo no mesmo setor; e "Equipe de
  enfermagem", a mesma lista dia a dia com todos da categoria. A mais simples de ler no celular.
- **C · grade da equipe** (Aboard, Wrike). Uma linha por pessoa da categoria, uma coluna por dia (duas
  semanas por vez), com D, M e N em cada célula; a minha linha em destaque no alto. Mostra de uma vez quem
  trabalha quando; no celular, a grade corre para o lado.

## Fora do visual (igual nas três)

- **Menu:** item "Escala" para cada papel da lista acima. Na telemedicina, ele substitui "Minha agenda",
  e o extrato do plantão remoto vira uma segunda aba dentro da Escala.
- **Fora do plantão:** a tela "Fora do seu horário" ganha o botão "Ver minha escala", e a casca deixa
  abrir só a rota da Escala (nada clínico) para quem entra pela escala.
- **Farmacêutico e faturamento:** entram em `PAPEIS_POR_ESCALA`. Antes de ligar, conferir que cada um tem
  plantão na escala: quem não tiver deixa de abrir o app fora da Escala.
- **Banco:** `minha_escala(p_de, p_ate)` (os meus plantões em todas as unidades, também fora do plantão;
  `tele_minha_escala` passa a chamá-la) e `escala_da_unidade` (já devolve a equipe da categoria desde a E1).

## Perguntas ao RT

1. **Qual opção:** A, B ou C?
2. **Farmacêutico e faturamento:** ligo a entrada pela escala já na E3, ou primeiro o gestor escala os dois
   e eu ligo depois, para ninguém perder o acesso no meio do caminho? Sugestão: depois, num passo próprio.

## Decisão do RT (28/10/2026) e o que foi aplicado

**Opção A**, o mês com o dia ao lado. Farmacêutico e faturamento: sem resposta nesta rodada; vale a
sugestão (a entrada pela escala liga depois, num passo próprio, quando o gestor tiver escalado os dois).
Até lá eles já têm a aba Escala, sem bloqueio fora do plantão.

- Sem migration: a tela lê `escala_da_unidade` (equipe da categoria desde a E1), os setores e
  `meu_proximo_plantao`.
- `src/components/escala/EscalaEquipe.tsx`: o próximo plantão no alto; o mês com os meus plantões na
  célula (faixa e setor; no celular, só a letra); ao lado, o dia escolhido com a equipe da categoria,
  setor por setor, horário e "você" no meu nome.
- `src/pages/EscalaEquipe.tsx`: rota `/minha-escala`. Na telemedicina, duas abas, Escala e Extrato (o
  extrato que estava na "Minha agenda"); `/telemedicina/agenda` leva para lá.
- Menu (`navegacao.ts`): item "Escala" para enfermeiro, técnico, recepção, regulador, farmacêutico,
  faturamento, NIR, telemedicina (no lugar de "Minha agenda") e papéis de rede. Plantonista, gestor e
  administrador não mudam.
- Fora do plantão: a tela "Fora do seu horário" ganha "Ver minha escala", que abre só a escala, com
  "Voltar" (nada clínico). O cartão do próximo plantão passou para `ProximoPlantao.tsx`, usado nas duas.
- Imagens da tela real com dados fictícios: `maquetes/e3-A-aplicada-claro|escuro|celular|tele.jpg`,
  `e3-fora-do-plantao.jpg` e `e3-fora-do-plantao-escala.jpg`.
