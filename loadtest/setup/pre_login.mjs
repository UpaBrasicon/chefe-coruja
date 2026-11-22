// Faz login de cada usuário carga-* UMA vez, espaçando as chamadas para ficar
// abaixo do limite de taxa do Auth por IP (P5), e grava .tokens.json.
// Uso: node setup/pre_login.mjs   (reexecute se os tokens tiverem >10 min)
import { carregarEnv, sleep, lerDados, gravarTokens } from './_lib.mjs'

const env = carregarEnv()
const ESPACO_MS = Number(process.env.LOGIN_ESPACO_MS || 1500) // ajuste conforme P5

const dados = lerDados()
if (!dados.usuarios?.length) throw new Error('dados.json sem usuarios — rode criar_massa.mjs antes.')

const tokens = []
for (const u of dados.usuarios) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: env.LOADTEST_SENHA }),
  })
  if (!res.ok) {
    console.error(`FALHA login ${u.email}: ${res.status} ${await res.text()}`)
    await sleep(ESPACO_MS)
    continue
  }
  const j = await res.json()
  tokens.push({
    papel: u.papel,
    email: u.email,
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: Date.now() + j.expires_in * 1000,
  })
  process.stdout.write('.')
  await sleep(ESPACO_MS)
}
gravarTokens(tokens)
console.log(`\n${tokens.length}/${dados.usuarios.length} tokens gravados em .tokens.json`)
