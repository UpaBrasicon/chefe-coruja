import { fichaAdulto } from './fonte.ts'
import { INFUSOES_ADULTO, concentracao } from './infusoes.ts'
import { esquemaAmiodarona, type Faixa } from './pcr.ts'

// Cuidados pós-parada cardíaca do adulto — Manual de Medicina de Emergência do
// HCFMUSP (3ª ed., 2022), cap. 6, p. 98–113. Metas numéricas, controle de
// temperatura (volume de SF a 4 °C, tempo de resfriamento e de reaquecimento),
// amiodarona na tempestade elétrica e janelas do neuroprognóstico. A
// ferramenta posiciona o valor e faz a conta; a decisão é do médico (ADR 0007).

export const fichaPosPcrAdulto = fichaAdulto('adulto-pos-pcr', 'Cuidados pós-PCR — metas, temperatura e prognóstico (adulto)', 'cap. 6 Cuidados pós-parada cardíaca, p. 98–113')

const valido = (x: number) => Number.isFinite(x) && x > 0
const vezes = (f: Faixa, k: number): Faixa => [f[0] * k, f[1] * k]

// ── Metas (p. 105–106, 108, 111) ────────────────────────────────────────────

export type Meta = { id: string; parametro: string; meta: string; pagina: string }

export const METAS_POS_PCR: Meta[] = [
  { id: 'paco2', parametro: 'PaCO2', meta: 'aproximadamente 40 mmHg (normocapnia)', pagina: 'p. 105' },
  { id: 'etco2', parametro: 'EtCO2', meta: '35 mmHg', pagina: 'p. 105' },
  { id: 'sato2', parametro: 'SatO2', meta: '> 94%', pagina: 'p. 105' },
  { id: 'pao2', parametro: 'PaO2', meta: 'evitar hiperóxia prolongada (PaO2 > 300 mmHg)', pagina: 'p. 105' },
  { id: 'pam', parametro: 'PAM', meta: '> 65 mmHg, de preferência 80–100 mmHg', pagina: 'p. 106' },
  { id: 'glicemia', parametro: 'Glicemia', meta: '140–180 mg/dL; sem indicação de controle intensivo (70–108 mg/dL)', pagina: 'p. 111' },
  { id: 'temperatura', parametro: 'Temperatura central', meta: 'controle ativo com alvo entre 32–36 °C; CT < 36 °C; HT 32–34 °C; por pelo menos 24 h, idealmente 48 h após o RCE', pagina: 'p. 108–109' },
]

export type Leitura = { id: string; texto: string; fora: boolean }

/** Posiciona cada valor informado em relação à meta do livro. */
export function lerMetas(v: { paco2?: number; sato2?: number; pao2?: number; pam?: number; glicemia?: number }): Leitura[] {
  const r: Leitura[] = []
  if (v.paco2 !== undefined && valido(v.paco2)) r.push({ id: 'paco2', texto: `PaCO2 ${v.paco2} mmHg — o livro dá "aproximadamente 40 mmHg", sem faixa`, fora: false })
  if (v.sato2 !== undefined && valido(v.sato2)) r.push({ id: 'sato2', texto: v.sato2 > 94 ? `SatO2 ${v.sato2}% — acima de 94%` : `SatO2 ${v.sato2}% — não está acima de 94%`, fora: v.sato2 <= 94 })
  if (v.pao2 !== undefined && valido(v.pao2)) r.push({ id: 'pao2', texto: v.pao2 > 300 ? `PaO2 ${v.pao2} mmHg — acima de 300 (hiperóxia no livro)` : `PaO2 ${v.pao2} mmHg — não passa de 300`, fora: v.pao2 > 300 })
  if (v.pam !== undefined && valido(v.pam)) {
    const t = v.pam <= 65 ? 'não está acima de 65' : v.pam >= 80 && v.pam <= 100 ? 'acima de 65 e dentro de 80–100' : 'acima de 65, fora da preferência de 80–100'
    r.push({ id: 'pam', texto: `PAM ${v.pam} mmHg — ${t}`, fora: v.pam <= 65 })
  }
  if (v.glicemia !== undefined && valido(v.glicemia)) {
    const dentro = v.glicemia >= 140 && v.glicemia <= 180
    r.push({ id: 'glicemia', texto: `Glicemia ${v.glicemia} mg/dL — ${dentro ? 'dentro de 140–180' : v.glicemia < 140 ? 'abaixo de 140' : 'acima de 180'}`, fora: !dentro })
  }
  return r
}

