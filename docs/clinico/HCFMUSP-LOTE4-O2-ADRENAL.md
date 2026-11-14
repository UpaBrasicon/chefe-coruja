# Revisão do HCFMUSP, lote 4, O2: cap. 72, insuficiência adrenal

O RT decidiu O1 a O4 = A em 14/11/2026. O diagnóstico está em `HCFMUSP-LOTE4-DIAGNOSTICO.md`.

## Fontes

As três foram lidas no texto integral no PMC, pelo Chrome do RT. Só entrou o que vale para o adulto.

- **Endocrine Society 2016**, insuficiência adrenal primária, com graus GRADE. Bornstein SR, Allolio B, Arlt W, et al. J Clin Endocrinol Metab 2016;101(2):364–389 (PMID 26760044; PMC4880116). Usei as recomendações 1 a 4 e a Tabela 3.
- **Society for Endocrinology 2016**, orientação de emergência para a crise adrenal no adulto. Endocr Connect 2016;5(5):G1–G3 (PMID 27935813; PMC5314805).
- **ESE/Endocrine Society 2024**, insuficiência adrenal induzida por glicocorticoide. Beuschlein F, Else T, Bancos I, et al. J Clin Endocrinol Metab 2024;109(7):1657–1683 (PMID 38724043; PMC11180513). Usei as recomendações 2.12, 3.1 e 3.2, a Tabela 8 e o texto sobre a crise.

O lado do manual vem da ficha da Central, já conferida no PDF (cap. 72, p. 964–971).

## O que mudou na Central

- **Ficha `adulto-insuficiencia-adrenal` 2026-11-14.1.** Antes, a ficha só tinha o manual.
  - Entram as fontes `ES_IA_PRIMARIA_2016`, `SFE_CRISE_ADRENAL_2016` e `ESE_ES_IA_GLICOCORTICOIDE_2024`.
  - `DIRETRIZ_IA`: 9 temas.
  - `DIFERENCAS_IA`: 5 frases.
  - A tela ganha a tabela "Endocrine Society 2016, SfE 2016 e ESE/ES 2024 — ao lado do manual".
- **Doses.** As das diretrizes aparecem ao lado do manual, com a fonte: hidrocortisona 200 mg/24 h, fludrocortisona 50–100 µg/dia e SF 1.000 mL na primeira hora. As doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap72-adrenal`:** 9 itens.
- **Migration** `20270414000015`.
- **Corpus.** O gerador põe o módulo endócrino inteiro nos 5 arquivos de crise tireotóxica, mixedema e insuficiência adrenal, e eles foram reingeridos. Uma pergunta de crise tireotóxica continuou respondendo com as doses do manual.

## Diferenças principais

| Tema | Diretrizes | Manual de 2022 |
|---|---|---|
| Hidrocortisona de manutenção | 200 mg/24 h (contínua ou 50 mg de 6/6 h); 100 mg/dia no dia seguinte | 50–100 mg de 6/6 h; desmame em 48–72 h (p. 969) |
| Volume | 1.000 mL na 1ª hora; 4–6 L em 24 h | até 1 L/h; 20–30 mL/kg na Figura 1 (p. 969, 971) |
| Teste com ACTH | pico < 18 µg/dL em 30 ou 60 min; matinal < 5 com ACTH | basal ≤ 3 e > 19; < 18 após ACTH (p. 969) |
| Fludrocortisona | 50–100 µg/dia na primária; contra na induzida por glicocorticoide | 50 µg de 8/8 h (p. 969) |
| Glicocorticoide não oral | inalado, tópico e intra-articular também causam crise | não traz |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| hidrocortisona de ataque e de manutenção | manual: 100 mg e 50–100 mg de 6/6 h | diretrizes: 100 mg e 200 mg/24 h; o manual como diferença |
| soro na primeira hora | manual: até 1 L/h | SfE e ES: 1.000 mL na 1ª hora, 4–6 L/24 h |
| fludrocortisona | manual: 50 µg de 8/8 h | ES: 50–100 µg/dia; ESE/ES: contra na induzida por glicocorticoide |
| corticoide inalado e choque | "os trechos não trazem" | ESE/ES: sim, qualquer via |
| corte do teste com ACTH | manual (texto e figura) | ES: pico < 18 µg/dL |
| dose de estresse | "não encontrei" | ESE/ES: oral no estresse menor, parenteral no maior |

As seis respostas passam a abrir pela diretriz.

## Homologação

- Migration aplicada.
- 6 arquivos do corpus ingeridos. API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.238, sem falha) e typecheck limpos.
- A tela não foi vista com login.

## Produção, com o "ok produção"

1. Aplicar a migration `20270414000015`.
2. Copiar e ingerir os 6 arquivos.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.

## Produção (14/11/2026, com o "ok produção" do RT)

- A migration `20270414000015` foi aplicada antes do merge. O #686 foi mesclado com o CI verde.
- O corpus foi gerado do master e os 6 arquivos foram ingeridos. A API foi reiniciada.
- Refiz as perguntas na produção: as seis abrem pela diretriz, e a da crise tireotóxica continua respondendo com as doses do manual.
