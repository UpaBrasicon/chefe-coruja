# Revisão do HCFMUSP, lote 9, Q1: notas dos cap. 55 (ascite), 108 (toracocentese), 104 (sintomas em paliativos) e 48 (pré-hospitalar)

Em 15/11/2026 o RT decidiu Q1 a Q4 = A no lote 9. Pela Q1, estes quatro capítulos ganham a nota a partir da ficha da Central, que já cita fonte nova. Nenhuma diretriz foi lida de novo, e nenhuma ficha muda.

## De onde vêm os itens

- **Cap. 55, ficha `adulto-ascite-pbe-hepatorrenal`:** 3 itens da lista da AASLD 2021, já lida no texto integral no lote 4 (paracentese diagnóstica, paracentese de grande volume, nefrotóxicos).
- **Cap. 108, ficha dos critérios de Light:** 2 itens da lista da BTS 2023 de doença pleural, lida no lote 7 (toracocentese guiada por imagem, amostra).
- **Cap. 104, ficha `adulto-sintomas-paliativos`:** a nota da EAPC 2024 de sedação paliativa (Delphi internacional), posta na ficha em 06/11/2026, dividida em 3 itens (indicação, hidratação, fármacos).
- **Cap. 48, ficha `adulto-trauma-inicial`:** o item de compressão e torniquete da diretriz europeia de 2023, a nota do PATCH-Trauma (ácido tranexâmico pré-hospitalar) e a dos dois ensaios de sangue total pré-hospitalar (NEJM 2026). Os ensaios aparecem como ensaios, não como diretriz.
- **Manual:** a coluna do manual foi tirada de novo dos próprios capítulos, no PDF: cap. 55, p. 757, 762, 763 e 766; cap. 108, p. 1462, 1463, 1467 e 1468; cap. 104, p. 1387 e 1388; cap. 48, p. 668.

## O que mudou na Central

- Notas novas, versão 2026-11-15.1, aguardando aprovação:
  - `nota-hcfmusp-cap55-ascite` (3 itens);
  - `nota-hcfmusp-cap108-toracocentese` (2 itens);
  - `nota-hcfmusp-cap104-paliativos-sintomas` (3 itens);
  - `nota-hcfmusp-cap48-pre-hospitalar` (3 itens).
- **Migration:** `20270414000051`.

## Onde a fonte difere do manual

| Tema | Fonte da ficha | Manual |
|---|---|---|
| Paracentese diagnóstica | AASLD 2021: todo cirrótico com ascite internado de urgência, mesmo sem sinal de infecção | puncionar a ascite sem diagnóstico prévio |
| Albumina na paracentese de alívio | AASLD 2021: 6–8 g por litro acima de 5 L; risco maior acima de 8 L | 8 g/L acima de 5 L |
| Nefrotóxicos | AASLD 2021: evitar AINE, IECA, BRA e aminoglicosídeo | o cap. 55 não trata |
| Toracocentese | BTS 2023: sempre guiada por imagem | POCUS como recurso; pneumotórax menor com ele |
| Sedação paliativa | EAPC 2024: proporcionalidade, sem tempo mínimo de expectativa de vida; hidratação decidida à parte | fase final de vida, sintoma refratário e sofrimento intolerável |
| Sangue total pré-hospitalar | dois ensaios (NEJM 2026): não superior aos componentes | o cap. 48 não trata |

## Antes e depois (15/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| ascite: quando fazer paracentese diagnóstica? | AASLD 2021, pela ficha | AASLD 2021 com o cap. 55 ao lado |
| paracentese de alívio: albumina | AASLD 2021 e manual | igual, agora com a página do cap. 55 |
| toracocentese guiada por ultrassom? | BTS 2023, com o manual citado pelo cap. 36 | BTS 2023 com o cap. 108 (POCUS e pneumotórax) |
| sedação paliativa: quando indicar? | EAPC 2024, pela ficha | EAPC 2024 com o cap. 104 ao lado |
| ácido tranexâmico no pré-hospitalar | EAST 2025 e PATCH-Trauma | igual, com o cap. 48 |
| sangue total no pré-hospitalar | "não encontrei" | os dois ensaios de 2026: não superior aos componentes; o cap. 48 não trata |

## Homologação

- A migration foi aplicada, e as quatro notas estão aguardando aprovação.
- As notas foram ingeridas, e a API foi reiniciada.
- Os testes da nota passam, e o typecheck está limpo.

## Produção do #736, 15/11/2026

- A migration `20270414000051` foi aplicada antes do merge. O #736 foi mesclado com o CI verde.
- Foram ingeridos 4 arquivos, e a API foi reiniciada. O Vercel publicou o master.
- As seis respostas saíram como na homologação. Na do sangue total, a resposta chamou os dois ensaios de "diretriz atual"; o item foi corrigido no #737.
