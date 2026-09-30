// Documentos de internação no formato do protótipo (index.html: aihBlocos,
// aihPendencias, admBlocos, admPendencias, montarAdmHtml). O conteúdo gravado
// tem os nomes de campo que src/lib/folhas.ts lê (laudoAih: `aih.*`;
// admissao: campos na raiz da ficha estruturada), e leva junto o bloco
// `paciente` antigo — quem já lia documentos emitidos continua lendo.
//
// A identificação NUNCA é digitada: sai do cadastro, do login e da unidade
// (components/documentos/identificacao).
import type { VitaisAih } from '@/components/documentos/apoioNews2'
import type { PacProto, UnidadeProto, UsuarioProto } from '@/components/documentos/identificacao'
import type { AnexoLaudo } from '@/components/documentos/leituraLaudo'

const t = (s: unknown) => String(s ?? '').trim()

/** Bloco `paciente` dos documentos antigos, completado com o cadastro (folha provisória). */
export type PacienteAntigo = Record<string, string | null>

function pacienteDoDocumento(antigo: PacienteAntigo, pac: PacProto | null): PacienteAntigo {
  return {
    ...antigo,
    sexo: pac?.sexo ?? '', prontuario: pac?.prontuario ?? '', cns: pac?.cns ?? '', cpf: pac?.cpf ?? '', mae: pac?.mae ?? '',
    telefone: pac?.telefone ?? '', endereco: pac?.endereco ?? '', municipio: pac?.municipio ?? '', uf: pac?.uf ?? '',
    raca: pac?.raca ?? '', responsavel: pac?.responsavel ?? '', telResp: pac?.telResp ?? '',
  }
}

// ── laudo para solicitação de AIH ────────────────────────────────────────────

export type CausaExterna = '' | 'transito' | 'trabalhoTipico' | 'trabalhoTrajeto'

/** Rascunho do laudo (nomes do protótipo, aihAtual()). */
export type FormAih = {
  sinais: string
  condicoes: string
  provas: string
  diagnostico: string
  cid: string
  cidOk: boolean
  cidSec: string
  cidAssoc: string
  procDesc: string
  procCod: string
  clinica: string
  carater: string
  causaTipo: CausaExterna
  vinculo: string
  cienteSigtap: boolean
  vitais: VitaisAih
  anexos: AnexoLaudo[]
}

export const AIH_VAZIO: FormAih = {
  sinais: '', condicoes: '', provas: '', diagnostico: '', cid: '', cidOk: false, cidSec: '', cidAssoc: '', procDesc: '', procCod: '',
  clinica: '', carater: 'Urgência', causaTipo: '', vinculo: '', cienteSigtap: false, vitais: {}, anexos: [],
}

export const CAUSAS_EXTERNAS: [CausaExterna, string][] = [
  ['', 'Não se aplica'], ['transito', 'Acidente de trânsito'], ['trabalhoTipico', 'Acidente de trabalho típico'], ['trabalhoTrajeto', 'Acidente de trabalho no trajeto'],
]

/** Algo escrito pelo médico (o caráter já vem marcado). */
export function aihTemAlgo(f: FormAih) {
  return !!(t(f.sinais) || t(f.condicoes) || t(f.provas) || t(f.diagnostico) || t(f.cid) || t(f.cidSec) || t(f.cidAssoc) ||
    t(f.procDesc) || t(f.procCod) || t(f.clinica) || f.causaTipo || Object.values(f.vitais ?? {}).some((v) => v !== undefined && v !== '' && v !== false))
}

