// Edge Function: api — API para integradores (Fase 3, tarefa 7).
//
// Contrato: docs/api/openapi.yaml. Fica atrás de api.chefecoruja.com.br/v1
// (Cloudflare, passo a passo em docs/api/implantacao.md).
//
// 1. Confere a rota e os parâmetros (contrato.ts).
// 2. Chama public.api_v1 com a chave secreta da plataforma; essa função só é
//    executável por service_role. Ela confere chave, validade, limite, IP e
//    escopo e registra a consulta.
// 3. Devolve JSON ou application/problem+json (RFC 9457), com os cabeçalhos
//    RateLimit-* e X-Request-Id.
//
// Publicar SEM a verificação de JWT do Supabase (o integrador usa a chave
// dele, não um login):
//   npx supabase functions deploy api --no-verify-jwt --project-ref <ref>
// Segredo opcional API_BORDA_SEGREDO: o mesmo que a borda (Cloudflare) manda
// no cabeçalho X-Coruja-Borda, para o IP do X-Coruja-IP-Cliente valer.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { chaveSecreta } from '../_shared/chaves.ts'
import { relatarErro } from '../_shared/sentry.ts'
import { caminhoDaApi, chaveDoCabecalho, interpretar, ipDeOrigem, problema, type CodigoErro } from './contrato.ts'
import { bundlePedidos, caminhoLaudoLab, capacidade, conteudoCanonico, lerDiagnosticReport, lerSpecimen, operationOutcome, paramsPedidos, rotaFhir } from './fhir.ts'

type Limite = { limite: number; restante: number; reinicio: number }
type RespostaBanco = { status: number; corpo?: unknown; codigo?: CodigoErro; detalhe?: string; limite?: Limite }

function responder(status: number, corpo: unknown, requisicao: string, limite?: Limite, problemaJson = false) {
  const h: Record<string, string> = {
    'Content-Type': problemaJson ? 'application/problem+json' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Request-Id': requisicao,
  }
  if (limite) {
    h['RateLimit-Limit'] = String(limite.limite)
    h['RateLimit-Remaining'] = String(limite.restante)
    h['RateLimit-Reset'] = String(limite.reinicio)
    if (status === 429) h['Retry-After'] = String(limite.reinicio)
  }
  return new Response(JSON.stringify(corpo), { status, headers: h })
}

const erro = (status: number, codigo: CodigoErro, detalhe: string | undefined, requisicao: string, limite?: Limite) =>
  responder(status, problema(status, codigo, detalhe, requisicao), requisicao, limite, true)

Deno.serve(async (req) => {
  const requisicao = crypto.randomUUID()
  const url = new URL(req.url)
  // Fase 5C, etapa 1.3: porta FHIR R4 do laboratório (GET e POST)
  if (caminhoDaApi(url.pathname).startsWith('/fhir')) return portaFhir(req, url, requisicao)
  if (req.method !== 'GET') return erro(405, 'requisicao_invalida', 'A API só aceita GET.', requisicao)

  const pedido = interpretar(caminhoDaApi(url.pathname), url.searchParams)
  if ('erro' in pedido) return erro(pedido.erro.status, pedido.erro.codigo, pedido.erro.detalhe, requisicao)

  const chave = chaveDoCabecalho(req.headers.get('Authorization'))
  if (!chave) return erro(401, 'chave_invalida', 'Mande a chave no cabeçalho Authorization: Bearer <chave>.', requisicao)

  const ip = ipDeOrigem((n) => req.headers.get(n), Deno.env.get('API_BORDA_SEGREDO') || undefined)
  try {
    const banco = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta(), { auth: { persistSession: false } })
    const { data, error } = await banco.rpc('api_v1', {
      p_chave: chave, p_ip: ip, p_requisicao: requisicao, p_recurso: pedido.recurso, p_params: pedido.params,
    })
    if (error) throw new Error(error.message)
    const r = data as RespostaBanco
    if (r.status === 200) return responder(200, r.corpo, requisicao, r.limite)
    return erro(r.status, r.codigo ?? 'erro_interno', r.detalhe, requisicao, r.limite)
  } catch (e) {
    relatarErro('api', pedido.recurso, e)
    return erro(500, 'erro_interno', undefined, requisicao)
  }
})

// ── porta FHIR R4 do laboratório (Fase 5C, tarefa 1, etapa 1.3) ──────────────
// O LIS busca os pedidos (GET /fhir/ServiceRequest) e devolve a coleta
// (POST /fhir/Specimen) e o laudo (POST /fhir/DiagnosticReport, com os
// analitos e o PDF). A tradução do FHIR fica em fhir.ts; as regras e o
// registro de cada chamada, em public.api_v1_laboratorio. O PDF sobe para a
// área privada `exames` antes da gravação e sai de lá se ela for recusada.

const CORPO_MAX = 15 * 1024 * 1024

function fhirResponder(status: number, corpo: unknown, requisicao: string, limite?: Limite) {
  const h: Record<string, string> = { 'Content-Type': 'application/fhir+json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Request-Id': requisicao }
  if (limite) {
    h['RateLimit-Limit'] = String(limite.limite)
    h['RateLimit-Remaining'] = String(limite.restante)
    h['RateLimit-Reset'] = String(limite.reinicio)
    if (status === 429) h['Retry-After'] = String(limite.reinicio)
  }
  return new Response(JSON.stringify(corpo), { status, headers: h })
}
const fhirErro = (status: number, detalhe: string, requisicao: string, limite?: Limite) =>
  fhirResponder(status, operationOutcome(status, detalhe, requisicao), requisicao, limite)

