# Revisão do HCFMUSP, lote 3, N2: cap. 39, hemorragia intraparenquimatosa (ESO/EANS 2025)

Decisão do RT de 14/11/2026 (N2 = A). O diagnóstico está em `HCFMUSP-LOTE3-DIAGNOSTICO.md`.

## Fonte

ESO/EANS guideline on stroke due to spontaneous intracerebral haemorrhage. Eur Stroke J 2025;10(4):1007–1086 (PMID 40401775; PMC12098356).

- Um agente leu o texto integral no PMC. Pelo Chrome do RT, conferi o texto exato dos itens principais na Tabela 2, a sinopse das recomendações e consensos:
  - pressão arterial;
  - CCP e vitamina K;
  - andexanete;
  - idarucizumabe;
  - plaquetas;
  - ácido tranexâmico;
  - anticonvulsivante;
  - compressão pneumática;
  - hemorragia cerebelar.
- O WebFetch no PMC caiu numa verificação anti-robô. Não tentei passar por ela; li pelo Chrome.
- "Consenso" é a declaração de especialistas da ESO, sem graduação GRADE.
- No pacote de cuidados, usei só os alvos do ensaio descritos no texto. Não pus o alvo de INR, porque o texto e a sinopse divergem.
- A atualização de PA da ESO de 2026 (PMID 42095756) não entrou: não conferi o texto dela.

O lado do manual foi conferido no PDF do livro (cap. 39, p. 542–549).

## O que mudou na Central

- **Ficha `adulto-reversao-anticoagulacao` 2026-11-14.1:**
  - fonte `ESO_HIC_2025`;
  - `DIRETRIZ_HIC_ESO_2025`: 12 temas com força, PICO e página do manual;
  - `DIFERENCAS_HIC_2025`: 6 frases;
  - a tela de reversão ganha a tabela "ESO/EANS 2025 — HIC, ao lado do manual".
- As doses que a ESO dá aparecem ao lado do manual, com a fonte: CCP por faixa de INR, vitamina K 10 mg e idarucizumabe 2 × 2,5 g. As doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap39-hic`:** 12 itens.
- **Migration** `20270414000005`. A ficha e a nota aguardam a aprovação do RT.

## Diferenças principais

| Tema | ESO/EANS 2025 | Manual de 2022 |
|---|---|---|
| PA | PAS < 140 em até 6 h só na HIC < 30 mL; sem queda > 70 mmHg; PAS nunca abaixo de 110 de forma ativa (consenso) | PAS 140 mmHg para PAS 150–220 (p. 547) |
| Varfarina | CCP 30–50 UI/kg se INR ≥ 2,0 ou 10 UI/kg se INR 1,3–1,9, com vitamina K 10 mg EV (consenso) | plasma 15–20 mL/kg com vitamina K, ou CCP (p. 548–549) |
| Dabigatrana | idarucizumabe 2 × 2,5 g EV (consenso) | idarucizumabe sem dose (p. 546) |
| Antiagregante | não transfundir plaquetas (fraca contra) | plaquetas na trombocitopenia grave (p. 545) |
| Anticonvulsivante | sem profilaxia primária (fraca contra) | só na crise (p. 547) |
| Cerebelar | evacuar > 15 mL (fraca a favor) | > 3 cm (p. 549) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| alvo de PA na HIC | DBHA 2025 e manual | ESO 2025: PAS < 140 em até 6 h na HIC < 30 mL, com os limites de queda |
| varfarina e INR 3 | vitamina K, plasma ou CCP (tabela geral) | igual: abre pela tabela geral de reversão da Central |
| idarucizumabe | SBTH 2026, sem dose | ESO 2025: 2 × 2,5 g EV |
| plaquetas com AAS | "o material não traz" | ESO 2025: não transfundir |
| anticonvulsivante | "os trechos não trazem" | ESO 2025: sem profilaxia primária |
| cirurgia cerebelar | > 3 cm (manual) | ESO 2025: > 15 mL, com o manual como diferença |

Cinco de seis respostas passam a abrir pela ESO 2025. A da varfarina abre pela tabela geral de reversão, que não contradiz a diretriz.

## Produção, com o "ok produção"

1. Aplicar a migration `20270414000005`.
2. Copiar e ingerir `adulto-escore-ich.md`, `adulto-reversao-anticoagulacao.md` e `nota-hcfmusp-cap39-hic.md`.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.

## Produção (14/11/2026, com o "ok produção" do RT)

- A migration `20270414000005` foi aplicada antes do merge. A ficha de reversão e a nota do cap. 39 estão na versão 2026-11-14.1.
- O #666 recebeu o master antes do merge, e as notas do lote 3 ficaram juntas: 33, 39, 40 e 76. O CI ficou verde.
- O corpus foi gerado do master e ingerido. A API foi reiniciada.
- Refiz as perguntas na produção. Cinco de seis abrem pela ESO 2025. A da varfarina abre pela tabela geral de reversão, como na homologação.
