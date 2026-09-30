// qSOFA calculado dos sinais vitais do leito (adulto).
//
// Fonte: Seymour CW, Liu VX, Iwashyna TJ et al. Assessment of Clinical
// Criteria for Sepsis: For the Third International Consensus Definitions for
// Sepsis and Septic Shock (Sepsis-3). JAMA 2016;315(8):762-774 — um ponto para
// cada: frequência respiratória ≥ 22/min, alteração do estado mental
// (Glasgow < 15) e pressão sistólica ≤ 100 mmHg; 2 ou mais = maior risco de
// desfecho ruim no paciente com infecção suspeita.
//
// Uso aqui: SINAL DE ALERTA ao lado do NEWS2, não rastreio isolado. A
// Surviving Sepsis Campaign recomenda contra o qSOFA como ferramenta única de
// rastreio, em favor de NEWS/NEWS2, MEWS ou SIRS (é a posição do pacote, em
// escores/news2.ts e escores/sepseAdulto.ts). Não se aplica a criança.
//
// Estado mental: Glasgow abaixo de 15, ou nível de consciência registrado
// diferente de "Alerta" (Confuso, Sonolento ou Coma, a escala do leito). O
// que não foi medido não soma ponto e deixa o resultado parcial.

export type EntradaQsofa = {
  /** Frequência respiratória, irpm. */
  fr?: number | null
  /** Pressão arterial sistólica, mmHg. */
  pas?: number | null
  /** Escala de coma de Glasgow, 3–15. */
  glasgow?: number | null
  /** Código do nível de consciência do leito: A (alerta), C, S, K. */
  consciencia?: string | null
}

export type ItemQsofa = {
  id: 'fr' | 'mental' | 'pas'
  rotulo: string
  /** O valor que decidiu o item, como se lê na tela; null se não medido. */
  valor: string | null
  pontos: 0 | 1
  medido: boolean
}

export type ResultadoQsofa = {
  total: number
  itens: ItemQsofa[]
  faltando: string[]
  parcial: boolean
  /** 2 pontos ou mais. */
  alerta: boolean
  texto: string
}

export const FONTE_QSOFA =
  'qSOFA: Seymour CW et al., JAMA 2016;315(8):762-774 (Sepsis-3). Sinal de alerta, não rastreio isolado: a Surviving Sepsis Campaign recomenda NEWS/NEWS2, MEWS ou SIRS em vez do qSOFA como ferramenta única.'

const CONSCIENCIA: Record<string, string> = { A: 'Alerta', C: 'Confuso', S: 'Sonolento', K: 'Coma' }
const num = (x: number | null | undefined): x is number => typeof x === 'number' && Number.isFinite(x)
const br = (x: number) => String(x).replace('.', ',')

export function qsofa(e: EntradaQsofa): ResultadoQsofa {
  const itens: ItemQsofa[] = []

  itens.push(
    num(e.fr)
      ? { id: 'fr', rotulo: 'FR ≥ 22', valor: `${br(e.fr)} irpm`, pontos: e.fr >= 22 ? 1 : 0, medido: true }
      : { id: 'fr', rotulo: 'FR ≥ 22', valor: null, pontos: 0, medido: false },
  )

  const temGlasgow = num(e.glasgow)
  const codigo = e.consciencia ? e.consciencia.trim().toUpperCase() : ''
  const temConsciencia = codigo !== ''
  if (temGlasgow || temConsciencia) {
    const alteradoGlasgow = temGlasgow && (e.glasgow as number) < 15
    const alteradoConsciencia = temConsciencia && codigo !== 'A'
    const valor = alteradoGlasgow || !temConsciencia
      ? `Glasgow ${e.glasgow}`
      : CONSCIENCIA[codigo] ?? codigo
    itens.push({ id: 'mental', rotulo: 'Estado mental alterado', valor, pontos: alteradoGlasgow || alteradoConsciencia ? 1 : 0, medido: true })
  } else {
    itens.push({ id: 'mental', rotulo: 'Estado mental alterado', valor: null, pontos: 0, medido: false })
  }

  itens.push(
    num(e.pas)
      ? { id: 'pas', rotulo: 'PAS ≤ 100', valor: `${br(e.pas)} mmHg`, pontos: e.pas <= 100 ? 1 : 0, medido: true }
      : { id: 'pas', rotulo: 'PAS ≤ 100', valor: null, pontos: 0, medido: false },
  )

  const total = itens.reduce((s, i) => s + i.pontos, 0)
  const faltando = itens.filter((i) => !i.medido).map((i) => i.rotulo)
  const parcial = faltando.length > 0
  const alerta = total >= 2
  const texto =
    `qSOFA ${total}${parcial ? '*' : ''} de 3` +
    (alerta ? ' · sinal de alerta: avalie sepse (SOFA)' : parcial ? '' : ' · negativo, o que não afasta sepse')
  return { total, itens, faltando, parcial, alerta, texto }
}
