# Doses pela cor e pelo peso — diagnóstico

Pedido do RT em 17/11/2026: "doses pela cor e peso, vai para todas as ferramentas que iremos construir em conjunto". No mesmo dia ele decidiu: **se tiver peso, a dose sai do peso, não da cor.**

Este documento é o diagnóstico. Ainda não existe código de dose. O código só começa depois que o RT decidir os pontos D1–D12.

## O que foi feito

1. **E-book Fita PED (Grupo MOVER, 1ª ed., 2021)**, enviado pelo RT: foram extraídas as 354 doses das 9 cores e das 11 páginas de drogas, além dos dispositivos, choques e sinais vitais. Para cada linha, a dose foi dividida pelo peso, e o volume foi refeito como dose ÷ concentração. O texto do e-book não entra no repositório.
2. **PubMed**: para cada droga e indicação (29 linhas), foi buscada a dose por kg e o máximo em fonte indexada. Sempre que possível, a fonte é aberta, com o trecho copiado. O app de hoje entrou na mesma tabela. Tabela completa, com trechos, PMID, PMC e DOI: [DOSES-FITA-CONFERENCIA-PUBMED.md](DOSES-FITA-CONFERENCIA-PUBMED.md).

## Resultado

### E-book × fontes

- **25 conferem** com a dose por kg da fonte. Inclui adenosina, amiodarona, epinefrina IV/IO e IM, lidocaína, magnésio (torsades e asma), bicarbonato, cálcio, desfibrilação 2 → 4 J/kg (até 10 J/kg), etomidato, cetamina, succinilcolina, rocurônio, paracetamol, ibuprofeno, carvão, dexametasona, glicose, difenidramina, fentanil (analgesia), glucagon (até a cor amarela), morfina e naloxona.
- **3 divergem:**
  - **atropina**: o mínimo de 0,1 mg saiu na intubação (AHA 2025 seção 17, Coreia 2025). A figura de bradicardia da própria AHA 2025 ainda traz esse mínimo.
  - **propofol**: 3 mg/kg só para criança pequena; a SBA 2024 usa 2 mg/kg.
  - **diazepam IV**: o e-book usa 0,1 mg/kg; a AES 2016 dá 0,15–0,2 mg/kg, máx 10 mg.
- **1 sem fonte aberta**: fentanil na intubação (1–3 mcg/kg). A única tabela aberta (SBA 2024) imprime a unidade errada.
- **Ainda não conferidos** (estão no e-book, mas não entraram nesta rodada): ondansetrona 0,15 mg/kg, salbutamol 2,5 mg fixo e gluconato de cálcio 60 mg/kg.

### Erros do próprio e-book (conferidos no texto)

Os números das páginas não podem ser copiados para o app:

| página | droga | o que está errado |
|---|---|---|
| 3, 4 e 5 kg | atropina | "(0,05 mg/mL): 0,1 mg = 1 mL"; nessa concentração são 2 mL |
| 4 kg | succinilcolina IM | "16 g" em vez de 16 mg |
| branco | rocurônio | concentração escrita "1 mg/mL", mas o volume só fecha com 10 mg/mL |
| branco, azul, laranja, verde | atropina | 0,8 a 1,6 mg (≈ 0,05 mg/kg, acima do máx 0,5 mg) |
| branco, azul, laranja, verde | glucagon | 15 a 35 mg (1 mg/kg); nas cores anteriores, 0,5 mg fixo |
| azul | cloreto de cálcio | 1.200 mg é a dose do gluconato (60 mg/kg); esperado 380–460 mg |
| branco | paracetamol | dose da cor azul |
| laranja | magnésio (IRPA) | dose da cor verde |
| rosa | ibuprofeno, carvão | volume não fecha com a concentração (11–14%) |
| várias | volumes pequenos | 30 arredondamentos de até 0,05 mL; 5 deles para o lado errado |
| várias | "1.200 mg", "1.400 mg" | o ponto de milhar pode ser lido como 1,2 mg |

Também há diferenças de padrão:

- A cardioversão do e-book é 1 → 2 J/kg; AHA 2025 e Coreia 2025 dizem 0,5–1 → 2 J/kg.
- O tubo traqueal segue ora a fórmula com cuff, ora a sem cuff, e o e-book não diz qual.
- Do branco em diante, cada seção da mesma página foi calculada com um peso diferente. Por exemplo, na cor azul: intubação com 21 kg, reanimação com 20 kg, gerais com 20 kg.
- Algumas doses passam do máximo usual: naloxona 3,5 mg, dexametasona 21 mg, ondansetrona 5,25 mg.

### App hoje × fontes (achados à parte)

Achados das telas que já estão na produção. A fonte das telas é o livro do ICr:

