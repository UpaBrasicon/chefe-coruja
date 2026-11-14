# Revisão do HCFMUSP, lote 4, O2: cap. 59, encefalopatia hepática

O RT decidiu O1 a O4 = A em 14/11/2026. Ele liberou a produção do resto do lote 4 desde que cada capítulo passe antes pela homologação e pelo CI verde.

## Fonte

- **Diretriz:** Bajaj JS, Jakab SS, Jesudian AB, et al. ACG Clinical Guideline: Hepatic Encephalopathy. Am J Gastroenterol 2026;121(3):588–618 (PMID 41773757).
- **Leitura:** li o texto integral no site da revista, pelo Chrome do RT. A diretriz usa GRADE e traz 24 recomendações, mais conceitos-chave sem grau.
- **O que ficou de fora:**
  - EASL 2022 (PMID 35724930): é anterior à ACG 2026 e não foi lida;
  - as recomendações 1 a 3, sobre testes da encefalopatia mínima no ambulatório, não servem ao pronto-socorro.
- **Manual:** o lado do manual vem da ficha da Central, já conferida no PDF (cap. 59, p. 799–806).

## O que mudou na Central

- **Ficha `adulto-encefalopatia-hepatites-graves` 2026-11-14.1:** antes só tinha o manual.
  - Fonte `ACG_EH_2026`.
  - `DIRETRIZ_EH`: 15 temas.
  - `DIFERENCAS_EH`: 6 frases.
  - A tela ganha a tabela ao lado do manual.
- **Doses:** as doses e contas do manual não mudam.
- **Nota `nota-hcfmusp-cap59-encefalopatia`:** 15 itens.
- **Migration:** `20270414000020`.

## Diferenças principais

| Tema | ACG 2026 | Manual de 2022 |
|---|---|---|
| Lactulose na crise | 15–30 mL a cada 2 h até 2 evacuações pastosas, depois 2 a 4 vezes ao dia | 20–40 mL de 8/8 a 4/4 h (p. 805–806) |
| Meta de evacuações | 2–3 pastosas por dia | 2 a 4 (p. 805–806) |
| Sem resposta | outra causa depois de 48–72 h; não cita neomicina nem metronidazol | neomicina depois de 48 h sem resposta (p. 805) |
| Rifaximina | soma na crise (condicional) e na recorrência (forte) | não disponível no Brasil, segundo o manual (p. 805–806) |
| Polietilenoglicol 4 L | alternativa à lactulose | não traz |
| Enema | 300 mL em 700 mL, 30–60 min, a cada 4–6 h | 200–300 mL em 700–800 mL, pelo menos 30 min (Tabela 4, p. 806) |

## Antes e depois (14/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| lactulose na crise | manual: 20–40 mL de 8/8 a 4/4 h | ACG: 15–30 mL a cada 2 h até 2 evacuações |
| dosar amônia | manual: não é necessária de rotina | ACG: não de rotina; amônia normal no coma põe o diagnóstico em dúvida |
| sem melhora em 48 h | manual: rifaximina ou neomicina | ACG: procurar outra causa, com o manual ao lado |
| rifaximina na crise | manual: só na falha | ACG: somar na crise (condicional) |
| polietilenoglicol | "os trechos não trazem" | ACG: 4 L como alternativa |
| restringir proteína | manual: não | ACG: não restringir (condicional) e meta de 1,2–1,5 g/kg |
| albumina na PBE (mesmo módulo, controle) | manual | AASLD e ADQI-ICA, da nota do #692 |

As seis respostas de encefalopatia passam a abrir pela diretriz. A pergunta de controle segue a nota da PBE, que já estava na produção.

## Homologação

- Migration aplicada.
- 3 arquivos ingeridos e API reiniciada.
- Branch `homolog` publicada depois de `test:clinico` (1.243, sem falha) e typecheck limpos.
- A tela não foi vista com login.