// ── Temperatura (p. 106, 108–110) ───────────────────────────────────────────

export const SF_FRIO = { mlKg: [20, 30] as Faixa, temperaturaC: 4, minutos: 30, referencia: '1 L em 15 min reduz a temperatura central em aproximadamente 1 °C', pagina: 'p. 106 e 110' }

export type SfFrio = { volumeMl: Faixa; mlH: Faixa; litros: Faixa }

/** SF 0,9% a 4 °C, 20–30 mL/kg em 30 min (p. 110): volume e velocidade. */
export function sfFrio(pesoKg: number): SfFrio | null {
  if (!valido(pesoKg)) return null
  const v = vezes(SF_FRIO.mlKg, pesoKg)
  return { volumeMl: v, mlH: vezes(v, 60 / SF_FRIO.minutos), litros: vezes(v, 1 / 1000) }
}

export const RESFRIAMENTO_EXTERNO_C_H: Faixa = [0.5, 1] // p. 110

/** Horas para ir da temperatura atual ao alvo com resfriamento externo (0,5–1 °C/h): [mais rápido, mais lento]. */
export function horasResfriamentoExterno(atual: number, alvo: number): Faixa | null {
  if (!valido(atual) || !valido(alvo) || alvo >= atual) return null
  const d = atual - alvo
  return [d / RESFRIAMENTO_EXTERNO_C_H[1], d / RESFRIAMENTO_EXTERNO_C_H[0]]
}

export const REAQUECIMENTO = { alvoCh: 0.25, maximoCh: 0.5, aposHorasHT: 24, pagina: 'p. 110' }

export type Reaquecimento = { horasNoAlvo: number; horasMinimas: number; graus: number }

/**
 * Reaquecimento após 24 h de HT: alvo de 0,25 °C/h, sem exceder 0,5 °C/h
 * (p. 110). A temperatura final é informada: o texto só cita 36 °C na Tabela 3
 * (reaquecimento por sangramento maior, p. 111).
 */
export function reaquecimento(atual: number, final: number): Reaquecimento | null {
  if (!valido(atual) || !valido(final) || final <= atual) return null
  const g = final - atual
  return { graus: g, horasNoAlvo: g / REAQUECIMENTO.alvoCh, horasMinimas: g / REAQUECIMENTO.maximoCh }
}

/** Velocidade de reaquecimento observada, e se passa do teto de 0,5 °C/h. */
export function velocidadeReaquecimento(de: number, para: number, horas: number): { cH: number; acimaDoTeto: boolean } | null {
  if (!valido(de) || !valido(para) || !valido(horas)) return null
  const cH = (para - de) / horas
  return { cH, acimaDoTeto: cH > REAQUECIMENTO.maximoCh }
}

// ── Hemodinâmica e arritmia (p. 106–107) ────────────────────────────────────

export const MILRINONA_ATAQUE = { ugKg: 50, minutos: 10, manutUgKgMin: [0.375, 0.75] as Faixa, dobutaminaUgKgMin: [2, 20] as Faixa, pagina: 'p. 106' }

const milrinonaAnexo = () => INFUSOES_ADULTO.find((i) => i.id === 'milrinona')!

/**
 * Milrinona: ataque de 50 µg/kg em 10 min (p. 106). O volume usa o preparo do
 * Anexo 1 (200 µg/mL, p. 1489): o capítulo não traz preparo próprio.
 */
export function milrinonaAtaque(pesoKg: number): { ug: number; ml: number; mlH10min: number } | null {
  if (!valido(pesoKg)) return null
  const ug = MILRINONA_ATAQUE.ugKg * pesoKg
  const ml = ug / concentracao(milrinonaAnexo())
  return { ug, ml, mlH10min: ml * (60 / MILRINONA_ATAQUE.minutos) }
}

