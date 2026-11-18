// Servidor HTTP do assinador (LG7). Rotas:
//   POST /sessao/iniciar   {provedor}       → {url}   (JWT do médico)
//   GET  /retorno?state&code                → página "sessão aberta até HH:MM"
//   POST /assinar          {documento_id}   → {assinatura_id}  (JWT)
//   POST /sessao/encerrar                   → 204      (JWT)
//   GET  /sessao                            → {ativa, provedor, valida_ate}  (JWT)
//   GET  /v?_format=application/validador-iti+json&_secretCode=… → JSON do VALIDAR
//   GET  /v                                 → página de conferência para pessoas
//   GET  /pdf?c=…                           → o PDF assinado (pelo código)
//   GET  /saude                             → 200
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'

import { assinarDocumento, encerrarSessao, ErroAssinador, iniciarSessao, retornoDoProvedor, type Dependencias } from './fluxo.ts'
import { respostaValidar } from './rodape.ts'

export type Publico = {
  conferir(codigo: string): Promise<{ encontrada: boolean } & Record<string, unknown>>
  pdfAssinado(codigo: string): Promise<Uint8Array | null>
}
export type Config = { origens: string[]; base: string; limitePorMinuto?: number }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const pagina = (titulo: string, corpo: string) =>
  `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title>` +
  `<body style="font:16px/1.5 system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#111"><h1 style="font-size:20px">${esc(titulo)}</h1>${corpo}</body></html>`

async function lerJson(req: IncomingMessage, limite = 16 * 1024): Promise<Record<string, unknown>> {
  let tam = 0
  const partes: Buffer[] = []
  for await (const c of req) {
    tam += c.length
    if (tam > limite) throw new ErroAssinador(413, 'Pedido grande demais')
    partes.push(c)
  }
  if (!tam) return {}
  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8'))
  } catch {
    throw new ErroAssinador(400, 'JSON inválido')
  }
}

export function criarServidor(d: Dependencias & { minhaSessao?: (jwt: string) => Promise<unknown> }, publico: Publico, cfg: Config) {
  const contagem = new Map<string, { n: number; desde: number }>()
  const limite = cfg.limitePorMinuto ?? 60
  const excedeu = (ip: string) => {
    const agora = Date.now()
    const c = contagem.get(ip)
    if (!c || agora - c.desde > 60_000) {
      contagem.set(ip, { n: 1, desde: agora })
      return false
    }
    c.n++
    return c.n > limite
  }

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const origem = req.headers.origin ?? ''
    const cors: Record<string, string> = cfg.origens.includes(origem)
      ? { 'Access-Control-Allow-Origin': origem, 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' }
      : {}
    const seguro = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' }
    const json = (s: number, j: unknown) => { res.writeHead(s, { ...cors, ...seguro, 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(j)) }
    const html = (s: number, h: string) => { res.writeHead(s, { ...seguro, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" }); res.end(h) }
    try {
      const url = new URL(req.url ?? '/', cfg.base)
      const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim()
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end() }
      if (url.pathname === '/saude') return json(200, { ok: true })
      if (excedeu(ip)) return json(429, { erro: 'Muitos pedidos. Tente de novo em um minuto.' })
      const jwt = () => {
        const a = req.headers.authorization ?? ''
        if (!a.startsWith('Bearer ')) throw new ErroAssinador(401, 'Sem sessão')
        return a.slice(7)
      }

      if (req.method === 'POST' && url.pathname === '/sessao/iniciar') {
        const corpo = await lerJson(req)
        return json(200, await iniciarSessao(d, jwt(), String(corpo.provedor ?? '')))
      }
      if (req.method === 'GET' && url.pathname === '/retorno') {
        if (url.searchParams.get('error')) return html(400, pagina('Autorização não concluída', '<p>O provedor não autorizou a sessão. Volte ao sistema e tente de novo.</p>'))
        const r = await retornoDoProvedor(d, url.searchParams.get('state') ?? '', url.searchParams.get('code') ?? '')
        const ate = new Date(r.validaAte).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
        return html(200, pagina('Sessão de assinatura aberta', `<p>Os documentos que você emitir serão assinados com o seu certificado até as <b>${esc(ate)}</b>.</p><p>Pode fechar esta janela e voltar ao sistema.</p>`))
      }
      if (req.method === 'POST' && url.pathname === '/assinar') {
        const corpo = await lerJson(req)
        const r = await assinarDocumento(d, jwt(), String(corpo.documento_id ?? ''))
        return json(200, { assinatura_id: r.assinaturaId })
      }
      if (req.method === 'POST' && url.pathname === '/sessao/encerrar') {
        await encerrarSessao(d, jwt())
        res.writeHead(204, cors)
        return res.end()
      }
      if (req.method === 'GET' && url.pathname === '/sessao' && d.minhaSessao) return json(200, await d.minhaSessao(jwt()))

      // ---- conferência pública (QR code e VALIDAR)
      if (req.method === 'GET' && url.pathname === '/v') {
        const codigo = (url.searchParams.get('_secretCode') ?? url.searchParams.get('c') ?? '').toUpperCase().replace(/\s/g, '')
        // o VALIDAR manda o "+" sem codificar, e a URL o lê como espaço
        if ((url.searchParams.get('_format') ?? '').replace(/ /g, '+') === 'application/validador-iti+json') {
          if (!codigo) return json(401, { erro: 'Código obrigatório' })
          const c = await publico.conferir(codigo)
          if (!c.encontrada) return json(401, { erro: 'Código não confere' })
          return json(200, respostaValidar(`${cfg.base}/pdf?c=${encodeURIComponent(codigo)}`))
        }
        if (!codigo) return html(200, pagina('Conferir documento assinado', '<p>Abra <b>validar.iti.gov.br</b>, leia o QR code do documento e informe o código impresso abaixo dele.</p>'))
        const c = await publico.conferir(codigo)
        if (!c.encontrada) return html(404, pagina('Documento não encontrado', '<p>O código não confere com nenhum documento assinado.</p>'))
        return html(200, pagina('Documento assinado com ICP-Brasil', `<p>Documento nº <b>${esc(String(c.numero ?? ''))}</b>, assinado por <b>${esc(String(c.assinado_por ?? ''))}</b> ${esc(String(c.registro ?? ''))} em ${esc(new Date(String(c.assinado_em)).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }))}.</p><p><a href="${esc(`/pdf?c=${encodeURIComponent(codigo)}`)}">Abrir o PDF assinado</a></p>`))
      }
      if (req.method === 'GET' && url.pathname === '/pdf') {
        const codigo = (url.searchParams.get('c') ?? '').toUpperCase()
        const pdf = codigo ? await publico.pdfAssinado(codigo) : null
        if (!pdf) return json(404, { erro: 'Não encontrado' })
        res.writeHead(200, { ...seguro, 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="documento-assinado.pdf"' })
        return res.end(Buffer.from(pdf))
      }
      return json(404, { erro: 'Não encontrado' })
    } catch (e) {
      const status = e instanceof ErroAssinador ? e.status : 500
      const msg = e instanceof ErroAssinador ? e.message : 'Erro interno do assinador'
      if (status >= 500) console.error('[assinador]', e instanceof Error ? e.message : e) // sem corpo nem dado do paciente
      if (req.url?.startsWith('/retorno')) return html(status, pagina('Não foi possível abrir a sessão', `<p>${esc(msg)}</p>`))
      return json(status, { erro: msg })
    }
  })
}
