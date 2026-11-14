# Revisão do HCFMUSP, lote 3, N2: cap. 43, neuroinfecção (ESCMID 2016 e EAN–ESCMID 2026)

Decisão do RT de 14/11/2026 (N2 = A). O diagnóstico está em `HCFMUSP-LOTE3-DIAGNOSTICO.md`.

## Fontes

- **Meningite bacteriana:** van de Beek D, Cabellos C, Dzupova O, et al. ESCMID guideline: diagnosis and treatment of acute bacterial meningitis. Clin Microbiol Infect 2016;22(Suppl 3):S37–S62 (PMID 27062097).
  - O texto não está no PMC. Li o texto integral no site da revista, pelo Chrome do RT, com as Tabelas 4.1 (empírico por idade), 4.2 (por agente) e 4.3 (profilaxia de contatos).
  - A ESCMID gradua de A (apoio forte) a D (contra).
- **Encefalite infecciosa:** Granerod J, Sellner J, Stahl JP, et al. Diagnosis and Management of Infectious Encephalitis in Adults: Guidelines From the European Academy of Neurology and European Society of Clinical Microbiology and Infectious Diseases. Eur J Neurol 2026;33(10):e70647 (PMID 42851210; PMC13650609).
  - Li o texto integral no PMC, pelo Chrome.
  - Usa GRADE e "boa prática".

O lado do manual vem da ficha da Central, já conferida no PDF (cap. 43, p. 589–597). A profilaxia de contatos do Brasil continua pelo Guia de Vigilância em Saúde 2024 (Quadro 3, p. 117).

## O que mudou na Central

- **Ficha `adulto-meningite` 2026-11-14.1:**
  - fontes `ESCMID_MENINGITE_2016` e `EAN_ESCMID_ENCEFALITE_2026`;
  - `DIRETRIZ_MENINGITE`: 14 temas com grau, fonte e página do manual;
  - `DIFERENCAS_MENINGITE`: 6 frases;
  - a tela de meningite ganha a tabela "ESCMID 2016 e EAN–ESCMID 2026 — ao lado do manual".
- As doses das diretrizes aparecem ao lado do manual, com a fonte: dexametasona 10 mg 6/6 h e profilaxia com rifampicina 600 mg, ceftriaxona 250 mg ou ciprofloxacino 500 mg. As doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap43-neuroinfeccao`:** 14 itens.
- **Migration** `20270414000006`. A ficha e a nota aguardam a aprovação do RT.

## Diferenças principais

| Tema | Diretriz | Manual de 2022 |
|---|---|---|
| Dexametasona | 10 mg 6/6 h por 4 dias, com a 1ª dose do antibiótico (A); até 4 h depois (C) — ESCMID | 0,15 mg/kg/dose 6/6 h por 4 dias (p. 591) |
| Suspender a dexametasona | se o agente não for pneumococo nem H. influenzae (B) — ESCMID | meningococo: "sem benefício, mas seguro" (p. 591) |
| TC antes da punção | só com déficit focal, crise nova, Glasgow < 10 ou imunossupressão grave (A) — ESCMID | remete à Figura 2 (p. 592) |
| Antibiótico | em até 1 h da chegada (A) — ESCMID | prioridade máxima, sem prazo (p. 590) |
| Profilaxia | em até 24 h; rifampicina 600 mg 12/12 h por 2 dias (A) — ESCMID | Guia do MS: até 48 h; 10 mg/kg, máx. 600 mg (p. 117) |
| Aciclovir | em até 6 h (forte); HSV comprovado ≥ 14 dias (boa prática) — EAN–ESCMID | desde a suspeita; 14–21 dias (p. 591–594) |
| Corticoide no HSV | sem recomendação a favor nem contra — EAN–ESCMID | não usar (p. 591) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| dose de dexametasona | 0,15 mg/kg (manual) | ESCMID: 10 mg 6/6 h, até 4 h depois; manual como diferença |
| TC antes da punção | "os trechos não trazem critérios objetivos" | ESCMID: os quatro critérios; sem eles, não fazer TC antes |
| tempo até o antibiótico | o mais cedo possível (manual) | ESCMID: até 1 h da chegada |
| suspender a dexametasona no meningococo | "o material não orienta suspensão" | ESCMID: suspender se o agente não for pneumococo nem H. influenzae (B) |
| profilaxia de contatos | Guia do MS: até 48 h; 10 mg/kg | ESCMID: até 24 h; 600 mg; o Guia do MS como diferença |
| aciclovir na encefalite herpética | desde a suspeita; 14–21 dias | EAN–ESCMID: até 6 h; ≥ 14 dias; regra de suspensão |

As seis respostas passam a abrir pela diretriz. Na pergunta da profilaxia, o texto da resposta chama o Guia do MS de "manual de 2022". O conteúdo está certo, mas o rótulo está trocado. A ficha e a nota citam o Guia do MS pelo nome.

## Homologação

- Migration aplicada.
- `adulto-meningite.md` (16 trechos) e `nota-hcfmusp-cap43-neuroinfeccao.md` (15 trechos) ingeridos. API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.229, sem falha) e typecheck limpos na árvore da homologação.
- A tela não foi vista com login.

## Produção, com o "ok produção"

1. Aplicar a migration `20270414000006`.
2. Copiar e ingerir `adulto-meningite.md` e `nota-hcfmusp-cap43-neuroinfeccao.md`.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.
