// GERADO por scripts/copiar-folhas.mjs a partir de src/lib/folhas.ts — não edite aqui.
// ─────────────────────────────────────────────────────────────────────────────
// Folhas A4 do Chefe Coruja — FONTE ÚNICA (Fase 4.2 + onda 6 do porte).
//
// O servidor (edge function `folha`) monta a folha a partir do que está
// gravado no banco; o aparelho só usa este módulo para a FOLHA PROVISÓRIA
// (sem conexão) e quando a função não responde (mesmo registro do banco).
// Os dois precisam desenhar a mesma folha, então este arquivo não importa
// nada: é TypeScript puro, lido também pelo Deno. `npm run folhas:copiar`
// copia para supabase/functions/_shared/folhas.ts (um teste confere).
//
// Gramática (produto/docs/design-system-prototipo.md §3.21, builders do
// protótipo): HTML/CSS A4 puro, sem imagem de fundo; Arial 9,5 pt;
// `@page` com "Página X de Y"; cabeçalho da unidade e do paciente em
// `thead` e rodapé em `tfoot` (repetem em cada página); faixa de alergia;
// marca "RASCUNHO – NÃO ASSINADO" quando o documento não foi emitido; vias
// (atestado em meia A4 com 2 vias; receita de controle especial em 2 vias
// com identificação do comprador). O rodapé leva número, protocolo da
// impressão, código de conferência e autor (autor = usuário do login que
// emitiu; no relatório, quem imprime). Sinais vitais saem CRUS, sem marca de
// alterado/crítico (regra clínica do produto).
//
// Campos: cada folha lê os campos que o app grava hoje E os do protótipo;
// campo que não vem não aparece (ou sai em branco para preencher à mão,
// quando é campo de formulário oficial — AIH, encaminhamento).
// ─────────────────────────────────────────────────────────────────────────────

/** Documentos (tabela documentos_clinicos) que têm folha. */
export type TipoFolha =
  | 'atestado' | 'receita' | 'encaminhamento' | 'pedido_exames' | 'prescricao' | 'laudo_aih'
  | 'termo_consentimento' | 'admissao_anamnese' | 'sumario_alta' | 'sumario_obito' | 'parecer'
  | 'evolucao' | 'evolucao_enfermagem' | 'anotacao_enfermagem' | 'evolucao_fisioterapia'
  | 'evolucao_nutricao' | 'evolucao_outros' | 'boletim_emergencia' | 'teleinterconsulta'

export const TIPOS_FOLHA: TipoFolha[] = [
  'atestado', 'receita', 'encaminhamento', 'pedido_exames', 'prescricao', 'laudo_aih',
  'termo_consentimento', 'admissao_anamnese', 'sumario_alta', 'sumario_obito', 'parecer',
  'evolucao', 'evolucao_enfermagem', 'anotacao_enfermagem', 'evolucao_fisioterapia',
  'evolucao_nutricao', 'evolucao_outros', 'boletim_emergencia', 'teleinterconsulta',
]

/** Relatórios de várias linhas (RPC folha_relatorio), não documentos. */
export type TipoRelatorio = 'classificacao' | 'evolucao' | 'alergias' | 'avaliacao' | 'pareceres' | 'encaminhamento_interno' | 'notificaveis'

export const TIPOS_RELATORIO: TipoRelatorio[] = ['classificacao', 'evolucao', 'alergias', 'avaliacao', 'pareceres', 'encaminhamento_interno', 'notificaveis']

export const TIPO_RECEITUARIO: { value: 'branca' | 'verde' | 'azul' | 'amarela'; label: string; cor: string }[] = [
  { value: 'branca', label: 'Branca (comum)', cor: '#ffffff' },
  { value: 'verde', label: 'Verde (antibióticos — B1)', cor: '#dcfce7' },
  { value: 'azul', label: 'Azul (controle especial — B2)', cor: '#dbeafe' },
  { value: 'amarela', label: 'Amarela (entorpecentes/psicotrópicos — A)', cor: '#fef3c7' },
]

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

// ── contexto da folha (vem do banco; na provisória, só o que o aparelho tem) ──

export type UnidadeFolha = { nome?: string | null; cnes?: string | null; municipio?: string | null; uf?: string | null }
export type PacienteFolha = {
  nome?: string | null; nascimento?: string | null; sexo?: string | null; prontuario?: string | null; cns?: string | null
  cpf?: string | null; mae?: string | null; telefone?: string | null; endereco?: string | null; municipio?: string | null
  uf?: string | null; raca_cor?: string | null; responsavel?: string | null; responsavel_telefone?: string | null
  setor?: string | null; leito?: string | null
}
export type AlergiasFolha = {
  estado: 'tem' | 'nega' | 'desconhece' | 'nao_registrada'
  itens: { substancia: string; gravidade?: string | null; reacao?: string | null }[]
}
export type ProfissionalFolha = { nome?: string | null; registro?: string | null }
export type EmissaoFolha =
  | { modo: 'emitido'; numero: string; versao: number; protocolo: string; em: string; codigo: string }
  | { modo: 'rascunho'; protocolo?: string | null; em?: string | null }
  | { modo: 'provisoria'; em: string }
  | { modo: 'relatorio'; protocolo: string; em: string }
export type ContextoFolha = {
  unidade?: UnidadeFolha | null
  paciente?: PacienteFolha | null
  alergias?: AlergiasFolha | null
  /** autor do documento (login que emitiu) ou, no relatório, quem imprime */
  autor?: ProfissionalFolha | null
  emissao: EmissaoFolha
  /** documento emitido e depois cancelado: sai marcado CANCELADO, com quem e por quê */
  cancelamento?: { em?: string | null; por?: string | null; motivo?: string | null } | null
}

// ── utilidades ───────────────────────────────────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
const vz = (s: unknown) => s == null || String(s).trim() === ''
const V = (s: unknown) => (vz(s) ? '<i class="nd">—</i>' : esc(String(s).trim()))
/** Primeiro valor não vazio. */
function pri(...xs: unknown[]): string {
  for (const x of xs) if (!vz(x)) return String(x).trim()
  return ''
}
const junta = (sep: string, ...xs: unknown[]) => xs.filter((x) => !vz(x)).map((x) => String(x).trim()).join(sep)
const p2 = (n: number) => String(n).padStart(2, '0')
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Partes da data/hora em Brasília (ISO com hora) ou da data civil (aaaa-mm-dd / dd/mm/aaaa). */
function partes(v: unknown): { d: number; m: number; a: number; h?: string } | null {
  const s = String(v ?? '').trim()
  let r = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s)
  if (r) return { d: +r[1], m: +r[2], a: +r[3] }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)!
    return { d: +r[3], m: +r[2], a: +r[1] }
  }
  const t = Date.parse(s)
  if (!s || isNaN(t)) return null
  const f = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(t))
  const g = (k: string) => f.find((x) => x.type === k)?.value ?? ''
  return { d: +g('day'), m: +g('month'), a: +g('year'), h: `${g('hour')}:${g('minute')}` }
}
function dataBr(v: unknown): string {
  const p = partes(v)
  return p ? `${p2(p.d)}/${p2(p.m)}/${p.a}` : ''
}
function dataHoraBr(v: unknown): string {
  const p = partes(v)
  return p ? `${p2(p.d)}/${p2(p.m)}/${p.a}${p.h ? ` ${p.h}` : ''}` : ''
}
function dataExtenso(v: unknown): string {
  const p = partes(v)
  return p ? `${p.d} de ${MESES[p.m - 1]} de ${p.a}` : ''
}
/** Idade na data de referência: "34a", "5m", "12d". */
function idade(nasc: unknown, ref: unknown): string {
  const n = partes(nasc), r = partes(ref)
  if (!n || !r) return ''
  let anos = r.a - n.a
  let meses = r.m - n.m
  if (r.d < n.d) meses--
  if (meses < 0) { anos--; meses += 12 }
  if (anos > 0) return `${anos}a`
  if (meses > 0) return `${meses}m`
  const dias = Math.round((Date.UTC(r.a, r.m - 1, r.d) - Date.UTC(n.a, n.m - 1, n.d)) / 86400000)
  return dias >= 0 ? `${dias}d` : ''
}
function extenso(n: number): string {
  const u = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos']
  if (!Number.isInteger(n) || n < 0 || n > 999) return String(n)
  if (n < 20) return u[n]
  if (n < 100) return d[Math.floor(n / 10)] + (n % 10 ? ' e ' + u[n % 10] : '')
  if (n === 100) return 'cem'
  return c[Math.floor(n / 100)] + (n % 100 ? ' e ' + extenso(n % 100) : '')
}
const texto = (s: unknown) => `<div class="txt">${esc(String(s ?? '').trim())}</div>`
const lista = (x: unknown): Json[] => (Array.isArray(x) ? x : [])

/** Uma caixa de seleção impressa: ✕ na opção marcada. */
function opcoes(itens: string[], sel: string, alerta = false): string {
  const alvo = sel.trim().toLowerCase()
  return `<span class="opcoes">${itens.map((o) => {
    const s = !!alvo && o.toLowerCase() === alvo
    return `<span class="opc${s ? ' sel' : ''}${s && alerta ? ' alerta' : ''}"><span class="cx">${s ? '✕' : ''}</span>${esc(o)}</span>`
  }).join('')}</span>`
}
/** Célula de grade de 12 colunas: rótulo em cima, valor embaixo. */
const cel = (n: number, rot: string, html: string, cls = '') => `<div class="c s${n}${cls ? ' ' + cls : ''}"><span class="rot">${esc(rot)}</span><div class="v">${html}</div></div>`
/** Célula em branco para preencher à mão. */
const branco = (n: number, rot: string, cls = '') => `<div class="c s${n} br${cls ? ' ' + cls : ''}"><span class="rot">${esc(rot)}</span><div class="vazio"></div></div>`
const grade = (cels: string) => `<div class="grade">${cels}</div>`
const secao = (t: string, corpo: string) => `<div class="sec"><div class="st">${esc(t)}</div>${corpo}</div>`
const bloco = (t: string, corpo: string, forte = false) => `<div class="bl${forte ? ' forte' : ''}"><div class="t">${esc(t)}</div>${corpo}</div>`
/** Bloco de texto só quando o texto existe. */
const blocoSe = (t: string, s: unknown, forte = false) => (vz(s) ? '' : bloco(t, texto(s), forte))

type Assinante = { nome?: string | null; linha?: string | null; papel: string }
function assinaturas(xs: Assinante[]): string {
  return `<div class="ass">${xs.map((x) => `<div>${x.nome ? `<strong>${esc(x.nome)}</strong><br>` : ''}${x.linha ? `${esc(x.linha)}<br>` : ''}${esc(x.papel)}</div>`).join('')}</div>`
}
const registroOuBranco = (p: ProfissionalFolha | null | undefined, conselho = 'CRM') => pri(p?.registro, `${conselho} ________`)

// ── paciente, alergia e cabeçalho ────────────────────────────────────────────

type Pac = PacienteFolha & { idade: string; peso: string; diagnostico: string; dieta: string }

/** O banco manda; o conteúdo do documento completa (folha provisória, campos antigos). */
function pacienteDe(ctx: ContextoFolha, d: Json): Pac {
  const b = ctx.paciente ?? {}
  const c = (d && typeof d === 'object' ? d.paciente : null) ?? {}
  const nasc = pri(b.nascimento, c.nascimento, c.data_nascimento)
  const ref = dataRef(ctx, d)
  return {
    nome: pri(b.nome, c.nome), nascimento: nasc, sexo: pri(b.sexo, c.sexo), prontuario: pri(b.prontuario, c.prontuario),
    cns: pri(b.cns, c.cns), cpf: pri(b.cpf, c.cpf), mae: pri(b.mae, c.mae, c.nome_mae), telefone: pri(b.telefone, c.telefone),
    endereco: pri(b.endereco, c.endereco), municipio: pri(b.municipio, c.municipio), uf: pri(b.uf, c.uf), raca_cor: pri(b.raca_cor, c.raca_cor, c.raca),
    responsavel: pri(b.responsavel, c.responsavel), responsavel_telefone: pri(b.responsavel_telefone, c.telResp),
    setor: pri(b.setor, c.setor), leito: pri(c.leito, b.leito),
    idade: pri(nasc ? idade(nasc, ref) : '', c.idade), peso: pri(c.peso), diagnostico: pri(c.diagnostico), dieta: pri(c.dieta),
  }
}
/** Data de referência do documento: a que o conteúdo registra, senão a da impressão. */
function dataRef(ctx: ContextoFolha, d: Json): string {
  return pri(d?.paciente?.dataAtual, d?.data, 'em' in ctx.emissao ? ctx.emissao.em : '', new Date().toISOString())
}
const SEXO: Record<string, string> = { M: 'Masculino', F: 'Feminino', masculino: 'Masculino', feminino: 'Feminino' }
const sexo = (s: unknown) => SEXO[String(s ?? '').trim()] ?? pri(s)

