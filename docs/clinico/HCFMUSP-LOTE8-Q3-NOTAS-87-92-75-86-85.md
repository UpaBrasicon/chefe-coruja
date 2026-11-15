# Revisão do HCFMUSP, lote 8, Q3: cap. 87 (COVID-19), 92 (chikungunya), 75 (reumatológicas), 86 (otorrino) e 85 (oftalmologia)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 8 inteiro. Pela Q3, estes capítulos ganham só a nota, ligada ao capítulo do manual, porque não há ficha de adulto na Central. Nenhuma ferramenta nova.

## Fontes e limites

- **Cap. 87, IDSA 2025 (antiviral na COVID-19 leve a moderada):** Shumaker et al., Clin Infect Dis 2026;82(Suppl 3):i1–i17 (PMID 41920902).
  - O texto no PMC está em embargo até 2027.
  - As recomendações foram lidas na página da diretriz no site da IDSA, atualizada em 14/10/2025, e conferidas no texto salvo.
  - O trecho sobre corticoide no internado sem hipoxemia não foi encontrado literalmente e ficou fora.
- **Cap. 92, OMS 2025 de arboviroses:** é a fonte que já está na Central pela ficha da dengue (lote 5).
  - O resumo das recomendações (NCBI Bookshelf, NBK616301) foi lido de novo pelo Chrome do RT, nas recomendações que valem para todas as arboviroses, incluindo a chikungunya.
  - Um agente não conseguiu abrir a página: o NCBI pediu reCAPTCHA, que ele não contornou. Pelo Chrome a página abriu normalmente.
- **Cap. 75:**
  - EULAR 2025 de polimialgia e vasculite de grandes vasos (PMID 42481270), lida pelo resumo.
  - SBR 2023 de esclerose sistêmica (PMID 38987832), lida no texto integral. A crise renal é tratada por opinião de especialistas.
- **Cap. 86, ABORL/SBO 2026 de surdez súbita:** PMID 42981831, texto integral lido.
  - O texto dá prednisolona 1 mg/kg/dia, até 60 mg/dia. O resumo da mesma diretriz pede dose individualizada, sem teto universal. A nota mostra as duas formas.
  - A AAO-HNS 2020 de epistaxe ficou fora: é fechada e o resumo não traz recomendação.
- **Cap. 85, AHA 2021 de oclusão da artéria central da retina:** PMID 33677974, declaração científica, lida pelo resumo.
  - É anterior ao manual, mas o manual não trata do tema.
  - A AAO 2026 de fechamento angular não tem resumo, e o site pediu verificação de navegador; ficou fora.
- **Manual:** conferido no PDF. Cap. 87, p. 1178; cap. 92, p. 1245; cap. 75, p. 994 e 1001; cap. 85, p. 1129.

## O que mudou na Central

- **Notas:**
  - `nota-hcfmusp-cap87-covid`: 4 itens;
  - `nota-hcfmusp-cap92-chikungunya`: 4 itens;
  - `nota-hcfmusp-cap75-reumatologicas`: 2 itens;
  - `nota-hcfmusp-cap86-otorrino`: 4 itens;
  - `nota-hcfmusp-cap85-oftalmologia`: 1 item.
- **Migration:** `20270414000049`.

## Onde a fonte difere do manual

| Tema | Fonte nova | Manual |
|---|---|---|
| Antiviral na COVID | nirmatrelvir com ritonavir primeiro, até 5 dias do início; remdesivir e molnupiravir conforme o risco | estudos ainda não publicados, sem aprovação no Brasil na época |
| AINE na chikungunya | OMS 2025: não usar na fase aguda (forte contra) | AINE se o paracetamol não resolver, depois de excluir dengue |
| Arterite de células gigantes | corticoide sem esperar a confirmação; 40–60 mg de prednisona | só na classificação |
| Crise renal esclerodérmica | inibidor da ECA já; somar outros se a pressão não voltar em 48–72 h | captopril 6,25 mg 8/8 h; evitar betabloqueador |
| Surdez súbita | corticoide inicial; audiometria em 14 dias; sem TC de rotina | não trata |
| Oclusão da artéria central da retina | forma de AVC; alteplase pode ser eficaz | só como complicação |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| antiviral na COVID com fator de risco | "não existe medicação liberada" (manual de 2022) | IDSA 2025: nirmatrelvir com ritonavir primeiro |
| AINE na chikungunya | manual do MS (evitar na fase aguda) | OMS 2025 (forte contra) com o manual do HC ao lado |
| corticoide antes da biópsia na arterite | "não encontrei" | EULAR 2025: começar sem esperar |
| crise renal esclerodérmica | "não encontrei" | SBR 2023: inibidor da ECA já |
| corticoide na surdez súbita | "não encontrei" | ABORL/SBO 2026, com as duas formas de dose |
| TC na surdez súbita | "não encontrei" | ABORL/SBO 2026: não de rotina |
| oclusão da artéria central da retina | "não encontrei" | AHA 2021 |

## Pendente

Os cap. 35 (BTS 2023 de aspiração) e 107 (CCS/CHRS 2026 de marca-passo) dependem de o RT passar a verificação de navegador no Chrome. Sem isso, a BTS fica sem resumo e a CCS/CHRS só tem um resumo genérico.

## Homologação

- A migration foi aplicada, e as cinco notas estão aguardando aprovação.
- As notas foram ingeridas, e a API foi reiniciada.
- Os testes da nota passam, e o typecheck está limpo.
