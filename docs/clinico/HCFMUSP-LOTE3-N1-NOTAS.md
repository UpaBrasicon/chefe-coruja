# Revisão do HCFMUSP, lote 3: N1 (notas dos cap. 33, 40 e 76) e N3 (IDSA na PAC)

Decisão do RT de 14/11/2026: N1 a N3 = A. O diagnóstico está em `HCFMUSP-LOTE3-DIAGNOSTICO.md`.

## O que mudou

**N1: três notas de atualização**, montadas a partir das listas já conferidas nas fichas, sem texto clínico novo.

| Nota | Itens | De onde vêm |
|---|---|---|
| `nota-hcfmusp-cap33-pac` | 9 | `DIRETRIZ_PAC_2026` (8) e a nota da IDSA |
| `nota-hcfmusp-cap40-hsa` | lista + 2 | `DIRETRIZ_HSA_2023` e as notas da ESO 2026 e da NCS 2026 |
| `nota-hcfmusp-cap76-agitacao` | 2 + diferenças | ACEP 2024, níveis B e C, e `DIFERENCAS_AGITACAO_2024` |

**N3: PAC.**
- Pelo Chrome do RT, abri o texto integral da ATS 2025 na Oxford Academic. Até então só tínhamos a página do periódico. As 10 recomendações, com força e votação, foram conferidas.
- A ficha tinha só uma das quatro recomendações sobre vírus respiratório. Ganhou a do internado: na PAC não grave, a ATS sugere antibiótico empírico (80% dos votos); na grave, a decisão foi unânime. O texto do ambulatório agora traz as duas votações.
- O comunicado da IDSA (Am J Respir Crit Care Med 2026;212(5):1064–1066, PMID 41738241) foi lido no texto integral. A IDSA concorda com 8 das 10 recomendações. Ela não aceita o antibiótico empírico para quem tem vírus positivo no ambulatório com comorbidade e no internado não grave. Nesses casos, sugere antibiótico só quando os dados do paciente indicarem coinfecção bacteriana.
- A ficha `adulto-pac-antibiotico` passa a 2026-11-14.1, com a IDSA como fonte e a nota dela na tela. Doses e esquemas não mudam.

**Migration** `20270414000004`. A ficha e as três notas aguardam a aprovação do RT.

## Antes e depois (14/11/2026)

Perguntas direto à API da biblioteca (`conflito_l3n1.py`). "Antes" é a produção. "Depois" é a homologação.

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| influenza positiva, internado não grave: antibiótico? | "não encontrei" | sim pela ATS (condicional, 80% dos votos), dizendo que a IDSA discorda |
| dias de tratamento na PAC não grave | "o material não traz" | menos de 5 dias, mínimo de 3 (ATS), com o manual como diferença |
| corticoide na PAC grave | ATS, condicional | igual |
| ácido tranexâmico na HSA | ESO 2026 e AHA 2023 | igual |
| profilaxia anticonvulsivante na HSA | NCS 2026 | igual |
| droga na agitação grave | quetamina 5 mg/kg IM do manual primeiro | ACEP 2024 (nível B) primeiro, com o manual como diferença |

## Produção, com o "ok produção"

1. Aplicar a migration `20270414000004`.
2. Copiar e ingerir `adulto-pac-antibiotico.md`, `nota-hcfmusp-cap33-pac.md`, `nota-hcfmusp-cap40-hsa.md` e `nota-hcfmusp-cap76-agitacao.md`.
3. Reiniciar a API.
4. Refazer as perguntas.
5. Mesclar.

## Produção (14/11/2026, com o "ok produção" do RT)

- A migration `20270414000004` foi aplicada antes do merge. A ficha da PAC e as três notas estão na versão 2026-11-14.1.
- O corpus foi gerado do master e ingerido. A API foi reiniciada.
- A Vercel publicou o master com sucesso.
- Refiz as perguntas na produção: as seis abrem pela diretriz.
