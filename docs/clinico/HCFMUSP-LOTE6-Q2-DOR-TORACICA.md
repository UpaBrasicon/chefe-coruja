# Revisão do HCFMUSP, lote 6, Q2: cap. 12 (dor torácica)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 6 inteiro. Pela Q2, o cap. 12 segue três passos: ler a diretriz, pôr a lista na ficha e fazer a nota.

## Fontes

- **SBC 2025:** Diretriz Brasileira de Atendimento à Dor Torácica na Unidade de Emergência, Arq Bras Cardiol 2025;122(9):e20250620 (PMID 41379176; PMC12981354).
  - Lida no texto integral do PMC, com as tabelas de recomendação (classe e nível de evidência).
  - Conferi no texto cada linha usada.
  - As figuras e o suplemento não vieram no PMC.
- **Manual:** cap. 12 conferido no PDF, p. 187–197 (exames, manejo, Tabelas 4 a 6 e Figura 1).

## O que mudou na Central

- **Ficha `heart`, versão 2026-11-14.1:**
  - nova lista `DIRETRIZ_DOR_TORACICA_2025`, com 11 temas e o manual ao lado;
  - na tela do HEART, um bloco novo: "SBC 2025 — ao lado do manual";
  - o cálculo do escore não mudou.
- **Nota `nota-hcfmusp-cap12-dor-toracica`:** 11 itens tirados da lista.
- **Migration:** `20270414000036`.

## Onde a diretriz difere do manual

| Tema | SBC 2025 | Manual |
|---|---|---|
| Oxigênio | saturação < 90% (sem classe) | saturação < 94% |
| Baixo risco no HEART | alta considerada com HEART ≤ 3 e descarte 0/1 h ou 0/2 h (I, B) | baixo risco HEART 0–2 (Tabela 4) |
| Dosagem única de troponina | dor > 3 h, abaixo do limite de detecção e baixo risco (IIa, B) | não trata |
| CK-MB | não pedir com troponina quantitativa (III, B) | não trata |
| AAS antes do diagnóstico | só AAS na suspeita de SCA; adiar na suspeita de dissecção | não trata |
| ADD-RS | não usar sozinho para excluir ou confirmar (III, B) | ADD-RS 0–1 e D-dímero < 500 descartam (Tabela 5) |

## Antes e depois (14/11/2026)

A produção já tinha o texto aberto da SBC 2025 no acervo de artigos CC BY. Por isso várias respostas já vinham pela diretriz.

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| protocolo de troponina | SBC 2025, pelo artigo aberto | SBC 2025: 0/1 h e 0/2 h preferíveis (IIa, B) |
| uma troponina basta (> 3 h) | SBC 2025, pelo artigo aberto | igual, com classe IIa, B |
| CK-MB | SBC 2025 (III, B) | igual |
| alta no baixo risco | "SCA descartada", sem HEART | SBC 2025: HEART ≤ 3 com descarte 0/1 h ou 0/2 h (I, B) |
| AAS antes do diagnóstico | "não há, nos trechos" | SBC 2025: só AAS; adiar na suspeita de dissecção |
| oxigênio | < 94% (manual) | SBC 2025 < 90%, com o manual < 94% ao lado |
| ADD-RS | ESC 2024 | ESC 2024 com a SBC 2025 |

## Homologação

- A migration foi aplicada, e as duas fichas estão aguardando aprovação.
- O HEART foi ingerido em 2 trechos e a nota em 12. A API foi reiniciada.
- Os testes da nota e do HEART passam, e o typecheck e o lint estão limpos.
