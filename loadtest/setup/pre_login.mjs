// Faz login de cada usuário carga-* UMA vez, espaçando as chamadas para ficar
// abaixo do limite de taxa do Auth por IP (P5), e grava .tokens.json.
// Uso: node setup/pre_login.mjs   (reexecute se os tokens tiverem >10 min)
//
// O Auth da homologação tem CAPTCHA (Turnstile), que recusa o login por senha
// feito por script. Decisão do RT em 23/11/2026: a sessão sai do link de acesso
// que a chave de serviço gera (admin/generate_link + verify), sem mexer no
// CAPTCHA. O teste não mede o login; a sessão é a mesma de um login normal.
// LOGIN=senha volta ao login por senha (para um Auth sem CAPTCHA).
import { carregarEnv, sleep, lerDados, gravarTokens } from './_lib.mjs'

const env = carregarEnv()
const ESPACO_MS = Number(process.env.LOGIN_ESPACO_MS || 1500) // ajuste conforme P5

const dados = lerDados()
if (!dados.usuarios?.length) throw new Error('dados.json sem usuarios — rode criar_massa.mjs antes.')

const POR_SENHA = process.env.LOGIN === 'senha'

async function entrar(email) {
  if (POR_SENHA) {
    return fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: env.LOADTEST_SENHA }),
    })
  }
  const link = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
  })
  if (!link.ok) return link
  const { hashed_token } = await link.json()
  return fetch(`${env.SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: hashed_token }),
  })
}

const tokens = []
for (const u of dados.usuarios) {
  const res = await entrar(u.email)
  if (!res.ok) {
    console.error(`FALHA login ${u.email}: ${res.status} ${await res.text()}`)
    await sleep(ESPACO_MS)
    continue
  }
  const j = await res.json()
  // Segundo fator: marca a sessão pelo dispositivo confiável criado pelo
  // criar_massa.mjs (mesma RPC da tela). Sem isso, com exigir_segundo_fator
  // ligado, toda RPC volta 403 SEGUNDO_FATOR.
  if (!u.dispositivo) throw new Error('dados.json sem dispositivo — rode criar_massa.mjs de novo.')
  const v = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/verificar_dispositivo_2fa`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${j.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: u.dispositivo }),
  })
  if (!v.ok || (await v.json()) !== true) {
    console.error(`FALHA segundo fator ${u.email}: ${v.status}`)
    await sleep(ESPACO_MS)
    continue
  }
  tokens.push({
    papel: u.papel,
    email: u.email,
    setor: u.setor ?? null,
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Date.now() + j.expires_in * 1000,
  })
  process.stdout.write('.')
  await sleep(ESPACO_MS)
}
gravarTokens(tokens)
console.log(`\n${tokens.length}/${dados.usuarios.length} tokens gravados em .tokens.json`)
