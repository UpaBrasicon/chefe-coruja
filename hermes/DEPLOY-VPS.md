# DEPLOY-VPS.md — Hermes na Hostinger (Ubuntu 24.04 LTS)

> Guia completo para subir o Hermes em produção. Preparado para ser seguido
> quando a VPS for contratada. Ordem: contratar → provisionar → subir → validar.

---

## 1. Contratar a VPS (Hostinger)

1. Acesse **https://www.hostinger.com.br/servidor-vps** → **VPS KVM 2** (ou superior);
2. Sistema operacional: **Ubuntu 24.04 LTS** (suporte até 2029 — ideal para produção em 2027);
3. Região: **São Paulo (BR)** — menor latência com o Supabase (também em SP);
4. Anote o **IP da VPS** e a senha temporária do root (enviada por e-mail).

> ⚠️ **Antes de pagar**: confirme que o plano KVM 2 tem RAM/CPU suficientes para
> app + Redis + Caddy + (futuro) open-wa com headless Chrome. Se for usar
> open-wa na mesma VPS, considere **KVM 4** (2 vCPU / 8 GB) — Chrome é pesado.

## 2. Provisionar a VPS (1 comando, como root)

```bash
ssh root@IP_DA_VPS
# copie o arquivo deploy/provisionar-vps.sh para a VPS e rode:
chmod +x provisionar-vps.sh
./provisionar-vps.sh
```

O script instala: Docker + compose, UFW (firewall: 22/80/443), fail2ban,
cria o usuário `hermes` (grupo docker) e a pasta `/home/hermes/deploy`.

## 3. Preparar a pasta de deploy

No seu PC (na pasta `hermes/` do repositório):

```bash
# 1) Crie o .env.prod a partir do exemplo (PREENCHE os valores!)
cp deploy/.env.prod.example .env.prod
#    edite: SUPABASE_SERVICE_ROLE_KEY, LLM_API_KEY, META_* (placeholder se
#    ainda for open-wa), HERMES_ORG_TESTE_ID

# 2) Envie para a VPS (como usuário hermes)
scp -r .env.prod docker-compose.prod.yml Dockerfile package.json package-lock.json tsconfig.json src/ deploy/ hermes@IP_DA_VPS:/home/hermes/deploy/
```

> O `.env.prod` **nunca** vai para o git nem para a imagem Docker
> (.dockerignore bloqueia `.env*`). Só trafega por scp.

## 4. Configurar o domínio (recomendado para HTTPS)

1. No painel da Hostinger (ou onde estiver o DNS): crie um registro **A**:
   `hermes.chefecoruja.com.br → IP_DA_VPS` (TTL baixo, 300s);
2. Edite `deploy/Caddyfile` no servidor com seu domínio real (o Caddy emite o
   certificado Let's Encrypt automaticamente no primeiro acesso).

> Sem domínio? Para teste rápido use `http://IP_DA_VPS` e ajuste o Caddyfile
> para `:80` (sem HTTPS) — mas a Meta exigirá HTTPS na migração.

## 5. Subir o Hermes

```bash
ssh hermes@IP_DA_VPS
cd /home/hermes/deploy
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps   # tudo healthy?
curl http://localhost:3000/health                # {"status":"ok",...}
```

Pela internet: `https://hermes.chefecoruja.com.br/health` (ou `http://IP/health`).

## 6. Validar o pipeline (sem canal ainda)

```bash
# webhook handshake fica esperando credenciais; o /health valida o resto:
curl https://hermes.chefecoruja.com.br/health
# esperado: {"status":"ok","redis":"connected","supabase":"connected",...}
```

O Hermes já fica de pé com o webhook pronto — o canal (open-wa ou Meta)
conecta depois sem mudar o pipeline.

## 7. Operação

| Ação | Comando (na VPS) |
|---|---|
| Ver logs | `docker compose -f docker-compose.prod.yml logs -f app` |
| Reiniciar | `docker compose -f docker-compose.prod.yml restart` |
| Atualizar | re-enviar `src/` via scp → `docker compose -f docker-compose.prod.yml up -d --build` |
| Backup | Redis é efêmero (dedup/rate limit); dados reais ficam no Supabase (cloud). Nada local a backupar além do `.env.prod` (guarde cópia segura). |
| Atualizações de segurança | `sudo apt update && sudo apt upgrade -y` (mensal) |

## 8. Segurança aplicada

- **Firewall UFW**: só 22 (SSH), 80, 443;
- **SSH por chave** (recomendado): `ssh-copy-id hermes@IP` + desabilitar senha;
- **fail2ban**: proteção contra força bruta no SSH;
- **Secrets fora da imagem**: `.dockerignore` bloqueia `.env*` no build;
- **service_role só na VPS**: nunca em código, logs ou git;
- **Caddy HTTPS**: certificado automático + renovação.

## Pendências futuras

- **open-wa** (número descartável) ou **Meta oficial** — implementar o adaptador
  de canal (o pipeline do Hermes não muda);
- **Monitoramento** (uptime, alertas de erro) — sugestão para depois da Fase 2;
- **Backup do `.env.prod`** em local seguro (ex.: cofre de senhas).
