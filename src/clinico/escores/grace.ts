import { completo, numero, somar, type Escore } from '../escore.ts'

// GRACE (mortalidade hospitalar): idade, FC, PAS e creatinina por faixa, mais
// Killip, parada, desvio de ST e marcador. Porte do protótipo
// (cardiologia/GRACE, construído em 29/08/2026; o protótipo marca a tabela de
// pontos por faixa como pendente de revisão clínica). Saíram (ADR 0007) a
// linha "estratégia sugerida pela diretriz" e o cuidado "levam a cateterismo
// imediato": fica o total, a faixa e a mortalidade da faixa.

type Tabela = [number, number][]

/** Pontos da primeira faixa em que x fica abaixo do limite (como no protótipo). */
const faixa = (x: number, tab: Tabela) => {
  for (const [limite, pontos] of tab) if (x < limite) return pontos
  return tab[tab.length - 1][1]
}

const IDADE: Tabela = [[30, 0], [40, 8], [50, 25], [60, 41], [70, 58], [80, 75], [90, 91], [Infinity, 100]]
const FC: Tabela = [[50, 0], [70, 3], [90, 9], [110, 15], [150, 24], [200, 38], [Infinity, 46]]
const PAS: Tabela = [[80, 58], [100, 53], [120, 43], [140, 34], [160, 24], [200, 10], [Infinity, 0]]
const CR: Tabela = [[0.4, 1], [0.8, 4], [1.2, 7], [1.6, 10], [2, 13], [4, 21], [Infinity, 28]]

const NAO_SIM = (pontos: number) => [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: pontos }]

export const grace: Escore = {
  ficha: {
    id: 'grace',
    titulo: 'GRACE — risco na síndrome coronariana aguda',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Granger CB, Goldberg RJ, Dabbous O, et al. Predictors of hospital mortality in the Global Registry of Acute Coronary Events. Arch Intern Med. 2003;163(19):2345–2353.', url: 'https://doi.org/10.1001/archinte.163.19.2345' },
      { citacao: 'Byrne RA, Rossello X, Coughlan JJ, et al. 2023 ESC Guidelines for the management of acute coronary syndromes. Eur Heart J. 2023;44(38):3720–3826.', url: 'https://doi.org/10.1093/eurheartj/ehad191' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Mortalidade hospitalar na síndrome coronariana aguda por oito variáveis da admissão',
  itens: [
    { tipo: 'numero', id: 'idade', rotulo: 'Idade', unidade: 'anos', min: 0, max: 130, passo: 1 },
    { tipo: 'numero', id: 'fc', rotulo: 'Frequência cardíaca', unidade: 'bpm', min: 0, max: 350, passo: 1 },
    { tipo: 'numero', id: 'pas', rotulo: 'Pressão sistólica', unidade: 'mmHg', min: 0, max: 350, passo: 1 },
    { tipo: 'numero', id: 'cr', rotulo: 'Creatinina', unidade: 'mg/dL', min: 0.05, max: 30, passo: 0.01, ajuda: 'A da admissão.' },
    { tipo: 'escolha', id: 'killip', rotulo: 'Classe de Killip', opcoes: [
      { rotulo: 'I — sem congestão', valor: 0 }, { rotulo: 'II — estertores ou terceira bulha', valor: 20 },
      { rotulo: 'III — edema agudo de pulmão', valor: 39 }, { rotulo: 'IV — choque cardiogênico', valor: 59 },
    ] },
    { tipo: 'escolha', id: 'parada', rotulo: 'Parada cardíaca na admissão', opcoes: NAO_SIM(39) },
    { tipo: 'escolha', id: 'st', rotulo: 'Desvio do segmento ST', opcoes: NAO_SIM(28) },
    { tipo: 'escolha', id: 'marcador', rotulo: 'Marcador de necrose elevado', opcoes: NAO_SIM(14) },
  ],
  calcular(r) {
    if (!completo(grace, r)) return null
    const pIdade = faixa(numero(grace, r, 'idade')!, IDADE)
    const pFc = faixa(numero(grace, r, 'fc')!, FC)
    const pPas = faixa(numero(grace, r, 'pas')!, PAS)
    const pCr = faixa(numero(grace, r, 'cr')!, CR)
    const pSel = somar(grace, r)
    const total = pIdade + pFc + pPas + pCr + pSel
    const banda = total > 140 ? 2 : total >= 109 ? 1 : 0
    return {
      rotulo: 'GRACE',
      valor: String(total),
      unidade: 'pontos',
      nota: ['baixo risco — mortalidade hospitalar abaixo de 1%', 'risco intermediário — mortalidade de 1 a 3%', 'alto risco — mortalidade acima de 3%'][banda],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Idade', pIdade + ' pontos'],
        ['Frequência cardíaca', pFc + ' pontos'],
        ['Pressão sistólica', pPas + ' pontos'],
        ['Creatinina', pCr + ' pontos'],
        ['Killip, parada, ST e marcador', pSel + ' pontos'],
        ['Faixa', ['até 108 pontos', '109 a 140 pontos', 'acima de 140 pontos'][banda]],
      ],
      cuidados: [
        'As faixas de 108 e 140 pontos são do modelo de mortalidade hospitalar. O modelo de 6 meses tem outras faixas.',
        'Creatinina em mg/dL. O registro original usa a mesma unidade; conferir a do laboratório antes de digitar.',
        'O escore foi derivado dos valores de chegada: recalcular após a estabilização não é GRACE.',
        'É um modelo de mortalidade, não uma contagem de gravidade clínica: pressão sistólica baixa e parada na admissão pesam mais que o marcador elevado.',
      ],
    }
  },
}