/** O que impede o laudo de sair (aihPendencias do protótipo). */
export function pendenciasAih({ form, pacienteId, cadastroFalta, avisosSigtap }: {
  form: FormAih; pacienteId: string | null | undefined; cadastroFalta: string[]; avisosSigtap: number
}): string[] {
  const p: string[] = []
  if (!pacienteId) p.push('Escolher ou cadastrar o paciente')
  if (!t(form.sinais)) p.push('Principais sinais e sintomas clínicos')
  if (!t(form.condicoes)) p.push('Condições que justificam a internação')
  if (!t(form.diagnostico)) p.push('Diagnóstico inicial')
  if (!t(form.cid)) p.push('CID-10 principal')
  if (!t(form.procDesc) || !t(form.procCod)) p.push('Procedimento com código SIGTAP')
  if (!t(form.clinica)) p.push('Clínica')
  if (pacienteId && cadastroFalta.length) p.push(`Completar o cadastro: ${cadastroFalta.join(', ')}`)
  if (avisosSigtap > 0 && !form.cienteSigtap) p.push('Confirmar os avisos da conferência do SIGTAP')
  return p
}

/** Só o código: "A91 — Dengue hemorrágica" → "A91". */
export const codigoCid = (s: string) => t(s).split(' — ')[0].split(/\s/)[0]

/**
 * O conteúdo gravado do laudo. `aih.*` é o que folhas.ts (laudoAih) lê; a
 * identificação do paciente vem do banco na folha, e o `paciente` gravado
 * serve à folha provisória e a quem lê o formato antigo.
 */
export function conteudoAih({ form, pac, pacienteAntigo, unidade, usuario }: {
  form: FormAih; pac: PacProto | null; pacienteAntigo: PacienteAntigo; unidade: UnidadeProto; usuario: UsuarioProto
}): string {
  const causa = form.causaTipo || ''
  return JSON.stringify({
    paciente: pacienteDoDocumento(pacienteAntigo, pac),
    aih: {
      carater: t(form.carater) || 'Urgência',
      clinica: t(form.clinica),
      sinais: t(form.sinais),
      condicoes: t(form.condicoes),
      provas: t(form.provas),
      diagnostico: t(form.diagnostico),
      cid: codigoCid(form.cid),
      cidSec: codigoCid(form.cidSec),
      cidAssoc: codigoCid(form.cidAssoc),
      procDesc: t(form.procDesc),
      procCod: t(form.procCod),
      causaTipo: causa,
      vinculo: causa === 'trabalhoTipico' || causa === 'trabalhoTrajeto' ? t(form.vinculo) : '',
    },
    // retrato do momento da emissão (a folha do servidor usa o banco)
    unidade: { nome: unidade.nome, cnes: unidade.cnes, municipio: unidade.municipio, uf: unidade.uf },
    usuario: { nome: usuario.nome, registro: usuario.registro, cpf: usuario.cpf },
  })
}

/** O `aih` de um conteúdo gravado (Copiar como novo) de volta ao formulário. */
export function formDoConteudoAih(conteudo: string): Partial<FormAih> | null {
  try {
    const j = JSON.parse(conteudo) as { aih?: Record<string, unknown> }
    const a = j.aih
    if (!a || typeof a !== 'object') return null
    const s = (k: string) => (typeof a[k] === 'string' ? (a[k] as string) : '')
    const causa = s('causaTipo')
    return {
      sinais: s('sinais'), condicoes: s('condicoes'), provas: s('provas'), diagnostico: s('diagnostico'),
      cid: s('cid'), cidOk: !!s('cid'), cidSec: s('cidSec'), cidAssoc: s('cidAssoc'), procDesc: s('procDesc'), procCod: s('procCod'),
      clinica: s('clinica'), carater: s('carater') || 'Urgência',
      causaTipo: (['transito', 'trabalhoTipico', 'trabalhoTrajeto'].includes(causa) ? causa : '') as CausaExterna,
      vinculo: s('vinculo'),
    }
  } catch {
    return null
  }
}

// ── ficha de admissão médica ─────────────────────────────────────────────────

export type Spo2Cond = '' | 'ar' | 'o2'
export type Sepse = '' | 'acionado' | 'nao_acionado'
export type DetalheAdm = { esquema: string; item: string }

