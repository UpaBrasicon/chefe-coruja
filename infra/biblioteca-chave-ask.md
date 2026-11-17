# Biblioteca: chave própria do `/v1/ask` (LG6, I5)

Decisão do RT de 17/11/2026, I5 = A (`docs/regulatorio/LG6-IA-DADO-SAUDE-DIAGNOSTICO.md`).

## O que cobre

- **Só a Edge chama o modelo.** O `/v1/ask` é o único caminho da biblioteca que chama o modelo de linguagem. Agora ele só aceita `BIBLIOTECA_ASK_KEY`, que só a Edge `clinical-search` tem. Toda pergunta ao modelo passa, então, pela liberação da Edge (`liberar.ts`: regex, nomes da unidade e NER).
- **As outras rotas não mudam.** `/v1/search`, `/v1/deid` e `/health` seguem com `BIBLIOTECA_API_KEY`, a chave que o Nous e o gateway do Hermes usam.
- **Código.** A regra está em `biblioteca/app/chaves.py` (teste em `test_chaves.py`). A Edge escolhe a chave pelo modo, em `supabase/functions/clinical-search/index.ts`.

## O que não cobre

- **Chave vazada da Edge.** Quem tiver a `BIBLIOTECA_ASK_KEY` ainda chama o `/v1/ask`. A biblioteca pseudonimiza de novo com NER estrito, como antes.
- **Gateway do Hermes.** O Hermes não usa a biblioteca para chamar o modelo; ele chama o provedor pelo próprio gateway.

## Chaves

- **`BIBLIOTECA_ASK_KEY`:** gerada com `openssl rand -hex 32`, sem impressão.
  - Homologação: no `/srv/biblioteca/app-homolog/.env` e no segredo `BIBLIOTECA_ASK_KEY` do Supabase `kswurfyxxvfydpjfrivy`.
  - Produção: no `/srv/biblioteca/app/.env` e no segredo do Supabase `saqjrjtrkzkswsxxvdxn`.
- **Sem a variável:** na biblioteca e na Edge, vale a chave única, como antes. É o estado de transição.

## Como ligar (cada ambiente)

1. Publicar a biblioteca com o `chaves.py`:
   - homologação: `npm run biblioteca:homolog`;
   - produção: `npm run biblioteca:sync -- --confirmo-producao`, a partir do master.
2. Publicar a Edge `clinical-search` com a escolha de chave por modo.
3. Gerar a chave e pô-la, no mesmo minuto, no `.env` da biblioteca e no segredo do Supabase. Recriar o contêiner da API. Entre um passo e outro, o "Perguntar" pode dar 401 por alguns segundos.
4. Conferir no VPS, imprimindo só o status:
   - `/v1/ask` com a chave geral → 401;
   - `/v1/ask` com a chave do ask → diferente de 401;
   - `/v1/search` com a chave geral → 200.

## Como reverter

- Tirar `BIBLIOTECA_ASK_KEY` do `.env` da biblioteca e recriar o contêiner. A chave geral volta a abrir o `/v1/ask`.
- O segredo da Edge pode ficar: sem a variável na biblioteca, a chave do ask é recusada. Por isso, apague o segredo da Edge junto com a variável, ou antes.
