// Utilidades dos scripts Node de setup/limpeza. Rodam NA MÁQUINA DO RICARDO.
// Leem loadtest/.env (service_role fica SÓ aqui, nunca no k6 — R2).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
export const RAIZ = path.resolve(AQUI, '..')

export function carregarEnv() {
  const arq = path.join(RAIZ, '.env')
  if (fs.existsSync(arq)) {
    for (const linha of fs.readFileSync(arq, 'utf8').split('\n')) {
      const m = linha.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
      if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, '')
    }
  }
  const req = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'LOADTEST_SENHA']
  const faltam = req.filter((k) => !process.env[k])
  if (faltam.length) throw new Error(`Faltam no loadtest/.env: ${faltam.join(', ')}`)
  conferirAlvo(process.env.SUPABASE_URL, process.env.LOADTEST_PRODUCAO)
  return process.env
}

// Trava de alvo: só a homologação. Produção exige LOADTEST_PRODUCAO=confirmo (e ok do RT).
export const HOMOLOG_REF = 'kswurfyxxvfydpjfrivy'
export function conferirAlvo(url, producao) {
  if (String(url).includes(`${HOMOLOG_REF}.supabase.co`)) return
  if (producao === 'confirmo') return
  throw new Error(`Alvo recusado: ${url} não é a homologação (${HOMOLOG_REF}). Ver infra/teste-carga.md.`)
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export const ORG_LOADTEST = '10ad7e57-0000-4000-8000-000000000001'

export function lerDados() {
  return JSON.parse(fs.readFileSync(path.join(RAIZ, 'dados.json'), 'utf8'))
}
export function gravarDados(obj) {
  fs.writeFileSync(path.join(RAIZ, 'dados.json'), JSON.stringify(obj, null, 2))
}
export function gravarTokens(lista) {
  fs.writeFileSync(path.join(RAIZ, '.tokens.json'), JSON.stringify(lista, null, 2))
}
