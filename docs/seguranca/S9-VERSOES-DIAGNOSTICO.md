# S9 — versões fixadas (diagnóstico, 16/11/2026)

Trilha de segurança da auditoria Cloudflare, item S9 (P3). Pedido do BACKLOG:
- `supabase-js` com versão exata e `deno.lock` nas funções de borda;
- ações do CI presas por SHA;
- imagens base por digest.

**O risco:** uma dependência que muda sozinha entre um deploy e outro, seja por versão nova com defeito ou por pacote comprometido na origem, entra na produção sem passar por revisão nem pelo CI.

## O que existe hoje

| Onde | Como está | Muda sozinho? |
|---|---|---|
| App, landing, hermes, rnds-envio (npm) | `package.json` com `^`, mas cada um tem `package-lock.json` no git. O CI roda `npm ci`, e a Vercel instala pelo lock. O `supabase-js` está travado no lock em **2.106.2** | **Não.** Só muda quando alguém atualiza o lock, e isso passa por PR e CI |
| Funções de borda (Deno) | 6 funções importam `supabase-js@2`, só com a versão maior. São 3 por `npm:` e 3 por `esm.sh`: `api`, `clinical-search`, `enviar-codigo-2fa`, `folha`, `pedir-demonstracao` e `webhooks`. Não há `deno.lock` | **Sim.** Cada deploy pega o 2.x mais novo do dia, e o `esm.sh` é mais uma origem de terceiro no caminho |
| Ações do CI (`.github/workflows/ci.yml`) | 13 `uses:` por etiqueta (`actions/checkout@v4`, `setup-node@v4`, `setup-python@v5`, `cache@v4`, `supabase/setup-cli@v1`) | **Sim.** A etiqueta `v4` pode ser movida pelo dono da ação. O CI tem acesso aos segredos do repositório |
| Imagens que construímos | `infra/guarda` (`postgres:17-alpine`), `hermes` (`node:22-alpine`), `services/rnds-envio` (`node:24-alpine`), `biblioteca/app` (`python:3.12-slim`) | Recebem patches da série a cada rebuild. A série não muda de versão maior |
| Imagens de terceiros no VPS | `qdrant/qdrant:latest` e `ollama/ollama:latest` (biblioteca); `redis:7-alpine` e `caddy:2-alpine` (hermes); `nousresearch/hermes-agent:v2026.9.24`, já com versão | **`latest` sim:** um `pull` pode trazer versão maior com mudança de formato, como já aconteceu com bancos de vetor |

## Decisões para o RT

**V1. `supabase-js` no app (npm)**
- **A (recomendada):** fica como está. O lock já trava a versão, e o CI e a Vercel instalam por ele. Só registrar no BACKLOG que o lock é a trava.
- **B:** trocar o `^2.106.2` por `2.106.2` exato no `package.json`. Muda pouco na prática, mas atualizar fica mais trabalhoso.

**V2. Funções de borda (Deno)**
- **A (recomendada):**
  - as 6 funções importam a mesma versão exata do app: `npm:@supabase/supabase-js@2.106.2`. O `esm.sh` sai;
  - entra um `deno.lock` em `supabase/functions`, conferido no CI;
  - um teste no CI falha se aparecer import de pacote sem versão exata.
- **B:** só trocar `@2` por `@2.106.2`, sem lock nem teste.

**V3. Ações do CI**
- **A (recomendada):** as 13 `uses:` presas por SHA de commit, com a versão num comentário (`actions/checkout@<sha> # v4.2.2`). Um teste no CI falha se aparecer `uses:` sem SHA.
- **B:** manter as etiquetas. São ações oficiais do GitHub e do Supabase.

**V4. Imagens Docker**
- **A (recomendada):**
  - trocar os `latest` por versão (`qdrant/qdrant` e `ollama/ollama` na versão que roda hoje no VPS);
  - manter as imagens base por série (`node:22-alpine`, `postgres:17-alpine` e as outras).

  Digest em todas exigiria atualizar à mão para receber os patches de segurança do Alpine e do Debian, e não temos ferramenta que faça isso.
- **B:** digest em todas as imagens, com um lembrete mensal para atualizar.

## Fora do escopo

- **Atualização automática de versões** (Dependabot ou Renovate): pode virar item próprio, se o RT quiser.
- **Os `package.json` com `^`** nas outras dependências: o lock já trava todas, como no V1.

## Como reverter

Cada decisão é só código ou configuração, e volta com `git revert` do PR. No V4 (A), voltar a tag `latest` no compose.
