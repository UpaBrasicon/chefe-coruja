# Revisão do HCFMUSP, lote 5, P2: cap. 80, anemia falciforme

O RT decidiu P1 a P4 = A em 14/11/2026 e liberou a produção do lote 5 inteiro, desde que cada capítulo passe antes pela homologação e pelo CI verde.

## Fonte

- **Diretriz:** SRLF, GFRUP e SFMU. Guidelines for the management of emergencies and critical illness in pediatric and adult patients with sickle cell disease. Ann Intensive Care 2025;15:74 (PMID 40439782; PMC12123041).
  - Li o texto integral no PMC e usei só a parte do adulto.
  - A força vem da redação da diretriz: "provavelmente" é GRADE 2; "os especialistas sugerem" é opinião de especialistas.
- **ASH 2020 de dor (PMID 32559294):** o resumo não traz recomendações específicas, e não li o texto integral. Fica de fora.
- **Manual:** o lado do manual vem da ficha da Central, já conferida no PDF (cap. 80, p. 1051–1061).

## O que mudou na Central

- **Ficha `adulto-falciforme` 2026-11-14.1:**
  - fonte `SRLF_FALCIFORME_2025`, ao lado do TASC 2025 que já estava;
  - `DIRETRIZ_FALCIFORME`: 15 temas;
  - `DIFERENCAS_FALCIFORME`: 4 frases;
  - a tela ganha a tabela ao lado do manual.
- **Doses:** as doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap80-falciforme`:** 15 itens.
- **Migration:** `20270414000028`.

## Diferenças principais

| Tema | SRLF/SFMU 2025 | Manual de 2022 |
|---|---|---|
| Hidratação | contra hiper-hidratação sistemática; ajustar à clínica | 50 mL/kg em 24 h (p. 1056) |
| Saturação na crise vaso-oclusiva | alvo de 95% | O2 só abaixo de 90% (p. 1056) |
| Transfusão na síndrome torácica aguda | pela gravidade; exsanguineotransfusão, salvo Hb < 7 g/dL | forma leve com alvo de Hb ≥ 10 g/dL; moderada a grave, eritrocitoaférese (p. 1058) |
| Espirometria, ultrassom, corticoide, VNI | tratados | a ferramenta não traz |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| hidratação na crise | manual: 50 mL/kg em 24 h | SRLF: contra hiper-hidratação; manual ao lado |
| alvo de saturação | manual: O2 se < 90% | SRLF: 95% |
| corticoide na STA | "não encontrei" | SRLF: não de rotina |
| transfusão na STA | manual | SRLF: pela gravidade |
| espirometria de incentivo | "não encontrei" | SRLF: usar |
| morfina na crise grave (controle) | manual | protocolo da SRLF e a dose do manual |

As cinco respostas passam a abrir pela diretriz. A de controle mantém a dose do manual.

## Homologação

- Migration aplicada.
- 2 arquivos ingeridos e API reiniciada.
- `test:clinico` (1.249, sem falha) e typecheck limpos.
- A tela não foi vista com login.

## Produção do #704 (cap. 71), 14/11/2026

- A migration `20270414000027` foi aplicada antes do merge. O #704 foi mesclado com o CI verde.
- Os 6 arquivos foram ingeridos e a API foi reiniciada.
- As 6 respostas saíram como na homologação.
- O Vercel publicou o master, já no plano Pro.
