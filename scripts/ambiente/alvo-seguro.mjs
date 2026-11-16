// Trava de alvo dos scripts que gravam com chave de serviço, DATABASE_URL ou
// chave da API (S10, decisão H4 do RT; BACKLOG.md, regra 3: "nada direto em
// produção"). O script recusa endereço da produção, a menos que quem roda
// passe --confirmo-producao na linha de comando.
//
// A produção é reconhecida pelo ref do projeto Supabase (aparece na URL da API,
// no host direto db.<ref>.supabase.co e no usuário do pooler postgres.<ref>) e
// pelo domínio da API pública.
//
// Uso (ESM):  import { exigirAlvoSeguro } from '../ambiente/alvo-seguro.mjs'
//             exigirAlvoSeguro([process.env.SUPABASE_URL], { nome: 'meu-script' })
// Uso (CJS):  const { exigirAlvoSeguro } = require('../ambiente/alvo-seguro.mjs')
import { PROJETOS } from './supabase-alvo.mjs'

export const FLAG_PRODUCAO = '--confirmo-producao'
export const REF_PRODUCAO = PROJETOS.producao
/** Hosts da produção que não carregam o ref (API pública atrás do Cloudflare). */
export const HOSTS_PRODUCAO = ['api.chefecoruja.com.br']

/** O endereço (URL da API, connection string) aponta para a produção? Puro, para teste. */
export function ehProducao(endereco) {
  if (!endereco) return false
  const texto = String(endereco).toLowerCase()
  if (texto.includes(REF_PRODUCAO)) return true
  let host = ''
  try {
    host = new URL(texto).hostname
  } catch {
    return false
  }
  return HOSTS_PRODUCAO.includes(host)
}

/** Decide se o script pode seguir. Puro, para teste. */
export function conferirAlvoSeguro({ enderecos, argv = [], nome = 'este script' }) {
  const naProducao = enderecos.some((e) => ehProducao(e))
  if (!naProducao) return { ok: true, producao: false }
  if (argv.includes(FLAG_PRODUCAO)) return { ok: true, producao: true }
  return {
    ok: false,
    producao: true,
    motivo:
      `${nome} aponta para a PRODUÇÃO (${REF_PRODUCAO}). O alvo padrão é a homologação. ` +
      `Para gravar na produção, com a mudança já validada na homologação e o ok do RT, rode de novo com ${FLAG_PRODUCAO}.`,
  }
}

/** Para o processo (código 1) quando o alvo é a produção sem a flag. */
export function exigirAlvoSeguro(enderecos, { nome, argv = process.argv } = {}) {
  const r = conferirAlvoSeguro({ enderecos, argv, nome })
  if (!r.ok) {
    console.error(`RECUSADO: ${r.motivo}`)
    process.exit(1)
  }
  if (r.producao) console.warn(`ATENÇÃO: ${nome ?? 'o script'} vai gravar na PRODUÇÃO (${FLAG_PRODUCAO}).`)
  return r
}
