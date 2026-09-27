import { completo, somar, type Escore } from '../escore.ts'

// Child-Pugh com INR: cinco parâmetros de 1 a 3 pontos, classe A/B/C.
// Porte do protótipo (escores/Child-Pugh, construído em 29/08/2026).

const SOBREVIDA = { A: ['100', '85'], B: ['80', '60'], C: ['45', '35'] } as const

export const childPugh: Escore = {
  ficha: {
    id: 'child-pugh',
    titulo: 'Child-Pugh — gravidade da cirrose',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Pugh RNH, Murray-Lyon IM, Dawson JL, et al. Transection of the oesophagus for bleeding oesophageal varices. Br J Surg. 1973;60(8):646–649.', url: 'https://doi.org/10.1002/bjs.1800600817' },
      // No protótipo esta fonte repetia o DOI do Pugh (link errado): fica sem url.
      { citacao: 'Child CG, Turcotte JG. Surgery and portal hypertension. In: The Liver and Portal Hypertension. Philadelphia: Saunders; 1964:50–64.' },
      { citacao: 'European Association for the Study of the Liver. EASL Clinical Practice Guidelines for the management of patients with decompensated cirrhosis. J Hepatol. 2018;69(2):406–460.', url: 'https://doi.org/10.1016/j.jhep.2018.03.024' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Classe A, B ou C, e a sobrevida estimada',
  itens: [
    { tipo: 'escolha', id: 'bb', rotulo: 'Bilirrubina total', opcoes: [
      { rotulo: 'Abaixo de 2 mg/dL', valor: 1 }, { rotulo: '2 a 3 mg/dL', valor: 2 }, { rotulo: 'Acima de 3 mg/dL', valor: 3 },
    ] },
    { tipo: 'escolha', id: 'alb', rotulo: 'Albumina sérica', opcoes: [
      { rotulo: 'Acima de 3,5 g/dL', valor: 1 }, { rotulo: '2,8 a 3,5 g/dL', valor: 2 }, { rotulo: 'Abaixo de 2,8 g/dL', valor: 3 },
    ] },
    { tipo: 'escolha', id: 'inr', rotulo: 'INR', opcoes: [
      { rotulo: 'Abaixo de 1,7', valor: 1 }, { rotulo: '1,7 a 2,3', valor: 2 }, { rotulo: 'Acima de 2,3', valor: 3 },
    ] },
    { tipo: 'escolha', id: 'ascite', rotulo: 'Ascite', opcoes: [
      { rotulo: 'Ausente', valor: 1 }, { rotulo: 'Leve, controlada com diurético', valor: 2 }, { rotulo: 'Moderada a grave, refratária', valor: 3 },
    ] },
    { tipo: 'escolha', id: 'enc', rotulo: 'Encefalopatia hepática', opcoes: [
      { rotulo: 'Ausente', valor: 1 }, { rotulo: 'Grau I a II', valor: 2 }, { rotulo: 'Grau III a IV', valor: 3 },
    ] },
  ],
  calcular(r) {
    if (!completo(childPugh, r)) return null
    const total = somar(childPugh, r)
    const classe = total <= 6 ? 'A' : total <= 9 ? 'B' : 'C'
    const banda = classe === 'C' ? 2 : classe === 'B' ? 1 : 0
    return {
      rotulo: 'Classe de Child-Pugh',
      valor: classe,
      nota: total + ' pontos · ' + ['doença compensada', 'comprometimento funcional significativo', 'doença descompensada'][banda],
      estado: banda,
      derivados: [
        ['Pontos', total + ' de 15'],
        ['Sobrevida em 1 ano', SOBREVIDA[classe][0] + '%'],
        ['Sobrevida em 2 anos', SOBREVIDA[classe][1] + '%'],
        ['Faixa da classe', ['5 a 6 pontos', '7 a 9 pontos', '10 a 15 pontos'][banda]],
      ],
      cuidados: [
        'Ascite e encefalopatia são graduadas por exame clínico, não por exame de sangue. Duas pessoas pontuam diferente o mesmo paciente — é a fraqueza conhecida do escore, e é por isso que o MELD substituiu o Child-Pugh na fila de transplante.',
        'Na cirrose biliar primária e na colangite esclerosante os limites de bilirrubina são outros (abaixo de 4, 4 a 10, acima de 10 mg/dL). Esta tela usa os limites gerais.',
        'O escore original usava o tempo de protrombina prolongado em segundos. Aqui está a versão com INR, que é a de uso corrente.',
        'Os percentuais de sobrevida são aproximações de série histórica e não incorporam o tratamento atual da hepatite viral.',
      ],
    }
  },
}
