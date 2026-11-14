# Revisão do HCFMUSP, lote 4, O3: cap. 22 (pericardites e miocardites) e cap. 45 (primeira crise epiléptica)

O RT decidiu O1 a O4 = A em 14/11/2026. Pela O3, os dois capítulos ganham só a nota de atualização, ligada ao capítulo do manual, porque não há ficha de adulto na Central. Nenhuma ferramenta nova. O RT liberou a produção do resto do lote 4 desde que cada passo passe antes pela homologação e pelo CI verde.

## Fontes

- **Cap. 22:** Schulz-Menger J, Collini V, Gröschel J, et al. 2025 ESC Guidelines for the management of myocarditis and pericarditis. Eur Heart J 2025;46(40):3952–4041 (PMID 40878297).
  - Li no site da revista, pelo Chrome do RT, a tabela 19 (todas as recomendações de classe I e III) e a tabela 16 (alto risco na pericardite).
  - As tabelas de recomendação por seção e a de doses (tabela 13) não abriram como texto. A nota não traz dose da ESC.
- **Cap. 45:** Krumholz A, Wiebe S, Gronseth GS, et al. Management of an unprovoked first seizure in adults (AAN/AES). Neurology 2015;84(16):1705–1713 (PMID 25901057).
  - Li as recomendações no resumo do PMC (PMC4409581).
  - A *clinical policy* da ACEP de 2024 (PMID 38906639) não foi lida: o site da revista pediu CAPTCHA, e não contorno CAPTCHA. A nota diz isso no primeiro item.
  - O próprio manual já cita a AAN de 2015 na Tabela 7.
- **Manual:** conferi no PDF as páginas da coluna do manual (cap. 22, p. 309, 310 e 320; cap. 45, p. 618–620). Onde não conferi, a coluna diz "não comparado nesta nota".

## O que mudou na Central

- **Nota `nota-hcfmusp-cap22-pericardite-miocardite`:** 11 itens.
- **Nota `nota-hcfmusp-cap45-primeira-crise`:** 6 itens.
- **Ligação:** as duas notas não têm ficha da Central (`fichaCentral` vazio). A função `notaSoManual` monta a nota sem ficha.
- **Migration:** `20270414000023`.

## Diferenças principais

| Tema | Diretriz | Manual de 2022 |
|---|---|---|
| Corticoide na pericardite | não é primeira opção sem indicação específica (ESC 2025, III, C) | prednisona 0,25–0,5 mg/kg/dia nos refratários e em dose baixa se houver contraindicação a AINE (p. 309) |
| Pericardite recorrente | anti-IL-1 depois de falha da primeira linha (ESC 2025, I, A) | não comparado |
| Internação | febre > 38 °C, início subagudo, derrame > 20 mm, tamponamento, sem resposta em 1 semana (ESC 2025) | lista parecida, com troponina, trauma, anticoagulante e imunossupressão (p. 309) |
| Primeira crise | igual ao manual, que já segue a AAN 2015 | Tabela 7 (p. 619) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| pericardite: quando internar | "os trechos não trazem" | ESC: internar alto risco (I, B), com os marcadores maiores |
| colchicina e anti-inflamatório | manual | ESC: AAS ou AINE com IBP (I, B) e colchicina (I, A); manual ao lado |
| corticoide na pericardite | "os trechos não trazem" | ESC: não como primeira opção (III, C); manual ao lado |
| imunossupressor na miocardite | manual | ESC: não de rotina com VE preservado (III, C); manual ao lado |
| primeira crise: recorrência | manual | AAN: 21–45% em 2 anos, com os fatores de risco |
| primeira crise: iniciar antiepiléptico | "não é respondida de forma fechada" | AAN: reduz recorrência em 2 anos, sem mudar o longo prazo; a resposta abre com "Sim" e simplifica a decisão caso a caso, que está no texto |
| pericardite recorrente sem resposta à colchicina | "o material não traz" | ESC: anti-IL-1 depois de falha da primeira linha (I, A) |

As sete respostas passam a abrir pela diretriz.

## Homologação

- Migration aplicada.
- 2 arquivos ingeridos e API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.246, sem falha) e typecheck limpos.
- Não há tela nova.
