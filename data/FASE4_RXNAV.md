# FASE 4 — Interações medicamentosas (offline)

> Status: **BLOQUEADA por infraestrutura** — ver seção "Bloqueio".

## Decisão de arquitetura

A plataforma roda em UPA com internet instável. **Não** se usa serviço externo de
interações em runtime. A estratégia é camadas:

| Camada | Fonte | Quando usar |
|---|---|---|
| 1 | RxNav-in-a-Box **local** (Docker, `localhost:4000`) | runtime (offline total) |
| 2 | Cache local `data/cache/rxnav/interactions/<rxcui>.json` | reuso offline |
| 3 | RxNorm REST remoto | **apenas** para pré-carregar o cache quando há internet |

## Descoberta crítica (2026-08-17)

- **A API pública de interação do RxNorm está descontinuada.** Testado:
  - `GET /REST/interaction/interaction.json?rxcui=7052` → **404**
  - `GET /REST/interaction/list.json?rxcuis=7052+161` → **404**
- A página oficial de funções da RxNorm API **não lista mais** nenhuma função de
  `interaction`. A interação medicamentosa passou a estar disponível **somente**
  via RxNav-in-a-Box local (dados completos, fora da API pública).

## Bloqueio atual

| Requisito | Situação |
|---|---|
| Licença UMLS (download RxNav-in-a-Box) | Não aceita — download retorna 0 bytes |
| Docker Desktop | **Não instalado** na máquina |
| RAM dedicada (12 GB) | A confirmar |
| Disco (100 GB) | A confirmar |
| Java 17 | ✅ Instalado (Temurin 17.0.20) |

**Consequência:** a Fase 4 não pode ser concluída nesta máquina agora. Fica
documentada para provisionamento.

## Instalação (quando houver Docker + licença UMLS)

```powershell
# 1. Aceitar licença UMLS em https://uts.nlm.nih.gov/license.html
# 2. Baixar o zip (exige aceite de licença)
Invoke-WebRequest -Uri "https://download.nlm.nih.gov/umls/kss/rxnav/rxnav-in-a-box/rxnav-in-a-box-20260803.zip" -OutFile rxnav-in-a-box.zip

# 3. Extrair e subir (Requisitos: Docker Desktop, 12GB RAM, 100GB disco)
Expand-Archive rxnav-in-a-box.zip -DestinationPath rxnav-in-a-box
cd rxnav-in-a-box/rxnav-in-a-box-20260803
docker-compose up   # aguardar "MariaDB init process done"

# 4. Usar em http://localhost:4000
```

## Script de integração (pronto)

`scripts/etl/10_interacoes_rxnav.cjs`

```powershell
node scripts/etl/10_interacoes_rxnav.cjs 7052 161
```

- Detecta RxNav local (`localhost:4000`).
- Usa cache local quando existe.
- Se não há nem local nem cache: retorna "sem rede e sem cache local".
- Quando o RxNav-in-a-Box for instalado, o mesmo script passa a funcionar 100% offline.

## Alternativa de dados (não implementada — avaliação)

Se a licença UMLS/Docker não for viável, as opções restantes para interações
oficiais são **fontes licenciadas** (Trissel's/Drug Interaction Facts), que
exigem contrato comercial — fora do escopo "código aberto e offline" definido
no projeto.

## Dependências documentadas

- RxNav-in-a-Box release: `20260803` (zip a baixar; exige licença UMLS)
- README oficial: https://data.lhncbc.nlm.nih.gov/public/rxnav/rxnav-in-a-box/README.txt
