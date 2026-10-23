import { completo, escolha, numero, type Escore } from '../escore.ts'

// QT corrigido pela frequência (lacunas da Central, lote 1, 23/10/2026).
// Fórmulas conferidas no texto: Bazett QT/√RR e Fridericia QT/∛RR (Drew 2010,
// AHA/ACCF), Framingham QT + 0,154 × (1 − RR) em segundos (Sagie 1992), Hodges
// QT + 105 × (1/RR − 1) com QT em ms e RR em s (Patel 2016). RR = 60/FC.
// Limiares da AHA/ACCF 2010 (Drew): percentil 99 em 470 ms no homem e 480 ms na
// mulher pós-púberes; acima de 500 ms é muito anormal; aumento de 60 ms ou mais
// sobre o basal pede ação. "QTc" sem outra indicação é o de Bazett (Drew).

export type Qtc = { bazett: number; fridericia: number; framingham: number; hodges: number }

/** QT em ms, FC em batimentos por minuto. */
export function qtc(qtMs: number, fc: number): Qtc | null {
  if (![qtMs, fc].every(Number.isFinite) || qtMs <= 0 || fc <= 0) return null
  const rr = 60 / fc
  return {
    bazett: qtMs / Math.sqrt(rr),
    fridericia: qtMs / Math.cbrt(rr),
    framingham: qtMs + 154 * (1 - rr),
    hodges: qtMs + 105 * (1 / rr - 1),
  }
}

export const qtcAdulto: Escore = {
  ficha: {
    id: 'adulto-qtc',
    titulo: 'QTc — Bazett, Fridericia, Framingham e Hodges (adulto)',
    versao: '2026-10-23.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Drew BJ, Ackerman MJ, Funk M, et al. Prevention of torsade de pointes in hospital settings: a scientific statement from the AHA and ACCF. Circulation. 2010;121(8):1047–1060 (PMID 20142454): Bazett, Fridericia e os limiares (470/480, 500 ms, aumento de 60 ms).', url: 'https://doi.org/10.1161/CIRCULATIONAHA.109.192704' },
      { citacao: 'Sagie A, Larson MG, Goldberg RJ, Bengtson JR, Levy D. An improved method for adjusting the QT interval for heart rate (the Framingham Heart Study). Am J Cardiol. 1992;70(7):797–801 (PMID 1519533).', url: 'https://doi.org/10.1016/0002-9149(92)90562-d' },
      { citacao: 'Patel PJ, Borovskiy Y, Killian A, et al. Optimal QT interval correction formula in sinus tachycardia for identifying cardiovascular and mortality risk. Heart Rhythm. 2016;13(2):527–535 (PMID 26552754): Hodges e Framingham em ms.', url: 'https://doi.org/10.1016/j.hrthm.2015.11.008' },
      { citacao: 'Vandenberk B, Vandael E, Robyns T, et al. Which QT correction formulae to use for QT monitoring? J Am Heart Assoc. 2016;5(6):e003264 (PMID 27317349): Fridericia e Framingham corrigem melhor; Bazett superestima.', url: 'https://doi.org/10.1161/JAHA.116.003264' },
    ],
    revisadoEm: '23/10/2026 (lacunas da Central, lote 1; fórmulas e limiares conferidos no texto da fonte)',
  },
  descricao: 'QT medido e frequência cardíaca. QTc pelas quatro fórmulas, com os limiares da AHA/ACCF 2010.',
  itens: [
    { tipo: 'numero', id: 'qt', rotulo: 'QT medido', unidade: 'ms', min: 200, max: 800, passo: 1 },
    { tipo: 'numero', id: 'fc', rotulo: 'Frequência cardíaca', unidade: 'bpm', min: 20, max: 250, passo: 1 },
    { tipo: 'escolha', id: 'sexo', rotulo: 'Sexo', opcoes: [{ rotulo: 'Feminino', valor: 0 }, { rotulo: 'Masculino', valor: 1 }] },
    { tipo: 'numero', id: 'basal', rotulo: 'QTc basal antes da droga (Bazett)', unidade: 'ms', min: 200, max: 800, passo: 1, opcional: true, ajuda: 'Se houver, para ver o aumento sobre o basal.' },
  ],
  calcular(r) {
    if (!completo(qtcAdulto, r)) return null
    const q = qtc(numero(qtcAdulto, r, 'qt')!, numero(qtcAdulto, r, 'fc')!)
    if (!q) return null
    const mulher = escolha(qtcAdulto, r, 'sexo')!.valor === 0
    const limite = mulher ? 480 : 470
    const b = Math.round(q.bazett)
    const basal = numero(qtcAdulto, r, 'basal')
    const aumento = basal !== undefined ? b - basal : undefined
    const muitoAlto = b > 500 || (aumento !== undefined && aumento >= 60)
    const fc = numero(qtcAdulto, r, 'fc')!
    return {
      rotulo: 'QTc (Bazett)',
      valor: String(b),
      unidade: 'ms',
      nota: b > 500 ? 'acima de 500 ms' : b > limite ? `acima do percentil 99 (${limite} ms ${mulher ? 'na mulher' : 'no homem'})` : `até ${limite} ms`,
      estado: muitoAlto ? 2 : b > limite ? 1 : 0,
      derivados: [
        ['Fridericia', `${Math.round(q.fridericia)} ms`],
        ['Framingham', `${Math.round(q.framingham)} ms`],
        ['Hodges', `${Math.round(q.hodges)} ms`],
        ...(aumento !== undefined ? [['Aumento sobre o basal (Bazett)', `${aumento > 0 ? '+' : ''}${aumento} ms`] as [string, string]] : []),
      ],
      alerta: muitoAlto
        ? 'Na declaração da AHA/ACCF 2010, QTc acima de 500 ms ou aumento de 60 ms ou mais sobre o basal pede ação imediata (risco de torsades).'
        : undefined,
      cuidados: [
        ...(fc > 85 ? ['Com frequência acima de 85 bpm, Bazett superestima o QTc; Fridericia e Framingham corrigem melhor.'] : []),
        'Os limiares de 470 e 480 ms valem para pós-púberes; os pontos de corte por sexo variam entre as fontes.',
        'Bloqueio de ramo novo alarga o QT sem significar QT longo; na fibrilação atrial, a declaração orienta a média do QTc do RR mais curto e do mais longo.',
      ],
    }
  },
}
