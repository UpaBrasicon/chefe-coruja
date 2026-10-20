// Porta FHIR R4 para o laboratório (Fase 5C, tarefa 1, etapa 1.3; decisões do
// RT de 19/10/2026) e para a imagem (tarefa 2, etapa 2.2; decisões de
// 20/10/2026). Regras puras, sem Deno nem rede, para testar no Node
// (fhir.test.ts): rota → ação, leitura do Specimen (coleta), do ImagingStudy
// (exame de imagem feito e link do visualizador) e do DiagnosticReport
// (situação, analitos e laudo em PDF), montagem do Bundle de pedidos e do
// OperationOutcome de erro. As regras de negócio ficam no banco
// (public.api_v1_fhir); o contrato está em docs/api/openapi.yaml.
//
// O sistema guarda o resultado como o laboratório mandou: o valor vai em
// texto, a faixa e a marca (interpretation) também; crítico é só a marca de
// crítico do próprio laboratório (HH, LL ou AA, da tabela HL7 v3
// ObservationInterpretation).

export type AcaoFhir = 'pedidos' | 'coleta' | 'estudo' | 'laudo' | 'metadata'
type Recusa = { erro: { status: number; detalhe: string } }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const PDF_MAX_BYTES = 10 * 1024 * 1024
const CRITICOS = ['HH', 'LL', 'AA']
const STATUS_ESTUDO = ['registered', 'available', 'cancelled']
const STATUS_LAUDO = ['registered', 'partial', 'preliminary', 'final', 'amended', 'corrected', 'appended', 'cancelled']

const recusa = (status: number, detalhe: string): Recusa => ({ erro: { status, detalhe } })

/** /fhir/<recurso> + método → ação da porta do laboratório e da imagem. */
export function rotaFhir(caminho: string, metodo: string): { acao: AcaoFhir } | Recusa {
  const seg = caminho.split('/').filter(Boolean)
  if (seg[0] !== 'fhir' || seg.length !== 2) return recusa(404, 'Recurso FHIR inexistente.')
  const r = seg[1]
  if (r === 'metadata') return metodo === 'GET' ? { acao: 'metadata' } : recusa(405, 'Use GET em metadata.')
  if (r === 'ServiceRequest') return metodo === 'GET' ? { acao: 'pedidos' } : recusa(405, 'ServiceRequest: só GET (busca dos pedidos).')
  if (r === 'Specimen') return metodo === 'POST' ? { acao: 'coleta' } : recusa(405, 'Specimen: só POST (coleta).')
  if (r === 'ImagingStudy') return metodo === 'POST' ? { acao: 'estudo' } : recusa(405, 'ImagingStudy: só POST (exame feito).')
  if (r === 'DiagnosticReport') return metodo === 'POST' ? { acao: 'laudo' } : recusa(405, 'DiagnosticReport: só POST (laudo).')
  return recusa(404, 'Recurso FHIR inexistente.')
}

/** Parâmetros da busca de pedidos: unidade_id, authored=ge<data>, _count (1 a 100) e cursor. */
export function paramsPedidos(q: URLSearchParams): Record<string, string | number> | Recusa {
  const p: Record<string, string | number> = {}
  const u = q.get('unidade_id')
  if (u) { if (!UUID.test(u)) return recusa(400, 'unidade_id não é um UUID.'); p.unidade_id = u }
  const a = q.get('authored')
  if (a) {
    const m = /^ge(\d{4}-\d{2}-\d{2}(T.+)?)$/.exec(a)
    if (!m || Number.isNaN(Date.parse(m[1]))) return recusa(400, 'authored no formato ge<data ISO 8601> (ex.: ge2026-10-19T00:00:00-03:00).')
    p.desde = m[1]
  }
  const c = q.get('_count')
  if (c) { const n = Number(c); if (!Number.isInteger(n) || n < 1 || n > 100) return recusa(400, '_count vai de 1 a 100.'); p.limite = n }
  const cur = q.get('cursor')
  if (cur) p.cursor = cur
  return p
}