/** Rascunho da ficha (nomes do protótipo, admAtual()). `undefined` = ainda vale o da triagem. */
export type FormAdm = {
  procedencia?: string
  acompanhante?: string
  comorb?: string
  meds?: string
  subjetivo?: string
  objetivo?: string
  pa?: string
  fc?: string
  fr?: string
  tax?: string
  spo2?: string
  spo2Cond?: Spo2Cond
  o2L?: string
  hgt?: string
  peso?: string
  glasgow?: string
  cid?: string
  cidOk?: boolean
  plano?: string
  sepse?: Sepse
  detalhes?: DetalheAdm[]
}

export const CAMPOS_ADM: (keyof FormAdm)[] = [
  'procedencia', 'acompanhante', 'comorb', 'meds', 'subjetivo', 'objetivo', 'pa', 'fc', 'fr', 'tax', 'spo2', 'spo2Cond', 'o2L',
  'hgt', 'peso', 'glasgow', 'cid', 'cidOk', 'plano', 'sepse', 'detalhes',
]

/** Tudo `undefined`: "Limpar" volta aos valores da triagem. */
export const ADM_VAZIO: FormAdm = Object.fromEntries(CAMPOS_ADM.map((k) => [k, undefined])) as FormAdm

export function admTemAlgo(f: FormAdm) {
  return CAMPOS_ADM.some((k) => {
    const v = f[k]
    return Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : !!v
  })
}

/**
 * Valor que não pode existir por definição (não é faixa clínica): não
 * numérico, zero ou negativo, 1000 ou mais, SpO₂ acima de 100, Glasgow fora de
 * 3 a 15, PA fora do formato S/D ou com diastólica maior ou igual à sistólica.
 * (vitalImpossivel do protótipo.)
 */
export function vitalImpossivel(k: string, v: unknown): string {
  const s = t(v)
  if (!s) return ''
  if (k === 'pa') {
    const m = /^(\d{1,3})\s*\/\s*(\d{1,3})$/.exec(s)
    if (!m) return 'formato inválido (use S/D)'
    if (+m[1] === 0) return 'sistólica zero'
    if (+m[2] >= +m[1]) return 'diastólica igual ou maior que a sistólica'
    return ''
  }
  const x = s.replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(x)) return 'não é número'
  const n = +x
  if (['fc', 'fr', 'tax', 'hgt', 'peso', 'o2L'].includes(k) && n <= 0) return 'zero ou negativo'
  if (['fc', 'fr', 'tax', 'spo2'].includes(k) && n >= 1000) return '1000 ou mais'
  if (k === 'spo2' && (n > 100 || n < 0)) return 'acima de 100%'
  if (k === 'glasgow' && (n % 1 !== 0 || n < 3 || n > 15)) return 'fora de 3 a 15'
  return ''
}

export const VITAIS_ADM: [keyof FormAdm, string][] = [
  ['pa', 'PA'], ['fc', 'FC'], ['fr', 'FR'], ['tax', 'Temp.'], ['spo2', 'SpO₂'], ['hgt', 'Glicemia'], ['glasgow', 'Glasgow'], ['peso', 'Peso'],
]

/** O que impede a ficha de ser registrada (admPendencias do protótipo + o que o servidor recusa). */
export function pendenciasAdm({ a, pacienteId, internacaoId, jaRegistrada, detalhesObrigatorio, setor }: {
  a: FormAdm; pacienteId: string | null | undefined; internacaoId: string | null | undefined; jaRegistrada: boolean
  detalhesObrigatorio: boolean; setor: string
}): string[] {
  const p: string[] = []
  if (!pacienteId) p.push('Escolher ou cadastrar o paciente')
  else if (!internacaoId) p.push('Paciente sem internação aberta: abra pelo box ou pelo leito')
  if (jaRegistrada) p.push('A admissão desta internação já foi registrada')
  if (detalhesObrigatorio && !(a.detalhes ?? []).length) p.push(`Detalhes da admissão (obrigatório no setor ${setor})`)
  if (!t(a.subjetivo)) p.push('Subjetivo')
  if (!t(a.objetivo)) p.push('Objetivo')
  if (!t(a.cid)) p.push('Hipótese diagnóstica')
  if (!t(a.plano)) p.push('Avaliação inicial e plano de tratamento')
  for (const [k, rot] of VITAIS_ADM) {
    const r = vitalImpossivel(k, a[k])
    if (r) p.push(`Valor impossível em ${rot}: "${t(a[k]).slice(0, 30)}" (${r})`)
  }
  if (a.spo2Cond === 'o2') {
    const r = vitalImpossivel('o2L', a.o2L)
    if (r) p.push(`Fluxo de O₂ impossível: "${t(a.o2L)}" (${r})`)
  }
  return p
}

