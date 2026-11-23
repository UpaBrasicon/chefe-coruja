// Camada fina sobre o PostgREST do Supabase. Toda requisição leva as tags
// `name` (ex.: rpc:painel_observacao) e `tipo` (leitura|escrita) para os
// thresholds separarem leitura de escrita. Todo check valida status 2xx —
// um 401/403 por RLS conta como falha (seção 6.1).
import http from 'k6/http'
import { check } from 'k6'
import { URL, ANON } from './config.js'

function headers(token) {
  return {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
}

export function rpc(token, nome, args, { tipo = 'leitura' } = {}) {
  const res = http.post(`${URL}/rest/v1/rpc/${nome}`, JSON.stringify(args || {}), {
    headers: headers(token),
    tags: { name: `rpc:${nome}`, tipo },
  })
  check(res, { [`rpc:${nome} 2xx`]: (r) => r.status >= 200 && r.status < 300 })
  return res
}

// caminho = tabela?select=...&filtro=... (PostgREST)
export function select(token, caminho, { tipo = 'leitura', name } = {}) {
  const rotulo = name || `get:${caminho.split('?')[0]}`
  const res = http.get(`${URL}/rest/v1/${caminho}`, {
    headers: headers(token),
    tags: { name: rotulo, tipo },
  })
  check(res, { [`${rotulo} 2xx`]: (r) => r.status >= 200 && r.status < 300 })
  return res
}
