# Revisão do HCFMUSP, lote 6, Q3: cap. 88 (HIV), 95 (febre amarela) e 5 (rebaixamento da consciência)

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 6 inteiro. Pela Q3, os três capítulos ganham só a nota, ligada ao capítulo do manual, porque não há ficha de adulto na Central. Nenhuma ferramenta nova.

## Fontes e limites

- **Cap. 88, DGN 2026** (complicações neurológicas do HIV): Hahn et al., Neurol Res Pract 2026;8 (PMID 42596004; PMC13474671).
  - Texto integral lido.
  - Não gradua as recomendações. Cobre só o sistema nervoso central. As doses seguem a EACS.
  - Dois trechos não foram transcritos como estão:
    - o esquema de dose única de anfotericina traz "fluconazol 1.200 mg quatro vezes ao dia", o que parece erro de redação. Ficou fora.
    - o adjuvante da neurotoxoplasmose aparece como "folic acid". A nota mostra esse texto ao lado do ácido folínico do manual e diz que não são a mesma droga, sem corrigir a fonte.
- **Cap. 88, EACS 2025 (v13.0):** PMID 41088922. O que está aberto no PMC é o resumo das mudanças, sem as tabelas de infecção oportunista (PCP, criptococo, toxoplasmose). Não entrou na nota.
- **Cap. 95, consenso colombiano 2025** de febre amarela grave: Forero-Delgadillo et al., Lancet Reg Health Am 2025;48:101144 (PMID 40585555; PMC12197880).
  - Texto integral lido. O método é Delphi com GRADE, voltado à UTI.
  - O rótulo de força de cada recomendação (forte ou fraca) não veio no texto do PMC, e a página do PMC pediu reCAPTCHA no Chrome. Cada item diz "força não conferida".
- **Cap. 5, EAN 2020** (diagnóstico de coma e distúrbios de consciência): Kondziella et al., Eur J Neurol 2020;27(5):741–756 (PMID 32090418).
  - Lida pelo resumo; o filtro do navegador bloqueou a extração do texto do site.
  - É diretriz de diagnóstico, voltada sobretudo ao distúrbio de consciência prolongado. Por isso a nota tem só 3 itens.
- **Manual:** conferido no PDF. Cap. 88, p. 1197–1201; cap. 95, p. 1273–1274; cap. 5, p. 88.

## O que mudou na Central

- **Notas:**
  - `nota-hcfmusp-cap88-hiv`: 6 itens;
  - `nota-hcfmusp-cap95-febre-amarela`: 8 itens;
  - `nota-hcfmusp-cap5-rebaixamento`: 3 itens.
- **Migration:** `20270414000040`.

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| neurotoxoplasmose: tratamento | manual | DGN 2026 com o manual ao lado; adjuvantes dos dois mostrados e rotulados |
| TB meníngea: quando começar a TARV | "não encontrei" | DGN 2026: depois de pelo menos 2 semanas |
| IRIS: conduta | "sem conduta específica" | DGN 2026: manter a TARV; corticoide controverso |
| febre amarela: plasma e plaquetas | "não há recomendação" | consenso 2025: não de rotina; limiares de 30.000 e 50.000/µL |
| febre amarela: antiviral | "o material não traz" | consenso 2025: sem recomendação a favor ou contra |
| febre amarela: volume e vasopressor | Guia de Vigilância | consenso 2025 (evitar sobrecarga; noradrenalina) com o Guia |
| Glasgow ou FOUR | "não há trecho que compare" | EAN 2020: FOUR na fase aguda (sugestão), com o manual ao lado |
| criptococo: indução (controle) | Guia de Vigilância | DGN 2026 com o Guia |

## Homologação

- A migration foi aplicada, e as três notas estão aguardando aprovação.
- As notas foram ingeridas e a API foi reiniciada.
- Os testes da nota passam, e o typecheck está limpo.
