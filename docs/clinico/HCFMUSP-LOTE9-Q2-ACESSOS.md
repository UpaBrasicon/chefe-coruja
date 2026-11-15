# Revisão do HCFMUSP, lote 9, Q2: cap. 105 (acessos na emergência)

Em 15/11/2026 o RT decidiu Q1 a Q4 = A no lote 9 e liberou a produção do lote inteiro. Pela Q2, o cap. 105 segue três passos: ler a diretriz, pôr a lista na ficha e fazer a nota.

## Fonte

- **Diretriz alemã S1 2025 de acesso vascular na sala de reanimação:** Struck et al., Int J Emerg Med 2025;18(1):187 (PMID 41039227; PMC12490025).
  - É o resumo em inglês da diretriz S1 de cinco sociedades alemãs (DGAI, DGINA, DGIIN, DGNI e DGU). S1 quer dizer consenso de especialistas, sem graduação.
  - O texto do PMC veio sem as recomendações, que estão em listas. Li o texto integral no site da revista, em acesso aberto, pelo Chrome.
  - Entraram as recomendações que mudam a conduta no PS. Ficaram fora fixação, documentação, queimado, ECMO e REBOA.
- **Manual:** cap. 105 conferido no PDF, p. 1396–1397, 1399, 1400, 1405, 1408, 1409 e 1414.

## O que mudou na Central

- **Ficha `adulto-acessos-calibres`, versão 2026-11-15.1:**
  - nova lista `DIRETRIZ_ACESSOS_2025`, com 8 temas e o manual ao lado;
  - na tela, um bloco novo: "Diretriz alemã S1 2025 — ao lado do manual";
  - calibres, French e intraósseo continuam os do manual.
- **Nota `nota-hcfmusp-cap105-acessos`:** 8 itens.
- **Nota `nota-hcfmusp-cap48-pre-hospitalar`, versão 2026-11-15.2:** o item do sangue total passou a dizer, no tema e no texto, que ali não há diretriz, só ensaios. Na produção do #736, a resposta chamava os ensaios de "diretriz atual".
- **Migration:** `20270414000052`.

## Onde a diretriz difere do manual

| Tema | Diretriz alemã S1 2025 | Manual |
|---|---|---|
| Acessos periféricos | pelo menos dois, com fluxo de pelo menos 100 mL/min (ex.: 18 G) | calibres nas Tabelas 1 e 2; não fixa quantos |
| Intraósseo | na falha do periférico com ameaça à vida; na PCR, logo; com só o IO, puncionar também um periférico | na PCR e em outras emergências após várias tentativas; no máximo 24 h |
| Vasopressor | pode correr em periférico, com cateter bem posto, braço em repouso e solução pouco concentrada | central para medicação vasoconstritora |
| Acesso central | quando o periférico é insuficiente e há instabilidade previsível; no compensado, não atrasar a TC | impossibilidade de periférico, vasoconstritor, hiperosmolar |
| Posição do cateter central | curva arterial, ECG endovascular, eco com bolus de soro, TC do politrauma | radiografia de tórax; eco com microbolhas |
| Acesso sem assepsia | trocar de sítio em até 24 h; sem antibiótico profilático | não trata |
| Sítio | evitar subclávia na insuficiência respiratória e com trombolítico ou anticoagulante (femoral esquerda) | na coagulopatia, sítios compressíveis e USG |

## Antes e depois (15/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| quantos acessos periféricos e de que calibre? | "não encontrei" | dois, 100 mL/min (18 G); o manual ao lado |
| noradrenalina em acesso periférico? | "não encontrei" | pode, com as três condições da diretriz |
| acesso central guiado por ultrassom? | sim, por um artigo aberto | diretriz alemã, com o manual ao lado |
| como confirmar a posição do cateter central? | radiografia, pelo manual | os quatro métodos da diretriz; o manual ao lado |
| qual sítio no paciente que vai trombolisar? | "não há trecho" | evitar subclávia; femoral esquerda |
| sangue total no pré-hospitalar | ensaios chamados de "diretriz atual" | "não há diretriz, só ensaios" |

Na primeira rodada da homologação, a pergunta da noradrenalina continuou "não encontrei". Pus "noradrenalina" no assunto da nota. Um teste com "noradrenalina, por exemplo" no tema fez a resposta atribuir o exemplo à diretriz, então o tema voltou ao texto da diretriz.

## Homologação

- A migration foi aplicada. A ficha e as notas estão aguardando aprovação.
- A ficha e as duas notas foram ingeridas, e a API foi reiniciada.
- Os testes passam, e o typecheck e o lint estão limpos.
