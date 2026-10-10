# Implantação da API para integradores (Fase 3, tarefa 7)

**Situação em 10/10/2026:**
- Implantada na homologação (`api-homolog.chefecoruja.com.br`) e na produção (`api.chefecoruja.com.br`).
- Teste de ponta a ponta com chave real na homologação: 200, com o IP real registrado.
- Na produção, conferidos o 401 (sem chave e com chave inexistente) e o IP real registrado.

Ordem: homologação primeiro, depois a produção, que pede o "ok produção" do RT.

Quem faz cada passo:
- **Claude:** migration, publicação da Edge Function e telas.
- **RT:** segredos e Cloudflare, porque são da conta dele.

## 1. Banco e Edge Function (Claude)

1. Aplicar a migration `20261104000002_api_integradores.sql` (`homolog:push`; na produção, com o ok).
2. Publicar a função **sem a verificação de JWT do Supabase**, porque o
   integrador usa a chave dele e não um login:
   ```bash
   npx supabase functions deploy api --no-verify-jwt --project-ref <ref>
   ```
   - Homologação: `kswurfyxxvfydpjfrivy`.
   - Produção: `saqjrjtrkzkswsxxvdxn`.

## 2. Segredo da borda (RT)

O segredo prova à função que a requisição passou pelo Cloudflare. Só assim o
IP real do integrador, que o Worker manda em `X-Coruja-IP-Cliente`, vale para
a lista de IPs da chave. O `CF-Connecting-IP` não serve, porque o Supabase
também está atrás do Cloudflare, que reescreve esse cabeçalho com o IP do
Worker.

1. Gere um valor aleatório e guarde-o no cofre de senhas:
   ```bash
   openssl rand -hex 32
   ```
   Use um valor diferente para a homologação e para a produção.
2. Grave o segredo na função:
   ```bash
   npx supabase secrets set API_BORDA_SEGREDO=<valor> --project-ref <ref>
   ```

Sem esse segredo a API funciona, mas a lista de IPs compara o IP que o
Supabase recebe, que é o do Cloudflare. Chave com lista de IPs, então, fica
recusada até o segredo existir.

## 3. Cloudflare (RT)

1. **Worker:**
   - Workers & Pages → Create → Worker.
   - Nome `chefe-coruja-api` (homologação: `chefe-coruja-api-homolog`).
   - Cole o código de `infra/cloudflare/api-worker.js` e publique.
2. **Variáveis do Worker** (Settings → Variables):
   - `ORIGEM` (texto): `https://saqjrjtrkzkswsxxvdxn.supabase.co/functions/v1/api` (homologação: `https://kswurfyxxvfydpjfrivy.supabase.co/functions/v1/api`);
   - `BORDA_SEGREDO` (tipo **Secret**): o mesmo valor do passo 2.
3. **Domínio.** Em 10/10/2026 o "Custom domain" do Worker não achou a zona
   (mesmo estando na mesma conta). O caminho que funcionou foi pelo domínio:
   - Em chefecoruja.com.br → DNS → Records → Add record:
     - tipo `AAAA`;
     - nome `api` (homologação: `api-homolog`);
     - endereço `100::`;
     - **Proxied** (nuvem laranja).
   - Em chefecoruja.com.br → Workers Routes → Add route:
     - `api.chefecoruja.com.br/*` → `chefe-coruja-api`;
     - homologação: `api-homolog.chefecoruja.com.br/*` → `chefe-coruja-api-homolog`.
4. **Regra "Fora do Brasil"** (Security → WAF → Custom rules, regra 2):
   acrescente `"api.chefecoruja.com.br" "api-homolog.chefecoruja.com.br"` à
   lista de hosts. Integrador fora do Brasil precisa de exceção por IP.
5. **Limite por IP na borda.** O plano gratuito tem 1 regra de rate limit, hoje
   sem uso. Em Security → WAF → Rate limiting rules:
   - Expressão:
     ```
     (http.host in {"api.chefecoruja.com.br" "api-homolog.chefecoruja.com.br"})
     ```
   - Contar por IP: 100 requisições em 10 segundos.
   - Ação: Block por 10 segundos.

   O limite fino, de 60 por minuto por chave e ajustável, fica no banco. A
   regra da borda só segura a enxurrada antes de chegar ao Supabase.
6. Atualize `infra/cloudflare.md` (tabela "O que a borda cobre" e a seção do
   rate limit).

## 4. Teste (RT, com uma chave de homologação)

1. Crie a chave em **Integrações (API)**, como super admin, ambiente
   "Homologação". Ela aparece uma única vez.
2. Consulte:
   ```bash
   curl -s https://api-homolog.chefecoruja.com.br/v1/unidades -H "Authorization: Bearer <chave>"
   curl -s "https://api-homolog.chefecoruja.com.br/v1/leitos?unidade_id=<id>" -H "Authorization: Bearer <chave>"
   ```
3. Confira:
   - os cabeçalhos `RateLimit-*` e `X-Request-Id`;
   - o 401 sem chave;
   - o 403 numa unidade fora da chave;
   - a consulta aparecendo em "Ver acessos".
4. Revogue a chave e confira o 401 na consulta seguinte.

## Reverter

- Para desligar a API: apague o Custom Domain do Worker. Os endereços param de
  responder e o resto do sistema não muda.
- Para cortar um integrador: revogue a chave dele. Vale na hora.
