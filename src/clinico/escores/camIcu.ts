import { completo, escolha, type Escore } from '../escore.ts'

// CAM-ICU: regra lógica, não soma — característica 1 E 2, mais 3 OU 4.
// Porte do protótipo (neurologia/CAM-ICU, construído em 29/08/2026). Saíram
// (ADR 0007) "reavaliar quando o paciente despertar", "busca de causa" e o
// cuidado sobre antipsicótico: fica o resultado pela definição.
// Com RASS −4 ou −5 o resultado é "não avaliável" mesmo sem as quatro
// características respondidas (no protótipo o RASS decide antes de tudo).

const AUSENTE_PRESENTE = [{ rotulo: 'Ausente', valor: 0 }, { rotulo: 'Presente', valor: 1 }]

export const camIcu: Escore = {
  ficha: {
    id: 'cam-icu',
    titulo: 'CAM-ICU — delirium no paciente crítico',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Ely EW, Inouye SK, Bernard GR, et al. Delirium in mechanically ventilated patients: validity and reliability of the confusion assessment method for the intensive care unit (CAM-ICU). JAMA. 2001;286(21):2703–2710.', url: 'https://doi.org/10.1001/jama.286.21.2703' },
      { citacao: 'Devlin JW, Skrobik Y, Gélinas C, et al. Clinical Practice Guidelines for the Prevention and Management of Pain, Agitation/Sedation, Delirium, Immobility, and Sleep Disruption in Adult Patients in the ICU. Crit Care Med. 2018;46(9):e825–e873.', url: 'https://doi.org/10.1097/CCM.0000000000003299' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Delirium no paciente crítico por quatro características, incluindo o intubado',
  itens: [
    { tipo: 'escolha', id: 'rass', rotulo: 'RASS no momento da avaliação', opcoes: [
      { rotulo: '−3 a +4 — avaliável', valor: 1 }, { rotulo: '−4 ou −5 — não avaliável', valor: 0 },
    ] },
    { tipo: 'escolha', id: 'c1', rotulo: '1 — Início agudo ou curso flutuante', opcoes: AUSENTE_PRESENTE },
    { tipo: 'escolha', id: 'c2', rotulo: '2 — Desatenção (erros no teste de letras ou figuras)', opcoes: [
      { rotulo: 'Menos de 3 erros', valor: 0 }, { rotulo: '3 erros ou mais', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'c3', rotulo: '3 — Nível de consciência alterado (RASS diferente de zero)', opcoes: [
      { rotulo: 'RASS zero', valor: 0 }, { rotulo: 'RASS diferente de zero', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'c4', rotulo: '4 — Pensamento desorganizado (erros nas perguntas e no comando)', opcoes: [
      { rotulo: 'Até 1 erro', valor: 0 }, { rotulo: 'Mais de 1 erro', valor: 1 },
    ] },
  ],
  calcular(r) {
    if (escolha(camIcu, r, 'rass')?.valor === 0) {
      return {
        rotulo: 'CAM-ICU',
        valor: 'Não avaliável',
        nota: 'RASS de −4 ou −5',
        estado: 1,
        derivados: [['Motivo', 'coma ou sedação profunda impedem a avaliação de atenção e pensamento']],
        cuidados: ['Em coma ou sedação profunda o resultado é "não avaliável", não negativo — registrar negativo nesse paciente é o erro que faz o delirium passar.'],
      }
    }
    if (!completo(camIcu, r)) return null
    const [c1, c2, c3, c4] = ['c1', 'c2', 'c3', 'c4'].map((id) => escolha(camIcu, r, id)!.valor === 1)
    const positivo = c1 && c2 && (c3 || c4)
    const presentes = [c1, c2, c3, c4].filter(Boolean).length
    return {
      rotulo: 'CAM-ICU',
      valor: positivo ? 'Delirium presente' : 'Delirium ausente',
      nota: positivo ? 'características 1 e 2 presentes, com 3 ou 4' : 'a combinação exigida pela definição não está presente',
      estado: positivo ? 2 : 0,
      derivados: [
        ['Características presentes', presentes + ' de 4'],
        ['Regra', '1 e 2 obrigatórias, mais 3 ou 4'],
        ['Subtipo, se positivo', positivo ? (c3 ? 'pelo sinal do RASS: negativo indica hipoativo, positivo indica hiperativo' : 'RASS zero com pensamento desorganizado') : '—'],
      ],
      alerta: !positivo && presentes >= 2 && !c2
        ? 'Há características presentes, mas sem desatenção não há delirium pela definição.'
        : undefined,
      cuidados: [
        'A conta não é somar: é característica 1 E 2, mais 3 OU 4.',
        'O delirium flutua: um resultado negativo vale para o momento da avaliação, não para o turno seguinte.',
        'Sedação recente derruba a atenção e pode produzir falso positivo.',
      ],
    }
  },
}
