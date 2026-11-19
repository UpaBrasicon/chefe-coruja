// ─────────────────────────────────────────────────────────────────────────────
// Envio das fichas do LEDI APS ao PEC e-SUS APS do município (percurso da UBS,
// U15, PR 4). Roda no mesmo serviço da RNDS, num ciclo à parte.
//
// Por ficha:
//   1. carga (public.ledi_dados_ficha); "retido: …" fica retido;
//   2. a credencial da API do PEC da unidade (gerada pelo administrador da
//      instalação do PEC, "Transmissão de dados > Credenciais para API");
//      faltando, fica retido;
//   3. o arquivo .esus (src/interop/ledi); "retido: …" fica retido;
//   4. o envio, como no exemplo oficial (laboratoriobridge/esusaps-integracao,
//      ExemploEnvioApi.java): POST /api/recebimento/login com usuario e senha em
//      multipart/form-data, o cookie JSESSIONID, e POST
//      /api/v1/recebimento/ficha com o campo "ficha" (o arquivo <uuid>.esus).
//      201 = aceita.
// Nenhum log leva dado do paciente: só o id da ficha, o tipo e o resultado.
// ─────────────────────────────────────────────────────────────────────────────
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { montarFicha, type CargaFai, type CargaFp, type Instalacao } from '../../../src/interop/ledi/fichas.ts'

export type ItemLedi = { id: string; tipo: 'fai' | 'fp'; unidade_id: string; uuid_ficha: string; tentativas: number }

/** O que public.ledi_dados_ficha devolve. */
export type FichaCarregada = {
  item_id: string
  tipo: 'fai' | 'fp'
  uuid_ficha: string
  unidade_id: string
  carga: CargaFai | CargaFp
  envio: { pec_url: string }
}

export type RegistroLedi = { resultado: 'enviado' | 'retido' | 'reenviar' | 'erro'; resposta?: unknown; erro?: string }

/** A fila do LEDI no banco (as três funções da migration 20270415000023). */
export interface FilaLedi {
  pegarLote(limite: number): Promise<ItemLedi[]>
  dados(item: string): Promise<FichaCarregada>
  registrar(item: string, r: RegistroLedi): Promise<void>
}

export type CredencialPec = { usuario: string; senha: string }
export interface CredenciaisPec {
  obter(unidade: string): Promise<CredencialPec | null>
}

/** <pasta>/<unidade_id>.json com {"usuario": "...", "senha": "..."}. */
export function credenciaisEmPasta(pasta: string): CredenciaisPec {
  return {
    async obter(unidade) {
      if (!/^[0-9a-f-]{36}$/i.test(unidade)) return null
      try {
        const c = JSON.parse(await readFile(join(pasta, `${unidade}.json`), 'utf8')) as Partial<CredencialPec>
        return c.usuario && c.senha ? { usuario: c.usuario, senha: c.senha } : null
      } catch {
        return null
      }
    },
  }
}

export type ResultadoPec = { resultado: RegistroLedi['resultado']; status?: number; erro?: string }

/** Cliente da API de recebimento do PEC. Guarda a sessão (JSESSIONID) por PEC e usuário. */
export class ClientePec {
  private sessoes = new Map<string, string>()
  private readonly f: typeof fetch
  constructor(opcoes: { fetch?: typeof fetch } = {}) {
    this.f = opcoes.fetch ?? fetch
  }

  private async login(url: string, c: CredencialPec): Promise<string | ResultadoPec> {
    const corpo = new FormData()
    corpo.set('usuario', c.usuario)
    corpo.set('senha', c.senha)
    let r: Response
    try {
      r = await this.f(`${url}/api/recebimento/login`, { method: 'POST', body: corpo, redirect: 'manual' })
    } catch (e) {
      return { resultado: 'reenviar', erro: `PEC fora do alcance no login: ${(e as Error).message}` }
    }
    const texto = await r.text().catch(() => '')
    if (r.status >= 500) return { resultado: 'reenviar', status: r.status, erro: `login no PEC: ${r.status}` }
    if (r.status !== 200) {
      // "Usuário ou senha inválidos", "Credencial inativa": o gestor corrige a credencial
      return { resultado: 'retido', status: r.status, erro: `retido: o PEC recusou a credencial da API (${r.status}: ${texto.slice(0, 200)})` }
    }
    const cookie = r.headers.getSetCookie().map((x) => x.split(';')[0]).find((x) => x.startsWith('JSESSIONID='))
    if (!cookie) return { resultado: 'reenviar', status: r.status, erro: 'login no PEC sem o cookie JSESSIONID' }
    return cookie
  }

