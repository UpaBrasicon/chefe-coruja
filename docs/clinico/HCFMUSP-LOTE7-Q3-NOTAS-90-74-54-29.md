# Revisão do HCFMUSP, lote 7, Q3: cap. 90 (influenza), 74 (monoartrite), 54 (diverticulite) e 29 (hemorragia alveolar)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 7 inteiro. Pela Q3, os quatro capítulos ganham só a nota, ligada ao capítulo do manual, porque não há ficha de adulto na Central. Nenhuma ferramenta nova.

## Fontes e limites

- **Cap. 90, OMS 2024 de influenza:** resumo da diretriz no BMJ (Vandvik et al., BMJ 2026;392:e087397, PMID 41760115).
  - Lido o resumo, que traz as recomendações e a força de cada uma.
  - O texto integral está fechado.
- **Cap. 74:**
  - SANJO 2023 de artrite séptica (Ravn et al., J Bone Jt Infect 2023;8(1):29–37, PMID 36756304, PMC9901514): texto integral lido, com graus GRADE de letra e número.
  - ACR 2020 de gota (FitzGerald et al., Arthritis Care Res 2020;72(6):744–760, PMID 32391934, PMC10563586): lida a seção da crise. A certeza de cada recomendação fica nas tabelas, que não vieram no texto.
  - A ACR 2020 é anterior ao manual, mas o manual não a segue na colchicina nem no hipouricemiante.
  - Não existe diretriz de gota de sociedade posterior a 2022.
- **Cap. 54, ACG 2026 de diverticulite:** Peery et al., Am J Gastroenterol 2026;121(7):1549–1561 (PMID 42390126).
  - Lido o resumo. A diretriz é voltada ao ambulatório de gastroenterologia.
- **Cap. 29, BSR 2025 de vasculite ANCA:** Biddle et al., Rheumatology 2025;64(8):4470–4494 (PMID 40499922, PMC12316377).
  - Texto integral lido, com GRADE e grau de concordância.
  - Não há diretriz só de hemorragia alveolar.
  - A BSR trata da granulomatose com poliangeíte e da poliangeíte microscópica, não da doença antimembrana basal.
- **Manual:** conferido no PDF. Cap. 90, p. 1224–1225; cap. 74, p. 990–992; cap. 54, p. 740–752; cap. 29, p. 401–404.
- **Conferência dos trechos:** os trechos dos agentes foram conferidos no texto salvo. Dois pontos ficaram fora:
  - o DOI da BSR que um dos agentes trouxe estava errado. O certo, conferido nos metadados, é 10.1093/rheumatology/keaf240;
  - a duração do antibiótico no SANJO não foi encontrada no texto e não entrou.

## O que mudou na Central

- **Notas:**
  - `nota-hcfmusp-cap90-influenza`: 4 itens;
  - `nota-hcfmusp-cap74-monoartrite`: 7 itens;
  - `nota-hcfmusp-cap54-diverticulite`: 4 itens;
  - `nota-hcfmusp-cap29-hemorragia-alveolar`: 5 itens.
- **Migration:** `20270414000045`.

## Ajustes feitos na homologação

- **Plasmaférese:** o tema passou a dizer "na vasculite ANCA".
- **Item novo de escopo:** a BSR não trata da doença antimembrana basal. Na pergunta sobre síndrome de Goodpasture, a resposta abria com "não é de rotina". Agora abre com a plasmaférese diária do manual.

## Onde a fonte difere do manual

| Tema | Fonte nova | Manual |
|---|---|---|
| Corticoide na influenza grave | OMS 2024: contra (condicional) | considerar com P/F < 200 |
| Antibiótico na influenza | OMS 2024: contra no caso não grave (forte) | amplo espectro no caso grave |
| Antibiótico na artrite séptica | SANJO: penicilina semissintética com ceftriaxona, ou amoxicilina-clavulanato | oxacilina; somar ceftriaxona ou ciprofloxacino nos de risco |
| Colchicina na gota | ACR 2020: dose baixa (1,2 mg e 0,6 mg 1 h depois) (forte) | 1,5–3 mg por 3–6 dias |
| Hipouricemiante na crise | ACR 2020: pode começar durante a crise (condicional) | não antes de 2 a 4 semanas |
| Antibiótico na diverticulite | ACG 2026: não de rotina no baixo risco | dispensável no ambulatorial |
| Pulso de metilprednisolona | BSR 2025: não de rotina; opção na hemorragia alveolar (2C) | 500–1.000 mg por 3–5 dias |
| Plasmaférese na vasculite ANCA | BSR 2025: não de rotina sem rim grave (1A); considerar com creatinina > 300 µmol/L (2B) | opção na granulomatose com poliangeíte |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| corticoide na influenza grave | "não há trecho específico" | OMS 2024: não usar |
| antibiótico na gripe não grave | "não encontrei" | OMS 2024: não usar (forte) |
| antibiótico na artrite séptica | manual (oxacilina) | SANJO 2023 com o manual ao lado |
| dose de colchicina | manual (1,5–3 mg) | ACR 2020 (dose baixa) com o manual |
| alopurinol na crise | "não encontrei" | ACR 2020: pode começar, se indicado; manual: esperar |
| antibiótico na diverticulite | manual | ACG 2026 com o manual |
| plasmaférese na vasculite | manual (opção) | BSR 2025 com o manual |
| pulso de metilprednisolona | manual | BSR 2025 com o manual |

## Homologação

- A migration foi aplicada, e as quatro notas estão aguardando aprovação.
- As notas foram ingeridas e a API foi reiniciada.
- Os testes da nota passam, e o typecheck está limpo.
