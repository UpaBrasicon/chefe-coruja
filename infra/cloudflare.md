# Borda: Cloudflare (Fase 0, tarefa 3)

Diagnóstico, decisões e roteiro da troca de DNS: `produto/docs/fase0/T3-borda.md`. Este arquivo é a referência de operação: o que a borda cobre, as regras como estão no painel e como reverter.

## O que a borda cobre — e o que NÃO cobre

| Caminho | Passa pelo Cloudflare? | Proteção |
|---|---|---|
| `chefecoruja.com.br`, `www` (site, Vercel) | **sim** (proxy) | WAF, regra de país, Turnstile no login |
| `homolog.chefecoruja.com.br` (Vercel Preview) | **sim** (proxy) | idem + proteção de deploy da Vercel |
| `hermes.chefecoruja.com.br` (VPS: só `/health` e `/webhook` são públicos) | **sim** (proxy) | WAF, regra de país, `/webhook` bloqueado |
| `biblioteca.chefecoruja.com.br` (VPS, busca IA) | **não** (DNS só) | fora do proxy por decisão do roteiro; proteção é a do próprio serviço no VPS |
| Registros de e-mail (MX, SPF, DKIM, DMARC) | não (DNS só) | — |
| **Navegador → `*.supabase.co`** (Auth, banco/PostgREST, Storage, Edge Functions) | **NÃO** | CAPTCHA (Turnstile) no Auth, limites de taxa do Supabase Auth, RLS, portão do 2FA antes de toda requisição (tarefa 1), `search_path` fixo (tarefa 5) |

**Limite conhecido:** o Cloudflare não fica na frente do Supabase. Um ataque direto à API do Supabase não passa pelo WAF nem pela regra de país — quem segura é o próprio Supabase (CAPTCHA, limites do Auth, RLS e o portão do 2FA). Não prometer "WAF em tudo" a cliente.

## Configuração

- Nameservers (Registro.br): `elias.ns.cloudflare.com`, `eloise.ns.cloudflare.com`.
- SSL/TLS: **Full (strict)**.
- DNSSEC: ligado pelo Cloudflare, DS cadastrado no Registro.br (sábado, passo 5).
- Turnstile: widget "Chefe Coruja" para `chefecoruja.com.br`, `www.chefecoruja.com.br`, `homolog.chefecoruja.com.br`. Site key no Vercel (`VITE_TURNSTILE_SITE_KEY`); secret só nos painéis do Supabase (Auth → Attack Protection).

## Regras (Security → WAF → Custom rules) — copiar a expressão em "Edit expression"

Plano gratuito: até 5 regras customizadas e 1 de rate limit. Ordem importa (a primeira que casa decide).

**1. Webhook do Hermes fechado** — ação **Block**
```
(http.host eq "hermes.chefecoruja.com.br" and starts_with(http.request.uri.path, "/webhook"))
```
O WhatsApp não está em uso (tarefa 4). Quando voltar: trocar por uma regra que só bloqueia país ≠ BR **exceto** para o `/webhook` (a Meta chama dos EUA) e pôr o rate limit nele; o HMAC já valida a assinatura.

**2. Fora do Brasil** — ação **Block**
```
(http.host in {"chefecoruja.com.br" "www.chefecoruja.com.br" "homolog.chefecoruja.com.br" "hermes.chefecoruja.com.br"} and ip.src.country ne "BR")
```
Efeito colateral: quem viaja ou usa VPN fora do Brasil fica de fora (decisão do responsável, 05/10/2026). Para liberar alguém pontualmente: acrescentar `and not ip.src in {<ip>}`.

**Rate limit:** nenhum por enquanto. O Caddy do Hermes só expõe `/webhook` (fechado pela regra 1) e `/health`; `/v1/chat/completions` não é público (404 na origem, conferido em 06/10/2026). Quando o `/webhook` voltar, a única regra de rate limit do plano gratuito vai para ele:
```
(http.host eq "hermes.chefecoruja.com.br" and starts_with(http.request.uri.path, "/webhook"))
```

**Managed rules:** "Cloudflare Free Managed Ruleset" ligado (Security → WAF → Managed rules).

## Certificado das origens atrás do proxy

Vercel e o Caddy do Hermes renovam o certificado pelo Let's Encrypt. Com o proxy ligado e Full (strict), confira que o desafio chega à origem:
```bash
curl -sI http://www.chefecoruja.com.br/.well-known/acme-challenge/teste
curl -sI http://hermes.chefecoruja.com.br/.well-known/acme-challenge/teste
```
Tem que vir **404 da origem** (Vercel/Caddy), não **301 do Cloudflare**. Se vier 301: Rules → Configuration Rules → quando `starts_with(http.request.uri.path, "/.well-known/acme-challenge/")` → *Automatic HTTPS Rewrites* e *Always Use HTTPS* desligados.

## Como reverter

| Problema | Ação (do mais leve ao mais pesado) |
|---|---|
| Uma regra barrando gente legítima | Security → Events mostra a regra; desligar **só ela** |
| Um subdomínio com problema | DNS → o registro → nuvem **cinza** (DNS only): o tráfego vai direto à origem na hora |
| Tudo com problema | todas as nuvens cinza (o Cloudflare vira só DNS) |
| Sair do Cloudflare | Registro.br → voltar aos servidores DNS do Registro.br e recriar os 9 registros (tabela em `T3-borda.md`) — **desligar o DNSSEC antes**, senão o domínio para de resolver |
