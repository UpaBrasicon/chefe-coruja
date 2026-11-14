# Revisão do HCFMUSP, lote 5, P2: cap. 10, sedação e analgesia em procedimentos

O RT decidiu P1 a P4 = A em 14/11/2026 e liberou a produção do lote 5 inteiro, desde que cada capítulo passe antes pela homologação e pelo CI verde.

## Fonte

- **Consenso:** Green SM, Roback MG, et al. Unscheduled Procedural Sedation Multidisciplinary Delphi Consensus Guidelines, Part 2: Clinical Practice. Ann Emerg Med 2026;88(3):346–361 (PMID 42618174).
  - É política oficial da ACEP.
  - Li o texto integral no site da revista, pelo Chrome do RT; desta vez a Annals abriu sem CAPTCHA.
  - Teve consenso forte em todas as seções. A certeza da evidência vem nos símbolos ⊕ do texto.
  - O consenso não traz dose.
- **Parte 1** (princípios, supervisão e qualidade, PMID 42618173): não foi lida; não trata de conduta à beira do leito.
- **Manual:** o lado do manual vem da ficha da Central e do PDF (cap. 10, p. 153–166).

## O que mudou na Central

- **Ficha `adulto-sedacao-procedimento` 2026-11-14.1:** antes só tinha o manual.
  - Fonte `ACEP_SEDACAO_2026`.
  - `DIRETRIZ_SAP`: 12 temas.
  - `DIFERENCAS_SAP`: 4 frases.
  - A tela ganha a tabela ao lado do manual.
- **Doses:** as doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap10-sedacao`:** 12 itens.
- **Migration:** `20270414000029`.

## Diferenças principais

| Tema | ACEP 2026 | Manual de 2022 |
|---|---|---|
| Jejum | não adiar procedimento urgente pelo tempo de jejum | esperar 2 h para líquido e 6 h para sólido no procedimento não emergencial (p. 160) |
| Oxigênio | opcional; atrasa o alarme da oximetria | O2 por máscara de alto fluxo (p. 160) |
| Risco | a ASA não decide o plano de cada paciente | ASA para escolher a droga; evitar sedação em ASA IV e V (p. 156–159) |
| Agonista de GLP-1 | sedação habitual na maioria; cetamina se o risco for maior | não traz |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| jejum | manual | ACEP: não adiar pelo jejum |
| oxigênio suplementar | "os trechos não trazem" | ACEP: opcional |
| semaglutida | "os trechos não trazem" | ACEP: sedação habitual na maioria |
| midazolam com fentanil ou propofol | manual, sem comparação | ACEP: propofol com fentanil ou cetamina |
| capnografia | "não encontrei" | ACEP: de rotina sempre que possível |
| dose de propofol (controle) | manual | manual, igual |

Cinco respostas passam a abrir pelo consenso. A de controle ficou igual.

## Homologação

- Migration aplicada.
- 2 arquivos ingeridos e API reiniciada.
- `test:clinico` (1.250, sem falha) e typecheck limpos.
- A tela não foi vista com login.

## Produção do #705 (cap. 80), 14/11/2026

- A migration `20270414000028` foi aplicada antes do merge. O #705 foi mesclado com o CI verde.
- Os 2 arquivos foram ingeridos e a API foi reiniciada.
- As 6 respostas saíram como na homologação.
- O Vercel publicou o master.
