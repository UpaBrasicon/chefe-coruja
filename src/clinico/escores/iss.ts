import { escolha, type Escore, type Item } from '../escore.ts'

// Injury Severity Score (Baker 1974): soma dos quadrados do maior AIS de cada
// uma das três regiões mais gravemente atingidas; qualquer AIS 6 dá ISS 75. A
// ferramenta NÃO classifica a lesão em AIS (isso exige o dicionário AIS da
// AAAM): o usuário informa o AIS de cada região. Sem corte de gravidade — o
// artigo original não define um.

const AIS = [
  { rotulo: '0 — sem lesão', valor: 0 },
  { rotulo: '1 — menor', valor: 1 },
  { rotulo: '2 — moderada', valor: 2 },
  { rotulo: '3 — grave, sem risco de vida', valor: 3 },
  { rotulo: '4 — grave, com risco de vida', valor: 4 },
  { rotulo: '5 — crítica, sobrevida incerta', valor: 5 },
  { rotulo: '6 — máxima (não sobrevivível)', valor: 6 },
]

const regiao = (id: string, rotulo: string): Item => ({ tipo: 'escolha', id, rotulo, opcoes: AIS })

export const REGIOES_ISS = ['cabeca', 'face', 'torax', 'abdome', 'extremidades', 'externa']

/** ISS a partir do maior AIS de cada uma das seis regiões. */
export function calcularIss(ais: number[]): number | null {
  if (ais.length !== 6 || ais.some((a) => !Number.isInteger(a) || a < 0 || a > 6)) return null
  if (ais.includes(6)) return 75
  return [...ais].sort((a, b) => b - a).slice(0, 3).reduce((s, a) => s + a * a, 0)
}

export const iss: Escore = {
  ficha: {
    id: 'iss',
    titulo: 'ISS — Injury Severity Score (adulto)',
    versao: '2026-09-30.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Baker SP, O\'Neill B, Haddon W Jr, Long WB. The Injury Severity Score: a method for describing patients with multiple injuries and evaluating emergency care. J Trauma. 1974;14(3):187–196.', url: 'https://doi.org/10.1097/00005373-197403000-00001' },
    ],
    revisadoEm: '30/09/2026 (referência primária; aguarda aprovação do RT)',
  },
  descricao: 'Maior AIS de cada uma das seis regiões; o ISS soma os quadrados das três regiões mais graves (0 a 75).',
  itens: [
    regiao('cabeca', 'Cabeça ou pescoço'),
    regiao('face', 'Face'),
    regiao('torax', 'Tórax'),
    regiao('abdome', 'Abdome ou conteúdo pélvico'),
    regiao('extremidades', 'Extremidades ou cintura pélvica'),
    regiao('externa', 'Externa (pele e subcutâneo)'),
  ],
  calcular(r) {
    const ais = REGIOES_ISS.map((id) => escolha(iss, r, id)?.valor)
    if (ais.some((a) => a === undefined)) return null
    const valor = calcularIss(ais as number[])!
    return {
      rotulo: 'ISS',
      valor: String(valor),
      unidade: 'de 75',
      nota: (ais as number[]).includes(6) ? 'AIS 6 em alguma região: ISS 75 por definição' : 'soma dos quadrados dos três maiores AIS',
      estado: 0,
      derivados: [['Três maiores AIS', [...(ais as number[])].sort((a, b) => b - a).slice(0, 3).join(', ')]],
      cuidados: [
        'O AIS de cada lesão vem do dicionário AIS (AAAM); a ferramenta não classifica a lesão.',
        'Use o maior AIS de cada região: só uma lesão por região entra na conta.',
        'O artigo original não define corte de "trauma grave"; nenhum é mostrado.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
