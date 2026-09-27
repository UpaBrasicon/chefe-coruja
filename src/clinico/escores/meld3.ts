import { completo, escolha, numero, type Escore } from '../escore.ts'

// MELD 3.0 com MELD-Na e MELD original ao lado. Porte do protótipo
// (gastro/MELD 3.0, construído em 29/08/2026), fórmula, pisos e tetos
// transcritos como estão lá. Saiu (ADR 0007) o "discutir transplante e cuidado
// intensivo" da faixa alta: fica o risco.

const fmt = (x: number) => String(Math.round(x * 100) / 100).replace('.', ',')
const limitar = (x: number) => Math.min(40, Math.max(6, Math.round(x)))
const piso = (x: number) => (x > 1 ? x : 1)

export const meld3: Escore = {
  ficha: {
    id: 'meld-3',
    titulo: 'MELD 3.0 — mortalidade na doença hepática',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Kim WR, Mannalithara A, Heimbach JK, et al. MELD 3.0: The Model for End-Stage Liver Disease Updated for the Modern Era. Gastroenterology. 2021;161(6):1887–1895.', url: 'https://doi.org/10.1053/j.gastro.2021.08.050' },
      { citacao: 'Mazumder NR, Fontana RJ. MELD 3.0 in advanced chronic liver disease. Annu Rev Med. 2024;75:233–245.', url: 'https://doi.org/10.1146/annurev-med-051322-122539' },
      { citacao: 'Kamath PS, Wiesner RH, Malinchoc M, et al. A model to predict survival in patients with end-stage liver disease. Hepatology. 2001;33(2):464–470.', url: 'https://doi.org/10.1053/jhep.2001.22172' },
      { citacao: 'Kim WR, Biggins SW, Kremers WK, et al. Hyponatremia and mortality among patients on the liver-transplant waiting list. N Engl J Med. 2008;359(10):1018–1026.', url: 'https://doi.org/10.1056/NEJMoa0801209' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Mortalidade em 3 meses na doença hepática avançada, com MELD-Na e MELD original para comparação',
  itens: [
    { tipo: 'numero', id: 'bili', rotulo: 'Bilirrubina total', unidade: 'mg/dL', min: 0.1, max: 80, passo: 0.1, ajuda: 'Piso de 1,0 nas três versões.' },
    { tipo: 'numero', id: 'inr', rotulo: 'INR', min: 0.5, max: 20, passo: 0.01, ajuda: 'Piso de 1,0 nas três versões.' },
    { tipo: 'numero', id: 'cr', rotulo: 'Creatinina', unidade: 'mg/dL', min: 0.1, max: 25, passo: 0.01, ajuda: 'MELD 3.0: piso 1,0 e teto 3,0. MELD-Na: teto 4,0.' },
    { tipo: 'numero', id: 'na', rotulo: 'Sódio', unidade: 'mEq/L', min: 90, max: 200, passo: 1, ajuda: 'Limitado entre 125 e 137.' },
    { tipo: 'numero', id: 'alb', rotulo: 'Albumina', unidade: 'g/dL', min: 0.5, max: 8, passo: 0.1, ajuda: 'Só o MELD 3.0 usa. Limitada entre 1,5 e 3,5.' },
    { tipo: 'escolha', id: 'sexo', rotulo: 'Sexo', opcoes: [{ rotulo: 'Masculino', valor: 0 }, { rotulo: 'Feminino', valor: 1 }] },
    { tipo: 'escolha', id: 'dialise', rotulo: 'Diálise', opcoes: [{ rotulo: 'Sem diálise', valor: 0 }, { rotulo: 'Duas ou mais sessões na semana', valor: 1 }] },
  ],
  calcular(r) {
    if (!completo(meld3, r)) return null
    const vBili = numero(meld3, r, 'bili')!
    const vInr = numero(meld3, r, 'inr')!
    const vCr = numero(meld3, r, 'cr')!
    const vNa = numero(meld3, r, 'na')!
    const vAlb = numero(meld3, r, 'alb')!
    const fem = escolha(meld3, r, 'sexo')!.valor === 1
    const dial = escolha(meld3, r, 'dialise')!.valor === 1
    const bili = piso(vBili)
    const inr = piso(vInr)
    const naLim = Math.min(137, Math.max(125, vNa))

    // MELD 3.0 (Kim 2021): creatinina com piso 1,0 e teto 3,0 (diálise força
    // 3,0); albumina limitada entre 1,5 e 3,5; feminino soma 1,33; termos de
    // interação bilirrubina × sódio e albumina × creatinina.
    const cr3 = dial ? 3 : Math.min(Math.max(piso(vCr), 1), 3)
    const alb = Math.min(3.5, Math.max(1.5, vAlb))
    const dNa = 137 - naLim
    const dAlb = 3.5 - alb
    const m3 = limitar((fem ? 1.33 : 0)
      + 4.56 * Math.log(bili)
      + 0.82 * dNa
      - 0.24 * dNa * Math.log(bili)
      + 9.09 * Math.log(inr)
      + 11.14 * Math.log(cr3)
      + 1.85 * dAlb
      - 1.83 * dAlb * Math.log(cr3)
      + 6)

    // MELD original e MELD-Na: creatinina com teto 4,0 (diálise força 4,0).
    const cr4 = dial ? 4 : Math.min(piso(vCr), 4)
    const meld = limitar(3.78 * Math.log(bili) + 11.2 * Math.log(inr) + 9.57 * Math.log(cr4) + 6.43)
    const meldNa = limitar(meld + 1.32 * dNa - 0.033 * meld * dNa)

    const banda = m3 >= 30 ? 2 : m3 >= 20 ? 1 : 0
    const dif = m3 - meldNa
    const pts = (n: number) => n + ' ponto' + (n > 1 ? 's' : '')
    return {
      rotulo: 'MELD 3.0',
      valor: String(m3),
      unidade: 'pontos',
      nota: ['risco baixo', 'risco intermediário', 'risco alto'][banda],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Faixa', ['abaixo de 20', '20 a 29', '30 ou mais'][banda]],
        ['MELD-Na · versão anterior', meldNa + ' pontos'],
        ['MELD original · 2001', meld + ' pontos'],
        ['Diferença do 3.0 em relação ao MELD-Na', (dif >= 0 ? '+' : '') + dif + ' pontos'],
        ['Sexo na conta', fem ? 'feminino · soma 1,33 por desenho da fórmula' : 'masculino · sem acréscimo'],
        ['Creatinina no MELD 3.0', fmt(cr3) + ' mg/dL' + (dial ? ' (diálise força 3,0)' : vCr > 3 ? ' (teto de 3,0)' : vCr < 1 ? ' (piso de 1,0)' : '')],
        ['Albumina na conta', fmt(alb) + ' g/dL' + (vAlb < 1.5 || vAlb > 3.5 ? ' (limitada pela fórmula)' : '')],
        ['Sódio na conta', fmt(naLim) + ' mEq/L' + (vNa < 125 || vNa > 137 ? ' (limitado pela fórmula)' : '')],
      ],
      alerta: dif !== 0
        ? 'O MELD 3.0 dá ' + (dif > 0 ? pts(dif) + ' a MAIS' : pts(-dif) + ' a MENOS') + ' que o MELD-Na neste paciente. Se a fila de transplante da sua referência ainda usa MELD-Na, os dois números não são intercambiáveis.'
        : undefined,
      cuidados: [
        'A OPTN aprovou o MELD 3.0 em substituição ao MELD-Na na alocação de fígado em adultos, incluindo adolescentes de 12 a 17 anos.',
        'Abaixo de 12 anos a referência é o PELD, que é outro escore. Não há validação declarada do MELD 3.0 abaixo de 12 anos, e esta tela não faz PELD.',
        'O MELD 3.0 discriminou melhor que o MELD-Na (estatística C 0,869 contra 0,862) e reclassificou cerca de 9% dos óbitos em fila para uma faixa mais alta.',
        'A pontuação segue limitada entre 6 e 40 nas três versões.',
        'O MELD não vê ascite refratária, encefalopatia nem sangramento varicoso: cirrótico com MELD baixo e complicação grave existe.',
        'A fórmula usa logaritmo natural. Bilirrubina e creatinina em mg/dL, albumina em g/dL — conferir a unidade do laudo.',
      ],
    }
  },
}
