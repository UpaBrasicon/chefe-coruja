// ============================================================================
// Mint dos JWTs de menor privilégio do Hermes (HERMES_USER_KEY / HERMES_JOB_KEY).
// ----------------------------------------------------------------------------
// Gera dois tokens HS256 com a claim `role` = hermes_user e hermes_job. O
// PostgREST do Supabase faz `SET ROLE <role>` a partir do authenticator
// (os GRANTs já existem: migration 20261020000001, linhas 40-41).
//
// PRÉ-REQUISITO: o projeto precisa ainda ter o JWT secret LEGADO (HS256)
// ativo para verificação de tokens. Desativar as *API keys* legadas
// (anon/service_role) NÃO desativa o JWT secret — mas se o projeto migrou
// para "JWT Signing Keys" assimétricas, este caminho não serve (ver
// cutover-hermes-v1.md §Mecanismo, caminho B — Postgres direto).
//
// USO (nunca passe o secret em argumento de linha de comando — fica no
// histórico do shell; use variável de ambiente):
//
//   SUPABASE_JWT_SECRET='<jwt-secret-do-projeto>' node scripts/mint-hermes-jwt.mjs
//
// O secret está em: Dashboard > Project Settings > API > JWT Settings >
// "JWT Secret" (campo legado HS256). Copie para a env, rode, cole a saída no
// .env.prod do Hermes. NÃO commite os tokens nem o secret.
//
// Expiração: 10 anos. Token de serviço, sem usuário. Para revogar antes do
// prazo: rotacionar o JWT secret no dashboard (invalida TODOS os tokens) ou
// usar REVOKE nos papéis no banco.
// ============================================================================
import { createHmac } from 'node:crypto'

const secret = process.env.SUPABASE_JWT_SECRET
if (!secret || secret.length < 20) {
  console.error('ERRO: defina SUPABASE_JWT_SECRET (JWT secret legado HS256 do projeto).')
  console.error("Uso: SUPABASE_JWT_SECRET='...' node scripts/mint-hermes-jwt.mjs")
  process.exit(1)
}

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function mint(role) {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = {
    role,                          // <- PostgREST faz SET ROLE neste valor
    iss: 'supabase',
    iat: now,
    exp: now + 60 * 60 * 24 * 365 * 10, // 10 anos
  }
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sig = b64url(createHmac('sha256', secret).update(data).digest())
  return `${data}.${sig}`
}

const userKey = mint('hermes_user')
const jobKey = mint('hermes_job')

console.log('# Cole no .env.prod do Hermes (NÃO commitar):')
console.log(`HERMES_USER_KEY=${userKey}`)
console.log(`HERMES_JOB_KEY=${jobKey}`)
console.log('')
console.log('# Verifique cada token em jwt.io (ou decode local): claim role correta,')
console.log('# alg HS256, exp ~10 anos. Depois teste pelo checklist §7 do cutover.')
