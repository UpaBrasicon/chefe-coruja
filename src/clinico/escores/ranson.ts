import { completo, somar, type Escore } from '../escore.ts'

// Ranson para pancreatite NÃO biliar: cinco critérios na admissão (obrigatórios)
// e seis nas primeiras 48 horas (marcas, porque podem ainda não existir). Porte
// do protótipo (gastro/Ranson, construído em 29/08/2026). Saiu (ADR 0007) a
// linha "Nível de cuidado": ficam os critérios e o limiar de gravidade.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const ADMISSAO = ['idade', 'leuco', 'glicemia', 'ldh', 'ast']
const H48 = ['ht', 'bun', 'calcio', 'pao2', 'deficit', 'sequestro']

export const ranson: Escore = {
  ficha: {
    id: 'ranson',
    titulo: 'Ranson — gravidade da pancreatite não biliar',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Ranson JHC, Rifkind KM, Roses DF, et al. Prognostic signs and the role of operative management in acute pancreatitis. Surg Gynecol Obstet. 1974;139(1):69–81.', url: 'https://pubmed.ncbi.nlm.nih.gov/4834279/' },
      { citacao: 'Banks PA, Bollen TL, Dervenis C, et al. Classification of acute pancreatitis — 2012: revision of the Atlanta classification. Gut. 2013;62(1):102–111.', url: 'https://doi.org/10.1136/gutjnl-2012-302779' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Gravidade da pancreatite aguda não biliar: cinco critérios na admissão e seis nas primeiras 48 horas',
  itens: [
    { tipo: 'escolha', id: 'idade', rotulo: 'Admissão · Idade acima de 55 anos', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'leuco', rotulo: 'Admissão · Leucócitos acima de 16.000/mm³', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'glicemia', rotulo: 'Admissão · Glicemia acima de 200 mg/dL', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'ldh', rotulo: 'Admissão · LDH acima de 350 U/L', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'ast', rotulo: 'Admissão · AST acima de 250 U/L', opcoes: NAO_SIM },
    { tipo: 'marca', id: 'ht', rotulo: 'Queda do hematócrito acima de 10 pontos percentuais', pontos: 1, grupo: 'Nas primeiras 48 horas' },
    { tipo: 'marca', id: 'bun', rotulo: 'Aumento do BUN acima de 5 mg/dL', pontos: 1, grupo: 'Nas primeiras 48 horas' },
    { tipo: 'marca', id: 'calcio', rotulo: 'Cálcio abaixo de 8 mg/dL', pontos: 1, grupo: 'Nas primeiras 48 horas' },
    { tipo: 'marca', id: 'pao2', rotulo: 'PaO₂ abaixo de 60 mmHg', pontos: 1, grupo: 'Nas primeiras 48 horas' },
    { tipo: 'marca', id: 'deficit', rotulo: 'Déficit de base acima de 4 mEq/L', pontos: 1, grupo: 'Nas primeiras 48 horas' },
    { tipo: 'marca', id: 'sequestro', rotulo: 'Sequestro de líquido acima de 6 L', pontos: 1, grupo: 'Nas primeiras 48 horas' },
  ],
  calcular(r) {
    if (!completo(ranson, r)) return null
    const nAdm = somar(ranson, r, ADMISSAO)
    const n48 = somar(ranson, r, H48)
    const total = nAdm + n48
    const grave = total >= 3
    const banda = total >= 5 ? 2 : total >= 3 ? 1 : 0
    return {
      rotulo: 'Ranson',
      valor: String(total),
      unidade: 'de 11',
      nota: grave ? 'pancreatite grave — três ou mais critérios' : 'abaixo do limiar de gravidade',
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Critérios da admissão', nAdm + ' de 5'],
        ['Critérios de 48 horas', n48 + ' de 6'],
        ['Limiar de gravidade', '3 critérios'],
      ],
      alerta: n48 === 0
        ? 'Nenhum critério de 48 horas marcado. Se ainda não passaram 48 horas, este total é parcial e não classifica gravidade.'
        : undefined,
      cuidados: [
        'Versão para pancreatite não biliar. A biliar usa outros pontos de corte, que esta tela não implementa.',
        'O escore só está completo depois de 48 horas.',
        'Derivado em 1974: a mortalidade absoluta por faixa não corresponde à prática atual; o que se mantém é a separação entre leve e grave.',
      ],
    }
  },
}
