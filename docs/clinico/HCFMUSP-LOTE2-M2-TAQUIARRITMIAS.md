# Revisão do HCFMUSP, lote 2, M2: cap. 18, outras taquiarritmias (AHA 2025)

Decisão do RT de 13/11/2026 (M2 = A): ler a diretriz nova, atualizar a ficha e só depois fazer a nota. O diagnóstico do lote 2 está em `HCFMUSP-LOTE2-DIAGNOSTICO.md`.

## Fonte

Part 9: Adult Advanced Life Support, 2025 American Heart Association Guidelines for CPR and ECC. Circulation 2025;152(suppl 2):S538–S577 (PMID 41122884).

- Em 14/11/2026 o texto integral abriu no site da Circulation, pelo Chrome do RT.
- As tabelas de recomendação e a Figura 6 são imagens. Foram lidas uma a uma:
  - taquicardia de QRS largo;
  - TV polimórfica;
  - taquicardia regular de QRS estreito;
  - Figura 6, com o algoritmo de taquiarritmia com pulso e o quadro de doses.
- A FA fica de fora, porque está no cap. 17 (ESC 2024 e SBC 2025, decisão M3).

O lado do manual foi conferido no PDF do livro (cap. 18, p. 262–266).

## O que mudou na Central

- **Ficha `adulto-taquiarritmias` 2026-11-14.1:**
  - fonte `AHA_ALS_2025_TAQUI`;
  - `DIRETRIZ_TAQUI_2025`: 16 temas com classe e a página do manual;
  - `DIFERENCAS_TAQUI_2025`: 6 frases;
  - a tela ganha a tabela "AHA 2025 — ao lado do manual".
- **Doses e contas do manual não mudam.**
- **Nota `nota-hcfmusp-cap18-taquiarritmias`:** 16 itens.
- **Migration** `20270414000002`. A ficha e a nota aguardam a aprovação do RT.

## Diferenças principais

| Tema | AHA 2025 | Manual de 2022 |
|---|---|---|
| TV monomórfica estável | cardioversão quando manobra vagal e drogas falham ou são contraindicadas (1, B-NR); amiodarona, procainamida ou sotalol (2b) | cardioversão é a primeira linha; drogas se o paciente recusa ou não tolera a sedação (p. 264) |
| Adenosina no QRS largo | aceita no estável, regular e monomórfico (2b); contraindicada no instável, irregular ou polimórfico (3: dano) | não trata do ponto |
| Verapamil e diltiazem no QRS largo | contraindicados (3: dano) | proibidos na disfunção de VE e na FA com WPW (p. 266) |
| Magnésio | só no torsades (2b); sem benefício com QT normal (3) | 2 g em 15 min no torsades estável (p. 266) |
| TSV estável | manobra vagal (1) e adenosina (1); diltiazem, verapamil ou betabloqueador IV (2a) | manobra vagal modificada, adenosina e, em terceira linha, diltiazem ou esmolol (p. 265) |

## Antes e depois (14/11/2026)

Perguntas direto à API da biblioteca (`conflito_taqui.py`). "Antes" é a produção. "Depois" é a homologação.

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| TV monomórfica estável | cardioversão primeiro (manual) | cardioversão quando as drogas falham (AHA 2025, 1), com o manual como diferença |
| adenosina no QRS largo | "os trechos não trazem" | só no estável, regular e monomórfico (2b); não no instável (3: dano) |
| verapamil no QRS largo | "os trechos não trazem" | não usar (3: dano) |
| magnésio com QT normal | "o material não traz" | não usar de rotina (3: sem benefício) |
| dose de adenosina | 6, 12 e 12 mg (manual) | 6 e 12 mg (AHA 2025), com o manual como diferença |
| betabloqueador IV na TSV | "os trechos não trazem" | razoável no estável (2a, C-LD) |

Na primeira rodada, a pergunta do betabloqueador não achou a nota. Separei o betabloqueador e o bloqueador de canal de cálcio em linhas próprias, com "TSV" no nome, e acrescentei "taquicardia supraventricular (TSV)" ao assunto da nota. Na segunda rodada, a busca achou.

## Produção, com o "ok produção"

1. Aplicar a migration `20270414000002`.
2. Copiar e ingerir `adulto-bradicardia.md`, `adulto-pcr.md`, `adulto-taquiarritmias.md` e `nota-hcfmusp-cap18-taquiarritmias.md`.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.
