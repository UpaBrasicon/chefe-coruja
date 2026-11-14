# Revisão do HCFMUSP, lote 2, M2: cap. 32, tromboembolismo pulmonar (AHA/ACC 2026)

Decisão do RT de 13/11/2026 (M2 = A): ler a diretriz nova, atualizar a ficha e só depois fazer a nota. O diagnóstico do lote 2 está em `HCFMUSP-LOTE2-DIAGNOSTICO.md`.

## Fonte

2026 AHA/ACC/ACCP/ACEP/CHEST/SCAI/SHM/SIR/SVM/SVN Guideline for the Evaluation and Management of Acute Pulmonary Embolism in Adults. Circulation 2026;153(12):e977–e1051 (PMID 41712677), versão corrigida.

**Como foi lida:**
- Em 14/11/2026, com o Chrome do RT conectado, o artigo abriu no site da Circulation. Ele está em acesso livre ("Free Access"), e a verificação do site passou sozinha, sem clique.
- As tabelas de recomendação são imagens. Li as das seções 3.1.1, 3.1.2, 3.2.1, 4.1.1, 4.2.1 (parte geral e obesidade), 4.2.2, 4.2.3, 4.4 e 4.4.1, além das figuras 1 (avaliação clínica) e 2 (categorias A a E).
- A diretriz não traz dose de trombolítico.

O lado do manual foi conferido no PDF do livro (cap. 32, p. 429–449). Ao conferir, troquei duas páginas que eu tinha escrito de memória. Vi também que o manual já traz o D-dímero ajustado pela idade (p. 435).

## O que mudou na Central

- **`tep2026.ts`:**
  - fonte `AHA_TEP_2026`;
  - `DIRETRIZ_TEP_2026`: 18 temas, cada um com classe (COR), nível (LOE), seção e o que o manual traz, com a página;
  - `DIFERENCAS_TEP_2026`: 6 frases.
- **PERC, HESTIA, PESI e fibrinolíticos** passam à versão 2026-11-14.1, com a fonte e cuidados da AHA/ACC 2026.
- **Tela dos fibrinolíticos:** ganha a tabela "AHA/ACC 2026 — TEP, ao lado do manual".
- **Doses e contas do manual não mudam.**
- **Nota `nota-hcfmusp-cap32-tep`:** 18 itens. A nota da SCA (cap. 13–14) continua igual, porque não herda a fonte nova.
- **Migration** `20270414000001`. As cinco versões aguardam a aprovação do RT.

## Diferenças principais

| Tema | AHA/ACC 2026 | Manual de 2022 |
|---|---|---|
| Gravidade | categorias A a E, com subcategorias e modificador R | baixo, intermediário baixo, intermediário alto e alto risco (Figura 4, p. 447) |
| Trombólise | razoável em E1–E2 (2a); considerada em D1–D2 (2b); incerta em C3 (2b); contraindicada de A1 a C2 (3: dano) | instabilidade hemodinâmica (p. 441); intermediário alto só se descompensar (p. 447) |
| PERC | só na probabilidade baixa (< 15%) | na probabilidade improvável (p. 433) |
| Anticoagulante parenteral | HBPM em vez de HNF nas categorias C1 a E1 (1, B-R) | HNF preferida na instabilidade, na disfunção renal e nos extremos (p. 442) |
| D-dímero | ajustado pela idade (2a) e YEARS (2a) | ajustado pela idade (p. 435); sem YEARS |
| Intubação | evitar sedação profunda e intubação sem indicação nas categorias C a E (3: dano) | suporte hemodinâmico e respiratório, sem detalhe |

## Antes e depois (14/11/2026)

Perguntas direto à API da biblioteca (`conflito_tep.py`). "Antes" é a produção, sem a AHA/ACC 2026. "Depois" é a homologação.

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| quando usar o PERC | probabilidade baixa ou improvável (manual) | só na probabilidade < 15% (AHA/ACC 2026), com o manual como diferença |
| D-dímero ajustado pela idade | idade × 10, pelo manual e pela diretriz de dor torácica | igual, citando a AHA/ACC 2026 (2a, B-R) |
| trombólise no risco intermediário alto | "não há conduta de trombólise para esse grupo" | trombólise por categoria (D 2b; E 2a; A1–C2, 3: dano) |
| HNF ou enoxaparina | "não há comparação direta" | HBPM em vez de HNF (1, B-R) |
| alta do pronto-socorro | PESI I–II com HESTIA negativo (manual) | igual, pelo manual; a AHA/ACC aparece abaixo |
| intubação no TEP com choque | "o material não traz" | evitar sedação profunda; vasopressor ou ECMO à mão (AHA/ACC 2026) |

Cinco de seis respostas passam a abrir pela AHA/ACC 2026. A da alta abre pelo manual, que não contradiz a diretriz.

## Produção, com o "ok produção"

1. Aplicar a migration `20270414000001`.
2. Copiar e ingerir `adulto-fibrinoliticos.md`, `adulto-hestia.md`, `adulto-perc.md`, `adulto-pesi.md` e `nota-hcfmusp-cap32-tep.md`.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.
