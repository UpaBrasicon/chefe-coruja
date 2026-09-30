import type { Ficha } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'
import {
  AJUSTE_INICIAL, OBSTRUIDO, SDRA, TABELAS_PEEP, peepParaFio2, relacaoIE, tinsVcv, vcPorPeso,
  type ClasseBerlim, type Faixa, type Modo, type TabelaPeepId,
} from './ventilacaoMecanica.ts'

// Ventilação mecânica em cinco passos (formato do protótipo: Quem, Modo,
// Ajustes, Acompanhar, Desmamar) com as faixas do cap. 37 do Manual de
// Medicina de Emergência do HCFMUSP (3ª ed., 2022). O protótipo usava as
// faixas de Valiatti 2016, Sarmento 2011 e SES-DF, complacência e constante de
// tempo "típicas" por quadro e um veredito MANTER/TROCAR/PARE; nada disso
// entra: aqui só as tabelas do livro (Tabelas 2, 4 e 5), e a tela diz o que
// está fora delas sem escolher o ajuste (ADR 0007).
//
// Só adulto. O livro do ICr não tem capítulo de ventilação mecânica
// (pediátrico e neonatal ficam na lista do RT).

const PAG_VM_PASSOS = 'cap. 37, p. 498–510 (Tabelas 2, 4, 5, 6 e 7; Figuras 4 e 5)'

export const fichaVmPassos: Ficha = {
  ...fichaAdulto('adulto-vm-cinco-passos', 'Ventilação mecânica em cinco passos (adulto)', PAG_VM_PASSOS),
  versao: '2026-09-30.1',
  fontes: [pagina(PAG_VM_PASSOS)],
  revisadoEm: '30/09/2026 (faixas conferidas no texto do cap. 37; aguarda aprovação do RT)',
}

/** O quadro escolhe a tabela do livro que vale para a checagem. */
export type QuadroVm = 'inicial' | 'obstruido' | 'sdra'

export const QUADROS_VM: Record<QuadroVm, { nome: string; tabela: string; modos: Modo[] }> = {
  inicial: { nome: 'Ajuste inicial (sem obstrução grave nem SDRA)', tabela: 'Tabela 2, p. 501–502', modos: ['vcv', 'pcv', 'psv'] },
  obstruido: { nome: 'Obstruído grave (asma ou DPOC)', tabela: 'Tabela 4, p. 504–505', modos: ['vcv', 'pcv'] },
  sdra: { nome: 'SDRA', tabela: 'Tabela 5, p. 506; Tabelas 6 e 7, p. 506–507', modos: ['vcv', 'pcv'] },
}

/** O que cada tabela traz como "alarmes" (a linha da própria tabela). */
export const ALARMES_LIVRO: Record<QuadroVm, { texto: string; pagina: string }[]> = {
  inicial: [{ texto: 'Alarmes: regulação individualizada (o livro não traz valores)', pagina: 'Tabela 2, p. 502' }],
  obstruido: [
    { texto: 'Evitar Pplatô > 30 cmH2O', pagina: 'Tabela 4, p. 505' },
    { texto: 'Evitar Ppico > 45 cmH2O', pagina: 'Tabela 4, p. 505' },
  ],
  sdra: [
    { texto: 'Manter Pplatô ≤ 30 cmH2O', pagina: 'Tabela 5, p. 506' },
    { texto: 'Evitar Pplatô − PEEP ("driving pressure") > 15 cmH2O', pagina: 'Tabela 5, p. 506' },
  ],
}

/** Alvo de SatO2 da tabela do quadro. */
export const ALVO_SAT: Record<QuadroVm, { texto: string; faixa: Faixa | null; acima: number | null; pagina: string }> = {
  inicial: { texto: 'SatO2 93–97%', faixa: AJUSTE_INICIAL.sato2, acima: null, pagina: 'Tabela 2, p. 501' },
  obstruido: { texto: 'SatO2 > 92%', faixa: null, acima: OBSTRUIDO.sato2Acima, pagina: 'Tabela 4, p. 505' },
  sdra: { texto: 'SatO2 > 92%', faixa: null, acima: SDRA.sato2Acima, pagina: 'Tabela 5, p. 506' },
}

