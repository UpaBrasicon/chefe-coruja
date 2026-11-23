// Tokens pré-gerados por setup/pre_login.mjs (login fora do loop do k6, R de
// taxa do Auth respeitada). Cada VU usa tokens[(__VU-1) % n] do seu papel;
// vários VUs compartilhando um usuário é aceitável (seção 6.2).
import { SharedArray } from 'k6/data'

const tokens = new SharedArray('tokens', () => JSON.parse(open('../.tokens.json')))

export function tokensDoPapel(papel) {
  return tokens.filter((t) => t.papel === papel)
}

export function usuarioDoVU(papel, vu) {
  const lista = tokensDoPapel(papel)
  if (lista.length === 0) {
    throw new Error(`Sem tokens para o papel "${papel}". Rode setup/pre_login.mjs.`)
  }
  return lista[(vu - 1) % lista.length] // { papel, access_token, refresh_token, expires_at }
}
