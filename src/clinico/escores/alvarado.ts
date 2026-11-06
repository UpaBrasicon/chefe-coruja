import { completo, somar, type Escore } from '../escore.ts'
import type { Fonte } from '../ficha.ts'

// Alvarado: oito critérios marcáveis (dois de 2 pontos, seis de 1), 0 a 10.
// Porte do protótipo (gastro/Alvarado, construído em 29/08/2026). Saíram
// (ADR 0007) "imagem indicada", "avaliação cirúrgica" e a conduta da coorte.
// Versão de 06/11/2026 (revisão PubMed, itens médios; RT, H16 = A): nota da
// WSES 2025 e da metanálise do AIR, pelos resumos. A WSES 2020 continua como
// fonte da regra até o RT ler a de 2025.

const DOIS = 'Valem 2 pontos cada'
const UM = 'Valem 1 ponto cada'

export const WSES_APENDICITE_2025: Fonte = {
  citacao: 'Podda M, Ceresoli M, De Simone B, et al. Diagnosis and Treatment of Acute Appendicitis: 2025 Edition of the World Society of Emergency Surgery Jerusalem Guidelines. JAMA Surg. 2026;161(3):283–295 (PMID 41604201).',
  url: 'https://doi.org/10.1001/jamasurg.2025.6218',
}

export const AIR_METANALISE_2025: Fonte = {
  citacao: 'Andersson RE, Stark J. Diagnostic value of the appendicitis inflammatory response (AIR) score. A systematic review and meta-analysis. World J Emerg Surg. 2025;20(1):12 (PMID 39923099).',
  url: 'https://doi.org/10.1186/s13017-025-00582-x',
}

export const NOTA_ALVARADO_WSES_2025 =
  'A WSES 2025 (JAMA Surg 2026) substitui a edição de 2020 citada aqui; pelo resumo, escores clínicos de risco e imagem melhoram a acurácia diagnóstica e reduzem a apendicectomia negativa. Metanálise do escore AIR (2025; 26 estudos, 15.699 pacientes): AUC de 0,86 do AIR contra 0,79 do Alvarado em todas as apendicites. A regra desta tela segue a WSES 2020 até o RT ler a de 2025.'

export const alvarado: Escore = {
  ficha: {
    id: 'alvarado',
    titulo: 'Alvarado — probabilidade de apendicite aguda',
    versao: '2026-11-06.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Alvarado A. A practical score for the early diagnosis of acute appendicitis. Ann Emerg Med. 1986;15(5):557–564.', url: 'https://doi.org/10.1016/S0196-0644(86)80993-3' },
      { citacao: 'Di Saverio S, Podda M, De Simone B, et al. Diagnosis and treatment of acute appendicitis: 2020 update of the WSES Jerusalem guidelines. World J Emerg Surg. 2020;15(1):27.', url: 'https://doi.org/10.1186/s13017-020-00306-3' },
      WSES_APENDICITE_2025,
      AIR_METANALISE_2025,
    ],
    revisadoEm: '06/11/2026 (nota da WSES 2025 e do AIR, WSES 2020 mantida como fonte da regra; revisão PubMed, itens médios; porte do protótipo em 27/09/2026)',
  },
  descricao: 'Oito itens de história, exame e hemograma, de 0 a 10',
  itens: [
    { tipo: 'marca', id: 'dorFid', rotulo: 'Dor à palpação em fossa ilíaca direita', pontos: 2, grupo: DOIS },
    { tipo: 'marca', id: 'leucocitose', rotulo: 'Leucocitose acima de 10.000/mm³', pontos: 2, grupo: DOIS },
    { tipo: 'marca', id: 'migracao', rotulo: 'Migração da dor para fossa ilíaca direita', pontos: 1, grupo: UM },
    { tipo: 'marca', id: 'anorexia', rotulo: 'Anorexia', pontos: 1, grupo: UM },
    { tipo: 'marca', id: 'nausea', rotulo: 'Náusea ou vômito', pontos: 1, grupo: UM },
    { tipo: 'marca', id: 'descompressao', rotulo: 'Descompressão dolorosa', pontos: 1, grupo: UM },
    { tipo: 'marca', id: 'febre', rotulo: 'Temperatura de 37,3 °C ou mais', pontos: 1, grupo: UM },
    { tipo: 'marca', id: 'desvio', rotulo: 'Desvio à esquerda — neutrófilos acima de 75%', pontos: 1, grupo: UM },
  ],
  calcular(r) {
    // Só marcas: completo() é sempre verdadeiro (nenhuma marcada = 0 ponto).
    if (!completo(alvarado, r)) return null
    const total = somar(alvarado, r)
    const banda = total >= 7 ? 2 : total >= 5 ? 1 : 0
    return {
      rotulo: 'Alvarado',
      valor: String(total),
      unidade: 'de 10',
      nota: ['apendicite improvável', 'apendicite possível', 'apendicite provável'][banda],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Faixa', total >= 9 ? '9 a 10 — muito provável' : total >= 7 ? '7 a 8 — provável' : total >= 5 ? '5 a 6 — possível' : '0 a 4 — improvável'],
        ['Pontos por palpação e leucocitose', String(somar(alvarado, r, ['dorFid', 'leucocitose'])) + ' de 4'],
      ],
      cuidados: [
        'Desempenho menor na mulher em idade fértil, na criança e no idoso.',
        'Escore baixo não exclui apendicite: a retrocecal dói pouco e pode não ter defesa.',
        'Não validado na gestante.',
        NOTA_ALVARADO_WSES_2025,
      ],
    }
  },
}
