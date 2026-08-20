# VIDaaS PSC — Observações da prova de conceito (Fase 3.0)

> Status: **AGUARDANDO credenciais + manual oficial** — nada foi executado ainda.
> Este arquivo é preenchido com o que REALMENTE acontecer ao rodar
> `spikes/vidaas/vidaas-poc.ts` contra a homologação da Valid.

---

## Pendências para executar (bloqueantes)

| # | Item | Estado |
|---|---|---|
| 1 | **Manual de integração VIDaaS PSC** em `docs/vidaas/` | ❌ pasta vazia — o repositório não tem o manual |
| 2 | **Credenciais de homologação** no `.env.local` (`VIDAAS_CLIENT_ID`, `VIDAAS_CLIENT_SECRET`, `VIDAAS_REDIRECT_URI`, `VIDAAS_BASE_URL`) | ❌ só existe `VITE_SUPABASE_URL` |
| 3 | **PDF de exemplo** em `spikes/vidaas/assinatura-exemplo.pdf` | ⏳ usar `--pdf` ou colocar o arquivo |

> Regra da fase: **nada de mock** — sem credencial válida, o script para com o erro exato.

---

## Endpoints observados (preencher após execução)

| Etapa | Endpoint (base + caminho) | Método | Payload |
|---|---|---|---|
| Autorização | `{BASE_URL} + ???` | GET | `response_type=code&client_id&redirect_uri&code_challenge&code_challenge_method=S256&scope=signature_session&lifetime` |
| Token | `{BASE_URL} + ???` | POST | `grant_type=authorization_code&code&redirect_uri&client_id&client_secret&code_verifier` |
| Assinatura | `{BASE_URL} + ???` | POST | `{ hash, hash_algorithm }` + `Authorization: Bearer` |

> ⚠️ Os caminhos acima são **suposições padrão OAuth** do script (`/oauth/authorize`, `/oauth/token`, `/signature`) — **NÃO foram confirmados** sem o manual. Se divergirem, corrigir apenas em `spikes/vidaas/vidaas-poc.ts` e anotar aqui.

---

## Formato da resposta de assinatura (preencher após execução)

- Campos observados:
- A assinatura devolvida é sobre o hash?:
- Encoding (base64 / hex / DER / PKCS#7?):

## Expirações observadas (preencher após execução)

- QR Code / sessão: `lifetime` pedido = ___ min; expirou em ___?
- Access token: `expires_in` = ___ s

## Erros observados (preencher após execução)

| Situação | HTTP | Corpo/estrutura |
|---|---|---|
| (ex.: code inválido) | | |
| (ex.: token expirado) | | |
| (ex.: hash malformado) | | |

---

## Divergências manual × comportamento observado

| # | Manual diz | Observado | Impacto |
|---|---|---|---|
| | | | |

## Perguntas para a Valid (pendências de decisão)

- [ ] Endpoints exatos de autorização/token/assinatura (o manual não está no repo)
- [ ] `signature_session`: o `lifetime` é em minutos? Aplicado no QR ou no token?
- [ ] Campo exato da solicitação de assinatura (o hash vai como `hash`? `digest`? outro?)
- [ ] Formato de retorno da assinatura (e se o servidor assina o hash informado ou re-hash do PDF)
