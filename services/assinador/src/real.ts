// Peças reais do assinador (LG7): Supabase com o JWT do médico (a RLS decide o
// que ele vê), banco pelo papel assinador_app (só as funções do assinador) e a
// folha em PDF pelo Chromium.
import postgres from 'postgres'
import { chromium, type Browser } from 'playwright-core'

import type { Dependencias, Documento, Medico } from './fluxo.ts'
import { ErroAssinador } from './fluxo.ts'
import { comNovaTentativa, comPrazo, PRAZO_FOLHA_MS, PRAZO_SUPABASE_MS, STATUS_TRANSITORIOS } from './prazo.ts'
import { comRodape, htmlDoRodape } from './rodape.ts'

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

// o que o médico lê quando o Supabase não responde dentro do prazo (o servidor devolve 504)
export const SUPABASE_SEM_RESPOSTA = 'O sistema demorou a responder. Tente de novo em instantes.'
export const CONFERENCIA_SEM_RESPOSTA = 'Conferência indisponível no momento. Tente de novo em instantes.'

/** `o` só para os testes: prazo e espera curtos */
export function supabaseDoMedico(url: string, chavePublica: string, f: Fetch = fetch, o: { prazoMs?: number; esperaMs?: number } = {}) {
  const prazo = o.prazoMs ?? PRAZO_SUPABASE_MS
  const cab = (jwt: string, extra: Record<string, string> = {}) => ({ apikey: chavePublica, Authorization: `Bearer ${jwt}`, ...extra })
  /** chama com prazo e lê a resposta dentro dele; só consulta (GET) tenta de novo em falha passageira */
  async function pedir<T>(jwt: string, caminho: string, ler: (r: Response) => Promise<T>, init: RequestInit = {}, ms = prazo): Promise<T> {
    const uma = () => comPrazo(ms, SUPABASE_SEM_RESPOSTA, async (signal) => {
      const r = await f(`${url}${caminho}`, { ...init, headers: { ...cab(jwt), ...(init.headers as Record<string, string> | undefined) }, signal })
      if (r.status === 401 || r.status === 403) throw new ErroAssinador(401, 'Sessão inválida. Entre de novo no sistema.')
      if (!r.ok) throw new ErroAssinador(502, `Supabase: HTTP ${r.status} em ${caminho.split('?')[0]}`, STATUS_TRANSITORIOS.has(r.status))
      return ler(r)
    })
    return (init.method ?? 'GET') === 'GET' ? comNovaTentativa(uma, { esperaMs: o.esperaMs }) : uma()
  }
  /** chamada anônima (conferência pública): POST de leitura, com prazo e sem nova tentativa */
  const anonima = <T>(rpc: string, corpo: unknown, ler: (r: Response) => Promise<T>) =>
    comPrazo(prazo, CONFERENCIA_SEM_RESPOSTA, async (signal) => {
      const r = await f(`${url}/rest/v1/rpc/${rpc}`, { method: 'POST', headers: { apikey: chavePublica, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal })
      if (!r.ok) throw new ErroAssinador(502, 'Conferência indisponível')
      return ler(r)
    })
  return {
    async quemE(jwt: string): Promise<Medico> {
      const u: { id?: string } = await pedir(jwt, '/auth/v1/user', (r) => r.json())
      if (!u.id) throw new ErroAssinador(401, 'Sessão inválida')
      const sel = 'id,nome_completo,cpf,conselho,registro_numero,registro_uf,crm,uf_crm'
      const [p]: Array<Record<string, string | null>> = await pedir(jwt, `/rest/v1/perfis?id=eq.${encodeURIComponent(u.id)}&select=${sel}`, (r) => r.json())
      if (!p) throw new ErroAssinador(403, 'Perfil não encontrado')
      const cpf = (p.cpf ?? '').replace(/\D/g, '')
      return {
        perfilId: String(p.id), nome: String(p.nome_completo ?? ''),
        cpf: cpf.length === 11 ? cpf : null,
        crmNumero: String(p.registro_numero ?? p.crm ?? ''), crmUf: String(p.registro_uf ?? p.uf_crm ?? ''),
      }
    },
    async fimDoPlantao(jwt: string): Promise<Date | null> {
      const linhas: Array<{ fim: string }> = await pedir(jwt, '/rest/v1/rpc/meu_plantao_agora', (r) => r.json(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const fins = linhas.map((l) => new Date(l.fim).getTime()).filter((n) => Number.isFinite(n))
      return fins.length ? new Date(Math.max(...fins)) : null
    },
    async documento(jwt: string, id: string): Promise<Documento | null> {
      const sel = 'id,tipo_documento,numero,estado,autor_id,assinado_em,unidade_id,paciente_id,unidades(nome)'
      const [d]: Array<Record<string, unknown>> = await pedir(jwt, `/rest/v1/documentos_clinicos?id=eq.${encodeURIComponent(id)}&select=${sel}`, (r) => r.json())
      if (!d) return null
      return {
        id: String(d.id), tipo: String(d.tipo_documento), numero: (d.numero as string | null) ?? null, estado: String(d.estado),
        autorId: String(d.autor_id), assinadoEm: (d.assinado_em as string | null) ?? null,
        unidadeId: String(d.unidade_id), pacienteId: String(d.paciente_id),
        unidadeNome: String((d.unidades as { nome?: string } | null)?.nome ?? ''),
      }
    },
    /** HTML da folha montado no servidor pela Edge `folha` (registra a impressão, como hoje: sem nova tentativa) */
    async folhaHtml(jwt: string, documentoId: string): Promise<string> {
      return pedir(jwt, '/functions/v1/folha', (r) => r.text(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documento_id: documentoId }) }, o.prazoMs ?? PRAZO_FOLHA_MS)
    },
    /** chamadas anônimas da conferência pública (QR code) */
    async conferir(codigo: string): Promise<{ encontrada: boolean } & Record<string, unknown>> {
      return anonima('conferir_assinatura', { p_codigo: codigo }, (r) => r.json())
    },
    async pdfAssinado(codigo: string): Promise<Uint8Array | null> {
      const v: string | null = await anonima('pdf_assinado', { p_codigo: codigo }, (r) => r.json())
      if (!v) return null
      return Buffer.from(v.replace(/^\\x/, ''), 'hex') // bytea vem como \x… em hexadecimal
    },
  }
}

export function bancoDoAssinador(pgUrl: string): Dependencias['banco'] & { fechar(): Promise<void> } {
  const sql = postgres(pgUrl, { max: 3, idle_timeout: 30, connect_timeout: 10, prepare: false })
  return {
    async abrirSessao(v) {
      const [r] = await sql`select private.abrir_sessao_assinatura(${v.perfilId}::uuid, ${v.provedor}, ${v.serial}, ${v.emissor}, ${v.cpfFinal},
        ${v.certValidoAte}::timestamptz, ${v.validaAte}::timestamptz) as id`
      return String(r.id)
    },
    async encerrarSessao(sessaoId, motivo) {
      await sql`select private.encerrar_sessao_assinatura(${sessaoId}::uuid, ${motivo})`
    },
    async registrarComPdf(v) {
      const [r] = await sql`select private.registrar_assinatura_com_pdf(${v.documentoId}::uuid, ${v.sessaoId}::uuid,
        ${Buffer.from(v.pdf)}::bytea, ${v.codigoSha256}) as id`
      return String(r.id)
    },
    fechar: () => sql.end({ timeout: 5 }),
  }
}

/** Chromium sem tela (instalado no contêiner) que transforma a folha em PDF A4. */
export function renderizador(caminhoChromium: string) {
  let navegador: Promise<Browser> | null = null
  const abrir = () => (navegador ??= chromium.launch({ executablePath: caminhoChromium, args: ['--no-sandbox', '--disable-dev-shm-usage'] }))
  return {
    async pdf(html: string, conferencia: { codigo: string; url: string }): Promise<Uint8Array> {
      const b = await abrir()
      const ctx = await b.newContext({ javaScriptEnabled: false, offline: true })
      try {
        const p = await ctx.newPage()
        await p.setContent(comRodape(html, await htmlDoRodape(conferencia.url, conferencia.codigo)), { waitUntil: 'load' })
        return await p.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
      } finally {
        await ctx.close()
      }
    },
    async fechar() {
      if (navegador) await (await navegador).close()
    },
  }
}