export type Ajustes = {
  /** VCV: volume corrente ajustado (mL) */
  vcMl?: number
  /** VCV: fluxo inspiratório em onda quadrada (L/min) */
  fluxoLMin?: number
  /** PCV: tempo inspiratório (s) */
  tinsS?: number
  fr?: number
  peep?: number
  /** FiO2 em % (21–100) */
  fio2Pct?: number
  /** obstruído: auto-PEEP medida na pausa expiratória */
  autoPeep?: number
}

export type EstadoLinha = 'ok' | 'fora' | 'sem-faixa' | 'vazio'

export type LinhaChecagem = {
  parametro: string
  valor: string
  livro: string
  estado: EstadoLinha
  nota?: string
  pagina: string
}

const valido = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x) && x > 0
const naoNeg = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x) && x >= 0
const n1 = (x: number) => (Math.round(x * 10) / 10).toLocaleString('pt-BR')
const n2 = (x: number) => (Math.round(x * 100) / 100).toLocaleString('pt-BR')
const fx = (f: Faixa, u: string) => (f[0] === f[1] ? `${n1(f[0])} ${u}` : `${n1(f[0])}–${n1(f[1])} ${u}`)
const dentro = (x: number, f: Faixa) => x >= f[0] - 1e-9 && x <= f[1] + 1e-9

/** VT do quadro em mL/kg (SDRA: pela classe de Berlim). */
export function vtMlKgDoQuadro(q: QuadroVm, classe?: ClasseBerlim): Faixa | null {
  if (q === 'inicial') return AJUSTE_INICIAL.vtMlKg
  if (q === 'obstruido') return [OBSTRUIDO.vtMlKg, OBSTRUIDO.vtMlKg]
  if (!classe) return null
  return classe === 'leve' ? [SDRA.vtLeve, SDRA.vtLeve] : SDRA.vtModeradaGrave
}

/** Tabela de PEEP que a Tabela 5 aponta pela classe (grave → PEEP alto). */
export const tabelaPeepSdra = (c: ClasseBerlim): TabelaPeepId => (c === 'grave' ? 'alveoli' : 'baixo')

export type EntradaChecagem = { quadro: QuadroVm; modo: Modo; pesoKg?: number; classe?: ClasseBerlim; tabelaPeep?: TabelaPeepId; a: Ajustes }

export type Checagem = { linhas: LinhaChecagem[]; ie: ReturnType<typeof relacaoIE>; tinsCalculadoS: number | null; vtAlvoMl: Faixa | null }

/**
 * Passo 3: confere cada parâmetro digitado contra a tabela do quadro. Não
 * sugere valor: diz o que o livro traz e se o número está dentro.
 */