const idDoPedido = (ref: unknown): string | null => {
  const m = typeof ref === 'string' ? /^ServiceRequest\/([0-9a-f-]{36})$/i.exec(ref) : null
  return m && UUID.test(m[1]) ? m[1] : null
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null)
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)

/** Specimen da coleta → { exame_id, coletado_em }. */
export function lerSpecimen(corpo: unknown): { exame_id: string; coletado_em: string | null } | Recusa {
  const s = obj(corpo)
  if (!s || s.resourceType !== 'Specimen') return recusa(400, 'Mande um recurso Specimen.')
  const exame = idDoPedido(obj(lista(s.request)[0])?.reference)
  if (!exame) return recusa(400, 'Specimen.request[0].reference deve ser ServiceRequest/<id do pedido>.')
  const quando = texto(obj(s.collection)?.collectedDateTime)
  if (quando && (Number.isNaN(Date.parse(quando)) || !/\d{4}-\d{2}-\d{2}T/.test(quando))) {
    return recusa(400, 'collection.collectedDateTime em ISO 8601 com hora.')
  }
  return { exame_id: exame, coletado_em: quando }
}

export type Estudo = { exame_id: string; status: string; iniciado_em: string | null; link: string | null; identificador: string | null }

/**
 * ImagingStudy do RIS → exame de imagem feito. O link do visualizador do PACS
 * vem num Endpoint contido (endpoint[0] → #id, address); o banco confere se é
 * https de um domínio cadastrado pela unidade.
 */
export function lerImagingStudy(corpo: unknown): Estudo | Recusa {
  const s = obj(corpo)
  if (!s || s.resourceType !== 'ImagingStudy') return recusa(400, 'Mande um recurso ImagingStudy.')
  const exame = idDoPedido(obj(lista(s.basedOn)[0])?.reference)
  if (!exame) return recusa(400, 'ImagingStudy.basedOn[0].reference deve ser ServiceRequest/<id do pedido>.')
  const status = texto(s.status)
  if (!status || !STATUS_ESTUDO.includes(status)) return recusa(400, `status do ImagingStudy: ${STATUS_ESTUDO.join(', ')}.`)
  const quando = texto(s.started)
  if (quando && (Number.isNaN(Date.parse(quando)) || !/\d{4}-\d{2}-\d{2}T/.test(quando))) return recusa(400, 'started em ISO 8601 com hora.')
  let link: string | null = null
  const ref = texto(obj(lista(s.endpoint)[0])?.reference)
  if (ref) {
    const ep = ref.startsWith('#') ? lista(s.contained).map(obj).find((c) => c?.resourceType === 'Endpoint' && c.id === ref.slice(1)) : undefined
    if (!ep) return recusa(400, 'endpoint[] deve apontar para um Endpoint contido (#id).')
    link = texto(ep.address)
    if (!link || link.length > 2000) return recusa(400, 'Endpoint.address com o link do visualizador (até 2000 letras).')
  }
  return { exame_id: exame, status, iniciado_em: quando, link, identificador: texto(obj(lista(s.identifier)[0])?.value) }
}

export type ItemLaudo = {
  analito: string; loinc: string | null; valor: string | null; unidade: string | null
  referencia: string | null; marca: string | null; critico: boolean
}
export type Laudo = {
  exame_id: string; status: string; identificador: string | null; nota: string | null; itens: ItemLaudo[]
  pdf: { base64: string; nome: string } | null
}

