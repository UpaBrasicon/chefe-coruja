import { completo, numero, somar, type Escore } from '../escore.ts'

// BISAP: cinco itens nas primeiras 24 horas. Porte do protótipo (gastro/BISAP,
// construído em 29/08/2026). Entrada de ureia em mg/dL, convertida em BUN à
// vista (÷ 2,14). Saíram (ADR 0007) "leito monitorizado", a linha "Nível de
// cuidado" e o cuidado de hidratação: ficam os pontos e a mortalidade.

const UREIA_MGDL_PARA_BUN = 2.14
const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const MORT = ['0,1%', '0,5%', '1,9%', '5,3%', '12,7%', '22,5%']
const fmt = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',')

export const bisap: Escore = {
  ficha: {
    id: 'bisap',
    titulo: 'BISAP — gravidade da pancreatite aguda',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Wu BU, Johannes RS, Sun X, et al. The early prediction of mortality in acute pancreatitis: a large population-based study. Gut. 2008;57(12):1698–1703.', url: 'https://doi.org/10.1136/gut.2008.152702' },
      { citacao: 'Banks PA, Bollen TL, Dervenis C, et al. Classification of acute pancreatitis — 2012: revision of the Atlanta classification. Gut. 2013;62(1):102–111.', url: 'https://doi.org/10.1136/gutjnl-2012-302779' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Gravidade da pancreatite aguda nas primeiras 24 horas e mortalidade da coorte original',
  itens: [
    { tipo: 'numero', id: 'ureia', rotulo: 'Ureia', unidade: 'mg/dL', min: 1, max: 600, passo: 1, ajuda: 'Como vem no laudo. A conversão para BUN aparece no resultado; o critério é BUN acima de 25 mg/dL.' },
    { tipo: 'escolha', id: 'mental', rotulo: 'Alteração do estado mental (Glasgow abaixo de 15)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'sirs', rotulo: 'SIRS — dois ou mais critérios', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade acima de 60 anos', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'derrame', rotulo: 'Derrame pleural na imagem', opcoes: NAO_SIM },
  ],
  calcular(r) {
    if (!completo(bisap, r)) return null
    const ureia = numero(bisap, r, 'ureia')!
    const bun = ureia / UREIA_MGDL_PARA_BUN
    const pBun = bun > 25 ? 1 : 0
    const total = pBun + somar(bisap, r)
    const banda = total >= 3 ? 2 : total === 2 ? 1 : 0
    return {
      rotulo: 'BISAP',
      valor: String(total),
      unidade: 'de 5',
      nota: ['baixo risco', 'risco intermediário', 'pancreatite grave'][banda] + ' · mortalidade ' + MORT[total],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Ureia convertida em BUN', fmt(bun) + ' mg/dL (' + fmt(ureia) + ' ÷ 2,14)'],
        ['Ponto por BUN', pBun ? '1 (acima de 25 mg/dL)' : '0'],
        ['Mortalidade na coorte original', MORT[total]],
      ],
      cuidados: [
        'O item de ureia é BUN (nitrogênio ureico), não a ureia do laudo brasileiro — a diferença é um fator de 2,14. Esta tela recebe ureia e converte.',
        'O escore é uma foto das primeiras 24 horas: pancreatite que começa leve e piora é a regra, não a exceção.',
        'Necrose e infecção aparecem depois da primeira semana e não entram neste escore.',
      ],
    }
  },
}
