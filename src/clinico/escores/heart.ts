import { completo, somar, type Escore } from '../escore.ts'

// HEART: cinco componentes de 0 a 2. Porte do protótipo (cardiologia/HEART,
// construído em 29/08/2026). A linha "conduta da coorte de validação" saiu
// (ADR 0007): fica a taxa de evento em 6 semanas da coorte.

const MACE = ['1,7%', '16,6%', '50,1%']

export const heart: Escore = {
  ficha: {
    id: 'heart',
    titulo: 'HEART — dor torácica no pronto-socorro',
    versao: '2026-09-27.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Six AJ, Backus BE, Kelder JC. Chest pain in the emergency room: value of the HEART score. Neth Heart J. 2008;16(6):191–196.', url: 'https://doi.org/10.1007/BF03086144' },
      { citacao: 'Backus BE, Six AJ, Kelder JC, et al. A prospective validation of the HEART score for chest pain patients at the emergency department. Int J Cardiol. 2013;168(3):2153–2158.', url: 'https://doi.org/10.1016/j.ijcard.2013.01.255' },
      { citacao: 'Byrne RA, Rossello X, Coughlan JJ, et al. 2023 ESC Guidelines for the management of acute coronary syndromes. Eur Heart J. 2023;44(38):3720–3826.', url: 'https://doi.org/10.1093/eurheartj/ehad191' },
    ],
    revisadoEm: '27/09/2026 (porte do protótipo)',
  },
  descricao: 'Risco de evento cardíaco maior em 6 semanas',
  itens: [
    { tipo: 'escolha', id: 'historia', rotulo: 'História', opcoes: [
      { rotulo: 'Pouco suspeita', valor: 0 }, { rotulo: 'Moderadamente suspeita', valor: 1 }, { rotulo: 'Muito suspeita', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'ecg', rotulo: 'ECG', opcoes: [
      { rotulo: 'Normal', valor: 0 }, { rotulo: 'Alteração inespecífica de repolarização', valor: 1 }, { rotulo: 'Infradesnivelamento significativo de ST', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [
      { rotulo: 'Abaixo de 45 anos', valor: 0 }, { rotulo: '45 a 64 anos', valor: 1 }, { rotulo: '65 anos ou mais', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'fatores', rotulo: 'Fatores de risco', ajuda: 'HAS, dislipidemia, diabetes, obesidade, tabagismo, história familiar', opcoes: [
      { rotulo: 'Nenhum', valor: 0 }, { rotulo: '1 ou 2 fatores', valor: 1 }, { rotulo: '3 ou mais, ou doença aterosclerótica conhecida', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'trop', rotulo: 'Troponina', opcoes: [
      { rotulo: 'Até o limite normal', valor: 0 }, { rotulo: '1 a 3× o limite', valor: 1 }, { rotulo: 'Acima de 3× o limite', valor: 2 },
    ] },
  ],
  calcular(r) {
    if (!completo(heart, r)) return null
    const total = somar(heart, r)
    const banda = total >= 7 ? 2 : total >= 4 ? 1 : 0
    return {
      rotulo: 'HEART',
      valor: String(total),
      unidade: 'de 10',
      nota: ['baixo risco', 'risco moderado', 'alto risco'][banda] + ' · evento em 6 semanas ' + MACE[banda],
      estado: banda as 0 | 1 | 2,
      derivados: [
        ['Faixa', ['0 a 3 pontos', '4 a 6 pontos', '7 a 10 pontos'][banda]],
        ['Evento cardíaco maior em 6 semanas', MACE[banda]],
      ],
      cuidados: [
        'A troponina do escore é a da chegada. Uma segunda medida dentro da janela do protocolo pode mudar a pontuação.',
        'HEART baixo não exclui dor torácica de causa não coronariana grave: dissecção, embolia pulmonar e pneumotórax não entram neste escore.',
        'Os percentuais são da coorte de validação holandesa e variam com a prevalência local de doença coronariana.',
      ],
    }
  },
}