function valorDaObservacao(o: Obj): { valor: string | null; unidade: string | null } {
  const q = obj(o.valueQuantity)
  if (q && (typeof q.value === 'number' || typeof q.value === 'string')) {
    return { valor: `${texto(q.comparator) ?? ''}${String(q.value)}`, unidade: texto(q.unit) ?? texto(q.code) }
  }
  if (typeof o.valueString === 'string') return { valor: o.valueString, unidade: null }
  const cc = obj(o.valueCodeableConcept)
  if (cc) return { valor: texto(cc.text) ?? texto(obj(lista(cc.coding)[0])?.display), unidade: null }
  if (typeof o.valueBoolean === 'boolean') return { valor: o.valueBoolean ? 'positivo' : 'negativo', unidade: null }
  if (typeof o.valueInteger === 'number') return { valor: String(o.valueInteger), unidade: null }
  return { valor: null, unidade: null }
}

function faixa(o: Obj): string | null {
  const r = obj(lista(o.referenceRange)[0])
  if (!r) return null
  if (texto(r.text)) return texto(r.text)
  const lo = obj(r.low), hi = obj(r.high)
  const u = texto(lo?.unit) ?? texto(hi?.unit)
  const a = lo?.value !== undefined ? String(lo.value) : null, b = hi?.value !== undefined ? String(hi.value) : null
  if (a && b) return `${a} a ${b}${u ? ` ${u}` : ''}`
  if (a) return `≥ ${a}${u ? ` ${u}` : ''}`
  if (b) return `≤ ${b}${u ? ` ${u}` : ''}`
  return null
}

/** DiagnosticReport → laudo. Os analitos vêm em Observation contidas, referidas em result[]. */
export function lerDiagnosticReport(corpo: unknown): Laudo | Recusa {
  const d = obj(corpo)
  if (!d || d.resourceType !== 'DiagnosticReport') return recusa(400, 'Mande um recurso DiagnosticReport.')
  const exame = idDoPedido(obj(lista(d.basedOn)[0])?.reference)
  if (!exame) return recusa(400, 'DiagnosticReport.basedOn[0].reference deve ser ServiceRequest/<id do pedido>.')
  const status = texto(d.status)
  if (!status || !STATUS_LAUDO.includes(status)) return recusa(400, `status do DiagnosticReport: ${STATUS_LAUDO.join(', ')}.`)
  const contidos = new Map<string, Obj>()
  for (const c of lista(d.contained)) { const o = obj(c); if (o?.resourceType === 'Observation' && typeof o.id === 'string') contidos.set(o.id, o) }
  const itens: ItemLaudo[] = []
  for (const r of lista(d.result)) {
    const ref = texto(obj(r)?.reference)
    const o = ref?.startsWith('#') ? contidos.get(ref.slice(1)) : undefined
    if (!o) return recusa(400, 'result[] deve apontar para Observation contidas (#id).')
    const code = obj(o.code)
    const codings = lista(code?.coding).map(obj).filter(Boolean) as Obj[]
    const analito = texto(code?.text) ?? texto(codings[0]?.display) ?? texto(codings[0]?.code)
    if (!analito) return recusa(400, 'Observation sem nome do analito (code.text).')
    const v = valorDaObservacao(o)
    const marca = texto(obj(lista(obj(lista(o.interpretation)[0])?.coding)[0])?.code)
    itens.push({
      analito, loinc: texto(codings.find((c) => c.system === 'http://loinc.org')?.code), valor: v.valor, unidade: v.unidade,
      referencia: faixa(o), marca, critico: !!marca && CRITICOS.includes(marca.toUpperCase()),
    })
  }
  const forma = lista(d.presentedForm).map(obj).find((f) => f?.contentType === 'application/pdf' && typeof f.data === 'string')
  let pdf: Laudo['pdf'] = null
  if (forma) {
    const b64 = (forma.data as string).replace(/\s/g, '')
    if (!/^[A-Za-z0-9+/]+=*$/.test(b64)) return recusa(400, 'presentedForm.data não é base64.')
    if (Math.floor((b64.length * 3) / 4) > PDF_MAX_BYTES) return recusa(413, 'O laudo em PDF passa de 10 MB.')
    pdf = { base64: b64, nome: texto(forma.title) ?? 'laudo.pdf' }
  } else if (lista(d.presentedForm).length > 0) {
    return recusa(400, 'presentedForm aceita só application/pdf em base64 (data).')
  }
  const identificador = texto(obj(lista(d.identifier)[0])?.value)
  if (['final', 'amended', 'corrected', 'appended'].includes(status) && itens.length === 0 && !pdf && !texto(d.conclusion)) {
    return recusa(400, 'Laudo final sem analitos, sem conclusão e sem PDF.')
  }
  return { exame_id: exame, status, identificador, nota: texto(d.conclusion), itens, pdf }
}