/** Texto da faixa de alergia: banco (situação na impressão) ou o que o documento gravou. */
function alergiaTexto(ctx: ContextoFolha, d: Json): string {
  const a = ctx.alergias
  if (a) {
    if (a.estado === 'tem' && a.itens.length) {
      return 'ALERGIAS: ' + a.itens.map((i) => i.substancia + (vz(i.gravidade) ? '' : ` (${i.gravidade})`) + (vz(i.reacao) ? '' : ` — ${i.reacao}`)).join('; ')
    }
    if (a.estado === 'nega') return 'NEGA ALERGIAS'
    if (a.estado === 'desconhece') return 'ALERGIAS: NÃO INFORMADAS · paciente/acompanhante não soube'
    return 'ALERGIAS: NÃO REGISTRADO · confirmar'
  }
  const s = pri(d?.paciente?.alergias)
  if (!s) return 'ALERGIAS: NÃO REGISTRADO · confirmar'
  if (/^nega$/i.test(s)) return 'NEGA ALERGIAS'
  return 'ALERGIAS: ' + s
}
const faixaAlergia = (ctx: ContextoFolha, d: Json) => `<div class="alergia">⚠ ${esc(alergiaTexto(ctx, d))}</div>`

function linhaUnidade(u: UnidadeFolha | null | undefined): string {
  return junta(' · ', u?.cnes ? `CNES ${u.cnes}` : '', junta('/', u?.municipio, u?.uf), 'SUS')
}
function cabecalho(ctx: ContextoFolha, doc: string, sub: string): string {
  const u = ctx.unidade
  return `<div class="cab"><div><h1>${esc(pri(u?.nome, 'Unidade de saúde'))}</h1><small>${esc(linhaUnidade(u))}</small></div>` +
    `<div class="doc">${doc}${sub ? `<span>${sub}</span>` : ''}</div></div>`
}
function linhaPaciente(p: Pac, extra: [string, string][] = []): string {
  const itens: [string, string][] = [
    ['Pront.', pri(p.prontuario)],
    ['Nasc.', junta(' · ', dataBr(p.nascimento), p.idade, sexo(p.sexo))],
    ['CNS', pri(p.cns)],
    ['Local', junta(' · ', p.setor, p.leito ? `Leito ${p.leito}` : '')],
    ...extra,
  ]
  return `<div class="pac"><span class="nome">${V(p.nome)}</span>${itens.filter(([, v]) => !vz(v)).map(([r, v]) => `<span><span class="rot i">${esc(r)}</span> ${esc(v)}</span>`).join('')}</div>`
}

/** Linha do rodapé que identifica a emissão (número, protocolo, código, autor). */
function linhaEmissao(ctx: ContextoFolha): string {
  const e = ctx.emissao
  const autor = pri(ctx.autor?.nome, '—')
  if (e.modo === 'emitido') {
    return (ctx.cancelamento ? 'CANCELADO · ' : '') + `Documento nº ${esc(e.numero)}${e.versao > 1 ? ` (versão ${e.versao})` : ''} · emitido por ${esc(autor)} · ` +
      `Impressão ${esc(e.protocolo)} em ${esc(dataHoraBr(e.em))} · Código de conferência ${esc(e.codigo)}`
  }
  if (e.modo === 'rascunho') {
    return `RASCUNHO — documento não emitido, sem número · por ${esc(autor)}${e.protocolo ? ` · Impressão ${esc(e.protocolo)} em ${esc(dataHoraBr(e.em))}` : ''}`
  }
  if (e.modo === 'provisoria') return `FOLHA PROVISÓRIA — sem conexão em ${esc(dataHoraBr(e.em))} · sem número definitivo: assinar à mão`
  return `Relatório emitido por ${esc(autor)}${ctx.autor?.registro ? ` · ${esc(ctx.autor.registro)}` : ''} · Impressão ${esc(e.protocolo)} em ${esc(dataHoraBr(e.em))}`
}
function rodape(ctx: ContextoFolha, p: Pac | null, doc: string): string {
  const lgpd = junta(' · ', p?.nome, p?.prontuario ? `Pront. ${p.prontuario}` : '', doc) + ' · Documento confidencial – LGPD (Lei 13.709/2018)'
  return `<div class="rod"><div>${esc(lgpd)}</div><div>${linhaEmissao(ctx)} — Chefe Coruja</div></div>`
}
function avisoProvisoria(ctx: ContextoFolha): string {
  const c = ctx.cancelamento
  if (c) {
    return `<div class="provisoria">DOCUMENTO CANCELADO${c.em ? ` em ${esc(dataHoraBr(c.em))}` : ''}${c.por ? ` por ${esc(c.por)}` : ''}` +
      `${c.motivo ? `: ${esc(c.motivo)}` : ''}. Sem validade; fica no prontuário.</div>`
  }
  return avisoSemConexao(ctx)
}
const avisoSemConexao = (ctx: ContextoFolha) => ctx.emissao.modo === 'provisoria'
  ? `<div class="provisoria">FOLHA PROVISÓRIA — emitida sem conexão em ${esc(dataHoraBr(ctx.emissao.em))}. Sem número definitivo: assinar à mão. O número sai quando a conexão voltar.</div>`
  : ''

// ── CSS da gramática ─────────────────────────────────────────────────────────

function css(paisagem: boolean): string {
  let cols = ''
  for (let i = 1; i <= 12; i++) cols += `.s${i}{grid-column:span ${i}}`
  return `@page{size:A4 ${paisagem ? 'landscape' : 'portrait'};margin:10mm 12mm 13mm;@bottom-right{content:"Página " counter(page) " de " counter(pages);font:8pt Arial,Helvetica,sans-serif;color:#555}}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;padding:0;background:#fff}
body{font:9.5pt/1.45 Arial,Helvetica,sans-serif;color:#000}
@media screen{body{padding:8mm 0}}
#folha{max-width:${paisagem ? '273mm' : '186mm'};margin:0 auto}
#folha *{overflow-wrap:anywhere;min-width:0}
table.pg{width:100%;border-collapse:collapse;table-layout:fixed}
table.pg>thead>tr>td,table.pg>tbody>tr>td,table.pg>tfoot>tr>td{padding:0;border:0;vertical-align:top}
table.pg>thead{display:table-header-group}table.pg>tfoot{display:table-footer-group}
.ficha+.ficha{break-before:page;page-break-before:always}
@media screen{.ficha+.ficha{margin-top:10mm;padding-top:10mm;border-top:2px dashed #999}}
.cab{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;border-bottom:1.5px solid #000;padding-bottom:5px;margin-bottom:5px}
.cab h1{margin:0;font-size:11.5pt;text-transform:uppercase;letter-spacing:.03em}.cab small{display:block;font-size:8.5pt;color:#222}
.cab .doc{font-size:12.5pt;font-weight:900;text-transform:uppercase;text-align:right;letter-spacing:.03em;line-height:1.2}
.cab .doc span{display:block;font-size:8pt;font-weight:700;letter-spacing:.02em;margin-top:2px}
.pac{display:flex;flex-wrap:wrap;align-items:baseline;gap:3px 16px;font-size:9.5pt;padding:3px 0 7px;margin-bottom:9px;border-bottom:1px solid #bbb}
.pac .nome{font-size:12pt;font-weight:900;margin-right:auto}
.rot{display:block;font-size:7.5pt;text-transform:uppercase;letter-spacing:.03em;color:#333;font-weight:700}.rot.i{display:inline}
.nd{color:#777;font-style:normal;font-weight:400}
.alergia{border:2px solid #000;border-left:9px solid #B91C1C;padding:5px 10px;font-weight:800;margin-bottom:10px;font-size:10pt}
.provisoria{border:1.5px solid #B91C1C;color:#B91C1C;font-weight:700;padding:5px 10px;margin-bottom:10px;text-align:center}
.bl{border:1px solid #999;border-radius:4px;padding:6px 10px;margin-bottom:8px;break-inside:avoid}
.bl.forte{border:1.5px solid #000;break-inside:auto}
.bl .t{font-size:8pt;font-weight:900;text-transform:uppercase;letter-spacing:.03em;margin-bottom:3px}
.bl.forte>.t{border-bottom:1px solid #bbb;padding-bottom:3px;break-after:avoid}
.txt{white-space:pre-wrap;orphans:3;widows:3}
.sec{margin-bottom:8px;break-inside:avoid}.sec.solta{break-inside:auto}
.st{font-weight:900;font-size:8.5pt;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #000;padding:1px 0;margin-bottom:0}
.grade{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));border-left:1px solid #444;border-top:1px solid #444;margin-bottom:8px}
.c{border-right:1px solid #444;border-bottom:1px solid #444;padding:2px 6px;min-width:0}
.c .v{font-size:9.5pt;font-weight:600;white-space:pre-wrap}.c.t .v{font-weight:400}
.c .vazio{min-height:1.8em}.c.alta .vazio{min-height:3.4em}.c.ass .vazio{min-height:11mm}.c.alta .v{min-height:3.4em}
${cols}
.opcoes{display:inline-flex;flex-wrap:wrap;gap:3px 10px;align-items:center}
.opc{display:inline-flex;align-items:center;gap:5px;color:#555;font-weight:600}
.opc .cx{width:13px;height:13px;border:1.5px solid currentColor;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;line-height:1;flex-shrink:0}
.opc.sel{color:#000;font-weight:900}.opc.sel.alerta{color:#B91C1C}
.itens{margin:0 0 8px;padding:0;list-style:none}
.itens li{display:grid;grid-template-columns:7mm 1fr;gap:4px;padding:5px 0;border-bottom:1px solid #ddd;break-inside:avoid}
.itens li>b:first-child{text-align:right}.itens .uso{font-style:italic;color:#222}
.tab{width:100%;border-collapse:collapse;font-size:9pt;table-layout:fixed;margin-bottom:8px}
.tab th{text-align:left;font-size:7.5pt;text-transform:uppercase;border-bottom:1.5px solid #000;padding:4px 5px;vertical-align:bottom}
.tab td{padding:4px 5px;border-bottom:1px solid #bbb;vertical-align:top}.tab tr{break-inside:avoid}.tab tr.in td{color:#555}
.sv{display:grid;grid-template-columns:repeat(auto-fill,minmax(19mm,1fr));gap:4px 8px;border:1px solid #999;padding:6px 10px;margin-bottom:8px}
.sv .rot{font-size:6.5pt}.sv b{display:block;font-size:9.5pt;font-weight:600}.sv em{display:block;font-style:normal;font-size:6.5pt;color:#333}
.faixa{display:flex;flex-wrap:wrap;gap:4px 18px;border:1px solid #999;padding:6px 10px;margin-bottom:8px}
.linha{display:flex;flex-wrap:wrap;align-items:center;gap:5px 10px;margin-bottom:8px}.linha>.rot{min-width:110px}
.meta{font-size:8.5pt;color:#333;margin:4px 0}
.branco{display:block;border-bottom:1px solid #000;height:7mm}
.ass{display:grid;grid-template-columns:repeat(auto-fit,minmax(55mm,1fr));gap:30px;padding-top:20mm;break-inside:avoid}
.ass div{border-top:1px solid #000;text-align:center;padding-top:5px;font-size:9pt;max-width:85mm;margin:0 auto;width:100%}
.rod{margin-top:12px;padding-top:4px;border-top:1px solid #bbb;font-size:7.5pt;color:#555;text-align:center;line-height:1.35}
body.cancelado #folha::after{content:"CANCELADO";position:fixed;top:45%;left:0;right:0;text-align:center;font-size:40pt;font-weight:900;color:rgba(185,28,28,.14);transform:rotate(-14deg);pointer-events:none;z-index:9}
body.rascunho #folha::after{content:"RASCUNHO – NÃO ASSINADO";position:fixed;top:45%;left:0;right:0;text-align:center;font-size:30pt;font-weight:900;color:rgba(0,0,0,.12);transform:rotate(-14deg);pointer-events:none;z-index:9}
@media print{.no-print{display:none!important}}`
}

type Ficha = { doc: string; sub?: string; corpo: string; semPaciente?: boolean; extraPac?: [string, string][] }

