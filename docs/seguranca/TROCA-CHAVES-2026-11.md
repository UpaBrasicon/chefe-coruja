# Troca das chaves expostas no backup sem cifra (plano, 17/11/2026)

**Origem:** até 20/10/2026, o backup diário do VPS foi ao Backblaze B2 (EUA) sem cifra. É a entrada 1 de `docs/regulatorio/juridico/LG5-REGISTRO-INCIDENTES.md`.

**Onde está hoje:**
- os arquivos já saíram do B2;
- o backup sobe cifrado desde 17/11;
- não há sinal de acesso indevido (bucket privado).

Mesmo assim, toda chave que estava nesses arquivos é tratada como exposta. O RT pediu o plano em 17/11/2026 ("Sim, planeje") e aprovou "Todas A, ok fase 1".

**Regras deste plano:**
- **Nenhum valor de chave aparece** em tela, log, chat ou git. As chaves novas são geradas no VPS (`openssl rand -hex 32`) e gravadas direto no arquivo.
- **Cada troca tem conferência e volta.** Os arquivos `.env` antigos ficam com cópia `.bak-troca-2026-11` (permissão 600) até a conferência.
- **O que vale para a produção** só roda com o "ok produção" do RT.

## O que estava exposto

**Critério:** o que existia antes de 20/10/2026. Os nomes vêm dos arquivos do backup; os valores não foram lidos. O que nasceu depois de 20/10 não estava nos arquivos expostos, mas as chaves internas entram mesmo assim, porque trocá-las custa pouco.

| # | Chave | Onde fica | Quem usa | Antes de 20/10? | Como trocar |
|---|---|---|---|---|---|
| 1 | `SKILL_API_TOKEN` / `HERMES_SKILL_TOKEN` | `.env.prod`; `.env` dos agentes | hermes-app ↔ plugin do Nous | sim | gerar no VPS e pôr nos dois lados |
| 2 | `IA_GATEWAY_TOKEN` e `IA_GATEWAY_TOKEN_<AGENTE>` | `.env.prod`; `config.yaml` e `.ambiente` dos agentes | gateway de IA do Hermes | sim | gerar no VPS e pôr nos dois lados |
| 3 | `API_SERVER_KEY` | `.env` de cada agente | API do Nous (só `127.0.0.1`) | sim | gerar no VPS |
| 4 | Senhas de `hermes_app_user` e `hermes_app_job` (`HERMES_PG_*_URL`) | `.env.prod`, `.agent.extra.env`, `.ambiente` | Hermes e agentes → banco da **produção** | criadas em 22/10; entram por precaução | `ALTER ROLE … PASSWORD` na produção e troca da URL |
| 5 | `BIBLIOTECA_API_KEY` (a chave da Edge) | `/srv/biblioteca/app/.env`; segredo da Edge no Supabase da produção | Edge `clinical-search` → biblioteca | sim | gerar no VPS; **o RT cola no painel do Supabase** |
| 6 | Tokens dos bots do Telegram (Corujinha, clínica, gestora, suporte, lab) | `.hermes/.env`, `.hermes-*/.ambiente`, `~/.agente-*.token` | agentes do Nous | sim | **o RT revoga no @BotFather** (`/revoke`) e cola o token novo no VPS |
| 7 | Chave do DeepSeek (`LLM_API_KEY`, `DEEPSEEK_API_KEY` e `auth.json` do Nous) | `.env.prod`, biblioteca, `.hermes/auth.json` | IA de hoje | sim | **o RT apaga no painel do DeepSeek** quando o Bedrock entrar (LG6, I1). O `auth.json` sai já, porque o Nous usa o gateway |
| 8 | `META_APP_SECRET` e `META_ACCESS_TOKEN` (WhatsApp) | `.env.prod` | WhatsApp (fora de uso) | sim | **o RT revoga no painel da Meta**; tiramos do `.env` |
| 9 | Chave do cofre e segredo da homologação no envio à RNDS | `/home/rnds/deploy` | `rnds-envio` (homologação e simulador) | não: o serviço é de 28/10 | não precisa |
| 10 | `BIBLIOTECA_INTERNA_KEY` | biblioteca, Hermes, agentes | Hermes e Nous | não: nasceu em 17/11 | não precisa |

## Decisões para o RT

**T1. Alcance**
- **A (recomendada):** trocar as linhas 1 a 8.
- **B:** só as externas (5 a 8).

**T2. Como fazer**
- **A (recomendada):** em fases, cada uma conferida antes da seguinte.
  - **Fase 1, eu faço:** linhas 1 a 4, mais tirar o DeepSeek do `auth.json`.
    - Reinicia o hermes-app e os agentes: cerca de 1 minuto sem a Corujinha.
    - Conferência: o `/health` do Hermes, o gateway respondendo com o token novo e o banco aceitando a senha nova.
  - **Fase 2, Telegram:**
    - você manda `/revoke` no @BotFather, um bot por vez;
    - no terminal da Hostinger, um comando pede o token novo e grava nos lugares certos;
    - eu reinicio o agente.
    - Cada bot fica fora do ar só entre o `/revoke` e o reinício.
  - **Fase 3, chave da Edge:**
    - o VPS gera a chave nova e mostra só no terminal da Hostinger;
    - você cola no painel do Supabase (Edge Functions → Secrets → `BIBLIOTECA_API_KEY`);
    - eu troco na biblioteca no mesmo minuto.
    - O "Perguntar" fica parado alguns segundos.
  - **Fase 4, DeepSeek:** você apaga a chave no painel do DeepSeek no dia em que o Bedrock entrar (I1).
  - **Fase 5, WhatsApp:** você revoga no painel da Meta, e eu tiro do `.env`.
