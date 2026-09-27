import { completo, somar, type Escore } from '../escore.ts'

// CURB-65: cinco critérios de 1 ponto. Porte do protótipo (escores/CURB-65,
// construído em 29/08/2026). A nota de local de tratamento e a linha "conduta
// de referência" do protótipo saíram (ADR 0007): fica a mortalidade em 30 dias
// da coorte original.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const MORTALIDADE_30D = ['0,7', '3,2', '13', '17', '41,5', '57']

export const curb65: Escore = {
  ficha: {
    id: 'curb-65',
    titulo: 'CURB-65 — gravidade da pneumonia comunitária',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Lim WS, van der Eerden MM, Laing R, et al. Defining community acquired pneumonia severity on presentation to hospital: an international derivation and validation study. Thorax. 2003;58(5):377–382.', url: 'https://doi.org/10.1136/thorax.58.5.377' },
      { citacao: 'Metlay JP, Waterer GW, Long AC, et al. Diagnosis and Treatment of Adults with Community-acquired Pneumonia. An Official Clinical Practice Guideline of the ATS and IDSA. Am J Respir Crit Care Med. 2019;200(7):e45–e67.', url: 'https://doi.org/10.1164/rccm.201908-1581ST' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Gravidade da pneumonia comunitária e mortalidade em 30 dias da coorte original',
  itens: [
    { tipo: 'escolha', id: 'c', rotulo: 'Confusão mental de início recente', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'u', rotulo: 'Ureia acima de 42 mg/dL (7 mmol/L)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'r', rotulo: 'Frequência respiratória de 30 irpm ou mais', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'b', rotulo: 'Sistólica abaixo de 90 ou diastólica de 60 mmHg ou menos', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'i', rotulo: 'Idade de 65 anos ou mais', opcoes: NAO_SIM },
  ],
  calcular(r) {
    if (!completo(curb65, r)) return null
    const total = somar(curb65, r)
    const banda = total >= 3 ? 2 : total === 2 ? 1 : 0
    return {
      rotulo: 'CURB-65',
      valor: String(total),
      unidade: total === 1 ? 'ponto' : 'pontos',
      nota: `mortalidade em 30 dias ${MORTALIDADE_30D[total]}%`,
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Mortalidade em 30 dias', MORTALIDADE_30D[total] + '%'],
        ['Critérios presentes', total + ' de 5'],
      ],
      cuidados: [
        'O escore mede gravidade, não etiologia, e não considera suporte social, comorbidade descompensada, hipoxemia nem capacidade de tomar medicação por via oral.',
        'Saturação de oxigênio não está no escore.',
        'A ureia é a sérica em mg/dL; o critério original é 7 mmol/L. Se o seu laboratório reporta nitrogênio ureico (BUN), o limite equivalente é 19,6 mg/dL.',
      ],
    }
  },
}