/** Texto estável do conteúdo do laudo, para reconhecer o reenvio (o hash é feito fora). */
export function conteudoCanonico(l: Laudo, pdfHash: string | null): string {
  return JSON.stringify({ nota: l.nota, itens: l.itens, pdf: pdfHash })
}

/** Nome seguro do arquivo do laudo na pasta do pedido. */
export function caminhoLaudoLab(exameId: string, identificador: string | null, agora: number): string {
  const id = (identificador ?? 'sem-id').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 60)
  return `${exameId}/lab-${id}-${agora}.pdf`
}

/** Bundle searchset dos pedidos, com o link para a próxima página. */
export function bundlePedidos(pedidos: unknown[], base: string, query: URLSearchParams, proximo: string | null) {
  const self = `${base}/fhir/ServiceRequest${query.toString() ? `?${query}` : ''}`
  const link: { relation: string; url: string }[] = [{ relation: 'self', url: self }]
  if (proximo) { const q = new URLSearchParams(query); q.set('cursor', proximo); link.push({ relation: 'next', url: `${base}/fhir/ServiceRequest?${q}` }) }
  return {
    resourceType: 'Bundle', type: 'searchset', link,
    entry: pedidos.map((r) => ({ fullUrl: `${base}/fhir/ServiceRequest/${(r as Obj).id}`, resource: r, search: { mode: 'match' } })),
  }
}

const CODIGO: Record<number, string> = { 400: 'invalid', 401: 'login', 403: 'forbidden', 404: 'not-found', 405: 'not-supported',
  409: 'conflict', 413: 'too-costly', 422: 'processing', 429: 'throttled', 500: 'exception', 503: 'transient' }

export function operationOutcome(status: number, detalhe: string, requisicao: string) {
  return {
    resourceType: 'OperationOutcome',
    issue: [{ severity: status < 400 ? 'information' : 'error', code: status < 400 ? 'informational' : (CODIGO[status] ?? 'exception'), diagnostics: detalhe }],
    meta: { tag: [{ system: 'https://api.chefecoruja.com.br/fhir/requisicao', code: requisicao }] },
  }
}

/** O que a porta oferece (GET /fhir/metadata, sem chave). */
export function capacidade(base: string) {
  return {
    resourceType: 'CapabilityStatement', status: 'active', date: '2026-10-20', kind: 'instance', fhirVersion: '4.0.1',
    format: ['application/fhir+json'], implementation: { description: 'Chefe Coruja — porta do laboratório (LIS) e da imagem (RIS/PACS)', url: `${base}/fhir` },
    rest: [{
      mode: 'server',
      security: { description: 'Authorization: Bearer <chave da unidade com o recurso laboratorio e/ou imagem>' },
      resource: [
        { type: 'ServiceRequest', interaction: [{ code: 'search-type' }],
          searchParam: [{ name: 'unidade_id', type: 'token' }, { name: 'authored', type: 'date' }, { name: '_count', type: 'number' }] },
        { type: 'Specimen', interaction: [{ code: 'create' }] },
        { type: 'ImagingStudy', interaction: [{ code: 'create' }] },
        { type: 'DiagnosticReport', interaction: [{ code: 'create' }] },
      ],
    }],
  }
}