async function sha256(dados: Uint8Array | string): Promise<string> {
  const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : dados
  const h = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function portaFhir(req: Request, url: URL, requisicao: string): Promise<Response> {
  const rota = rotaFhir(caminhoDaApi(url.pathname), req.method)
  if ('erro' in rota) return fhirErro(rota.erro.status, rota.erro.detalhe, requisicao)
  const base = `${url.origin}${url.pathname.slice(0, url.pathname.indexOf('/fhir'))}`
  if (rota.acao === 'metadata') return fhirResponder(200, capacidade(base), requisicao)

  const chave = chaveDoCabecalho(req.headers.get('Authorization'))
  if (!chave) return fhirErro(401, 'Mande a chave no cabeçalho Authorization: Bearer <chave>.', requisicao)
  const ip = ipDeOrigem((n) => req.headers.get(n), Deno.env.get('API_BORDA_SEGREDO') || undefined)

  let dados: Record<string, unknown>
  let pdfCaminho: string | null = null
  const banco = createClient(Deno.env.get('SUPABASE_URL')!, chaveSecreta(), { auth: { persistSession: false } })
  try {
    if (rota.acao === 'pedidos') {
      const p = paramsPedidos(url.searchParams)
      if ('erro' in p) return fhirErro(p.erro.status, p.erro.detalhe, requisicao)
      dados = p
    } else {
      if (Number(req.headers.get('content-length') ?? '0') > CORPO_MAX) return fhirErro(413, 'Corpo passa de 15 MB.', requisicao)
      let corpo: unknown
      try { corpo = await req.json() } catch { return fhirErro(400, 'Corpo não é JSON.', requisicao) }
      if (rota.acao === 'coleta') {
        const s = lerSpecimen(corpo)
        if ('erro' in s) return fhirErro(s.erro.status, s.erro.detalhe, requisicao)
        dados = s
      } else {
        const l = lerDiagnosticReport(corpo)
        if ('erro' in l) return fhirErro(l.erro.status, l.erro.detalhe, requisicao)
        let pdfHash: string | null = null
        // o PDF só sobe se a chave vale para este pedido (a gravação confere tudo de novo e registra)
        const pode = l.pdf ? await banco.rpc('api_laboratorio_pode_anexar', { p_chave: chave, p_exame: l.exame_id }) : null
        if (pode?.error) throw new Error(pode.error.message)
        if (l.pdf && pode?.data === true) {
          const bytes = Uint8Array.from(atob(l.pdf.base64), (c) => c.charCodeAt(0))
          if (!(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) return fhirErro(400, 'presentedForm não é um PDF.', requisicao)
          pdfHash = await sha256(bytes)
          pdfCaminho = caminhoLaudoLab(l.exame_id, l.identificador, Date.now())
          const up = await banco.storage.from('exames').upload(pdfCaminho, bytes, { contentType: 'application/pdf', upsert: false })
          if (up.error) throw new Error(up.error.message)
        }
        dados = { exame_id: l.exame_id, status: l.status, identificador: l.identificador, nota: l.nota, itens: l.itens,
                  pdf_caminho: pdfCaminho, pdf_nome: l.pdf?.nome ?? null, conteudo_hash: await sha256(conteudoCanonico(l, pdfHash)) }
      }
    }
    const { data, error } = await banco.rpc('api_v1_laboratorio', { p_chave: chave, p_ip: ip, p_requisicao: requisicao, p_acao: rota.acao, p_dados: dados })
    if (error) throw new Error(error.message)
    const r = data as RespostaBanco
    const corpo = r.corpo as Record<string, unknown> | undefined
    // o laudo recusado ou repetido não fica guardado
    if (pdfCaminho && (r.status !== 200 || corpo?.repetido)) await banco.storage.from('exames').remove([pdfCaminho])
    if (r.status !== 200) return fhirErro(r.status, r.detalhe ?? 'Erro.', requisicao, r.limite)
    if (rota.acao === 'pedidos') {
      return fhirResponder(200, bundlePedidos((corpo?.pedidos as unknown[]) ?? [], base, url.searchParams, (corpo?.proximo_cursor as string) ?? null), requisicao, r.limite)
    }
    const msg = rota.acao === 'coleta' ? `Coleta registrada (situação: ${corpo?.situacao}).`
      : corpo?.repetido ? `Laudo já recebido (versão ${corpo?.versao}); nada mudou.`
      : `Laudo recebido (situação: ${corpo?.situacao}${corpo?.versao ? `, versão ${corpo.versao}` : ''}).`
    return fhirResponder(200, operationOutcome(200, msg, requisicao), requisicao, r.limite)
  } catch (e) {
    if (pdfCaminho) await banco.storage.from('exames').remove([pdfCaminho]).catch(() => undefined)
    console.error(`[api] fhir_${rota.acao}: ${(e as Error).message}`)
    relatarErro('api', `fhir_${rota.acao}`, e)
    return fhirErro(500, 'Erro interno.', requisicao)
  }
}
