import { ehPediatrico } from '../../domain/idade.ts'
import { escoreZ, lmsNaIdade, medidaNoEscoreZ, percentil, type LinhaLms, type Lms } from './lms.ts'

import bfaF05 from './dados/bfa-meninas-0-5.json' with { type: 'json' }
import bfaF519 from './dados/bfa-meninas-5-19.json' with { type: 'json' }
import bfaM05 from './dados/bfa-meninos-0-5.json' with { type: 'json' }
import bfaM519 from './dados/bfa-meninos-5-19.json' with { type: 'json' }
import hcfaF05 from './dados/hcfa-meninas-0-5.json' with { type: 'json' }
import hcfaM05 from './dados/hcfa-meninos-0-5.json' with { type: 'json' }
import lhfaF05 from './dados/lhfa-meninas-0-5.json' with { type: 'json' }
import lhfaF519 from './dados/lhfa-meninas-5-19.json' with { type: 'json' }
import lhfaM05 from './dados/lhfa-meninos-0-5.json' with { type: 'json' }
import lhfaM519 from './dados/lhfa-meninos-5-19.json' with { type: 'json' }
import wfaF05 from './dados/wfa-meninas-0-5.json' with { type: 'json' }
import wfaF519 from './dados/wfa-meninas-5-19.json' with { type: 'json' }
import wfaM05 from './dados/wfa-meninos-0-5.json' with { type: 'json' }
import wfaM519 from './dados/wfa-meninos-5-19.json' with { type: 'json' }

// Curva de crescimento da OMS (porte do protótipo, etapa 9): peso, comprimento/
// estatura, IMC e perímetro cefálico para a idade, com as linhas de escore-z e
// os pontos do paciente. Fontes em ./fonte.ts; as tabelas em ./dados são as da
// OMS sem mudança de valor.
//
//   • 0 a 5 anos: padrão da OMS 2006 (até 23 meses a tabela é de comprimento,
//     deitado; de 24 meses, estatura, em pé — a própria OMS emenda assim).
//   • 5 a 19 anos: referência da OMS 2007. Peso para a idade só até 10 anos
//     (a OMS 2007 não publica depois); perímetro cefálico só até 5 anos.
//   • Aqui só pediatria: do nascimento até antes de completar 14 anos (regra
//     da unidade). As tabelas vão até 19 anos, mas o adolescente de 14 anos ou
//     mais é atendido como adulto e a tela diz o motivo.

export type Indicador = 'peso' | 'estatura' | 'imc' | 'pc'
export type Sexo = 'M' | 'F'
export type Intervalo = '0-5' | '5-19'

export type TabelaOms = { fonte: string; unidade: string; eixo: string; lms: LinhaLms[] }

type Def = {
  id: Indicador
  rotulo: string
  /** nome do grandeza no texto ("peso", "estatura"…) */
  grandeza: string
  unidade: string
  /** meses mostrados em cada intervalo (já cortados no fim da pediatria) */
  intervalos: Partial<Record<Intervalo, [number, number]>>
}

/** Último mês da pediatria no eixo: 14 anos = 168 meses (não incluso). */
export const MESES_FIM_PEDIATRIA = 168

export const INDICADORES: Def[] = [
  { id: 'peso', rotulo: 'Peso × idade', grandeza: 'peso', unidade: 'kg', intervalos: { '0-5': [0, 60], '5-19': [61, 120] } },
  { id: 'estatura', rotulo: 'Comprimento/estatura × idade', grandeza: 'estatura', unidade: 'cm', intervalos: { '0-5': [0, 60], '5-19': [61, MESES_FIM_PEDIATRIA] } },
  { id: 'imc', rotulo: 'IMC × idade', grandeza: 'IMC', unidade: 'kg/m²', intervalos: { '0-5': [0, 60], '5-19': [61, MESES_FIM_PEDIATRIA] } },
  { id: 'pc', rotulo: 'Perímetro cefálico × idade', grandeza: 'perímetro cefálico', unidade: 'cm', intervalos: { '0-5': [0, 60] } },
]

export const defIndicador = (id: Indicador) => INDICADORES.find((d) => d.id === id)!

