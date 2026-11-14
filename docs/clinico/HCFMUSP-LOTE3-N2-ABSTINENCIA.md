# Revisão do HCFMUSP, lote 3, N2: cap. 78, síndrome de abstinência alcoólica (BAP 2026)

Decisão do RT de 14/11/2026 (N2 = A). O RT liberou a produção dos capítulos restantes do N2 nesta data, depois da homologação e do CI verde.

## Fonte

- Sinclair JMA, Kalk NJ, Kaar SJ, et al. Evidence-based consensus guidelines for the pharmacological management of substance dependence: Recommendations from the British Association for Psychopharmacology. J Psychopharmacol 2026;40(2):227–272 (PMID 41731947; PMC13222391).
- Li no texto integral, no PMC, pelo Chrome do RT, a parte de álcool: abstinência, complicações, tiamina, eletrólitos, populações especiais e recomendações. Ela traz níveis A a D e S (padrão de cuidado).
- Antes, a BAP estava na ficha só como nota. A ASAM 2020 não foi lida.

O lado do manual vem da ficha da Central, já conferida no PDF (cap. 78, p. 1024–1035).

## O que mudou na Central

- **Ficha `adulto-abstinencia-alcoolica` 2026-11-14.1:**
  - a citação da BAP passa a dizer o que foi lido;
  - `DIRETRIZ_SAA`: 12 temas;
  - `DIFERENCAS_SAA`: 4 frases;
  - a tela ganha a tabela "BAP 2026 — ao lado do manual".
- As doses da BAP aparecem ao lado do manual, com a fonte: tiamina 300–1.500 mg/dia parenteral. As doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap78-abstinencia`:** 12 itens.
- **Migration** `20270414000012`.
  - Ela foi gerada de novo depois do merge da neutropenia, para registrar as versões atuais.
  - Na homologação foi aplicada duas vezes. O registro é idempotente.

## Diferenças principais

| Tema | BAP 2026 | Manual de 2022 |
|---|---|---|
| Tiamina com risco de Wernicke | 300–1.500 mg/dia parenteral por 3–5 dias (A) | 100–200 mg IM 1–2 vezes ao dia na Wernicke estabelecida; 100–300 mg VO na profilaxia (p. 1032) |
| Esquema | dose fixa com redução de 25% ao dia e doses extras por sintomas nas 48–72 h (A) | ajusta após as primeiras doses; guiado por sintomas usa doses menores (p. 1032–1033) |
| Fenobarbital | adjuvante ou monoterapia no hospital se o benzodiazepínico for contraindicado (D) | só no delirium refratário, com intubação (p. 1033) |
| Antipsicótico | nunca sozinho; acréscimo no delirium refratário (D) | na agitação extrema com alucinações (p. 1033) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| tiamina com risco de Wernicke | manual: 100–200 mg IM | BAP: 300–1.500 mg/dia parenteral |
| fenobarbital | nota da metanálise de 2024 | BAP: adjuvante ou monoterapia no hospital |
| haloperidol sozinho no delirium | "não traz" | BAP: não em monoterapia |
| dose fixa ou por sintomas | manual: por sintomas | BAP: dose fixa com extras por sintomas |
| magnésio profilático | "não encontrei" | BAP: sem evidência para profilaxia |
| gestante | "não encontrei" | BAP (S): internar; oxazepam pode ser o preferido |

As seis respostas passam a abrir pela diretriz.

## Homologação

- Migration aplicada.
- `adulto-abstinencia-alcoolica.md` e `nota-hcfmusp-cap78-abstinencia.md` ingeridos. API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.235, sem falha) e typecheck limpos.
- A tela não foi vista com login.
