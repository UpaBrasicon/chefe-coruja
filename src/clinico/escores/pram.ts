import { completo, somar, type Escore } from '../escore.ts'

// PRAM — Pediatric Respiratory Assessment Measure (Chalut 2000; validação de
// Ducharme 2008, 2 a 17 anos): cinco itens, 0 a 12 pontos, leve 0–3, moderada
// 4–7, grave 8–12. O livro do ICr não traz o PRAM; ele entra pela referência
// primária e fica aguardando o RT. Não é convertido de escore de adulto.

export const pram: Escore = {
  ficha: {
    id: 'ped-pram',
    titulo: 'PRAM — gravidade da crise de asma (criança)',
    versao: '2026-09-30.1',
    publico: 'pediatrico',
    fontes: [
      { citacao: 'Ducharme FM, Chalut D, Plotnick L, et al. The Pediatric Respiratory Assessment Measure: a valid clinical score for assessing acute asthma severity from toddlers to teenagers. J Pediatr. 2008;152(4):476–480.', url: 'https://doi.org/10.1016/j.jpeds.2007.08.034', pediatrica: true },
      { citacao: 'Chalut DS, Ducharme FM, Davis GM. The Preschool Respiratory Assessment Measure (PRAM): a responsive index of acute asthma severity. J Pediatr. 2000;137(6):762–768.', url: 'https://doi.org/10.1067/mpd.2000.110121', pediatrica: true },
    ],
    revisadoEm: '30/09/2026 (referência primária; aguarda aprovação do RT)',
  },
  descricao: 'Cinco itens do exame (0 a 12 pontos): leve 0–3, moderada 4–7, grave 8–12. Validado de 2 a 17 anos.',
  itens: [
    { tipo: 'escolha', id: 'supraesternal', rotulo: 'Retração supraesternal', opcoes: [{ rotulo: 'Ausente', valor: 0 }, { rotulo: 'Presente — 2', valor: 2 }] },
    { tipo: 'escolha', id: 'escalenos', rotulo: 'Contração dos escalenos', opcoes: [{ rotulo: 'Ausente', valor: 0 }, { rotulo: 'Presente — 2', valor: 2 }] },
    { tipo: 'escolha', id: 'entrada', rotulo: 'Entrada de ar', opcoes: [
      { rotulo: 'Normal', valor: 0 }, { rotulo: 'Diminuída nas bases — 1', valor: 1 }, { rotulo: 'Diminuída de forma difusa — 2', valor: 2 }, { rotulo: 'Ausente ou mínima — 3', valor: 3 },
    ] },
    { tipo: 'escolha', id: 'sibilos', rotulo: 'Sibilância', opcoes: [
      { rotulo: 'Ausente', valor: 0 }, { rotulo: 'Só expiratória — 1', valor: 1 }, { rotulo: 'Inspiratória e expiratória — 2', valor: 2 }, { rotulo: 'Audível sem estetoscópio, ou tórax silencioso com entrada mínima — 3', valor: 3 },
    ] },
    { tipo: 'escolha', id: 'spo2', rotulo: 'SpO₂ em ar ambiente', opcoes: [{ rotulo: '≥ 95%', valor: 0 }, { rotulo: '92 a 94% — 1', valor: 1 }, { rotulo: '< 92% — 2', valor: 2 }] },
  ],
  calcular(r) {
    if (!completo(pram, r)) return null
    const total = somar(pram, r)
    const banda = total >= 8 ? 2 : total >= 4 ? 1 : 0
    return {
      rotulo: 'PRAM',
      valor: String(total),
      unidade: 'de 12',
      nota: ['leve (0–3)', 'moderada (4–7)', 'grave (8–12)'][banda],
      estado: banda as 0 | 1 | 2,
      derivados: [['Gravidade', ['leve', 'moderada', 'grave'][banda]]],
      cuidados: [
        'O livro do ICr não traz o PRAM; a conduta da crise segue a ferramenta Asma — criança (livro do ICr).',
        'SpO₂ medida em ar ambiente.',
        'Validado de 2 a 17 anos; fora dessa faixa o escore não foi estudado.',
      ],
    }
  },
}