const TABELAS: Record<Indicador, Record<Sexo, Partial<Record<Intervalo, TabelaOms>>>> = {
  peso: { M: { '0-5': wfaM05 as TabelaOms, '5-19': wfaM519 as TabelaOms }, F: { '0-5': wfaF05 as TabelaOms, '5-19': wfaF519 as TabelaOms } },
  estatura: { M: { '0-5': lhfaM05 as TabelaOms, '5-19': lhfaM519 as TabelaOms }, F: { '0-5': lhfaF05 as TabelaOms, '5-19': lhfaF519 as TabelaOms } },
  imc: { M: { '0-5': bfaM05 as TabelaOms, '5-19': bfaM519 as TabelaOms }, F: { '0-5': bfaF05 as TabelaOms, '5-19': bfaF519 as TabelaOms } },
  pc: { M: { '0-5': hcfaM05 as TabelaOms }, F: { '0-5': hcfaF05 as TabelaOms } },
}

export function tabelaDe(ind: Indicador, sexo: Sexo, intervalo: Intervalo): TabelaOms | null {
  return TABELAS[ind][sexo][intervalo] ?? null
}

/** Sexo do cadastro ('M'/'F', ou por extenso) → sexo da tabela; o resto é null. */
export function sexoDaTabela(sexo: string | null | undefined): Sexo | null {
  const s = (sexo ?? '').trim().toUpperCase()
  if (s === 'M' || s.startsWith('MASC')) return 'M'
  if (s === 'F' || s.startsWith('FEM')) return 'F'
  return null
}

/** Dia de calendário (UTC) de 'AAAA-MM-DD' ou de um instante na hora local. */
function diaUtc(x: string | Date): number {
  if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) {
    const [a, m, d] = x.split('-').map(Number)
    return Date.UTC(a, m - 1, d)
  }
  const d = new Date(x)
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
}

/**
 * Idade em meses (fracionária) na data da aferição, como a OMS conta: dias
 * completos ÷ 30,4375. Devolve null se a data é anterior ao nascimento.
 */
export function mesesDeIdade(nascimento: string, aferidoEm: string | Date): number | null {
  const n = diaUtc(nascimento.slice(0, 10))
  const h = diaUtc(aferidoEm)
  if (!Number.isFinite(n) || !Number.isFinite(h) || h < n) return null
  return Math.round((h - n) / 86_400_000) / 30.4375
}

/** Intervalo da curva que a tela abre, pela idade. */
export const intervaloDaIdade = (meses: number | null): Intervalo => (meses !== null && meses > 60 ? '5-19' : '0-5')

/**
 * L, M e S do indicador na idade. Até 60 meses, o padrão 2006; de 61 em
 * diante, a referência 2007. Entre 60 e 61 meses as duas tabelas não se
 * cobrem: interpola do último mês do padrão ao primeiro da referência (a OMS
 * construiu a referência 2007 para emendar no padrão aos 5 anos). Sem tabela
 * (perímetro cefálico depois de 5 anos, peso depois de 10) devolve null.
 */
export function lmsPara(ind: Indicador, sexo: Sexo, meses: number): Lms | null {
  const t05 = tabelaDe(ind, sexo, '0-5')
  const t519 = tabelaDe(ind, sexo, '5-19')
  if (meses <= 60) return t05 ? lmsNaIdade(t05.lms, meses) : null
  if (meses >= 61) return t519 ? lmsNaIdade(t519.lms, meses) : null
  if (!t05 || !t519) return null
  const a = lmsNaIdade(t05.lms, 60)
  const b = lmsNaIdade(t519.lms, 61)
  if (!a || !b) return null
  const t = meses - 60
  return { L: a.L + (b.L - a.L) * t, M: a.M + (b.M - a.M) * t, S: a.S + (b.S - a.S) * t }
}

export type Avaliacao = { z: number; percentil: number }

/** Escore-z e percentil da medida; null fora das tabelas ou com medida inválida. */
export function avaliarMedida(ind: Indicador, sexo: Sexo, meses: number, valor: number): Avaliacao | null {
  if (!(valor > 0) || !Number.isFinite(meses) || meses < 0) return null
  const lms = lmsPara(ind, sexo, meses)
  if (!lms) return null
  const z = escoreZ(lms, valor)
  return { z, percentil: percentil(z) }
}