export function checarAjustes(e: EntradaChecagem): Checagem {
  const { quadro: q, modo, a } = e
  const linhas: LinhaChecagem[] = []
  const pag = QUADROS_VM[q].tabela

  // volume corrente
  const vtKg = vtMlKgDoQuadro(q, e.classe)
  const vtAlvoMl = vtKg && valido(e.pesoKg) ? vcPorPeso(e.pesoKg, vtKg) : null
  if (modo === 'vcv') {
    if (!valido(a.vcMl)) linhas.push({ parametro: 'Volume corrente', valor: '—', livro: vtKg ? fx(vtKg, 'mL/kg') : 'escolha a classe de Berlim', estado: 'vazio', pagina: pag })
    else if (!valido(e.pesoKg)) linhas.push({ parametro: 'Volume corrente', valor: `${Math.round(a.vcMl)} mL`, livro: vtKg ? fx(vtKg, 'mL/kg') : '—', estado: 'sem-faixa', nota: 'Informe o peso usado na conta para comparar em mL/kg.', pagina: pag })
    else {
      const mlKg = Math.round((a.vcMl / e.pesoKg) * 10) / 10
      linhas.push({
        parametro: 'Volume corrente', valor: `${Math.round(a.vcMl)} mL (${n1(mlKg)} mL/kg)`, livro: vtKg ? fx(vtKg, 'mL/kg') : 'escolha a classe de Berlim',
        estado: vtKg ? (dentro(mlKg, vtKg) ? 'ok' : 'fora') : 'sem-faixa',
        nota: q === 'sdra' && e.classe !== 'leve' ? 'Errata: a Tabela 5 imprime 3–6 mL/kg; o livro traz 4–6 na p. 127 e na p. 403.' : undefined,
        pagina: pag,
      })
    }
  } else if (modo !== 'psv' || q === 'inicial') {
    linhas.push({ parametro: 'Volume corrente (exalado)', valor: '—', livro: vtKg ? `${fx(vtKg, 'mL/kg')}${vtAlvoMl ? ` = ${Math.round(vtAlvoMl[0])}–${Math.round(vtAlvoMl[1])} mL` : ''}` : '—', estado: 'sem-faixa', nota: modo === 'pcv' ? 'Em PCV o volume é consequência: regule a pressão inspiratória olhando o Vt exalado (Tabela 2).' : 'Em PSV regule a pressão de suporte olhando o Vt exalado (Tabela 2).', pagina: pag })
  }

  // frequência
  const frFaixa: Faixa | null = q === 'inicial' ? (modo === 'psv' ? null : AJUSTE_INICIAL.fr) : q === 'obstruido' ? OBSTRUIDO.fr : [SDRA.frInicial, SDRA.frInicial]
  if (modo === 'psv' && q === 'inicial') linhas.push({ parametro: 'Frequência', valor: valido(a.fr) ? `${a.fr} rpm` : '—', livro: 'drive do paciente; ajustar ventilação de apneia', estado: 'sem-faixa', pagina: pag })
  else if (!valido(a.fr)) linhas.push({ parametro: 'Frequência', valor: '—', livro: frFaixa ? fx(frFaixa, 'rpm') : '—', estado: 'vazio', pagina: pag })
  else if (q === 'sdra') linhas.push({ parametro: 'Frequência', valor: `${a.fr} rpm`, livro: 'inicial 20 rpm; casos graves podem precisar de 35–45 (atentar para auto-PEEP)', estado: a.fr === SDRA.frInicial ? 'ok' : a.fr >= SDRA.frGrave[0] && a.fr <= SDRA.frGrave[1] ? 'ok' : 'fora', nota: a.fr !== SDRA.frInicial ? 'Diferente dos 20 rpm iniciais da Tabela 5.' : undefined, pagina: pag })
  else linhas.push({ parametro: 'Frequência', valor: `${a.fr} rpm`, livro: fx(frFaixa!, 'rpm'), estado: dentro(a.fr, frFaixa!) ? 'ok' : 'fora', pagina: pag })

  // tempo inspiratório e fluxo
  const tinsCalculadoS = modo === 'vcv' && valido(a.vcMl) && valido(a.fluxoLMin) ? tinsVcv(a.vcMl, a.fluxoLMin) : modo === 'pcv' && valido(a.tinsS) ? a.tinsS : null
  if (modo === 'pcv') {
    const f: Faixa | null = q === 'inicial' ? AJUSTE_INICIAL.tins : null
    const max = q === 'obstruido' ? OBSTRUIDO.tinsMax : q === 'sdra' ? SDRA.tinsMax : null
    if (!valido(a.tinsS)) linhas.push({ parametro: 'Tempo inspiratório', valor: '—', livro: f ? fx(f, 's') : `≤ ${n1(max!)} s`, estado: 'vazio', pagina: pag })
    else linhas.push({ parametro: 'Tempo inspiratório', valor: `${n2(a.tinsS)} s`, livro: f ? fx(f, 's') : `≤ ${n1(max!)} s`, estado: f ? (dentro(a.tinsS, f) ? 'ok' : 'fora') : a.tinsS <= max! + 1e-9 ? 'ok' : 'fora', pagina: pag })
  }
  if (modo === 'vcv') {
    const f: Faixa | null = q === 'inicial' ? AJUSTE_INICIAL.fluxo : q === 'sdra' ? SDRA.fluxo : null
    const livro = f ? fx(f, 'L/min') : `≥ ${OBSTRUIDO.fluxoMin} L/min`
    if (!valido(a.fluxoLMin)) linhas.push({ parametro: 'Fluxo inspiratório', valor: '—', livro, estado: 'vazio', pagina: pag })
    else linhas.push({ parametro: 'Fluxo inspiratório', valor: `${a.fluxoLMin} L/min`, livro, estado: f ? (dentro(a.fluxoLMin, f) ? 'ok' : 'fora') : a.fluxoLMin >= OBSTRUIDO.fluxoMin ? 'ok' : 'fora', pagina: pag })
    if (tinsCalculadoS !== null && q !== 'inicial') {
      const max = q === 'obstruido' ? OBSTRUIDO.tinsMax : SDRA.tinsMax
      linhas.push({ parametro: 'Tempo inspiratório (VC ÷ fluxo)', valor: `${n2(tinsCalculadoS)} s`, livro: `≤ ${n1(max)} s`, estado: tinsCalculadoS <= max + 1e-9 ? 'ok' : 'fora', pagina: pag })
    }
  }

  // relação I:E
  const ie = valido(a.fr) && tinsCalculadoS !== null && modo !== 'psv' ? relacaoIE(a.fr, tinsCalculadoS) : null
  if (modo !== 'psv') {
    const livroIe = q === 'inicial' ? '1:2 ou 1:3' : q === 'obstruido' ? '≥ 1:3 e não além de 1:5' : '≥ 1:2 (permitir o esvaziamento)'
    if (!ie) linhas.push({ parametro: 'Relação I:E', valor: valido(a.fr) && tinsCalculadoS !== null ? 'Tins maior que o ciclo' : '—', livro: livroIe, estado: valido(a.fr) && tinsCalculadoS !== null ? 'fora' : 'vazio', pagina: pag })
    else {
      const n = ie.n
      const ok = q === 'inicial' ? n >= AJUSTE_INICIAL.ie[0] - 1e-9 && n <= AJUSTE_INICIAL.ie[1] + 1e-9 : q === 'obstruido' ? n >= OBSTRUIDO.ieMinimo - 1e-9 && n <= OBSTRUIDO.ieEvitarAcima + 1e-9 : n >= SDRA.ieMinimo - 1e-9
      linhas.push({ parametro: 'Relação I:E', valor: `1:${n1(n)} (Te ${n2(ie.teS)} s)`, livro: livroIe, estado: ok ? 'ok' : 'fora', nota: q === 'obstruido' && n > OBSTRUIDO.ieEvitarAcima ? 'p. 505: evita-se I:E > 1:5 (risco de retenção de CO2).' : undefined, pagina: q === 'obstruido' ? 'Tabela 4 e p. 505' : pag })
    }
  }

  // PEEP
  if (q === 'sdra') {
    const tab = e.tabelaPeep ?? (e.classe ? tabelaPeepSdra(e.classe) : 'baixo')
    const fio2 = valido(a.fio2Pct) ? a.fio2Pct / 100 : undefined
    const leitura = fio2 !== undefined ? peepParaFio2(tab, fio2) : null
    const livro = leitura && leitura.exatas.length
      ? `${TABELAS_PEEP[tab].nome}: FiO2 ${n1(fio2! * 100)}% → PEEP ${leitura.exatas.map((c) => (c.peep[0] === c.peep[1] ? c.peep[0] : `${c.peep[0]}–${c.peep[1]}`)).join(' ou ')}`
      : leitura ? `${TABELAS_PEEP[tab].nome}: FiO2 sem coluna exata (a tabela não interpola)` : `${TABELAS_PEEP[tab].nome} pela FiO2`
    if (!naoNeg(a.peep) || a.peep === 0) linhas.push({ parametro: 'PEEP', valor: '—', livro, estado: 'vazio', pagina: TABELAS_PEEP[tab].pagina })
    else {
      const bate = leitura?.exatas.some((c) => a.peep! >= c.peep[0] - 1e-9 && a.peep! <= c.peep[1] + 1e-9)
      linhas.push({ parametro: 'PEEP', valor: `${a.peep} cmH2O`, livro, estado: leitura && leitura.exatas.length ? (bate ? 'ok' : 'fora') : 'sem-faixa', pagina: TABELAS_PEEP[tab].pagina })
    }
  } else if (q === 'obstruido' && valido(a.autoPeep)) {
    const alvo = a.autoPeep * OBSTRUIDO.fracaoAutoPeep
    linhas.push({ parametro: 'PEEP', valor: naoNeg(a.peep) && a.peep > 0 ? `${a.peep} cmH2O` : '—', livro: `85% da auto-PEEP medida = ${n1(alvo)} cmH2O`, estado: naoNeg(a.peep) && a.peep > 0 ? (Math.abs(a.peep - alvo) < 0.5 ? 'ok' : 'fora') : 'vazio', pagina: 'Tabela 4, p. 505' })
  } else {
    const f = q === 'inicial' ? AJUSTE_INICIAL.peep : OBSTRUIDO.peep
    if (!naoNeg(a.peep) || a.peep === 0) linhas.push({ parametro: 'PEEP', valor: '—', livro: `${fx(f, 'cmH2O')} inicialmente`, estado: 'vazio', pagina: pag })
    else linhas.push({ parametro: 'PEEP', valor: `${a.peep} cmH2O`, livro: `${fx(f, 'cmH2O')} inicialmente${q === 'obstruido' ? ' (ou 85% da auto-PEEP)' : ', ajuste conforme necessário'}`, estado: dentro(a.peep, f) ? 'ok' : 'fora', pagina: pag })
  }

  // FiO2
  if (valido(a.fio2Pct)) {
    const texto = q === 'inicial' ? 'inicialmente 100%, depois pela SatO2 93–97%' : `pela SatO2 (${ALVO_SAT[q].texto})`
    linhas.push({ parametro: 'FiO2', valor: `${n1(a.fio2Pct)}%`, livro: texto, estado: a.fio2Pct > 100 || a.fio2Pct < 21 ? 'fora' : 'sem-faixa', nota: a.fio2Pct > 100 || a.fio2Pct < 21 ? 'FiO2 entre 21 e 100%.' : undefined, pagina: pag })
  } else linhas.push({ parametro: 'FiO2', valor: '—', livro: q === 'inicial' ? 'inicialmente 100%' : `pela SatO2 (${ALVO_SAT[q].texto})`, estado: 'vazio', pagina: pag })

  return { linhas, ie, tinsCalculadoS, vtAlvoMl }
}

