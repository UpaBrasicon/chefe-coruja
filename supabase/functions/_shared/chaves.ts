// Chaves do Supabase nas edge functions.
//
// Troca das chaves legadas (30/09/2026, onda 11): o segredo JWT legado vazou e
// vai ser revogado, e com ele param as chaves `anon` e `service_role` que a
// plataforma injeta (SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY). As chaves
// novas (publishable `sb_publishable_…` e secret `sb_secret_…`) ficam nos
// segredos das functions, com os nomes abaixo, cadastrados no painel (Edge
// Functions → Secrets) — nunca no repositório. Enquanto não existirem, vale a
// chave legada, para a troca não derrubar nada no meio do caminho.

/** Chave pública (o que o navegador também usa): acesso com o token de quem chamou. */
export const chavePublica = () => Deno.env.get('CC_PUBLISHABLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!

/** Chave secreta (ignora a RLS): só para conferências internas da function. */
export const chaveSecreta = () => Deno.env.get('CC_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
