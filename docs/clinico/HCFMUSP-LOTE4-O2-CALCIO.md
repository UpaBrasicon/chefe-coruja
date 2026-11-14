# Revisão do HCFMUSP, lote 4, O2: cap. 68, distúrbios do cálcio

O RT decidiu O1 a O4 = A em 14/11/2026 e liberou a produção do resto do lote 4 ("Pode seguir até acabar e dar ok em toda produção"), depois da homologação e do CI verde de cada capítulo.

## Fontes

- **Endocrine Society 2023** sobre hipercalcemia da malignidade, com 8 recomendações GRADE. El-Hajj Fuleihan G, Clines GA, Hu MI, et al. J Clin Endocrinol Metab 2023;108(3):507–528 (PMID 36545746). Li o texto integral no site da revista, pelo Chrome do RT.
- **Society for Endocrinology 2016**, orientação de emergência para hipercalcemia aguda. Endocr Connect 2016;5(5):G9–G11 (PMID 27935816; PMC5314807).
- **Society for Endocrinology 2016**, orientação de emergência para hipocalcemia aguda. Endocr Connect 2016;5(5):G7–G8 (PMID 27935815; PMC5314808).
- As duas da SfE não são graduadas. Li o texto integral das duas no PMC.
- Os cortes da SfE estão em mmol/L. Os valores em mg/dL que aparecem ao lado são a conversão aproximada (× 4) e vêm marcados assim.

O lado do manual vem das fichas da Central, já conferidas no PDF: cap. 68 (p. 918–930) e Anexo 5.

## O que mudou na Central

- **Fichas `adulto-hipercalcemia` e `adulto-reposicao-calcio`, versão 2026-11-14.1.** Antes, as duas só tinham o manual.
- **`DIRETRIZ_CALCIO`:** 14 temas, 10 de hipercalcemia e 4 de hipocalcemia.
- **`DIFERENCAS_CALCIO`:** 5 frases.
- **Telas:** cada uma das duas telas ganha a sua tabela ao lado do manual.
- **Doses:** as doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap68-calcio`:** 14 itens.
- **Migration:** `20270414000017`.
- **Corpus:** o gerador põe o módulo `eletrolitos.ts` em 5 arquivos (potássio, magnésio, cálcio, hipercalcemia e fósforo). A pergunta do potássio continuou respondendo.

## Diferenças principais

| Tema | Diretriz | Manual de 2022 |
|---|---|---|
| Denosumabe | preferido ao bisfosfonato; usado na refratária (ES 2023) | não traz |
| Pamidronato | 30–90 mg a 20 mg/h; mais lento na insuficiência renal (SfE) | 90 mg em 2–4 h (p. 927) |
| Corticoide | prednisolona 40 mg/dia (SfE) | prednisona 1 mg/kg (p. 928) |
| Diurético | só na sobrecarga; não baixa o cálcio (SfE) | furosemida individualizada, depois de reidratar (p. 927) |
| Infusão de cálcio | 100 mL de gluconato em 1 L, a 50–100 mL/h (SfE) | 110 mL em 890 mL, a 0,5–1,5 mg/kg/h (p. 922, 1500) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| denosumabe ou bisfosfonato | "não há trecho sobre denosumabe" | ES 2023: denosumabe preferido |
| calcitonina | manual | ES 2023: calcitonina com bisfosfonato ou denosumabe, por 48–72 h |
| furosemida | manual | SfE: não baixa o cálcio; só na sobrecarga |
| pamidronato na insuficiência renal | "não traz ajuste" | SfE: 30–90 mg a 20 mg/h, mais lento, dose menor |
| gluconato de cálcio | manual | SfE: bolus e infusão, com o manual ao lado |
| corticoide no linfoma | manual: prednisona 1 mg/kg | SfE: prednisolona 40 mg/dia; o manual como diferença |

As seis respostas passam a abrir pela diretriz.

## Homologação

- Migration aplicada.
- 6 arquivos ingeridos. API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.240, sem falha) e typecheck limpos.
- A tela não foi vista com login.

## Produção (14/11/2026, com o "ok produção" do RT)

- A migration `20270414000017` foi aplicada antes do merge. O #690 foi mesclado com o CI verde.
- O corpus foi gerado do master e os 5 arquivos foram ingeridos. A API foi reiniciada.
- Refiz as perguntas na produção: as seis respostas abrem pela diretriz, e a pergunta de controle do potássio continua certa.
- O Vercel publicou o master.
