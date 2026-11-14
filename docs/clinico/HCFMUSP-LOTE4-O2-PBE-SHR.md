# Revisão do HCFMUSP, lote 4, O2: cap. 57 e 58, peritonite bacteriana espontânea e síndrome hepatorrenal

O RT decidiu O1 a O4 = A em 14/11/2026. Ele liberou a produção do resto do lote 4 desde que cada capítulo passe antes pela homologação e pelo CI verde.

## Fontes

- **AASLD 2021:** Biggins SW, Angeli P, Garcia-Tsao G, et al. Diagnosis, Evaluation, and Management of Ascites, Spontaneous Bacterial Peritonitis and Hepatorenal Syndrome: 2021 Practice Guidance by the American Association for the Study of Liver Diseases. Hepatology 2021;74(2):1014–1048 (PMID 33942342).
  - Li o texto integral no site da revista, pelo Chrome do RT.
  - É uma guidance: as recomendações não têm graduação.
- **ADQI-ICA 2024:** consenso já citado na ficha desde 09/10/2026. Agora entram as recomendações graduadas, lidas no PMC.
- **Manual:** o lado do manual vem da ficha da Central, já conferida no PDF (cap. 55, 57 e 58).

## O que mudou na Central

- **Ficha `adulto-ascite-pbe-hepatorrenal` 2026-11-14.1:**
  - nova fonte `AASLD_ASCITE_2021`;
  - `DIRETRIZ_PBE_SHR`: 16 temas;
  - `DIFERENCAS_PBE_SHR`: 6 frases;
  - a tela ganha a tabela ao lado do manual.
- **Doses:** as doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap57-58-pbe-shr`:** 16 itens.
- **Migration:** `20270414000019`.

## Diferenças principais

| Tema | Diretriz | Manual de 2022 |
|---|---|---|
| Diagnóstico da SHR | 24 h sem melhora após volume; não exige 48 h de albumina (ADQI-ICA, forte, D) | 48 h de albumina 1 g/kg (p. 791–793) |
| Subir a terlipressina | a cada 24 h sem queda de 25% da creatinina (ADQI-ICA, forte, D) | a cada 2 dias (p. 795–797) |
| Quando parar | sem melhora em 48 h na dose máxima (ADQI-ICA); 4 dias (AASLD) | até 14 dias (p. 797) |
| Volume na LRA | cristaloide balanceado (ADQI-ICA, forte, B) | albumina 1 g/kg/dia por 2 dias (p. 791) |
| Cefotaxima | 2 g de 12/12 h (AASLD) | 2 g de 6/6 h ou 8/8 h (p. 784–785) |
| Paracentese grande | 6–8 g de albumina por litro (AASLD) | 8 g/L (p. 766) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| cefotaxima na PBE | manual: 2 g 8/8 h | AASLD: 2 g 12/12 h, com a diferença do manual |
| quando subir a terlipressina | manual: a cada 2 dias | ADQI-ICA: a cada 24 h; manual ao lado |
| 48 h de albumina para a SHR | ADQI-ICA: não exige | ADQI-ICA: não exige (forte, D) |
| albumina ou cristaloide na LRA | manual: albumina | ADQI-ICA: cristaloide balanceado; manual ao lado |
| albumina na paracentese grande | manual: 8 g/L | AASLD: 6–8 g/L; manual ao lado |
| midodrina e octreotídeo | "não encontrei" | AASLD: midodrina 5–15 mg 8/8 h e octreotídeo 100–200 µg 8/8 h, eficácia baixa |
| lactulose (mesmo módulo, controle) | manual | manual, sem mudança |

Cinco respostas passam a abrir pela diretriz. A de 48 h já abria. A da lactulose ficou igual.

## Homologação

- Migration aplicada.
- 3 arquivos ingeridos e API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.242, sem falha) e typecheck limpos.
- A tela não foi vista com login.
