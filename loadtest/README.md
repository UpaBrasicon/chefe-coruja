# loadtest — teste de carga do Chefe Coruja (k6)

Carga **direto no Supabase** (PostgREST/Auth/Realtime), nunca no domínio da Vercel (R1).
O k6 usa só a chave **anon** + JWT de usuário (R2). Comece pela **homologação**.

## Pré-requisitos

Roda no **VPS**, com o k6 e o Node pelo Docker, sem instalar nada no sistema. O passo a passo completo, as chaves e a reversão estão em `infra/teste-carga.md`.

1. `cp .env.example .env` e preencher com as chaves da **homologação**. O `.env` fica fora do git.
2. Os scripts e o k6 recusam qualquer URL que não seja a da homologação (`kswurfyxxvfydpjfrivy`). Produção exige `LOADTEST_PRODUCAO=confirmo` e ok do RT.
3. Dependência dos scripts Node: `npm install --no-save @supabase/supabase-js` (dentro de `loadtest/`).

## Preparar a massa (uma vez)

```bash
node setup/criar_massa.mjs     # cria usuários carga-*; grava dados.json
node setup/pre_login.mjs       # gera .tokens.json (repetir se os tokens tiverem mais de 50 min)
```
> ⚠️ `criar_massa.mjs` tem a parte de **usuários pronta**; a criação de unidade/setores/
> pacientes/escala está como **TODO** (depende do schema — ver DESCOBERTA.md). Smoke só
> roda com o domínio preenchido.

## Rodar (um comando cada)

```bash
# Smoke (obrigatório primeiro; só leitura, tem que dar 0 erro)
k6 run -e SUPABASE_URL=$SUPABASE_URL -e SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY testes/smoke.js

# Carga média (liga escrita com -e ESCRITA=1 só depois de conferir os payloads)
K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=resultados/carga_$(date +%Y%m%d_%H%M).html \
  k6 run -e SUPABASE_URL=$SUPABASE_URL -e SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
  --summary-export=resultados/carga.json testes/carga.js
```

Trocar o alvo de usuários: `-e ALVO=200`. Ligar escrita: `-e ESCRITA=1`.

### 🛑 Testes que pedem OK do Ricardo antes de rodar
`stress.js`, `pico_troca_plantao.js`, `ruptura.js` — e, em produção, qualquer um.
Entre stress/pico/ruptura, 10 min de pausa para o banco estabilizar.

## Limpeza

```bash
node setup/limpar_massa.mjs            # dry-run (só conta)
node setup/limpar_massa.mjs --apply    # 🛑 só após OK; imutáveis ficam, org vira ativo=false
```

## Nunca versionar
`.env`, `.tokens.json`, `dados.json`, `resultados/` (já no .gitignore).
