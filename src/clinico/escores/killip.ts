import { completo, escolha, type Escore } from '../escore.ts'

// Killip: quatro classes ao exame físico da admissão. Porte do protótipo
// (cardiologia/Killip, construído em 29/08/2026). Saiu (ADR 0007) o alerta
// "reperfusão imediata e suporte hemodinâmico": fica a classe e a mortalidade
// da coorte original.

const MORT = ['', '6%', '17%', '38%', '81%']
const ROMANO = ['', 'I', 'II', 'III', 'IV']

export const killip: Escore = {
  ficha: {
    id: 'killip',
    titulo: 'Killip — classe de congestão no infarto',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Killip T 3rd, Kimball JT. Treatment of myocardial infarction in a coronary care unit: a two year experience with 250 patients. Am J Cardiol. 1967;20(4):457–464.', url: 'https://doi.org/10.1016/0002-9149(67)90023-9' },
      { citacao: 'Ibanez B, James S, Agewall S, et al. 2017 ESC Guidelines for the management of acute myocardial infarction in patients presenting with ST-segment elevation. Eur Heart J. 2018;39(2):119–177.', url: 'https://doi.org/10.1093/eurheartj/ehx393' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Classe de congestão no infarto, de I a IV, pelo exame físico da admissão',
  itens: [
    { tipo: 'escolha', id: 'classe', rotulo: 'Achado ao exame', opcoes: [
      { rotulo: 'I — sem estertores e sem terceira bulha', valor: 1 },
      { rotulo: 'II — estertores em até metade dos campos, ou terceira bulha, ou turgência jugular', valor: 2 },
      { rotulo: 'III — edema agudo de pulmão', valor: 3 },
      { rotulo: 'IV — choque cardiogênico', valor: 4 },
    ] },
  ],
  calcular(r) {
    if (!completo(killip, r)) return null
    const c = escolha(killip, r, 'classe')!.valor
    const banda = c >= 3 ? 2 : c === 2 ? 1 : 0
    return {
      rotulo: 'Killip',
      valor: ROMANO[c],
      unidade: 'de IV',
      nota: 'mortalidade hospitalar de ' + MORT[c] + ' na coorte original',
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Mortalidade hospitalar', MORT[c]],
        ['Entra no TIMI IAMCSST', c >= 2 ? 'sim, 2 pontos' : 'não, 0 ponto'],
      ],
      cuidados: [
        'A classificação é do exame físico na admissão, antes do tratamento. Reclassificar depois do diurético não é Killip.',
        'Os percentuais são da coorte de 1967, anterior à reperfusão. A mortalidade atual é menor em todas as classes; o que se mantém é a ordem entre elas.',
      ],
    }
  },
}
