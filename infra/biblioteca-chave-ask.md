# Biblioteca: só a Edge abre o `/v1/ask` (LG6, I5)

Decisão do RT de 17/11/2026, I5 = A (`docs/regulatorio/LG6-IA-DADO-SAUDE-DIAGNOSTICO.md`).

## O que cobre

- **O `/v1/ask` só abre com a chave da Edge.** Ele é o único caminho da biblioteca que chama o modelo de linguagem, e agora só aceita `BIBLIOTECA_API_KEY`, a chave que a Edge `clinical-search` já tem. Toda pergunta ao modelo passa, então, pela liberação da Edge (`liberar.ts`: regex, nomes da unidade e NER).
- **O Hermes e o Nous usam a chave interna.** Ela fica em `BIBLIOTECA_INTERNA_KEY` na biblioteca e abre `/v1/search`, `/v1/deid` e `/health`, mas não o `/v1/ask`.
- **Código.** A regra está em `biblioteca/app/chaves.py`, com teste em `test_chaves.py`. A Edge não muda.

## O que não cobre

- **Chave vazada da Edge.** Quem tiver a chave da Edge ainda chama o `/v1/ask`. A biblioteca pseudonimiza de novo com NER estrito, como antes.
- **O gateway do Hermes.** Ele chama o provedor de IA pelo próprio gateway, sem passar pela biblioteca.

## Chaves

- **`BIBLIOTECA_API_KEY` (a da Edge):** não muda. Fica no `.env` da biblioteca e no segredo da Edge.
- **`BIBLIOTECA_INTERNA_KEY` (nova):** gerada no VPS com `openssl rand -hex 32` e nunca impressa. Vai:
  - para o `.env` da biblioteca (`/srv/biblioteca/app/.env` na produção, `/srv/biblioteca/app-homolog/.env` na homologação);
  - no lugar de `BIBLIOTECA_API_KEY`, para o `.env.prod` do Hermes e para o ambiente dos agentes do Nous (`.agent.extra.env`).
- **Nada no Supabase.** Não há segredo novo; a Edge segue com a mesma chave.

## Como ligar na produção (com o "ok produção")

1. Publicar a biblioteca com o `chaves.py`: `npm run biblioteca:sync -- --confirmo-producao`, a partir do master.
2. No VPS, gerar a chave interna e acrescentá-la ao `/srv/biblioteca/app/.env`. Recriar a API. Nada muda para quem usa: a chave da Edge ainda abre tudo.
3. Trocar o valor de `BIBLIOTECA_API_KEY` pela chave interna no `.env.prod` do Hermes e no ambiente dos agentes do Nous. Recriar o `hermes-app` e os agentes.
4. Conferir no VPS, imprimindo só o status:
   - `/v1/ask` com a chave interna → 401;
   - `/v1/search` e `/v1/deid` com a chave interna → 200;
   - `/v1/ask` com a chave da Edge → diferente de 401.
   No app, o "Perguntar" responde. No Telegram, a Corujinha responde, o que confirma que o NER segue de pé.

## Como reverter

- No Hermes e no Nous, voltar `BIBLIOTECA_API_KEY` para a chave da Edge. Ela está no `.env` da biblioteca e no backup diário.
- Tirar `BIBLIOTECA_INTERNA_KEY` do `.env` da biblioteca e recriar os contêineres.
