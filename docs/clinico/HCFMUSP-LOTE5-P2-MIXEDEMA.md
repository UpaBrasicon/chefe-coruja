# Revisão do HCFMUSP, lote 5, P2: cap. 71, estado mixedematoso

O RT decidiu P1 a P4 = A em 14/11/2026.

## Fonte

- **Consenso:** Taylor P, Gibb F, Medici M, et al. Management of endocrine emergencies: joint consensus statement for management of myxoedema coma. Eur Thyroid J 2026;15(4) (PMID 42466568; PMC13452032).
  - É das sociedades britânica de tireoide, europeia de tireoide, de endocrinologia do Reino Unido e galesa de endocrinologia.
  - Li o texto integral no PMC.
  - É consenso de especialistas, sem graduação.
- **Manual:** o lado do manual vem da ficha da Central, já conferida no PDF (cap. 71, p. 958–963).

## O que mudou na Central

- **Ficha `adulto-estado-mixedematoso` 2026-11-14.1:** antes só tinha o manual.
  - Fonte `CONSENSO_MIXEDEMA_2026`.
  - `DIRETRIZ_MIXEDEMA`: 12 temas.
  - `DIFERENCAS_MIXEDEMA`: 5 frases.
  - A tela ganha a tabela ao lado do manual.
- **Doses e escore:** as doses e o escore do manual não mudam.
- **Nota `nota-hcfmusp-cap71-mixedema`:** 12 itens.
- **Migration:** `20270414000027`.

## Diferenças principais

| Tema | Consenso 2026 | Manual de 2022 |
|---|---|---|
| Ataque de levotiroxina | 200–400 µg EV; 100–200 µg no idoso, no paciente menor ou com cardiopatia | 200–500 µg EV ou 500 µg VO, sem ajuste (p. 962) |
| Manutenção | 1,6 µg/kg/dia, 75% disso enquanto EV | 50–150 µg/dia (p. 962) ou 100–150 µg/dia (Tabela 5) |
| Hidrocortisona | 100 mg EV e depois 50 mg a cada 6 h | 100 mg EV a cada 8 h (p. 962) |
| Antibiótico | largo espectro até excluir infecção | a ferramenta não traz |
| Escore | risco a partir de 45; FC < 40 vale 30 pontos | sugestivo a partir de 25; sem linha para FC < 40 (Tabela 3) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| ataque de levotiroxina | manual: 200–500 µg EV ou 500 µg VO | consenso: 200–400 µg EV, menos no idoso ou cardiopata |
| hidrocortisona | 100 mg e 50–100 mg a cada 6 h (outro trecho) | consenso: 100 mg e 50 mg a cada 6 h, em todos |
| liotironina | manual: a maioria não recomenda | consenso: só se não melhorar em 24 h, 2,5–10 µg a cada 8 h |
| antibiótico empírico | "não encontrei" | consenso: largo espectro até excluir infecção |
| aquecimento | manual: cobertores | consenso: passivo; o ativo periférico pode causar colapso |
| hidrocortisona na crise adrenal (mesmo módulo, controle) | Endocrine Society, SfE e ESE/ES | igual |

As cinco respostas do mixedema passam a abrir pelo consenso. A pergunta de controle ficou igual.

## Homologação

- Migration aplicada.
- 6 arquivos ingeridos e API reiniciada.
- `test:clinico` (1.248, sem falha) e typecheck limpos.
- A tela não foi vista com login.

## Produção do #703 (P1), 14/11/2026, com o ok do RT

- A migration `20270414000026` foi aplicada antes do merge. O #703 foi mesclado com o CI verde.
- Os 4 arquivos foram ingeridos e a API foi reiniciada.
- As 8 respostas saíram como na homologação.
- O Vercel não publicou: o plano gratuito bateu o limite diário de deploys. O #703 não mexe em nenhuma tela, então o site da produção não mudou. O RT passou para o plano Pro no mesmo dia.