/** A ficha estruturada (p_ficha de registrar_admissao): o que folhas.ts (admissao) lê. */
export function fichaAdm({ a, setor, regulacao, pacienteAntigo, pac, agora }: {
  a: FormAdm; setor: string; regulacao: string; pacienteAntigo: PacienteAntigo; pac: PacProto | null; agora: Date
}) {
  const s = (k: keyof FormAdm) => t(a[k])
  const o2 = a.spo2Cond === 'o2'
  return {
    // dataAtual com hora: a folha usa como data/hora da admissão
    paciente: { ...pacienteDoDocumento(pacienteAntigo, pac), dataAtual: agora.toISOString(), diagnostico: s('cid') },
    data: agora.toISOString(),
    procedencia: s('procedencia'), acompanhante: s('acompanhante'), comorb: s('comorb'), meds: s('meds'),
    subjetivo: s('subjetivo'), objetivo: s('objetivo'),
    pa: s('pa'), fc: s('fc'), fr: s('fr'), tax: s('tax'), spo2: s('spo2'), spo2Cond: a.spo2Cond ?? '', o2L: o2 ? s('o2L') : '',
    hgt: s('hgt'), peso: s('peso'), glasgow: s('glasgow'),
    cid: s('cid'), plano: s('plano'), sepse: a.sepse ?? '', setor, regulacao,
    detalhes: a.detalhes ?? [],
  }
}

/** O texto legível que vai para o prontuário (documentos_clinicos). */
export function textoAdm(f: ReturnType<typeof fichaAdm>): string {
  const cond = f.spo2Cond === 'ar' ? ' em ar ambiente' : f.spo2Cond === 'o2' ? ` em O₂${f.o2L ? ` ${f.o2L} L/min` : ''}` : ''
  const vitais = [
    f.pa ? `PA ${f.pa} mmHg` : '', f.fc ? `FC ${f.fc} bpm` : '', f.fr ? `FR ${f.fr} irpm` : '', f.tax ? `Temp. ${f.tax} °C` : '',
    f.spo2 ? `SpO₂ ${f.spo2}%${cond}` : '', f.hgt ? `Glicemia ${f.hgt} mg/dL` : '', f.glasgow ? `Glasgow ${f.glasgow}` : '',
    f.peso ? `Peso ${f.peso} kg` : '',
  ].filter(Boolean).join(' · ')
  const linha = (r: string, v: string) => (v ? `${r}: ${v}` : '')
  return [
    'FICHA DE ADMISSÃO MÉDICA',
    [linha('Procedência', f.procedencia), linha('Acompanhante', f.acompanhante || 'Desacompanhado')].filter(Boolean).join('\n'),
    [linha('Comorbidades', f.comorb), linha('Medicações em uso', f.meds)].filter(Boolean).join('\n'),
    `SUBJETIVO\n${f.subjetivo}`,
    `OBJETIVO\n${f.objetivo}${vitais ? `\nSinais vitais: ${vitais}` : ''}`,
    linha('Hipótese diagnóstica', f.cid),
    [linha('Protocolo de sepse', f.sepse === 'acionado' ? 'acionado' : f.sepse === 'nao_acionado' ? 'não acionado' : ''),
      linha('Setor de destino', f.setor), linha('Regulação de leito', f.regulacao)].filter(Boolean).join('\n'),
    `AVALIAÇÃO INICIAL E PLANO\n${f.plano}`,
  ].filter((x) => x.trim()).join('\n\n')
}
