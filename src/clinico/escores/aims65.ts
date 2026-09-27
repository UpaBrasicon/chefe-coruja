import { completo, somar, type Escore } from '../escore.ts'

// AIMS65: cinco critérios de 1 ponto. Porte do protótipo (gastro/AIMS65,
// construído em 29/08/2026). Saiu (ADR 0007) a linha "Para decidir alta": fica
// a mortalidade hospitalar da coorte de derivação.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]
const MORT = ['0,3%', '1%', '3%', '9%', '15%', '25%']

export const aims65: Escore = {
  ficha: {
    id: 'aims65',
    titulo: 'AIMS65 — mortalidade na hemorragia digestiva alta',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Saltzman JR, Tabak YP, Hyett BH, et al. A simple risk score accurately predicts in-hospital mortality, length of stay, and cost in acute upper GI bleeding. Gastrointest Endosc. 2011;74(6):1215–1224.', url: 'https://doi.org/10.1016/j.gie.2011.06.024' },
      { citacao: 'Stanley AJ, Laine L, Dalton HR, et al. Comparison of risk scoring systems for patients presenting with upper gastrointestinal bleeding. BMJ. 2017;356:i6432.', url: 'https://doi.org/10.1136/bmj.i6432' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Mortalidade hospitalar na hemorragia digestiva alta com cinco itens da chegada',
  itens: [
    { tipo: 'escolha', id: 'albumina', rotulo: 'Albumina abaixo de 3,0 g/dL', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'inr', rotulo: 'INR acima de 1,5', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'mental', rotulo: 'Alteração do estado mental', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'pas', rotulo: 'Pressão sistólica de 90 mmHg ou menos', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade acima de 65 anos', opcoes: NAO_SIM },
  ],
  calcular(r) {
    if (!completo(aims65, r)) return null
    const total = somar(aims65, r)
    const banda = total >= 3 ? 2 : total >= 2 ? 1 : 0
    return {
      rotulo: 'AIMS65',
      valor: String(total),
      unidade: 'de 5',
      nota: ['baixo risco', 'risco intermediário', 'alto risco'][banda] + ' · mortalidade hospitalar ' + MORT[total],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Mortalidade hospitalar', MORT[total]],
        ['Critérios presentes', total + ' de 5'],
      ],
      cuidados: [
        'Prevê morte, não ressangramento nem necessidade de transfusão.',
        'Sem albumina coletada, o escore fica subestimado. Registre que faltou em vez de assumir normal.',
        'Os percentuais são da coorte de derivação de 2011.',
      ],
    }
  },
}
