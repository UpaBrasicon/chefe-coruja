# Revisão do HCFMUSP, lote 2, M2: cap. 31, exacerbação de DPOC (GOLD 2026)

Decisão do RT de 13/11/2026 (M2 = A): ler a diretriz nova, atualizar a ficha e só depois fazer a nota. O diagnóstico do lote 2 está em `HCFMUSP-LOTE2-DIAGNOSTICO.md`.

## Fonte

GOLD, Global Strategy for the Diagnosis, Management, and Prevention of COPD, relatório 2026 (v1.3, 8 dez. 2025).

- O RT autorizou baixar o PDF em 13/11/2026.
- Foi lido o capítulo 4, Management of Exacerbations, p. 92–108, com as figuras 4.2, 4.4, 4.5, 4.6, 4.8 e 4.9. As figuras foram vistas como imagem.
- O resumo das mudanças de 2026 diz que esse capítulo foi todo reescrito.
- O GOLD não usa classe de recomendação. Quando a Figura 4.6 traz nível de evidência, a ficha cita o nível.

## O que mudou na Central

**Ficha `adulto-dpoc-exacerbacao` 2026-11-13.1:**
- fonte `GOLD_2026`;
- `DIRETRIZ_DPOC_GOLD_2026`: 17 temas, cada um com a página do relatório e o que o manual traz;
- `DIFERENCAS_DPOC_GOLD_2026`: 6 frases;
- a tela ganha a tabela "GOLD 2026 — ao lado do manual".
- Ficam como estavam: a conta da gasometria, que segue a Tabela 6 do manual, as doses e os parâmetros de VNI e VM.

**Nota `nota-hcfmusp-cap31-dpoc`:** 17 itens tirados da lista.

**Migration** `20270413000010`. A ficha e a nota aguardam a aprovação do RT.

## Diferenças principais

| Tema | GOLD 2026 | Manual de 2022 |
|---|---|---|
| Indicação de VNI | PaCO2 ≥ 45 mmHg e pH ≤ 7,35; dispneia grave com fadiga; hipoxemia persistente (Figura 4.8) | pH < 7,35 e PaCO2 > 60 mmHg (Tabela 6) |
| Gravidade | Classificação de Roma: dispneia, FR, FC, SaO2, PCR e gasometria | 1, 2 ou 3 manifestações cardinais |
| Antibiótico | escarro purulento e mais um sintoma; cultura positiva anterior; ou ventilação mecânica | exacerbações moderadas e graves |
| CNAF | primeiro suporte na insuficiência hipoxêmica; VNI na hipercápnica | não está na ferramenta |
| Corticoide | 40 mg de prednisona por 5 dias | igual |

A tela mostra a diferença da VNI por escrito. A conta da gasometria não muda. Mudar o corte da conta é decisão do RT.

## Antes e depois (13/11/2026)

Perguntas direto à API da biblioteca (`conflito_dpoc.py`). "Antes" é a produção, sem o GOLD 2026. "Depois" é a homologação.

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| pH 7,32 e PaCO2 52: tem VNI? | "sim", misturando cortes de outros trechos e a Tabela 6 do manual | "sim", pelo GOLD 2026 (PaCO2 ≥ 45 e pH ≤ 7,35), com o manual como diferença |
| quando dar antibiótico | moderadas e graves (manual) | critérios do GOLD 2026 (evidência A), com o manual como diferença |
| aminofilina | ineficaz (manual) | não recomendada (GOLD 2026), igual ao manual |
| CNAF na DPOC | "os trechos não trazem" | primeiro suporte na hipoxêmica; VNI na hipercápnica (GOLD 2026) |
| corticoide | prednisona 40 mg por 5 dias | igual, citando o GOLD 2026 |
| gravidade | manual, misturado com a GINA da asma | classificação de Roma (GOLD 2026), com o manual como diferença |

Seis de seis respostas passam a abrir pelo GOLD 2026.

## Produção, com o "ok produção"

1. Aplicar a migration `20270413000010`.
2. Copiar e ingerir `adulto-asma-exacerbacao.md`, `adulto-dpoc-exacerbacao.md` e `nota-hcfmusp-cap31-dpoc.md`.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.

## Produção (13/11/2026, com o "ok produção" do RT)

- A migration `20270413000010` está aplicada. As fichas `adulto-dpoc-exacerbacao` e `nota-hcfmusp-cap31-dpoc` estão na versão 2026-11-13.1.
- O corpus foi gerado do master e ingerido. A API foi reiniciada.
- A Vercel publicou o master com sucesso.
- As seis perguntas foram refeitas na produção:
  - cinco abrem pelo GOLD 2026 (antibiótico, aminofilina, CNAF, corticoide, Roma);
  - a da VNI com pH 7,32 e PaCO2 52 responde "sim", mas abre pelo corte de outra ficha da Central ("PaCO2 > 45 ou pH < 7,3"), e não pelo GOLD. Na homologação, a mesma pergunta abria pelo GOLD. A resposta não contradiz o GOLD. Fica como achado de ordenação da busca.