  async enviar(a: { url: string; credencial: CredencialPec; nome: string; bytes: Uint8Array }): Promise<ResultadoPec> {
    const url = a.url.replace(/\/+$/, '')
    const chave = `${url} ${a.credencial.usuario}`
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      let cookie = this.sessoes.get(chave)
      if (!cookie) {
        const l = await this.login(url, a.credencial)
        if (typeof l !== 'string') return l
        cookie = l
        this.sessoes.set(chave, cookie)
      }
      const corpo = new FormData()
      corpo.set('ficha', new Blob([a.bytes], { type: 'application/octet-stream' }), a.nome)
      let r: Response
      try {
        r = await this.f(`${url}/api/v1/recebimento/ficha`, { method: 'POST', body: corpo, headers: { cookie }, redirect: 'manual' })
      } catch (e) {
        return { resultado: 'reenviar', erro: `PEC fora do alcance: ${(e as Error).message}` }
      }
      const texto = (await r.text().catch(() => '')).slice(0, 1000)
      if (r.status === 201 || r.status === 200) return { resultado: 'enviado', status: r.status }
      // sessão vencida: entra de novo uma vez
      if ((r.status === 401 || r.status === 403 || (r.status >= 300 && r.status < 400)) && tentativa === 0) {
        this.sessoes.delete(chave)
        continue
      }
      if (r.status === 400 || (r.status === 500 && /desserializar/i.test(texto))) {
        return { resultado: 'erro', status: r.status, erro: `o PEC recusou a ficha (${r.status}): ${texto}` }
      }
      return { resultado: 'reenviar', status: r.status, erro: `PEC respondeu ${r.status}: ${texto}` }
    }
    return { resultado: 'reenviar', erro: 'sessão do PEC recusada duas vezes' }
  }
}

export type DependenciasLedi = {
  fila: FilaLedi
  credenciais: CredenciaisPec
  pec: Pick<ClientePec, 'enviar'>
  instalacao: Instalacao
  log?: (linha: Record<string, unknown>) => void
}

export type ResumoLedi = Record<RegistroLedi['resultado'], number>
const RETIDO = /^retido: /

export async function processarLoteLedi(d: DependenciasLedi, limite = 20): Promise<ResumoLedi> {
  const resumo: ResumoLedi = { enviado: 0, retido: 0, reenviar: 0, erro: 0 }
  const log = d.log ?? (() => {})
  for (const item of await d.fila.pegarLote(limite)) {
    const r = await processarFicha(d, item)
    await d.fila.registrar(item.id, r)
    resumo[r.resultado]++
    log({ sisab: item.id, tipo: item.tipo, resultado: r.resultado, ...(r.erro ? { motivo: r.erro.replace(/\d{11,15}/g, '***') } : {}) })
  }
  return resumo
}

async function processarFicha(d: DependenciasLedi, item: ItemLedi): Promise<RegistroLedi> {
  let f: FichaCarregada
  try {
    f = await d.fila.dados(item.id)
  } catch (e) {
    const msg = (e as Error).message
    return RETIDO.test(msg) ? { resultado: 'retido', erro: msg } : { resultado: 'erro', erro: `carga: ${msg}` }
  }
  const credencial = await d.credenciais.obter(item.unidade_id)
  if (!credencial) return { resultado: 'retido', erro: 'retido: unidade sem a credencial da API do PEC no serviço de envio' }
  let arquivo
  try {
    arquivo = montarFicha(f.tipo, f.uuid_ficha, f.carga, d.instalacao)
  } catch (e) {
    const msg = (e as Error).message
    return RETIDO.test(msg) ? { resultado: 'retido', erro: msg } : { resultado: 'erro', erro: `ficha: ${msg}` }
  }
  const r = await d.pec.enviar({ url: f.envio.pec_url, credencial, nome: arquivo.nome, bytes: arquivo.bytes })
  const resposta = { status: r.status ?? null, avisos: arquivo.avisos }
  return r.resultado === 'enviado' ? { resultado: 'enviado', resposta } : { resultado: r.resultado, erro: r.erro, resposta }
}