- **B:** tudo numa janela só, à noite.

**T3. Ok produção.** A fase 1 troca a senha de dois papéis no banco da produção (`ALTER ROLE`) e reinicia serviços da produção. A fase 3 troca um segredo da produção. Cada uma pede o seu "ok produção".

## Como reverter

| Troca | Volta |
|---|---|
| Arquivos | `cp -p <arquivo>.bak-troca-2026-11 <arquivo>` e recriar o serviço |
| Senha dos papéis | `ALTER ROLE … PASSWORD` com a senha anterior, que fica guardada na URL do arquivo `.bak` |
| Telegram e DeepSeek | o token antigo deixa de valer depois do `/revoke` ou da exclusão. A volta é gerar outro |

## Evidência ao fim

Cada fase registra o que foi conferido, só com status, sem valor de chave. O registro vai para a entrada 1 do registro de incidentes e para `infra/vps-backup-offbox.md`.

## Execução

### Fase 1, concluída em 17/11/2026 (script `/root/troca-chaves-fase1.sh` no VPS)

**O que foi trocado:**
- `SKILL_API_TOKEN` / `HERMES_SKILL_TOKEN`: 8 lugares.
- `IA_GATEWAY_TOKEN`: 9 lugares, contando o `config.yaml` dos agentes.
- `IA_GATEWAY_TOKEN_LAB`: 3 lugares.
- `API_SERVER_KEY`: 7 lugares nos quatro agentes, mais 1 no lab.
- Credencial do DeepSeek no `auth.json` do Nous: retirada.

**Senhas do Postgres (`hermes_app_user` e `hermes_app_job`):**
- **Primeira tentativa:** `ALTER ROLE CURRENT_USER` pelo próprio papel. A troca no banco funcionou, mas a primeira conexão com a senha nova falhou, porque o pooler guarda a senha por alguns segundos. O script parou antes de gravar a senha nova, e ela se perdeu. A senha antiga já não entrava.
- **Correção:**
  - o VPS gerou senhas novas e entregou só o verificador SCRAM-SHA-256;
  - o verificador foi aplicado na produção (`ALTER ROLE … PASSWORD 'SCRAM-SHA-256$…'`), sem a senha passar pela sessão;
  - o VPS gravou as senhas novas nos arquivos e apagou os temporários.
- **Tempo afetado:** as consultas diretas dos agentes ao banco ficaram alguns minutos sem acesso.

**Recriados:** hermes-app (health ok), Corujinha (pelo `recriar-agente.sh`), clínica, gestora, suporte e lab.

**Conferência (só status):**
- gateway de IA: token novo 200, antigo 401;
- API das skills: token novo passa (400 com pedido vazio), antigo 401;
- senha antiga do `hermes_app_user` recusada; senhas novas aceitas pelo pooler;
- os 4 agentes com o mesmo token das skills, do gateway e da URL do banco que o hermes-app;
- `config.yaml` de cada agente com o token certo;
- os 5 agentes de pé, sem erro no log.

**Volta:** arquivos `*.bak-troca-2026-11`. Atenção: eles têm os valores antigos, que não valem mais.

### Fase 2, concluída em 17/11/2026 (Telegram, com o RT)

O RT revogou os 5 tokens no @BotFather e gravou os novos com `bash /root/trocar-token-telegram.sh <bot>`:

| Comando | Bot |
|---|---|
| `corujinha` | Chefe Coruja, @Chefe_coruja_bot |
| `clinica` | @Coruja_clinica_cc_bot |
| `gestora` | @coruja_gestora_cc_bot |
| `suporte` | @coruja_suporte_cc_bot |
| `lab` | @Coruja_lab_bot |

**Conferência:** nos 5 bots, o `getMe` responde ok com o token novo e recusa o antigo (401). Os agentes estão de pé, sem erro de autenticação; na Clínica apareceu uma única queda de rede, passageira.

### Fase 3: chave da Edge (precisa de "ok produção")

`bash /root/trocar-chave-edge.sh` no terminal do VPS:
1. mostra a chave nova só na tela do RT;
2. o RT cola em Supabase → Edge Functions → Secrets → `BIBLIOTECA_API_KEY`;
3. com Enter, a biblioteca da produção é recriada com a chave nova.

**Conferência:** o `/v1/ask` responde 401 com a chave antiga e não dá 401 com a nova, e o "Perguntar" do app volta a responder. A volta fica no arquivo `/srv/biblioteca/app/.env.bak-troca-2026-11-edge`.