/**
 * Peso para a idade, crianças de 0 a 10 anos (Ministério da Saúde, SISVAN
 * 2011): < −3 muito baixo peso; ≥ −3 e < −2 baixo peso; ≥ −2 e ≤ +2 peso
 * adequado; > +2 peso elevado. É o único indicador com leitura no protótipo;
 * os outros mostram só o escore-z e o percentil.
 */
export function classificarPesoIdade(z: number): string {
  if (z < -3) return 'Muito baixo peso para a idade'
  if (z < -2) return 'Baixo peso para a idade'
  if (z <= 2) return 'Peso adequado para a idade'
  return 'Peso elevado para a idade'
}

/** IMC = peso (kg) ÷ estatura (m)². */
export function imc(pesoKg: number, estaturaCm: number): number | null {
  if (!(pesoKg > 0) || !(estaturaCm > 0)) return null
  const m = estaturaCm / 100
  return pesoKg / (m * m)
}

export type Medida = { aferidoEm: string; valor: number }

/**
 * Pontos de IMC: peso e estatura aferidos no MESMO dia (data de calendário
 * local). Se houver mais de um no dia, vale o último de cada.
 */
export function paresImc(pesos: Medida[], estaturas: Medida[]): Medida[] {
  const dia = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }
  const ultimo = (lista: Medida[]) => {
    const m = new Map<string, Medida>()
    for (const x of [...lista].sort((a, b) => a.aferidoEm.localeCompare(b.aferidoEm))) m.set(dia(x.aferidoEm), x)
    return m
  }
  const est = ultimo(estaturas)
  const out: Medida[] = []
  for (const [k, p] of ultimo(pesos)) {
    const e = est.get(k)
    const v = e ? imc(p.valor, e.valor) : null
    if (e && v !== null) out.push({ aferidoEm: p.aferidoEm > e.aferidoEm ? p.aferidoEm : e.aferidoEm, valor: v })
  }
  return out.sort((a, b) => a.aferidoEm.localeCompare(b.aferidoEm))
}

/** As linhas que o gráfico desenha: −3, −2, 0, +2 e +3. */
export const LINHAS_Z = [-3, -2, 0, 2, 3] as const

export type PontoLinha = { meses: number; valor: number }

/** Linha de um escore-z no intervalo, mês a mês (pela tabela LMS). */
export function linhaZ(ind: Indicador, sexo: Sexo, intervalo: Intervalo, z: number): PontoLinha[] {
  const faixa = defIndicador(ind).intervalos[intervalo]
  if (!faixa) return []
  const pts: PontoLinha[] = []
  for (let m = faixa[0]; m <= faixa[1]; m++) {
    const lms = lmsPara(ind, sexo, m)
    if (lms) pts.push({ meses: m, valor: medidaNoEscoreZ(lms, z) })
  }
  return pts
}

/**
 * Por que a curva não se aplica ao paciente, ou null se se aplica. A curva
 * precisa da data de nascimento e do sexo, e aqui só vale para a pediatria.
 */
export function motivoSemCurva(nascimento: string | null | undefined, sexo: string | null | undefined, hoje: string): string | null {
  if (!nascimento) return 'Sem data de nascimento no cadastro: a curva precisa da idade exata.'
  const ped = ehPediatrico(nascimento, hoje)
  if (ped === null) return 'Data de nascimento inválida no cadastro.'
  if (!ped) return 'Paciente com 14 anos ou mais é atendido como adulto: a curva de crescimento fica só na pediatria (do nascimento a 13 anos, 11 meses e 29 dias).'
  if (!sexoDaTabela(sexo)) return 'Sexo não registrado no cadastro: as tabelas da OMS são separadas para meninos e meninas.'
  return null
}

/** Rótulo do intervalo no botão ("Nascimento a 5 anos", "5 a 14 anos"…). */
export function rotuloIntervalo(ind: Indicador, intervalo: Intervalo): string {
  if (intervalo === '0-5') return 'Nascimento a 5 anos'
  return ind === 'peso' ? '5 a 10 anos' : '5 a 14 anos'
}
