# Revisão do HCFMUSP, lote 3, N2: cap. 66, distúrbios do sódio (europeia 2014 e ERA 2024)

Decisão do RT de 14/11/2026 (N2 = A). O diagnóstico está em `HCFMUSP-LOTE3-DIAGNOSTICO.md`.

## Fontes

- **Diretriz europeia de 2014:** Spasovski G, Vanholder R, Allolio B, et al. Clinical practice guideline on diagnosis and treatment of hyponatraemia. Eur J Endocrinol 2014;170(3):G1–G47 (PMID 24569125).
  - É a diretriz conjunta da ESICM, da ESE e da ERA-EDTA.
  - Li o texto integral no site da revista, pelo Chrome do RT.
  - Usa GRADE: 1 = recomenda, 2 = sugere; A a D = qualidade da evidência.
- **ERA 2024:** Spasovski G. Hyponatraemia—treatment standard 2024. Nephrol Dial Transplant 2024;39(10):1583–1592 (PMID 39009016).
  - Li o texto integral, pelo Chrome.
  - O diagnóstico do lote 3 a chamou de diretriz, mas é uma revisão de um autor, sem graduação. Ela entra como complemento, marcada "revisão, sem graduação".

O lado do manual vem da ficha da Central, já conferida no PDF (cap. 66, p. 882–891). Conferi no PDF que o capítulo não traz o resgate da hipercorreção nem o tratamento do SIADH.

A hipernatremia não mudou: nenhuma das duas fontes trata dela.

## O que mudou na Central

- **Ficha `adulto-hiponatremia` 2026-11-14.1:**
  - fontes `EUROPEIA_HIPONATREMIA_2014` e `ERA_HIPONATREMIA_2024`;
  - `DIRETRIZ_HIPONATREMIA`: 16 temas (11 da europeia, 5 da ERA), com grau, fonte e página do manual;
  - `DIFERENCAS_HIPONATREMIA`: 6 frases;
  - a tela de hiponatremia ganha a tabela "Europeia 2014 e ERA 2024 — ao lado do manual".
- O alerta contra a subcorreção (JAMA Intern Med 2025) continua na tela.
- As doses das diretrizes aparecem ao lado do manual, com a fonte: bolus de 150 mL de NaCl 3% e desmopressina 2 µg. As contas e doses do manual não mudam.
- **Nota `nota-hcfmusp-cap66-sodio`:** 16 itens, só da hiponatremia.
- **Migration** `20270414000008`. A ficha e a nota aguardam a aprovação do RT.
- O gerador do corpus põe o módulo inteiro do sódio nas duas fichas. Por isso o arquivo da hipernatremia também foi reingerido, sem versão nova.

## Diferenças principais

| Tema | Diretriz | Manual de 2022 |
|---|---|---|
| Bolus nos sintomas graves | 150 mL de NaCl 3% em 20 min, até duas repetições ou +5 (europeia, 1D/2D); 100–150 mL (ERA) | 100 mL, até 300 mL (p. 890) |
| Limite em 24 h | +10 nas primeiras 24 h e +8 depois (europeia, 1D); 8 em 24 h (ERA) | 8 em 24 h na crônica (p. 890) |
| Quando parar | sintomas melhoram, +10 ou Na 130 (europeia, 1D) | parar em 125 na crônica (p. 890–891) |
| Edemaciado | não tratar só para subir o Na na leve/moderada; restrição hídrica; sem vaptana (europeia) | NaCl 3% 15–30 mL/h com furosemida no Na < 120 (p. 890) |
| Hipercorreção | baixar de novo; água livre ou glicose 5% e desmopressina (europeia e ERA) | não traz |
| SIADH | restrição hídrica; depois ureia ou alça com NaCl; vaptana não (europeia); tolvaptana e ureia (ERA) | não traz |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| bolus na convulsão | 100 mL, máx. 300 (manual) | europeia: 150 mL em 20 min, até 2 repetições ou +5 |
| limite em 24 h na crônica | 8 (manual) | 8, pela ERA, com o manual ao lado |
| hipercorreção | "não encontrei" | ERA e europeia: glicose 5% e/ou desmopressina; critérios de re-baixar |
| SIADH | "os trechos não trazem" | europeia: restrição, ureia ou alça com NaCl; vaptana não; ERA ao lado |
| edemaciado com IC | "não há indicação de 3%" | europeia: não tratar só para subir o Na, restrição, sem vaptana; manual como diferença |
| leve assintomática | "o material não traz conduta" | europeia (2C): não tratar só para subir o Na |

As seis respostas passam a abrir pela diretriz. Na pergunta do limite em 24 h, a resposta abre pelos 8 mmol/L da ERA e não cita os 10 da europeia. Não contradiz o manual, mas fica registrado.

Na homologação, a pergunta do edemaciado deu timeout na API na primeira rodada. Refeita sozinha, respondeu normal.

## Homologação

- Migration aplicada.
- `adulto-hiponatremia.md` (20 trechos), `adulto-hipernatremia.md` (20) e `nota-hcfmusp-cap66-sodio.md` (17) ingeridos. API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.231, sem falha) e typecheck limpos na árvore da homologação.
- A tela não foi vista com login.

## Produção, com o "ok produção"

1. Aplicar a migration `20270414000008`.
2. Copiar e ingerir os 3 arquivos.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.
