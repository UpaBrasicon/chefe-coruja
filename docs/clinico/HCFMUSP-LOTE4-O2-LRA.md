# Revisão do HCFMUSP, lote 4, O2 e O4: cap. 61, lesão renal aguda

O RT decidiu O1 a O4 = A em 14/11/2026. Ele liberou a produção do resto do lote 4 desde que cada capítulo passe antes pela homologação e pelo CI verde.

## Fonte (O4)

- **KDIGO 2026:** abri a página da KDIGO pelo Chrome do RT em 14/11/2026. A diretriz de 2026 de lesão renal aguda e doença renal aguda ainda é rascunho em consulta pública, sem texto final. Pela decisão O4 = A, não usei o rascunho.
- **KDIGO 2012:** Kidney Disease: Improving Global Outcomes (KDIGO) Acute Kidney Injury Work Group. KDIGO Clinical Practice Guideline for Acute Kidney Injury. Kidney Int Suppl 2012;2(1):1–138.
  - Li o resumo das recomendações (p. 8–12) no PDF do site da KDIGO, aberto no visualizador do Chrome. Nada foi baixado.
  - Usa GRADE.
  - O resumo da Nephron Clin Pract (PMID 22890468) não abre sem assinatura.
- **Manual:** o lado do manual vem da ficha da Central, já conferida no PDF (cap. 61, p. 824–841).

## O que mudou na Central

- **Ficha `adulto-lesao-renal-aguda` 2026-11-14.1:** antes só tinha o manual.
  - Fonte `KDIGO_LRA_2012`.
  - `DIRETRIZ_LRA`: 13 temas. O primeiro diz que a KDIGO 2026 ainda era rascunho.
  - `DIFERENCAS_LRA`: 4 frases.
  - A tela ganha a tabela ao lado do manual.
- **Contas:** as contas do manual (KDIGO, FENa, FEUr, furosemida) não mudam.
- **Nota `nota-hcfmusp-cap61-lra`:** 13 itens.
- **Migration:** `20270414000022`.

## Diferenças principais

| Tema | KDIGO 2012 | Manual de 2022 |
|---|---|---|
| Diurético | não usar para tratar LRA fora da sobrecarga de volume (2C) | teste de estresse com furosemida para prever a evolução (p. 836) |
| Início da diálise | pelo contexto e pela tendência dos exames, sem corte isolado | lista de indicações, com pH < 7,1 na acidose refratária (Tabela 5, p. 837–838) |
| Fluido, nutrição, aminoglicosídeo, contraste, anticoagulação da diálise | traz, com grau | a ferramenta não traz |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| furosemida para tratar | trecho sem grau | KDIGO: não, exceto na sobrecarga (2C) |
| dopamina em dose renal | manual: sem benefício | KDIGO: não usar (1A); manual ao lado |
| cristaloide ou albumina | ADQI-ICA (cirrose) e manual | KDIGO: cristaloide isotônico (2B) |
| contraste iodado | "não encontrei" | KDIGO: soro fisiológico ou bicarbonato isotônico EV (1A) |
| quando iniciar diálise | manual | KDIGO: urgência quando há risco à vida; decidir pelo contexto |
| proteína na dieta | "não traz" | KDIGO: não restringir; 0,8–1,7 g/kg/dia conforme o caso (2D) |
| alvo de diurese na rabdomiólise (mesmo módulo, controle) | manual | manual, igual |

Seis respostas passam a abrir pela diretriz. A pergunta de controle ficou igual.

## Homologação

- Migration aplicada.
- 3 arquivos ingeridos e API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.245, sem falha) e typecheck limpos.
- A tela não foi vista com login.

## Produção (14/11/2026, com o "ok produção" do RT)

- A migration `20270414000022` foi aplicada antes do merge. O #695 foi mesclado com o CI verde.
- O corpus foi gerado do master e os 3 arquivos foram ingeridos. A API foi reiniciada.
- Refiz as perguntas na produção: as seis respostas abrem pela KDIGO 2012, e a de controle (rabdomiólise) ficou igual.
- O Vercel publicou o master.

## Atualização: aviso da KDIGO 2026 (14/11/2026)

- O RT pediu para usar a KDIGO 2026. Achei o rascunho no site da KDIGO: https://kdigo.org/wp-content/uploads/2026/03/KDIGO-2026-AKI-AKD-Guideline-Public-Review-Draft-March-2026.pdf (433 páginas, março de 2026).
- A capa diz que é rascunho para consulta pública, que o conteúdo vai mudar e que não deve ser usado para outro fim.
- O RT decidiu pela opção A: a nota segue com a KDIGO 2012 e ganha só o aviso, com o link. A 2026 entra quando sair a versão final.
- Ficha `adulto-lesao-renal-aguda` e nota `nota-hcfmusp-cap61-lra` passam para 2026-11-14.2. Migration `20270414000025`.

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| já vale a KDIGO 2026? | não; "ainda era rascunho" | não; rascunho que a KDIGO pede para não usar fora da consulta; entra com a versão final |
| furosemida para tratar (controle) | KDIGO 2012 | igual |
| quando iniciar diálise (controle) | KDIGO 2012 | igual |