export const AMIODARONA_TEMPESTADE = { impregnacaoG: [10, 15] as Faixa, voMgDia: [200, 400] as Faixa, pagina: 'p. 107' }

/** Tempestade elétrica: mesmo esquema do cap. 18 (150 mg + 1 mg/min × 6 h + 0,5 mg/min × 18 h), com o saldo até a impregnação. */
export function amiodaronaTempestade(acumuladoMg?: number) {
  const esquema = esquemaAmiodarona()
  const acumulado = acumuladoMg !== undefined && Number.isFinite(acumuladoMg) && acumuladoMg >= 0 ? acumuladoMg : undefined
  const saldo: Faixa | null = acumulado === undefined ? null : [Math.max(0, AMIODARONA_TEMPESTADE.impregnacaoG[0] * 1000 - acumulado), Math.max(0, AMIODARONA_TEMPESTADE.impregnacaoG[1] * 1000 - acumulado)]
  return { esquema, saldoAteImpregnacaoMg: saldo }
}

// ── Neuroprognóstico e exames (p. 101, 111–112) ─────────────────────────────

export type Janela = { id: string; texto: string; aPartirDeH: number; ateH?: number; pagina: string }

export const JANELAS_POS_RCE: Janela[] = [
  { id: 'tc', texto: 'TC de crânio após 24 h do RCE', aPartirDeH: 24, pagina: 'p. 112' },
  { id: 'pess', texto: 'Potencial evocado somatossensorial só após 48 h do reaquecimento (ou da PCR, se não houve HT)', aPartirDeH: 48, pagina: 'p. 112' },
  { id: 'exame', texto: 'Exame neurológico com maior acurácia só após 72 h do RCE (reflexos corneanos e pupilares, resposta motora no 3º dia)', aPartirDeH: 72, pagina: 'p. 112' },
  { id: 'rm', texto: 'RM de crânio em 3–5 dias se a TC não trouxer dados', aPartirDeH: 72, ateH: 120, pagina: 'p. 112' },
]

/**
 * Janelas atingidas pelo tempo decorrido. A contagem do PESS é a partir do
 * reaquecimento quando houve HT: informe as horas desde o marco certo.
 */
export function janelasAtingidas(horas: number): { janela: Janela; atingida: boolean }[] | null {
  if (!Number.isFinite(horas) || horas < 0) return null
  return JANELAS_POS_RCE.map((j) => ({ janela: j, atingida: horas >= j.aPartirDeH && (j.ateH === undefined || horas <= j.ateH) }))
}

export const PROGNOSTICO_TEXTO = [
  'Nenhum achado precoce (< 24 h) é confiável, nem no paciente sedado (p. 111).',
  'EEG maligno: supressão completa, surto-supressão, complexos periódicos generalizados, baixa voltagem (< 10 µV), crises, não reação a estímulo, padrão alfa-theta (p. 112).',
  'Ausência de potenciais evocados bilateralmente após 48 a 72 h: a ferramenta auxiliar mais útil segundo o livro (p. 112).',
  'Com HT a predição é incerta; no caso de dúvida, o livro orienta aguardar (p. 112).',
]

export const MONITORIZACAO = [
  { texto: 'Gasometria arterial com lactato de 6/6 h', pagina: 'Tabela 1, p. 101' },
  { texto: 'Eletrólitos de 6/6 h enquanto houver controle de temperatura ou reaquecimento; de 4/4 h na HT', pagina: 'Tabela 1, p. 101; Tabela 3, p. 111' },
  { texto: 'Troponina a cada 8 ou 12 h nas primeiras 24 h; PCR, desfibrilação e compressões podem elevar a troponina I discretamente (0–5 ng/mL)', pagina: 'Tabela 1, p. 102' },
  { texto: 'Leucocitose entre 10–20 mil é comum', pagina: 'Tabela 1, p. 102' },
  { texto: 'Temperatura central contínua: venosa central, depois esofágica, vesical e retal; não usar axilar nem timpânica', pagina: 'p. 110' },
]