// ---------------------------------------------------------------- passo 4

export type Medidas = { ppico?: number; pplato?: number; peep?: number; autoPeep?: number; ph?: number; paco2?: number; pao2?: number; fio2Pct?: number; sat?: number }

/** Passo 4: números da checagem contra os limites da tabela do quadro e os cortes do capítulo. */
export function lerAcompanhamento(q: QuadroVm, m: Medidas): string[] {
  const r: string[] = []
  if (valido(m.pplato) && m.pplato > 30) r.push(`Pplatô ${m.pplato} cmH2O — acima de 30 (${q === 'inicial' ? 'Tabelas 4 e 5, p. 505–506' : ALARMES_LIVRO[q][0].pagina})`)
  if (valido(m.pplato) && naoNeg(m.peep) && m.pplato >= m.peep && m.pplato - m.peep > 15) r.push(`Driving pressure ${n1(m.pplato - m.peep)} cmH2O — acima de 15 (p. 506)`)
  if (valido(m.ppico) && m.ppico > OBSTRUIDO.picoMax && q === 'obstruido') r.push(`Ppico ${m.ppico} cmH2O — acima de 45 (Tabela 4: evitar)`)
  if (valido(m.autoPeep) && naoNeg(m.peep)) r.push(`Auto-PEEP informada: ${n1(m.autoPeep)} cmH2O (pausa expiratória com PEEP aferida maior que a regulada, p. 504)`)
  if (valido(m.ph)) {
    if (q !== 'inicial' && m.ph <= 7.2) r.push(`pH ${n2(m.ph)} — o livro tolera hipercapnia só com pH > 7,2 (p. ${q === 'obstruido' ? '505' : '507'})`)
    if (q === 'inicial' && m.ph <= 7.2) r.push(`pH ${n2(m.ph)} — a Figura 4 (p. 509) tolera pH mais baixo em obstruídos ou SDRA se pH > 7,2`)
  }
  const alvo = ALVO_SAT[q]
  if (valido(m.sat)) {
    if (alvo.faixa && (m.sat < alvo.faixa[0] || m.sat > alvo.faixa[1])) r.push(`SatO2 ${m.sat}% — fora de ${alvo.texto} (${alvo.pagina})`)
    if (alvo.acima !== null && m.sat <= alvo.acima) r.push(`SatO2 ${m.sat}% — o alvo é ${alvo.texto} (${alvo.pagina})`)
  }
  return r
}

/** Rótulos dos passos, na ordem do protótipo. */
export const PASSOS_VM = ['Quem', 'Modo', 'Ajustes', 'Acompanhar', 'Desmamar'] as const