/** A folha na gramática: cada ficha com cabeçalho e rodapé repetidos por página. */
function pagina(o: { titulo: string; ctx: ContextoFolha; pac: Pac | null; fichas: Ficha[]; paisagem?: boolean; estilo?: string; docRodape?: string }): string {
  const marca = o.ctx.cancelamento ? 'cancelado' : o.ctx.emissao.modo === 'rascunho' ? 'rascunho' : ''
  const fichas = o.fichas.map((f, i) => `<section class="ficha"><table class="pg"><thead><tr><td>` +
    cabecalho(o.ctx, f.doc, f.sub ?? '') + (o.pac && !f.semPaciente ? linhaPaciente(o.pac, f.extraPac) : '') +
    `</td></tr></thead><tfoot><tr><td>${rodape(o.ctx, o.pac, o.docRodape ?? o.titulo)}</td></tr></tfoot><tbody><tr><td>` +
    (i === 0 ? avisoProvisoria(o.ctx) : '') + f.corpo + `</td></tr></tbody></table></section>`).join('')
  const titulo = junta(' — ', o.titulo, o.pac?.nome)
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${css(!!o.paisagem)}${o.estilo ?? ''}</style></head>` +
    `<body${marca ? ` class="${marca}"` : ''}><div id="folha">${fichas}</div></body></html>`
}

const assMedico = (ctx: ContextoFolha, papel = 'Assinatura e carimbo'): Assinante => ({ nome: pri(ctx.autor?.nome), linha: registroOuBranco(ctx.autor), papel })

// ── receituário ──────────────────────────────────────────────────────────────
// Conteúdo: {paciente, receita:{tipo, obs, controle_especial?, itens:[{medicamento|nome,
// dose|apresentacao, quantidade|qtd, posologia|uso, controle_especial?}]}}.
// Item de controle especial (ou receita inteira com tipo 'controle_especial')
// sai na Receita de Controle Especial (Portaria SVS/MS 344/98) em 2 vias:
// 1ª via retida na farmácia, 2ª via do paciente, com comprador e fornecedor.

function itemReceita(i: Json, idx: number, controle: boolean): string {
  const nome = pri(i.medicamento, i.nome, i.med)
  const apres = pri(i.dose, i.apresentacao)
  const qtd = pri(i.quantidade, i.qtd)
  const n = /^\d+/.exec(qtd)
  const qtdTxt = qtd ? (controle && n ? `${qtd} (${extenso(Number(n[0]))})` : qtd) : ''
  return `<li><b>${idx + 1}</b><div><strong>${esc(nome.toUpperCase())}</strong>${apres ? ` — ${esc(apres)}` : ''}${qtdTxt ? ` · <b>${esc(qtdTxt)}</b>` : ''}` +
    `${vz(pri(i.posologia, i.uso)) ? '' : `<br><span class="uso">${esc(pri(i.posologia, i.uso))}</span>`}</div></li>`
}

function receita(d: Json, ctx: ContextoFolha): string {
  const r = d.receita ?? {}
  const todos = lista(r.itens).filter((i) => !vz(pri(i.medicamento, i.nome, i.med)))
  const tudoControle = r.controle_especial === true || r.tipo === 'controle_especial'
  const ctrl = todos.filter((i) => tudoControle || i.controle_especial === true)
  const comuns = todos.filter((i) => !ctrl.includes(i))
  const pac = pacienteDe(ctx, d)
  const dataDoc = dataBr(dataRef(ctx, d))
  const tipo = TIPO_RECEITUARIO.find((t) => t.value === r.tipo)
  const fichas: Ficha[] = []
  if (comuns.length || !ctrl.length) {
    fichas.push({
      doc: 'Receituário', sub: tipo && tipo.value !== 'branca' ? esc(tipo.label) : dataDoc,
      corpo: faixaAlergia(ctx, d) +
        (comuns.length ? `<ol class="itens">${comuns.map((i, k) => itemReceita(i, k, false)).join('')}</ol>` : '<p class="meta">Nenhum item preenchido.</p>') +
        blocoSe('Observações', r.obs) + `<p class="meta">Data: ${esc(dataDoc || '____/____/______')}</p>` +
        assinaturas([assMedico(ctx)]),
    })
  }
  if (ctrl.length) {
    const u = ctx.unidade
    const emitente = grade(cel(6, 'Médico(a)', V(ctx.autor?.nome)) + cel(3, 'Registro no conselho', V(ctx.autor?.registro)) + cel(3, 'Data', V(dataDoc)) +
      cel(8, 'Unidade (endereço)', V(junta(' · ', u?.nome, junta('/', u?.municipio, u?.uf)))) + cel(4, 'CNES', V(u?.cnes)))
    const paciente = grade(cel(8, 'Paciente', V(pac.nome)) + cel(4, 'Nascimento', V(dataBr(pac.nascimento))) +
      cel(12, 'Endereço', V(junta(' – ', pac.endereco, junta('/', pac.municipio, pac.uf)))))
    const comprador = secao('Identificação do comprador', grade(branco(8, 'Nome') + branco(4, 'Documento (RG) e órgão emissor') +
      branco(8, 'Endereço') + branco(4, 'Telefone') + branco(6, 'Cidade / UF')))
    const fornecedor = secao('Identificação do fornecedor', grade(branco(6, 'Farmácia') + branco(3, 'Data') + branco(3, 'Assinatura do farmacêutico', 'ass')))
    const via = (n: number, destino: string): Ficha => ({
      doc: 'Receituário de controle especial', sub: `${n}ª VIA — ${destino}`, semPaciente: true,
      corpo: `<p class="meta">Portaria SVS/MS 344/98 · 1ª via retida na farmácia, 2ª via do paciente.</p>` +
        secao('Identificação do emitente', emitente) + secao('Paciente', paciente) + faixaAlergia(ctx, d) +
        `<ol class="itens">${ctrl.map((i, k) => itemReceita(i, k, true)).join('')}</ol>` +
        assinaturas([assMedico(ctx)]) + `<div style="height:8mm"></div>` + comprador + fornecedor,
    })
    fichas.push(via(1, 'retida na farmácia'), via(2, 'paciente'))
  }
  return pagina({ titulo: 'Receituário', ctx, pac, fichas })
}

// ── atestado (meia A4, 2 vias) ───────────────────────────────────────────────
// Conteúdo de hoje: {paciente, atestado:{tipo:'afastamento'|'comparecimento'|'repouso', dias, cid, texto}}.
// Do protótipo: tipo 'Acompanhante', inicio (aaaa-mm-dd), hentrada, hsaida,
// acompanhante, vinculo, comCid, obs. CID só com autorização do paciente
// (Res. CFM 1.658/2002, art. 3º) — sai com a assinatura dele.

function atestado(d: Json, ctx: ContextoFolha): string {
  const a = d.atestado ?? {}
  const pac = pacienteDe(ctx, d)
  const tipo = String(a.tipo ?? 'afastamento').toLowerCase()
  const titulo = tipo === 'comparecimento' ? 'Declaração de comparecimento' : tipo === 'acompanhante' ? 'Atestado de acompanhante' : 'Atestado médico'
  const ref = dataRef(ctx, d)
  const ini = pri(dataBr(a.inicio), dataBr(ref))
  const nome = pri(pac.nome, '____________________')
  const b = (s: string) => `<b>${esc(s)}</b>`
  // artigo pelo sexo do cadastro, como o protótipo (atPartes): "a Sr.(a)" / "o Sr.(a)"
  const fem = String(pac.sexo ?? '').trim().charAt(0).toUpperCase() === 'F'
  const trat = fem ? 'a Sr.(a)' : 'o Sr.(a)'
  const tratDo = fem ? 'da Sr.(a)' : 'do Sr.(a)'
  const quem = `${trat} ${b(nome)}${pac.cpf ? `, CPF ${b(pac.cpf)}` : ''}`
  const de = pri(a.hentrada, '__:__'), ate = pri(a.hsaida, '__:__')
  const dias = Math.max(1, Number(a.dias) || 1)
  let frase: string
  if (tipo === 'comparecimento') {
    frase = `Declaro, para os devidos fins, que ${quem} compareceu a esta unidade de saúde em ${b(ini)}` +
      (a.hentrada || a.hsaida ? `, no período das ${b(de)} às ${b(ate)}` : '') + ', para atendimento médico.' +
      (Number(a.dias) > 0 ? ` Necessita de ${b(`${dias} (${extenso(dias)}) ${dias === 1 ? 'dia' : 'dias'}`)} de afastamento de suas atividades.` : '')
  } else if (tipo === 'acompanhante') {
    frase = `Atesto, para os devidos fins, que ${b(pri(a.acompanhante, '____________________'))} compareceu a esta unidade de saúde em ${b(ini)}, das ${b(de)} às ${b(ate)}, ` +
      `na condição de acompanhante ${tratDo} ${b(nome)}${pac.cpf ? `, CPF ${b(pac.cpf)}` : ''}${vz(a.vinculo) ? '' : ` (${esc(a.vinculo)})`}.`
  } else if (tipo === 'repouso') {
    frase = `Atesto, para os devidos fins, que ${quem} necessita de ${b(`${dias} (${extenso(dias)}) ${dias === 1 ? 'dia' : 'dias'}`)} de repouso, a partir de ${b(ini)}.`
  } else {
    const p = partes(ini)
    const fim = p ? new Date(Date.UTC(p.a, p.m - 1, p.d + dias - 1)) : null
    const fimTxt = fim ? `${p2(fim.getUTCDate())}/${p2(fim.getUTCMonth() + 1)}/${fim.getUTCFullYear()}` : ''
    frase = `Atesto, para os devidos fins, que ${quem} esteve sob meus cuidados profissionais nesta data, necessitando de afastamento de suas atividades por ` +
      `${b(`${dias} (${extenso(dias)}) ${dias === 1 ? 'dia' : 'dias'}`)}, de ${b(ini)}${fimTxt ? ` a ${b(fimTxt)}, inclusive` : ''}.`
  }
  const cid = pri(a.cid)
  const comCid = !!cid && a.comCid !== false
  const obs = pri(a.obs, a.texto)
  const u = ctx.unidade
  const local = junta(', ', junta('/', u?.municipio, u?.uf), dataExtenso(ref)) + (partes(ref)?.h ? ` – ${partes(ref)!.h}` : '')
  const e = ctx.emissao
  const ident = e.modo === 'emitido' ? `Nº ${e.numero}${e.versao > 1 ? ` v${e.versao}` : ''} · Cód. ${e.codigo}` : e.modo === 'rascunho' ? 'RASCUNHO — sem número' : e.modo === 'provisoria' ? 'PROVISÓRIA — sem número' : ''
  const via = (n: number, destino: string) => `<section class="via">` +
    `<div class="cabv"><div><b class="un">${esc(junta(' · ', pri(u?.nome, 'Unidade de saúde'), u?.cnes ? `CNES ${u.cnes}` : ''))}</b><small>${esc(junta(' · ', junta('/', u?.municipio, u?.uf), 'SUS'))}</small></div>` +
    `<div class="num">${n}ª VIA<span>${esc(destino)}</span></div></div>` +
    `<div class="tit">${esc(titulo)}</div><p class="frase">${frase}</p>` +
    (comCid ? `<div class="cid"><strong>CID-10: ${esc(cid)}</strong> — incluído a pedido do(a) paciente, que autoriza expressamente sua divulgação (Res. CFM 1.658/2002, art. 3º).</div>` : '') +
    (obs ? `<p class="obs">${esc(obs)}</p>` : '') +
    `<div class="rodv${comCid ? '' : ' um'}"><div class="ld">${esc(local)}</div>` +
    (comCid ? `<div><div class="carimbo"></div><div class="assv"><strong>${esc(nome)}</strong><br>Paciente – concordância com a inclusão do CID</div></div>` : '') +
    `<div><div class="carimbo"></div><div class="assv so"><strong>${esc(pri(ctx.autor?.nome))}</strong><br>${esc(registroOuBranco(ctx.autor))}<br>Assinatura e carimbo</div></div></div>` +
    `<div class="metav"><span>${esc(junta(' · ', pac.prontuario ? `Pront. ${pac.prontuario}` : '', ident))}</span><span>Documento confidencial – LGPD</span></div>` +
    `<div class="metav"><span>${linhaEmissao(ctx)}</span></div></section>`
  const rasc = e.modo === 'rascunho' ? 'RASCUNHO – NÃO ASSINADO' : ctx.cancelamento ? 'CANCELADO' : ''
  const estilo =`@page{size:A4 portrait;margin:9mm 12mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}html,body{margin:0;padding:0;background:#fff}
body{font:11pt/1.45 Arial,Helvetica,sans-serif;color:#000}#folha{width:186mm;margin:0 auto}#folha *{overflow-wrap:anywhere}
.provisoria{border:1.5px solid #B91C1C;color:#B91C1C;font-weight:700;padding:4px 8px;margin-bottom:4px;text-align:center;font-size:8.5pt}
.via{font-size:11pt;position:relative;display:flex;flex-direction:column;height:${ctx.emissao.modo === 'provisoria' ? '130mm' : '134mm'};overflow:hidden}.via>*{flex:0 0 auto}
.cabv{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;border-bottom:1.5px solid #000;padding-bottom:5px;margin-bottom:9px}
.cabv .un{display:block;font-size:.95em;text-transform:uppercase;letter-spacing:.03em}.cabv small{display:block;font-size:.73em;color:#222}
.num{font-size:.73em;font-weight:800;border:1.5px solid #000;border-radius:3px;padding:2px 8px;white-space:nowrap;text-align:center}.num span{display:block;font-weight:500}
.tit{text-align:center;font-size:1.27em;font-weight:900;letter-spacing:.06em;text-transform:uppercase;margin:4px 0 11px}
.frase{margin:0;text-align:justify;line-height:1.75}.frase b{font-weight:800;border-bottom:1px solid #000}
.cid{margin-top:9px;font-size:.86em;border-left:4px solid #000;padding:3px 10px}.obs{margin:8px 0 0;font-size:.86em;white-space:pre-wrap}
.rodv{margin-top:auto;display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:end;padding-top:8px}.rodv.um{grid-template-columns:1fr}
.ld{grid-column:1/-1;text-align:center;font-size:.86em}.carimbo{height:16mm}
.assv{border-top:1px solid #000;text-align:center;padding-top:4px;font-size:.77em;line-height:1.35}.assv.so{max-width:85mm;margin:0 auto}
.metav{display:flex;justify-content:space-between;gap:8px;font-size:.62em;color:#333;margin-top:3px;border-top:1px solid #bbb;padding-top:2px}
.corte{position:relative;border-top:1.5px dashed #555;margin:3mm 0}
${rasc ? '.via::after{content:"' + rasc + '";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2.4em;font-weight:900;color:rgba(0,0,0,.13);transform:rotate(-14deg);pointer-events:none}' : ''}`
  const caber = `<script>(function(){function caber(){var ps=document.querySelectorAll(".via");for(var i=0;i<ps.length;i++){var p=ps[i];p.style.fontSize="";var fs=11;` +
    `var alto=function(){var u=p.lastElementChild;return u?u.offsetTop+u.offsetHeight-p.offsetTop:0;};while(alto()>p.clientHeight+1&&fs>7.5){fs-=0.2;p.style.fontSize=fs+"pt";}}}` +
    `caber();window.addEventListener("beforeprint",caber);})();</script>`
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(junta(' — ', titulo, pac.nome))}</title><style>${estilo}</style></head>` +
    `<body><div id="folha">${avisoProvisoria(ctx)}${via(1, 'Paciente')}<div class="corte" aria-hidden="true"></div>${via(2, 'Arquivo da unidade')}</div>${caber}</body></html>`
}

// ── encaminhamento (referência e contrarreferência) ──────────────────────────
// Hoje: {paciente, encaminhamento:{especialidade, prioridade, resumo}}. Do
// protótipo: destino, procCod, procDesc, numReg, cid, hipotese, motivo,
// tratamento, exames, vitais.

function encaminhamento(d: Json, ctx: ContextoFolha): string {
  const e = d.encaminhamento ?? {}
  const pac = pacienteDe(ctx, d)
  const u = ctx.unidade
  const proc = junta(' · ', e.procCod, e.procDesc)
  const prio = pri(e.prioridade)
  const PRI = ['Emergência', 'Urgência', 'Eletivo']
  const prioHtml = PRI.some((x) => x.toLowerCase() === prio.toLowerCase()) || !prio ? opcoes(PRI, prio) : esc(prio)
  const corpo =
    secao('1. Identificação do usuário', grade(
      cel(6, 'Nome', V(pac.nome)) + cel(3, 'Nascimento · idade', V(junta(' · ', dataBr(pac.nascimento), pac.idade))) + cel(1, 'Sexo', V(pac.sexo ? String(pac.sexo).charAt(0) : '')) + cel(2, 'CPF', V(pac.cpf)) +
      cel(4, 'Cartão SUS (CNS)', V(pac.cns)) + cel(5, 'Nome da mãe', V(pac.mae)) + cel(3, 'Telefone', V(pac.telefone)) +
      cel(8, 'Endereço', V(pac.endereco)) + cel(4, 'Município / UF', V(junta(' / ', pac.municipio, pac.uf))))) +
    faixaAlergia(ctx, d) +
    secao('2. Unidade solicitante e destino', grade(
      cel(8, 'Unidade de origem', V(u?.nome)) + cel(4, 'CNES', V(u?.cnes)) +
      cel(6, 'Unidade / serviço de destino', vz(e.destino) ? '<i class="nd">A definir pela regulação</i>' : esc(e.destino)) + cel(6, 'Especialidade / serviço', V(e.especialidade)) +
      cel(5, 'Prioridade', prioHtml) + cel(4, 'Procedimento (SIGTAP)', V(proc)) + cel(3, 'Nº regulação', V(e.numReg)))) +
    secao('3. Dados clínicos', grade(
      cel(2, 'CID-10', `<b style="font-size:11pt">${V(e.cid)}</b>`) + cel(10, 'Hipótese diagnóstica', V(pri(e.hipotese, pac.diagnostico))) +
      cel(12, 'Motivo do encaminhamento / história clínica', V(pri(e.motivo, e.resumo)), 't alta') +
      (vz(e.vitais) ? '' : cel(12, 'Sinais vitais', V(e.vitais), 't')) +
      cel(12, 'Tratamento realizado na origem', V(e.tratamento), 't') + cel(12, 'Exames realizados e resultados', V(e.exames), 't'))) +
    secao('4. Profissional solicitante', grade(
      cel(4, 'Nome', V(ctx.autor?.nome)) + cel(3, 'Registro no conselho', V(ctx.autor?.registro)) +
      // telefone do médico: do retrato gravado no documento (o banco não o manda no contexto)
      cel(2, 'Telefone', V(pri(d?.usuario?.telefone, d?.retrato?.usuario?.telefone))) +
      cel(3, 'Data', V(dataBr(dataRef(ctx, d)))) + branco(12, 'Assinatura e carimbo', 'ass'))) +
    `<div class="corte"><span>✂ Destaque e devolva ao paciente, orientando-o a apresentá-la na unidade de origem</span></div>` +
    secao('Contrarreferência (preenchimento pela unidade de destino)', grade(
      cel(6, 'Paciente', V(pac.nome)) + cel(3, 'Cartão SUS (CNS)', V(pac.cns)) + cel(3, 'Nascimento', V(dataBr(pac.nascimento))) +
      cel(12, 'Devolver para (unidade de origem)', V(junta(' · ', u?.nome, u?.cnes ? `CNES ${u.cnes}` : ''))) +
      branco(6, 'Unidade de destino / serviço') + branco(3, 'Data do atendimento') + branco(3, 'CID-10 definitivo') +
      branco(12, 'Diagnóstico e parecer', 'alta') + branco(12, 'Exames realizados e resultados') + branco(12, 'Tratamento realizado e recomendações de seguimento', 'alta') +
      branco(5, 'Profissional') + branco(3, 'Registro no conselho') + branco(4, 'Assinatura e carimbo', 'ass')))
  const estilo = `.corte{border-top:1.5px dashed #000;margin:12px 0 8px;text-align:center}.corte span{position:relative;top:-.75em;background:#fff;padding:0 8px;font-size:8pt;font-style:italic}`
  return pagina({ titulo: 'Encaminhamento', ctx, pac, estilo, fichas: [{ doc: 'Encaminhamento de usuário', sub: 'Referência e contrarreferência', corpo }] })
}

// ── pedido de exames ─────────────────────────────────────────────────────────
// Porta hoje: {paciente, pedido:{texto}}; internação: {paciente, exames:{texto}}.
// Do protótipo: pedido.{carater, cid, hipotese, indicacao, obs, itens[] |
// grupos[{nome, itens[]}] | folhas[{titulo, documento?, grupos, nota}]} — uma
// folha por serviço (laboratório, imagem…). Com `cardapio` no grupo, a folha
// imprime o cardápio inteiro do serviço com os marcados em destaque e duas
// linhas "Outros" em branco (montarPedHtml); sem ele, só os marcados.

type GrupoExames = { nome: string; itens: string[]; cardapio?: string[] }
function gruposDe(x: Json): GrupoExames[] {
  return lista(x).map((g): GrupoExames => Array.isArray(g)
    ? { nome: String(g[0] ?? ''), itens: lista(g[1]).map(String) }
    : { nome: pri(g?.nome, g?.titulo), itens: lista(g?.itens).map(String), ...(Array.isArray(g?.cardapio) ? { cardapio: lista(g.cardapio).map(String) } : {}) })
    .filter((g) => g.itens.length || g.cardapio?.length)
}

function pedidoExames(d: Json, ctx: ContextoFolha): string {
  const p = d.pedido ?? d.exames ?? {}
  const pac = pacienteDe(ctx, d)
  const linhasTexto = String(p.texto ?? '').split(/\n+/).map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)
  let folhas: { titulo: string; documento?: string; grupos: GrupoExames[]; nota?: string }[] =
    lista(p.folhas).map((f) => ({ titulo: pri(f.titulo), documento: pri(f.documento), grupos: gruposDe(f.grupos), nota: pri(f.nota) }))
  if (!folhas.length) {
    const grupos = gruposDe(p.grupos)
    const soltos = lista(p.itens).map(String).concat(linhasTexto)
    if (soltos.length) grupos.push({ nome: grupos.length ? 'Outros' : '', itens: soltos })
    folhas = [{ titulo: '', grupos }]
  }
  const carater = pri(p.carater, p.prioridade)
  const ref = dataRef(ctx, d)
  const idPac = grade(cel(6, 'Nome do paciente', `<b>${V(pac.nome)}</b>`) + cel(3, 'Nascimento · idade', V(junta(' · ', dataBr(pac.nascimento), pac.idade))) +
    cel(1, 'Sexo', V(pac.sexo ? String(pac.sexo).charAt(0) : '')) + cel(2, 'Pront. · leito', V(junta(' · ', pac.prontuario, pac.leito))) +
    cel(6, 'Nome da mãe', V(pac.mae)) + cel(3, 'CNS', V(pac.cns)) + cel(3, 'Telefone', V(pac.telefone)))
  const clinico = grade(cel(3, 'Data / hora', `<b>${V(pri(dataHoraBr(ref)))}</b>`) +
    cel(5, 'Prioridade', carater ? opcoes(['Rotina', 'Urgência'], carater) : opcoes(['Rotina', 'Urgência'], '')) +
    cel(4, 'CID-10', `<b style="font-size:11pt">${V(String(p.cid ?? '').trim().split(/\s/)[0])}</b>`) +
    cel(12, 'Hipótese diagnóstica', V(pri(p.hipotese, pac.diagnostico))) +
    (vz(p.indicacao) ? '' : cel(12, 'Indicação clínica / justificativa', V(p.indicacao), 't')))
  // CNS de quem pede, do retrato gravado no documento (o protótipo assina "registro · CNS")
  const cnsMedico = pri(d?.retrato?.usuario?.cns, d?.usuario?.cns)
  const ass: Assinante = { ...assMedico(ctx), linha: junta(' · ', registroOuBranco(ctx.autor), cnsMedico ? `CNS ${cnsMedico}` : '') }
  const item = (x: string, on: boolean) => `<div class="it${on ? ' on' : ''}"><span class="cx">${on ? '✕' : ''}</span>${esc(x)}</div>`
  const fichas: Ficha[] = folhas.map((f) => {
    const n = f.grupos.reduce((s, g) => s + g.itens.length, 0)
    const comCardapio = f.grupos.some((g) => g.cardapio)
    const outros = f.grupos.find((g) => !g.cardapio && /^outros$/i.test(g.nome))
    const grupos = comCardapio ? f.grupos.filter((g) => g !== outros) : f.grupos
    const blocos = grupos.map((g) => '<div class="grupo">' + (g.nome ? `<div class="gt">${esc(g.nome)}</div>` : '') +
      (g.cardapio ? g.cardapio.map((x) => item(x, g.itens.includes(x))) : g.itens.map((x) => item(x, true))).join('') + '</div>').join('')
    // o protótipo fecha cada folha com "Outros" e duas linhas em branco; os extras vão na última
    const blocoOutros = comCardapio
      ? '<div class="grupo"><div class="gt">Outros</div>' + (outros?.itens ?? []).map((x) => item(x, true)).join('') +
        item('____________________', false).repeat(2) + '</div>'
      : ''
    const cardapio = n ? `<div class="cardapio">${blocos}${blocoOutros}</div>` : '<p class="meta">Nenhum exame marcado.</p>'
    return {
      doc: f.documento ? esc(f.documento) : 'Solicitação de exames' + (f.titulo ? ` — ${esc(f.titulo)}` : ''), sub: carater ? `Caráter: ${esc(carater)}` : '', semPaciente: true,
      corpo: idPac + faixaAlergia(ctx, d) + clinico + `<div class="qtd">${n} ${n === 1 ? 'exame solicitado' : 'exames solicitados'}</div>` + cardapio +
        blocoSe('Observações', p.obs) + (f.nota ? `<p class="meta">${esc(f.nota)}</p>` : '') + assinaturas([ass]),
    }
  })
  const estilo = `.qtd{font-size:8.5pt;font-weight:800;text-align:right;margin:2px 0 4px}
.cardapio{columns:3;column-gap:14px;border:1.5px solid #000;border-radius:3px;padding:7px 10px;margin-bottom:8px}
.grupo{break-inside:avoid;margin-bottom:6px}.gt{font-size:7.5pt;font-weight:900;text-transform:uppercase;letter-spacing:.03em;border-bottom:1px solid #bbb;margin-bottom:2px}
.it{display:flex;align-items:center;gap:6px;font-size:9pt;padding:1px 0;color:#444}.it.on{color:#000;font-weight:900}
.it .cx{width:13px;height:13px;border:1.5px solid currentColor;border-radius:2px;display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;line-height:1;flex-shrink:0}`
  return pagina({ titulo: 'Solicitação de exames', ctx, pac, estilo, fichas })
}

// ── prescrição ───────────────────────────────────────────────────────────────
// {paciente:{…, peso, leito, diagnostico, dieta}, itens:[{med, via, pos, apr}], obs}

function prescricao(d: Json, ctx: ContextoFolha): string {
  const pac = pacienteDe(ctx, d)
  const itens = lista(d.itens)
  const linhas = itens.map((i, k) => `<tr><td>${p2(k + 1)}</td><td><strong>${esc(pri(i.med, i.descricao))}</strong></td><td>${V(i.via)}</td><td>${V(pri(i.pos, i.posologia))}</td><td>${esc(pri(i.apr))}</td></tr>`).join('')
  const extra: [string, string][] = [['Peso', pac.peso ? `${pac.peso} kg` : ''], ['Data', dataBr(dataRef(ctx, d))]]
  const corpo = faixaAlergia(ctx, d) +
    (vz(pac.diagnostico) && vz(pac.dieta) ? '' : `<div class="faixa">${pac.diagnostico ? `<span><span class="rot i">Diagnóstico</span> ${esc(pac.diagnostico)}</span>` : ''}${pac.dieta ? `<span><span class="rot i">Dieta</span> ${esc(pac.dieta)}</span>` : ''}</div>`) +
    (itens.length
      ? `<table class="tab"><colgroup><col style="width:7%"><col style="width:43%"><col style="width:9%"><col style="width:22%"><col style="width:19%"></colgroup><thead><tr><th>Item</th><th>Nome</th><th>Via</th><th>Posologia</th><th>Aprazamento</th></tr></thead><tbody>${linhas}</tbody></table>`
      : '<p class="meta">Nenhum item.</p>') +
    blocoSe('Observações', d.obs) + assinaturas([assMedico(ctx)])
  return pagina({ titulo: 'Prescrição médica', ctx, pac, fichas: [{ doc: 'Prescrição médica', corpo, extraPac: extra }] })
}

// ── laudo para solicitação de AIH ────────────────────────────────────────────
// Hoje: {paciente, campos:[{rotulo, valor, textarea}]} (rótulos já numerados).
// Do protótipo: aih.{executante, cnesExec, sinais, condicoes, provas,
// diagnostico, cid, cidSec, cidAssoc, procDesc, procCod, clinica, carater,
// causaTipo, cnpjSeg, bilhete, serie, cnpjEmp, cnae, cbor, vinculo}.

function laudoAih(d: Json, ctx: ContextoFolha): string {
  const pac = pacienteDe(ctx, d)
  const u = ctx.unidade
  const af = d.aih ?? {}
  const F = (n: number, num: string, rot: string, html: string, cls = '') => cel(n, `${num} – ${rot}`, html, cls)
  const Z = (n: number, num: string, rot: string, cls = '') => branco(n, `${num} – ${rot}`, cls)
  let corpo: string
  const campos = lista(d.campos)
  if (campos.length && !d.aih) {
    // formato de hoje: os rótulos já vêm numerados do formulário
    corpo = secao('Identificação do paciente', grade(F(9, '5', 'Nome do paciente', V(pac.nome)) + F(3, '6', 'Nº do prontuário', V(pac.prontuario)) +
      F(4, '7', 'Cartão Nacional de Saúde (CNS)', V(pac.cns)) + F(4, '8', 'Data de nascimento', V(dataBr(pac.nascimento))) + F(4, '9', 'Sexo', V(sexo(pac.sexo))))) +
      secao('Campos do laudo', grade(campos.map((c) => cel(c.textarea ? 12 : 6, pri(c.rotulo), V(c.valor), c.textarea ? 't' : '')).join('')))
  } else {
    const carater = pri(af.carater, 'Urgência')
    const sx = pac.sexo ? String(pac.sexo).charAt(0).toUpperCase() : ''
    corpo =
      secao('Identificação do estabelecimento de saúde', grade(F(10, '1', 'Nome do estabelecimento solicitante', V(u?.nome)) + F(2, '2', 'CNES', V(u?.cnes)) +
        F(10, '3', 'Nome do estabelecimento executante', V(af.executante)) + F(2, '4', 'CNES', V(af.cnesExec)))) +
      secao('Identificação do paciente', grade(F(9, '5', 'Nome do paciente', V(pac.nome)) + F(3, '6', 'Nº do prontuário', V(pac.prontuario)) +
        F(4, '7', 'Cartão Nacional de Saúde (CNS)', V(pac.cns)) + F(2, '8', 'Data de nascimento', V(dataBr(pac.nascimento))) +
        F(3, '9', 'Sexo', opcoes(['1 Masc.', '3 Fem.'], sx === 'M' ? '1 Masc.' : sx === 'F' ? '3 Fem.' : '')) + F(3, '10', 'Raça/cor', V(pac.raca_cor)) +
        F(8, '11', 'Nome da mãe', V(pac.mae)) + F(4, '12', 'Telefone de contato', V(pac.telefone)) +
        F(8, '13', 'Nome do responsável', V(pac.responsavel)) + F(4, '14', 'Telefone de contato', V(pac.responsavel_telefone)) +
        F(12, '15', 'Endereço (rua, nº, bairro)', V(pac.endereco)) + F(8, '16', 'Município de residência', V(pac.municipio)) + F(4, '18', 'UF', V(pac.uf)))) +
      faixaAlergia(ctx, d) +
      secao('Justificativa da internação', grade(F(12, '20', 'Principais sinais e sintomas clínicos', V(af.sinais), 't alta') +
        F(12, '21', 'Condições que justificam a internação', V(af.condicoes), 't alta') +
        F(12, '22', 'Principais resultados de provas diagnósticas', V(af.provas), 't alta') +
        F(6, '23', 'Diagnóstico inicial', V(af.diagnostico)) + F(2, '24', 'CID-10 principal', `<b style="font-size:11pt">${V(af.cid)}</b>`) +
        F(2, '25', 'CID-10 secundário', V(af.cidSec)) + F(2, '26', 'CID-10 causas assoc.', V(af.cidAssoc)))) +
      secao('Procedimento solicitado', grade(F(9, '27', 'Descrição do procedimento solicitado', V(af.procDesc)) + F(3, '28', 'Código do procedimento', V(af.procCod)) +
        F(5, '29', 'Clínica', V(af.clinica)) + F(7, '30', 'Caráter da internação', opcoes(['Eletivo', 'Urgência'], carater)) +
        F(4, '33', 'Nome do profissional solicitante/assistente', V(ctx.autor?.nome)) + F(2, '32', 'Registro no conselho', V(ctx.autor?.registro)) +
        // documento (CPF) do solicitante, como no protótipo: do retrato gravado no laudo
        F(3, '31', 'Documento (CPF)', V(pri(d?.usuario?.cpf, d?.retrato?.usuario?.cpf))) +
        F(3, '34', 'Data da solicitação', V(dataBr(dataRef(ctx, d)))) + Z(12, '35', 'Assinatura e carimbo (nº do registro do conselho)', 'ass'))) +
      secao('Causas externas (acidentes ou violências)', grade(
        cel(12, 'Tipo', opcoes(['36 – Acidente de trânsito', '37 – Acidente trabalho típico', '38 – Acidente trabalho trajeto'],
          af.causaTipo === 'transito' ? '36 – Acidente de trânsito' : af.causaTipo === 'trabalhoTipico' ? '37 – Acidente trabalho típico' : af.causaTipo === 'trabalhoTrajeto' ? '38 – Acidente trabalho trajeto' : '')) +
        F(4, '39', 'CNPJ da seguradora', V(af.cnpjSeg)) + F(4, '40', 'Nº do bilhete', V(af.bilhete)) + F(4, '41', 'Série', V(af.serie)) +
        F(4, '42', 'CNPJ empresa', V(af.cnpjEmp)) + F(4, '43', 'CNAE da empresa', V(af.cnae)) + F(4, '44', 'CBOR', V(af.cbor)) +
        F(12, '45', 'Vínculo com a previdência', opcoes(['Empregado', 'Empregador', 'Autônomo', 'Desempregado', 'Aposentado', 'Não segurado'], pri(af.vinculo))))) +
      secao('Autorização (uso exclusivo do órgão autorizador)', grade(Z(6, '46', 'Nome do profissional autorizador') + Z(2, '47', 'Cód. órgão emissor') +
        Z(4, '52', 'Nº da AIH') + Z(4, '49', 'Nº documento (CNS/CPF) do autorizador') + Z(4, '48', 'Documento') + Z(4, '50', 'Data da autorização') +
        Z(12, '51', 'Assinatura e carimbo (nº do registro do conselho)', 'ass')))
  }
  return pagina({ titulo: 'Laudo para solicitação de AIH', ctx, pac, fichas: [{ doc: 'Laudo para solicitação de AIH', sub: 'Autorização de internação hospitalar · SUS', semPaciente: true, corpo }] })
}

// ── termo de consentimento livre e esclarecido ───────────────────────────────
// {termo:{procedimento, texto, informacoes, declaracao, paciente:{nome}, assinante,
// sem_condicoes_motivo, responsavel:{nome, documento, vinculo}, ausencia_motivo,
// testemunha:{nome, documento}, medico:{nome, crm, uf_crm}}} (20261004000004).

function termo(d: Json, ctx: ContextoFolha): string {
  const t = d.termo ?? d
  const pac = pacienteDe(ctx, { paciente: { nome: t.paciente?.nome } })
  const resp = t.responsavel
  const nomePac = pri(pac.nome, t.paciente?.nome)
  const quem = t.assinante === 'responsavel' && resp ? `${esc(resp.nome)}, ${esc(resp.vinculo)} de ${esc(nomePac)}` : esc(nomePac)
  const medico: ProfissionalFolha = { nome: pri(t.medico?.nome, ctx.autor?.nome), registro: t.medico?.crm ? `CRM ${t.medico.crm}${t.medico.uf_crm ? `/${t.medico.uf_crm}` : ''}` : ctx.autor?.registro }
  const u = ctx.unidade
  const local = junta(', ', junta('/', u?.municipio, u?.uf), dataExtenso(dataRef(ctx, d)))
  const ass: Assinante[] = []
  if (t.assinante === 'responsavel' && resp) ass.push({ nome: resp.nome, linha: junta(' · ', resp.documento ? `Doc. ${resp.documento}` : '', resp.vinculo), papel: 'Responsável' })
  // ninguém presente: menor de 16 (representado) ou paciente sem condições de
  // assinar, sem responsável. O paciente não assina; ficam o médico, a
  // testemunha e o motivo da ausência (auditoria 03/10/2026, defeito 10).
  else if (t.assinante === 'ninguem_presente') { /* sem linha do paciente */ }
  else if (resp) {
    // 16 e 17 anos: o paciente assina assistido pelo responsável (os dois assinam)
    ass.push({ nome: nomePac, papel: 'Paciente' })
    ass.push({ nome: resp.nome, linha: junta(' · ', resp.documento ? `Doc. ${resp.documento}` : '', resp.vinculo), papel: 'Responsável (assistência)' })
  } else ass.push({ nome: nomePac, papel: 'Paciente' })
  ass.push({ nome: medico.nome, linha: registroOuBranco(medico), papel: 'Médico responsável' })
  ass.push(t.testemunha ? { nome: t.testemunha.nome, linha: t.testemunha.documento ? `Doc. ${t.testemunha.documento}` : '', papel: 'Testemunha' } : { papel: 'Testemunha' })
  const corpo = faixaAlergia(ctx, d) +
    bloco('Procedimento', texto(t.procedimento)) +
    blocoSe('Informações sobre o procedimento', t.texto, true) +
    blocoSe('Informações específicas deste paciente', t.informacoes) +
    (t.assinante === 'ninguem_presente'
      ? bloco('Declaração', '<div class="txt">Não há paciente em condições de assinar nem responsável presente. O motivo está registrado abaixo; assinam o médico responsável e a testemunha.</div>', true)
      : bloco('Declaração', `<div class="txt">Eu, ${quem}, ${esc(pri(t.declaracao, 'declaro que recebi as informações acima, tive a oportunidade de fazer perguntas e autorizo a realização do procedimento descrito. Sei que posso retirar este consentimento antes do procedimento.'))}</div>`, true)) +
    blocoSe('Paciente sem condições de assinar', t.sem_condicoes_motivo) +
    blocoSe('Ausência de responsável', t.ausencia_motivo) +
    `<p class="meta" style="text-align:center;margin-top:10px">${esc(local)}</p>` + assinaturas(ass)
  return pagina({ titulo: 'Termo de consentimento', ctx, pac, fichas: [{ doc: 'Termo de consentimento livre e esclarecido', sub: pri(t.modelo?.titulo), corpo }] })
}

// ── ficha de admissão médica ─────────────────────────────────────────────────
// Hoje o documento é texto livre. Do protótipo (JSON): subjetivo, objetivo, cid,
// plano, pa, fc, fr, tax, spo2, spo2Cond, o2L, hgt, glasgow, peso, comorb, meds,
// procedencia, acompanhante, setor, regulacao, sepse ('acionado'|'nao_acionado').

function sinaisCrus(sv: [string, unknown, string?][]): string {
  return `<div class="sv">${sv.map(([r, v, e]) => `<div><span class="rot">${esc(r)}</span><b>${V(v)}</b>${e ? `<em>${esc(e)}</em>` : ''}</div>`).join('')}</div>`
}

function admissao(d: Json, ctx: ContextoFolha): string {
  const pac = pacienteDe(ctx, d)
  if (typeof d.texto === 'string' && !d.subjetivo && !d.objetivo) return documentoTexto('admissao_anamnese', d, ctx)
  const cond = d.spo2Cond === 'ar' ? 'ar ambiente' : d.spo2Cond === 'o2' ? `O₂${d.o2L ? ` ${d.o2L} L/min` : ''}` : ''
  const sepse = pri(d.sepse)
  const corpo =
    (vz(d.procedencia) && vz(d.acompanhante) ? '' : grade(cel(6, 'Procedência', V(d.procedencia)) + cel(6, 'Acompanhante', V(pri(d.acompanhante, 'Desacompanhado'))))) +
    faixaAlergia(ctx, d) +
    (vz(d.comorb) && vz(d.meds) ? '' : `<div class="faixa"><span><span class="rot i">Comorbidades</span> ${V(d.comorb)}</span><span><span class="rot i">Medicações em uso</span> ${V(d.meds)}</span></div>`) +
    sinaisCrus([['PA (mmHg)', d.pa], ['FC (bpm)', d.fc], ['FR (irpm)', d.fr], ['Temp. (°C)', d.tax], ['SpO₂ (%)', d.spo2, cond], ['Glicemia (mg/dL)', d.hgt], ['Glasgow', d.glasgow], ['Peso (kg)', d.peso]]) +
    (sepse ? `<div class="linha"><span class="rot">Protocolo de sepse</span>${opcoes(['Acionado', 'Não acionado'], sepse === 'acionado' ? 'Acionado' : sepse === 'nao_acionado' ? 'Não acionado' : '', true)}</div>` : '') +
    bloco('Admissão', texto(junta('\n\n', d.subjetivo, d.objetivo) || 'Sem anotações.'), true) +
    blocoSe('Hipótese diagnóstica / CID', d.cid) +
    (vz(d.setor) ? '' : `<div class="linha"><span class="rot">Setor de destino</span><b>${esc(d.setor)}</b></div>`) +
    (vz(d.regulacao) ? '' : `<div class="linha"><span class="rot">Regulação de leito</span>${esc(d.regulacao)}</div>`) +
    bloco('Conduta', texto(pri(d.plano, 'Sem anotações.')), true) +
    assinaturas([assMedico(ctx), { nome: 'Paciente ou responsável', papel: 'Ciência da internação e do plano terapêutico' }])
  return pagina({ titulo: 'Ficha de admissão médica', ctx, pac, fichas: [{ doc: 'Ficha de admissão médica', corpo, extraPac: [['Admissão', dataHoraBr(dataRef(ctx, d))]] }] })
}

// ── sumário / resumo de alta ─────────────────────────────────────────────────
// Texto livre hoje; do protótipo (JSON): motivo, data (ISO), retroativa,
// retroJust, cid, proc, obs, obito:{setor, cid, do}, desfecho.

function alta(tipo: TipoFolha, d: Json, ctx: ContextoFolha): string {
  if (typeof d.texto === 'string' && !d.motivo) return documentoTexto(tipo, d, ctx)
  const pac = pacienteDe(ctx, d)
  const lin = (k: string, v: unknown) => (vz(v) ? '' : cel(6, k, esc(v)))
  const corpo = faixaAlergia(ctx, d) + grade(
    lin('Data e hora da alta', junta(' ', dataHoraBr(d.data), d.retroativa ? '(retroativa)' : '')) + lin('Motivo da alta', pri(d.desfecho, d.motivo)) +
    lin('Diagnóstico de alta', d.cid) + lin('Procedimento', d.proc) +
    (d.retroativa ? lin('Justificativa da alta retroativa', d.retroJust) : '') +
    (d.obito ? lin('Setor do óbito', d.obito.setor) + lin('CID do óbito', d.obito.cid) + lin('Nº da Declaração de Óbito', d.obito.do) : '')) +
    blocoSe('Observações de alta', d.obs, true) + blocoSe('Resumo', d.resumo, true) +
    assinaturas([assMedico(ctx)])
  return pagina({ titulo: tipo === 'sumario_obito' ? 'Sumário de óbito' : 'Sumário de alta', ctx, pac, fichas: [{ doc: tipo === 'sumario_obito' ? 'Sumário de óbito' : 'Alta médica', corpo }] })
}

// ── documento de texto (evoluções, parecer, boletim…) ────────────────────────

const TITULO_DOC: Record<string, string> = {
  admissao_anamnese: 'Ficha de admissão médica', evolucao: 'Evolução médica', evolucao_enfermagem: 'Evolução de enfermagem',
  anotacao_enfermagem: 'Anotação de enfermagem', evolucao_fisioterapia: 'Evolução de fisioterapia', evolucao_nutricao: 'Evolução de nutrição',
  evolucao_outros: 'Evolução multiprofissional', sumario_alta: 'Sumário de alta', sumario_obito: 'Sumário de óbito', parecer: 'Parecer médico',
  boletim_emergencia: 'Boletim de emergência', teleinterconsulta: 'Teleinterconsulta', termo_consentimento: 'Termo de consentimento',
  atestado: 'Atestado', receita: 'Receituário', encaminhamento: 'Encaminhamento', pedido_exames: 'Solicitação de exames',
  prescricao: 'Prescrição médica', laudo_aih: 'Laudo para solicitação de AIH',
}
const ENFERMAGEM = new Set(['evolucao_enfermagem', 'anotacao_enfermagem'])

function documentoTexto(tipo: string, d: Json, ctx: ContextoFolha): string {
  const pac = pacienteDe(ctx, d)
  const t = typeof d === 'string' ? d : pri(d?.texto, typeof d === 'object' ? JSON.stringify(d, null, 2) : '')
  const titulo = TITULO_DOC[tipo] ?? 'Documento clínico'
  const corpo = faixaAlergia(ctx, d) + bloco(titulo, texto(t || 'Sem texto.'), true) +
    assinaturas([{ nome: pri(ctx.autor?.nome), linha: registroOuBranco(ctx.autor, ENFERMAGEM.has(tipo) ? 'COREN' : 'Registro'), papel: 'Assinatura e carimbo' }])
  return pagina({ titulo, ctx, pac, fichas: [{ doc: titulo, corpo }] })
}

/**
 * Monta a folha do documento. `dados` é o conteúdo gravado (JSON, ou
 * {texto} quando o documento é texto livre); `ctx` traz unidade, paciente,
 * alergias e autor do banco e a emissão (número, protocolo, código).
 */
export function montarFolha(tipo: TipoFolha | string, dados: Json, contexto: ContextoFolha): string {
  const d = dados == null ? {} : typeof dados === 'string' ? { texto: dados } : dados
  // sem o banco (folha provisória), a unidade e o autor vêm do retrato gravado no documento
  const r = d.retrato ?? d
  const ctx: ContextoFolha = {
    ...contexto,
    unidade: contexto.unidade ?? (r.unidade?.nome ? { nome: r.unidade.nome, cnes: r.unidade.cnes, municipio: r.unidade.municipio, uf: r.unidade.uf } : null),
    autor: contexto.autor?.nome ? contexto.autor : r.usuario?.nome ? { nome: r.usuario.nome, registro: r.usuario.registro } : contexto.autor,
  }
  switch (tipo) {
    case 'receita': return receita(d, ctx)
    case 'atestado': return atestado(d, ctx)
    case 'encaminhamento': return encaminhamento(d, ctx)
    case 'pedido_exames': return pedidoExames(d, ctx)
    case 'prescricao': return prescricao(d, ctx)
    case 'laudo_aih': return laudoAih(d, ctx)
    case 'termo_consentimento': return termo(d, ctx)
    case 'admissao_anamnese': return admissao(d, ctx)
    case 'sumario_alta': case 'sumario_obito': return alta(tipo, d, ctx)
    default: return documentoTexto(tipo, d, ctx)
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// RELATÓRIOS (várias linhas; dados da RPC folha_relatorio — ver a migration
// 20261005000001_folhas.sql para o formato de cada um)
// ═════════════════════════════════════════════════════════════════════════════

// ── classificação de risco ───────────────────────────────────────────────────
const MTS: Record<string, { rotulo: string; nivel: string; n: number; cor: string; alvo: string }> = {
  vermelho: { rotulo: 'Vermelho', nivel: 'Emergência', n: 1, cor: '#B91C1C', alvo: 'imediato' },
  laranja: { rotulo: 'Laranja', nivel: 'Muito urgente', n: 2, cor: '#C2410C', alvo: '10 min' },
  amarelo: { rotulo: 'Amarelo', nivel: 'Urgente', n: 3, cor: '#CA8A04', alvo: '60 min' },
  verde: { rotulo: 'Verde', nivel: 'Pouco urgente', n: 4, cor: '#15803D', alvo: '120 min' },
  azul: { rotulo: 'Azul', nivel: 'Não urgente', n: 5, cor: '#1D4ED8', alvo: '240 min' },
}
const mts = (c: unknown) => MTS[String(c ?? '').toLowerCase()]

function relClassificacao(d: Json, ctx: ContextoFolha): string {
  const pac = pacienteDe(ctx, {})
  const ep = d.episodio ?? {}
  const cls = lista(d.classificacoes)
  const at = cls[0] ?? null
  const m = at ? mts(at.cor) : undefined
  const s = at?.sinais ?? {}
  const av = at?.avaliacao ?? {}
  const pa = junta('/', s['pressao-arterial-sistolica'], s['pressao-arterial-diastolica'])
  const oxi = at?.oxigenio?.modo === 'ar_ambiente' ? 'ar ambiente' : at?.oxigenio?.modo === 'o2_suplementar' ? `O₂${at.oxigenio.litros_min ? ` ${at.oxigenio.litros_min} L/min` : ''}` : ''
  const prios = lista(ep.prioridades_legais).map(String)
  const cron = cls.slice().reverse()
  const hist = cron.map((c, i) => {
    const mc = mts(c.cor)
    let seta = ''
    if (i > 0) {
      const a0 = mts(cron[i - 1].cor)?.n ?? 9, a1 = mc?.n ?? 9
      if (a1 < a0) seta = `<div class="seta">↑ piorou</div>`
      else if (a1 > a0) seta = `<div class="seta">↓ melhorou</div>`
    }
    return `<tr><td>${esc(dataHoraBr(c.criado_em))}</td><td><span class="tag" style="--cor:${mc?.cor ?? '#999'}"><b>${mc?.n ?? '?'}</b> ${esc(mc?.rotulo ?? c.cor)}</span>${seta}</td>` +
      `<td>${V(c.fluxograma_nome)}${c.discriminador ? `<br><span class="meta">${esc(c.discriminador)}</span>` : ''}${c.motivo ? `<br><span class="meta">Motivo: ${esc(c.motivo)}</span>` : ''}${c.justificativa ? `<br><span class="meta">Justificativa: ${esc(c.justificativa)}</span>` : ''}</td>` +
      `<td>${V(c.autor_nome)}<br><span class="meta">${esc(junta(' · ', c.autor_papel, c.autor_registro))}</span></td></tr>`
  }).join('')
  const g = at?.gestacao
  const chegada = ep.chegada_em && cron[0] ? Math.max(0, Math.round((Date.parse(cron[0].criado_em) - Date.parse(ep.chegada_em)) / 60000)) : null
  const espera = at && ep.atendimento_iniciado_em ? Math.max(0, Math.round((Date.parse(ep.atendimento_iniciado_em) - Date.parse(at.criado_em)) / 60000)) : null
  const corpo = `<div class="linha"><span class="rot">Prioridade legal</span><b${prios.length ? ' style="text-decoration:underline"' : ''}>${esc(prios.join(', ') || 'Nenhuma')}</b></div>` +
    faixaAlergia(ctx, {}) +
    (at && m
      ? `<div class="card" style="--cor:${m.cor}"><div class="niv"><div class="n">${m.n}</div><h2>${esc(m.rotulo.toUpperCase())}</h2><b>· ${esc(m.nivel)}</b></div>` +
        `<div><b>${V(at.fluxograma_nome)}</b>${at.discriminador ? ` / ${esc(at.discriminador)}` : ''}</div>` +
        `<div class="meta" style="flex-basis:100%">Alvo ${esc(m.alvo)} · ${espera !== null ? `espera pelo médico: ${espera} min` : 'aguardando médico'} · chegada → classificação: ${chegada !== null ? `${chegada} min` : '—'}</div></div>`
      : '<p>Sem classificação registrada.</p>') +
    (ep.suspeita_infeccao_em ? `<div class="linha"><span class="rot">Protocolo de sepse</span>${opcoes(['Acionado', 'Não acionado'], 'Acionado', true)}<span class="meta">Suspeita de infecção registrada em ${esc(dataHoraBr(ep.suspeita_infeccao_em))}</span></div>` : '') +
    (at ? grade(cel(6, 'Queixa principal', V(junta(' · ', pri(at.queixa, ep.queixa), av.tempo_sintomas ? `há ${av.tempo_sintomas}` : ''))) +
      cel(3, 'Comorbidades', V(av.comorbidades)) + cel(3, 'Uso contínuo', V(av.medicacoes))) : '') +
    (at ? `<span class="rot">Sinais vitais na classificação atual</span>` + sinaisCrus([
      ['PA (mmHg)', pa], ['FC (bpm)', s['frequencia-cardiaca']], ['FR (irpm)', s['frequencia-respiratoria']], ['Temp. (°C)', s.temperatura],
      ['SpO₂ (%)', s['saturacao-o2'], oxi], [at.dor?.escala && at.dor.escala !== 'numerica' ? `Dor (${String(at.dor.escala).toUpperCase()})` : 'Dor (0–10)', s['escala-dor']],
      ['Glicemia (mg/dL)', s['glicemia-capilar']], ['Glasgow', pri(av.glasgow, s.glasgow)], ['AVDI', av.avdi], ['Peso (kg)', s.peso]]) : '') +
    (g && g.tipo && !/^nao_/.test(g.tipo) ? `<span class="rot">Gestação</span>` + grade(cel(3, 'Situação', V(String(g.tipo).replace(/_/g, ' '))) +
      cel(3, 'G · P · A', V([g.g, g.p, g.a].map((x) => (x == null ? '—' : x)).join(' · '))) + cel(3, 'DUM', V(dataBr(g.dum))) +
      cel(3, 'IG', V(g.ig_semanas != null ? `${g.ig_semanas} sem${g.ig_dias ? ` ${g.ig_dias} d` : ''}` : ''))) : '') +
    (hist ? `<span class="rot">Histórico de classificações no episódio</span><table class="tab"><colgroup><col style="width:17%"><col style="width:17%"><col><col style="width:24%"></colgroup><thead><tr><th>Data e hora</th><th>Cor</th><th>Fluxograma / discriminador</th><th>Responsável</th></tr></thead><tbody>${hist}</tbody></table>` : '') +
    (ep.atendimento_iniciado_em ? `<div class="bl"><div class="t">Atendimento médico</div>${esc(junta(' · ', dataHoraBr(ep.atendimento_iniciado_em), ep.medico))}</div>` : '') +
    assinaturas([{ nome: pri(at?.autor_nome, 'Enfermeiro(a)'), linha: junta(' · ', pri(at?.autor_registro, 'COREN ________'), dataHoraBr(at?.criado_em)), papel: 'Assinatura e carimbo' },
      { nome: 'Paciente ou responsável', papel: 'Ciência da classificação e do tempo de espera' }])
  const estilo = `.card{border:1.5px solid var(--cor);border-left:8px solid var(--cor);padding:8px 12px;margin-bottom:10px;display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:space-between;align-items:center}
.niv{display:flex;align-items:center;gap:8px}.niv .n{width:26px;height:26px;border:2px solid #000;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11pt}.niv h2{font-size:12.5pt;margin:0;font-weight:900}
.tag{display:inline-flex;align-items:center;gap:5px;border:1.5px solid var(--cor);border-left-width:6px;padding:0 5px;font-weight:700}.seta{font-size:8pt;font-weight:700;margin-top:2px}`
  return pagina({ titulo: 'Classificação de risco', ctx, pac, estilo, docRodape: 'Classificação de risco',
    fichas: [{ doc: 'Acolhimento com classificação de risco', sub: ep.chegada_em ? `Chegada ${esc(dataHoraBr(ep.chegada_em))}` : '', corpo }] })
}

// ── relatório de evolução ────────────────────────────────────────────────────
const ROT_EVOL: Record<string, string> = {
  admissao_anamnese: 'Admissão médica', evolucao: 'Evolução médica', evolucao_enfermagem: 'Evolução de enfermagem',
  anotacao_enfermagem: 'Anotação de enfermagem', evolucao_fisioterapia: 'Evolução de fisioterapia', evolucao_nutricao: 'Evolução de nutrição', evolucao_outros: 'Outros',
}
function relEvolucao(d: Json, ctx: ContextoFolha): string {
  const pac = pacienteDe(ctx, {})
  const regs = lista(d.registros)
  const sit = (r: Json) => r.estado === 'cancelado' ? 'Cancelado' : r.versao > 1 ? `Corrigido · v${r.versao}` : r.papel === 'complemento' ? 'Complemento' : 'Registrado'
  const artigos = regs.map((r) => `<article><div class="m"><b>${esc(dataHoraBr(r.registrado_em))}</b><span>${esc(ROT_EVOL[r.tipo] ?? r.tipo)}</span>` +
    `<span>${esc(junta(' · ', pri(r.autor, '—'), r.especialidade))}</span><span class="s">${esc(sit(r))}</span></div>` +
    `<div class="txt">${esc(r.texto)}</div>${r.versao > 1 && r.motivo_correcao ? `<p class="meta">Correção em ${esc(dataHoraBr(r.corrigido_em))}: ${esc(r.motivo_correcao)}</p>` : ''}</article>`).join('')
  const i = d.internacao ?? {}
  const corpo = faixaAlergia(ctx, {}) + (artigos || '<p class="meta">Nenhum registro selecionado.</p>') +
    assinaturas([{ nome: pri(ctx.autor?.nome), linha: pri(ctx.autor?.registro), papel: 'Emitido por' }])
  const estilo = `article{border-top:1px solid #000;padding:5px 0 7px;break-inside:avoid}.m{display:flex;flex-wrap:wrap;gap:3px 12px;font-size:9pt;margin-bottom:3px}.m .s{margin-left:auto;text-transform:uppercase;font-size:8pt;font-weight:700}`
  return pagina({ titulo: 'Relatório de evolução', ctx, pac, estilo, docRodape: 'Relatório de evolução',
    fichas: [{ doc: 'Relatório de evolução', sub: `${regs.length} ${regs.length === 1 ? 'registro' : 'registros'}`, corpo, extraPac: [['Internação', dataBr(i.data_admissao)]] }] })
}

// ── alergias e eventos adversos ──────────────────────────────────────────────
function relAlergias(d: Json, ctx: ContextoFolha): string {
  const pac = pacienteDe(ctx, {})
  const lin: string[][] = []
  const ativas = lista(d.alergias).filter((a) => !a.inativada_em)
  lista(d.alergias).forEach((a) => lin.push([`Alergia · ${pri(a.tipo, 'substância')}`, pri(a.substancia), pri(a.gravidade), pri(a.reacao),
    a.inativada_em ? junta(' · ', dataHoraBr(a.inativada_em), a.inativada_por) : junta(' · ', dataHoraBr(a.registrado_em), a.autor),
    a.inativada_em ? `Inativa${a.motivo_inativacao ? ` (${a.motivo_inativacao})` : ''}` : 'Ativa']))
  lista(d.eventos).forEach((e) => lin.push(['Evento adverso', pri(e.evento), e.grau != null ? `Grau ${e.grau}` : '', junta(' · ', e.item_descricao, e.observacao),
    e.inativado_em ? junta(' · ', dataHoraBr(e.inativado_em), e.inativado_por) : junta(' · ', dataHoraBr(pri(e.grau_em, e.registrado_em)), e.autor),
    e.inativado_em ? `Inativo${e.motivo_inativacao ? ` (${e.motivo_inativacao})` : ''}` : 'Ativo']))
  const nega = lista(d.negacoes).find((n) => !n.encerrada_em)
  const sit = d.estado === 'tem' ? `ALERGIAS: ${ativas.map((a) => a.substancia).join(', ')}` : d.estado === 'nega' ? 'NEGA ALERGIA' : d.estado === 'desconhece' ? 'NÃO INFORMADAS · não soube' : 'NÃO REGISTRADO'
  const corpo = `<div class="alergia">⚠ ${esc(sit)}${nega ? ` · ${esc(junta(' · ', dataHoraBr(nega.registrado_em), nega.autor))}` : ''}</div>` +
    (lin.length
      ? `<table class="tab"><colgroup><col style="width:15%"><col style="width:17%"><col style="width:11%"><col><col style="width:20%"><col style="width:13%"></colgroup><thead><tr><th>Tipo</th><th>Registro</th><th>Severidade</th><th>Reação / observação / item</th><th>Última modificação</th><th>Situação</th></tr></thead><tbody>` +
        lin.map((l) => `<tr${/^Inativ/.test(l[5]) ? ' class="in"' : ''}>${l.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') + '</tbody></table>'
      : '<p>Sem registros.</p>') +
    assinaturas([{ nome: pri(ctx.autor?.nome), linha: registroOuBranco(ctx.autor, 'Registro'), papel: 'Assinatura e carimbo' }])
  return pagina({ titulo: 'Alergias e eventos adversos', ctx, pac, docRodape: 'Alergias e eventos adversos', fichas: [{ doc: 'Alergias e eventos adversos', corpo }] })
}

// ── avaliações (escalas) ─────────────────────────────────────────────────────
const ESCALA: Record<string, { nome: string; fonte: string; itens: Record<string, string> }> = {
  nips: { nome: 'NIPS', fonte: 'Neonatal Infant Pain Scale (Lawrence et al., 1993)', itens: { face: 'Expressão facial', choro: 'Choro', resp: 'Padrão respiratório', bracos: 'Braços', pernas: 'Pernas', alerta: 'Estado de alerta' } },
  flacc: { nome: 'FLACC', fonte: 'Face, Legs, Activity, Cry, Consolability (Merkel et al., 1997)', itens: { face: 'Face', pernas: 'Pernas', atividade: 'Atividade', choro: 'Choro', consolo: 'Consolabilidade' } },
  braden: { nome: 'Braden', fonte: 'Escala de Braden (Bergstrom et al., 1987)', itens: { percepcao: 'Percepção sensorial', umidade: 'Umidade', atividade: 'Atividade', mobilidade: 'Mobilidade', nutricao: 'Nutrição', friccao: 'Fricção e cisalhamento' } },
  morse: { nome: 'Morse', fonte: 'Morse Fall Scale (Morse, 1989)', itens: { quedas: 'Histórico de quedas', diagnostico: 'Diagnóstico secundário', auxilio: 'Auxílio na deambulação', terapia_ev: 'Terapia endovenosa', marcha: 'Marcha', estado_mental: 'Estado mental' } },
}
function relAvaliacao(d: Json, ctx: ContextoFolha): string {
  const pac = pacienteDe(ctx, {})
  const avs = lista(d.avaliacoes)
  const blocos = avs.map((a) => {
    const e = ESCALA[a.escala]
    const resp = a.respostas && typeof a.respostas === 'object' ? Object.entries(a.respostas as Record<string, unknown>) : []
    return bloco(`${e?.nome ?? a.escala} · ${dataHoraBr(a.registrado_em)}${a.cancelada_em ? ` · CANCELADA por ${pri(a.cancelada_por, '—')}` : ''}`,
      (resp.length ? `<table class="tab"><tbody>${resp.map(([k, v]) => `<tr><th style="width:45%">${esc(e?.itens[k] ?? k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>` : '') +
      `<p><b>Resultado ${esc(a.total)}</b> · ${esc(a.interpretacao)}</p>` +
      `<p class="meta">${esc(junta(' · ', e?.fonte, a.versao ? `versão ${a.versao}` : ''))}</p><p class="meta">Registrado por ${esc(pri(a.autor, '—'))}</p>` +
      (a.cancelada_em && a.motivo_cancelamento ? `<p class="meta">Motivo do cancelamento: ${esc(a.motivo_cancelamento)}</p>` : ''))
  }).join('')
  const corpo = faixaAlergia(ctx, {}) + (blocos || '<p class="meta">Nenhuma avaliação selecionada.</p>') +
    assinaturas([{ nome: pri(ctx.autor?.nome), linha: registroOuBranco(ctx.autor, 'Registro'), papel: 'Assinatura e carimbo' }])
  return pagina({ titulo: 'Avaliações', ctx, pac, docRodape: 'Avaliações', fichas: [{ doc: avs.length === 1 ? 'Avaliação' : 'Avaliações', sub: avs.length > 1 ? `${avs.length} registros` : '', corpo }] })
}

// ── pareceres (um por folha) ─────────────────────────────────────────────────
const PRIORIDADE_PARECER: Record<string, string> = { eletivo: 'Eletivo', urgente: 'Urgente', emergencia: 'Emergência', rotina: 'Rotina' }
const STATUS_PARECER: Record<string, string> = { solicitado: 'Solicitado', em_analise: 'Em análise', realizado: 'Realizado', cancelado: 'Cancelado' }
function relPareceres(d: Json, ctx: ContextoFolha): string {
  const pac = pacienteDe(ctx, {})
  const ps = lista(d.pareceres)
  const fichas: Ficha[] = ps.map((p) => ({
    doc: 'Parecer médico', sub: junta(' · ', p.especialidade, STATUS_PARECER[p.status] ?? p.status),
    corpo: faixaAlergia(ctx, {}) +
      grade(cel(4, 'Especialidade', `<b>${V(p.especialidade)}</b>`) + cel(4, 'Prestador solicitado', V(p.prestador)) + cel(4, 'Prioridade', `<b>${V(PRIORIDADE_PARECER[p.prioridade] ?? p.prioridade)}</b>`) +
        cel(6, 'Solicitante', V(junta(' · ', p.solicitante_nome, p.solicitante_registro))) + cel(6, 'Data / hora da solicitação', V(dataHoraBr(p.solicitado_em))) +
        (p.documento_solicitacao_numero ? cel(12, 'Documento da solicitação', V(`nº ${p.documento_solicitacao_numero}`)) : '')) +
      bloco('Pergunta ao especialista', texto(p.pergunta)) +
      bloco('Parecer', p.status === 'realizado' ? texto(p.resposta) + (p.documento_resposta_numero ? `<p class="meta">Documento nº ${esc(p.documento_resposta_numero)}</p>` : '')
        : p.status === 'cancelado' ? `<div class="txt"><em>Cancelado em ${esc(dataHoraBr(p.cancelado_em))}${p.cancelado_nome ? ` por ${esc(p.cancelado_nome)}` : ''} · ${esc(p.motivo_cancelamento)}</em></div>`
        : '<span class="branco"></span><span class="branco"></span><span class="branco"></span><span class="branco"></span>', true) +
      (p.analise_iniciada_em ? `<p class="meta">Análise iniciada em ${esc(dataHoraBr(p.analise_iniciada_em))}${p.analista_nome ? ` por ${esc(p.analista_nome)}` : ''}.</p>` : '') +
      assinaturas([{ nome: pri(p.solicitante_nome), linha: pri(p.solicitante_registro), papel: 'Solicitante' },
        { nome: pri(p.analista_nome), linha: pri(p.analista_registro), papel: `Parecerista${p.respondido_em ? ` – ${dataHoraBr(p.respondido_em)}` : ''}` }]),
  }))
  if (!fichas.length) fichas.push({ doc: 'Parecer médico', corpo: '<p class="meta">Nenhum parecer selecionado.</p>' })
  return pagina({ titulo: 'Parecer médico', ctx, pac, docRodape: 'Parecer médico', fichas })
}

// ── encaminhamento interno ───────────────────────────────────────────────────
const ESTADO_ENC: Record<string, string> = { pendente: 'Aguardando aceite', aceito: 'Aceito', recusado: 'Recusado', atendido: 'Atendido', cancelado: 'Cancelado' }
function relEncaminhamentoInterno(d: Json, ctx: ContextoFolha): string {
  const pac = pacienteDe(ctx, {})
  const es = lista(d.encaminhamentos)
  const blocos = es.map((e) => bloco(junta(' · ', e.especialidade, e.medico_destino, e.servico),
    grade(cel(4, 'Encaminhado por', V(e.encaminhado_por)) + cel(4, 'Em', V(dataHoraBr(e.encaminhado_em))) + cel(4, 'Situação', `<b>${V(ESTADO_ENC[e.estado] ?? e.estado)}</b>`) +
      (e.respondido_em ? cel(6, e.estado === 'recusado' ? 'Recusado por' : 'Aceito por', V(e.respondido_por)) + cel(6, 'Em', V(dataHoraBr(e.respondido_em))) : '') +
      (e.atendido_em ? cel(12, 'Atendido em', V(dataHoraBr(e.atendido_em))) : '') +
      (e.cancelado_em ? cel(6, 'Cancelado por', V(e.cancelado_por)) + cel(6, 'Em', V(dataHoraBr(e.cancelado_em))) : '')) +
    (vz(e.justificativa) ? '' : `<span class="rot">Observação / justificativa</span>${texto(e.justificativa)}`) +
    (vz(e.motivo_recusa) ? '' : `<span class="rot">Justificativa da recusa</span>${texto(e.motivo_recusa)}`) +
    (vz(e.motivo_cancelamento) ? '' : `<span class="rot">Motivo do cancelamento</span>${texto(e.motivo_cancelamento)}`))).join('')
  const corpo = faixaAlergia(ctx, {}) + (blocos || '<p class="meta">Nenhum encaminhamento selecionado.</p>') +
    assinaturas([{ nome: pri(ctx.autor?.nome), linha: registroOuBranco(ctx.autor), papel: 'Assinatura e carimbo' }])
  return pagina({ titulo: 'Encaminhamento interno', ctx, pac, docRodape: 'Encaminhamento interno', fichas: [{ doc: 'Encaminhamento interno', corpo }] })
}

// ── atendimentos notificáveis (paisagem, sem paciente no cabeçalho) ──────────
// {linhas:[{data, paciente, local, cid, cid_nome, status}], filtro:{de, ate, cids[]}}
function relNotificaveis(d: Json, ctx: ContextoFolha): string {
  const f = d.filtro ?? {}
  const linhas = lista(d.linhas)
  const tr = linhas.map((l) => `<tr><td>${esc(dataBr(l.data) || l.data)}</td><td>${esc(l.paciente)}</td><td>${esc(l.local)}</td><td><b>${esc(l.cid)}</b> ${esc(l.cid_nome)}</td><td>${esc(l.status)}</td></tr>`).join('')
  const corpo = `<p class="meta">Período do atendimento: ${esc(junta(' a ', pri(dataBr(f.de), 'início'), pri(dataBr(f.ate), 'hoje')))} · CIDs considerados: ${esc(lista(f.cids).length ? lista(f.cids).join(', ') : 'todos os notificáveis')}</p>` +
    (tr ? `<table class="tab"><colgroup><col style="width:11%"><col style="width:24%"><col style="width:18%"><col><col style="width:18%"></colgroup><thead><tr><th>Atendimento</th><th>Paciente</th><th>Local</th><th>CID</th><th>Notificação</th></tr></thead><tbody>${tr}</tbody></table>` : '<p>Nenhum atendimento no período.</p>') +
    `<p class="meta">Emitido por ${esc(pri(ctx.autor?.nome, '—'))}</p>`
  return pagina({ titulo: 'Atendimentos notificáveis', ctx, pac: null, paisagem: true, docRodape: 'Atendimentos notificáveis',
    fichas: [{ doc: 'Atendimentos com CID de notificação compulsória', corpo, semPaciente: true }] })
}

/** Monta um relatório de várias linhas (dados da RPC folha_relatorio). */
export function montarRelatorio(tipo: TipoRelatorio, dados: Json, ctx: ContextoFolha): string {
  const d = dados ?? {}
  switch (tipo) {
    case 'classificacao': return relClassificacao(d, ctx)
    case 'evolucao': return relEvolucao(d, ctx)
    case 'alergias': return relAlergias(d, ctx)
    case 'avaliacao': return relAvaliacao(d, ctx)
    case 'pareceres': return relPareceres(d, ctx)
    case 'encaminhamento_interno': return relEncaminhamentoInterno(d, ctx)
    case 'notificaveis': return relNotificaveis(d, ctx)
  }
}

/** Contexto a partir da resposta de folha_documento / folha_relatorio (mesmo formato de cabeçalho). */
export function contextoDoBanco(r: {
  cabecalho?: { unidade?: UnidadeFolha; paciente?: PacienteFolha; alergias?: AlergiasFolha } | null
  autor?: string | null; autor_registro?: string | null
  estado?: string | null; numero?: string | null; versao?: number | null; codigo?: string | null
  protocolo: string; impresso_em: string
}, relatorio = false): ContextoFolha {
  const c = r.cabecalho ?? {}
  const emissao: EmissaoFolha = relatorio
    ? { modo: 'relatorio', protocolo: r.protocolo, em: r.impresso_em }
    : r.estado === 'rascunho' || !r.numero
      ? { modo: 'rascunho', protocolo: r.protocolo, em: r.impresso_em }
      : { modo: 'emitido', numero: r.numero, versao: r.versao ?? 1, protocolo: r.protocolo, em: r.impresso_em, codigo: r.codigo ?? '' }
  return { unidade: c.unidade ?? null, paciente: c.paciente ?? null, alergias: c.alergias ?? null, autor: { nome: r.autor ?? null, registro: r.autor_registro ?? null }, emissao }
}

/** Conteúdo gravado → dados da folha (JSON; texto livre vira {texto}). */
export function lerConteudo(conteudo: string | null | undefined): Json {
  const s = String(conteudo ?? '')
  if (/^\s*[{[]/.test(s)) {
    try { return JSON.parse(s) } catch { /* texto que começa com chave */ }
  }
  return { texto: s }
}

/**
 * A folha a partir da resposta de folha_documento: contexto do banco,
 * cancelamento e, na admissão, a ficha estruturada por cima do conteúdo.
 * Usada pela edge function `folha` e, quando ela não responde, pelo app.
 */
export function folhaDoRegistro(r: Parameters<typeof contextoDoBanco>[0] & {
  tipo: TipoFolha | string; conteudo: string | null
  estruturado?: Json; cancelamento?: ContextoFolha['cancelamento']
}): string {
  const ctx: ContextoFolha = { ...contextoDoBanco(r), cancelamento: r.cancelamento ?? null }
  const base = lerConteudo(r.conteudo)
  const dados = r.estruturado && typeof r.estruturado === 'object' && !Array.isArray(base) ? { ...base, ...r.estruturado } : base
  return montarFolha(r.tipo, dados, ctx)
}
