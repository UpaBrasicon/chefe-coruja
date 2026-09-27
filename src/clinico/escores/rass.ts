import { completo, escolha, type Escore } from '../escore.ts'

// RASS: dez níveis, de +4 a −5. Porte do protótipo (neurologia/RASS,
// construído em 29/08/2026). Saíram (ADR 0007) a leitura de conduta por nível
// ("procurar causa antes de sedar", "considerar reduzir a infusão", "exige
// indicação escrita e prazo") e a linha "interrupção diária da sedação
// indicada": fica o nível, a faixa usual de referência e a avaliabilidade do
// CAM-ICU.

const fmt = (x: number) => (x > 0 ? '+' + x : x < 0 ? '−' + Math.abs(x) : '0')

export const rass: Escore = {
  ficha: {
    id: 'rass',
    titulo: 'RASS — escala de agitação e sedação de Richmond',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Sessler CN, Gosnell MS, Grap MJ, et al. The Richmond Agitation-Sedation Scale: validity and reliability in adult intensive care unit patients. Am J Respir Crit Care Med. 2002;166(10):1338–1344.', url: 'https://doi.org/10.1164/rccm.2107138' },
      { citacao: 'Ely EW, Truman B, Shintani A, et al. Monitoring sedation status over time in ICU patients: reliability and validity of the Richmond Agitation-Sedation Scale (RASS). JAMA. 2003;289(22):2983–2991.', url: 'https://doi.org/10.1001/jama.289.22.2983' },
      { citacao: 'Devlin JW, Skrobik Y, Gélinas C, et al. Clinical Practice Guidelines for the Prevention and Management of Pain, Agitation/Sedation, Delirium, Immobility, and Sleep Disruption in Adult Patients in the ICU. Crit Care Med. 2018;46(9):e825–e873.', url: 'https://doi.org/10.1097/CCM.0000000000003299' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Nível de agitação ou sedação, de +4 combativo a −5 sem despertar',
  itens: [
    { tipo: 'escolha', id: 'nivel', rotulo: 'Nível observado', ajuda: 'Observe, depois chame pelo nome, e só então estimule fisicamente.', opcoes: [
      { rotulo: '+4 — combativo, violento, risco para a equipe', valor: 4 },
      { rotulo: '+3 — muito agitado, arranca cateteres, agressivo', valor: 3 },
      { rotulo: '+2 — agitado, movimento frequente sem propósito, briga com o ventilador', valor: 2 },
      { rotulo: '+1 — inquieto, ansioso, sem movimento agressivo', valor: 1 },
      { rotulo: '0 — alerta e calmo', valor: 0 },
      { rotulo: '−1 — sonolento, desperta ao chamado e mantém por mais de 10 segundos', valor: -1 },
      { rotulo: '−2 — sedação leve, desperta ao chamado por menos de 10 segundos', valor: -2 },
      { rotulo: '−3 — sedação moderada, move ou abre os olhos ao chamado, sem contato visual', valor: -3 },
      { rotulo: '−4 — sedação profunda, responde só ao estímulo físico', valor: -4 },
      { rotulo: '−5 — não desperta à voz nem ao estímulo físico', valor: -5 },
    ] },
  ],
  calcular(r) {
    if (!completo(rass, r)) return null
    const n = escolha(rass, r, 'nivel')!.valor
    const banda = n >= 2 || n <= -4 ? 2 : n === 1 || n === -3 ? 1 : 0
    const leitura = n >= 2 ? 'agitação'
      : n === 1 ? 'inquieto'
        : n === 0 ? 'alerta e calmo'
          : n >= -2 ? 'sedação leve · dentro da faixa usual de 0 a −2'
            : n === -3 ? 'sedação moderada · abaixo da faixa usual de 0 a −2'
              : 'sedação profunda'
    return {
      rotulo: 'RASS',
      valor: fmt(n),
      nota: leitura,
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Faixa usual de referência no paciente crítico', '0 a −2'],
        ['CAM-ICU', n <= -4 ? 'não avaliável neste RASS' : 'avaliável — e este valor é a característica 3'],
        ['Distância até o zero', n === 0 ? 'no zero' : Math.abs(n) + (Math.abs(n) === 1 ? ' nível' : ' níveis')],
      ],
      alerta: n >= 3
        ? 'Agitação grave (RASS +3 ou +4). Causas frequentes de agitação no paciente crítico: dor, hipóxia, hipoglicemia, bexiga cheia, abstinência e delirium.'
        : undefined,
      cuidados: [
        'Aplique na ordem: observe, depois chame pelo nome, e só depois estimule ombro ou estímulo doloroso. Pular etapas superestima o nível.',
        'Bloqueio neuromuscular em uso invalida a escala — o paciente não pode responder.',
        'RASS não é escala de dor nem de delirium.',
      ],
    }
  },
}