| arquivo | hoje | fonte |
|---|---|---|
| `rcp.ts` atropina | sem máximo | máx 0,5 mg (AHA 2025, Coreia 2025) |
| `viaAerea.ts` atropina | máx 1 mg (livro p. 71) | SBA 2024 também diz 1 mg; AHA 0,5 mg |
| `bolus.ts` epinefrina PCR | sem teto | máx 1 mg (`rcp.ts` já tem) |
| `rcp.ts` cloreto de cálcio e magnésio | sem teto | máx 2 g (Coreia 2025) |
| `rcp.ts` cardioversão, 2ª tentativa | 1–2 J/kg | 2 J/kg (AHA 2025, Coreia 2025) |
| `criseEpileptica.ts` diazepam IV | 0,2–0,4 mg/kg | 0,15–0,2 mg/kg (AES 2016) |
| `bolus.ts` diazepam IV < 5 anos | máx 5 mg | máx 10 mg (AES 2016) |
| `bolus.ts` glucagon < 20 kg | 0,02–0,03 mg/kg | 0,5 mg fixo (ISPAD 2022) |
| `anafilaxia.ts` difenidramina | 1–2 mg/kg | 1 mg/kg máx 50 mg (diretriz chinesa 2020) |
| `bolus.ts` epinefrina IM | "a cada 20 min" | 5–15 min (WAO 2020; `anafilaxia.ts` já diz 5–15) |
| `bolus.ts` naloxona | só 0,1 mg/kg | também dose baixa 1–5 µg/kg (Coreia 2025) |
| `diarreia.ts` ondansetrona (rodada D10) | 0,1 mg/kg, sem teto | 0,15 mg/kg, máx 8 mg IV (Rerksuppaphol 2010); VO por faixa de peso (Sociedade Canadense de Pediatria 2011) |
| `asma.ts` salbutamol (rodada D10) | só contínuo e spray | nebulização intermitente de 2,5 a 5 mg (Sociedade Italiana de Pediatria 2018) |
| gluconato de cálcio em 6 arquivos (rodada D10) | tetos diferentes: nenhum, 20 mL, 3 g | única fonte aberta: 60 mg/kg, até a dose de adulto de 6 g (AHA 2025 Part 10, Tabela 4, intoxicação) |

## Como ficaria o módulo

- Uma ficha nova, `ped-doses-fita`, em `src/clinico/pediatria/`, passa pelo gate LG10 e entra no mapa LG11, grupo pediatria. Para cada droga, a ficha guarda dose por kg, mínimo, máximo, concentração, via, indicação e fonte, com o trecho literal.
- Uma função só, `dosesDoPeso(kg)`, devolve dose em mg, volume em mL e a concentração usada. Ela não guarda número pronto por cor.
- **Com peso informado, ela calcula com o peso** (regra do RT). Sem peso, mas com a cor escolhida, calcula com o peso da cor (D2).
- As ferramentas que vamos construir juntos leem esse módulo. A primeira é a de parada e reanimação. Nenhuma ferramenta repete o número da dose.
- A dose só aparece depois de calcular, e o peso aparece com a origem: digitado, da fita ou do prontuário (regra da sessão legal para o bloco do CID).

## Decisões para o RT

| # | pergunta | A (recomendado) | B |
|---|---|---|---|
| D1 | De onde vem a dose por kg? | Da fonte conferida (AHA 2025, Coreia 2025, SBA 2024, AES 2016, WAO 2020, ISPAD 2022…). O e-book organiza a tela (cores, ordem, seções), mas nenhum número sai dele. | Do livro do ICr, o mesmo das telas de hoje |
| D2 | Sem peso, só com a cor, qual peso usar? | O meio da faixa da cor, o mesmo que a fita já usa ("6–7 kg → 6,5 kg"), com a dose calculada | O número impresso na página da cor do e-book |
| D3 | Atropina | 0,02 mg/kg, máx 0,5 mg, sem mínimo; na bradicardia, nota de que a figura da AHA 2025 ainda traz 0,1 mg | Mínimo de 0,1 mg em tudo |
| D4 | Cardioversão | 0,5–1 J/kg, depois 2 J/kg (AHA 2025) | 1 J/kg, depois 2 J/kg (e-book) |
| D5 | Propofol na intubação | 2 mg/kg, com a nota "até 3 mg/kg em criança pequena" (SBA 2024) | 3 mg/kg (e-book) |
| D6 | Diazepam IV na crise | 0,15–0,2 mg/kg, máx 10 mg, repetir 1 vez (AES 2016) | 0,1 mg/kg (e-book) |
| D7 | Glucagon | 0,5 mg abaixo de 20 kg, 1 mg a partir de 20 kg (ISPAD 2022, corte Lilly) | Corte em 25 kg (Novo Nordisk) |
| D8 | Fentanil na intubação (sem fonte aberta) | Fica fora do módulo até achar fonte aberta | Usar o livro do ICr (p. 70) |
| D9 | Tetos sem fonte aberta (dexametasona 10 mg, carvão 50 g) | Teto do livro do ICr, citado como livro | Sem teto |
| D10 | Ondansetrona, salbutamol, gluconato | Mais uma rodada no PubMed antes de entrar | Entram com a dose do livro do ICr |
| D11 | Achados das telas de hoje (tabela acima) | Lote de correção separado, depois do módulo, cada ficha aprovada por você | Corrigir agora, antes do módulo |
| D12 | Volume em mL | Mostrar mg e mL com a concentração escrita ao lado ("0,65 mL de 0,1 mg/mL"); mL arredondado a 0,01 abaixo de 1 mL; milhar sem ponto ("1200 mg") | Só mg |

**Decisão do RT (17/11/2026): todas A.**

## Ordem depois das decisões

1. Rodada do D10 no PubMed (se A).
2. Ficha `ped-doses-fita` e `dosesDoPeso` com teste. O teste cobre cada droga em 3 pesos e confere que nenhum número das páginas com erro passa.
3. Migration de registro da ficha: homolog, depois ok produção, depois aprovação na Revisão Clínica.
4. Guia de parada e reanimação construído com o RT, lendo o módulo.
5. Lote D11 (se A).
