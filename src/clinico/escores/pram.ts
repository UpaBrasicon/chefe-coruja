import { completo, somar, type Escore } from '../escore.ts'

// PRAM — Pediatric Respiratory Assessment Measure (Chalut 2000; validação de
// Ducharme 2008, 2 a 17 anos): cinco itens, 0 a 12 pontos, leve 0–3, moderada
// 4–7, grave 8–12. O livro do ICr não traz o PRAM; ele entra pela referência
// primária e fica aguardando o RT. Não é convertido de escore de adulto.
//
// Revisão PubMed de 09/10/2026, itens médios (decisão do RT em 06/11/2026):
// CASPER (Arch Dis Child 2026), a coorte brasileira (J Pediatr (Rio J) 2026) e o
// estudo em lactentes (Arch Pediatr 2026) entram como nota em `cuidados`; a
// linha da faixa etária foi reescrita (H10). A conta não muda.

export const pram: Escore = {
  ficha: {
    id: 'ped-pram',
    titulo: 'PRAM — gravidade da crise de asma (criança)',
    versao: '2026-11-06.1',
    publico: 'pediatrico',
    fontes: [
      { citacao: 'Ducharme FM, Chalut D, Plotnick L, et al. The Pediatric Respiratory Assessment Measure: a valid clinical score for assessing acute asthma severity from toddlers to teenagers. J Pediatr. 2008;152(4):476–480.', url: 'https://doi.org/10.1016/j.jpeds.2007.08.034', pediatrica: true },
      { citacao: 'Chalut DS, Ducharme FM, Davis GM. The Preschool Respiratory Assessment Measure (PRAM): a responsive index of acute asthma severity. J Pediatr. 2000;137(6):762–768.', url: 'https://doi.org/10.1067/mpd.2000.110121', pediatrica: true },
      { citacao: 'Gray C, Armit L, Babl FE, et al. Diagnostic accuracy study assessing the ability of paediatric asthma scores to predict admission following initial emergency department bronchodilator therapy: a Clinical Asthma Scoring systems in Paediatric Emergency (CASPER) study. Arch Dis Child. 2026 (publicado on-line antes da edição impressa; PMID 42392843).', url: 'https://doi.org/10.1136/archdischild-2026-330613', pediatrica: true },
      { citacao: 'Pergo LS, de Almeida PA, Bordignon G, et al. The pediatric respiratory assessment measure as a predictor of hospitalization in the management of asthma exacerbations: an observational study. J Pediatr (Rio J). 2026;102(5):101583 (PMID 42448296).', url: 'https://doi.org/10.1016/j.jped.2026.101583', pediatrica: true },
      { citacao: 'Courselle A, Raghani J, Marguet C, et al. Evaluation of the PRAM score for assessing the severity of wheezing episodes in infants under 24 months of age: A prospective observational study in a pediatric emergency department. Arch Pediatr. 2026;33(4):105511 (PMID 41996743).', url: 'https://doi.org/10.1016/j.arcped.2026.105511', pediatrica: true },
    ],
    revisadoEm: '06/11/2026 (nota do CASPER e da coorte brasileira; faixa etária reescrita com o estudo em lactentes; revisão PubMed, itens médios; referência primária; aguarda aprovação do RT)',
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
        'Validado de 2 a 17 anos; abaixo de 2 anos há só um estudo pequeno e unicêntrico (92 lactentes).',
        'CASPER (2026): em 4 prontos-socorros australianos, 1.238 crianças de 2 a 18 anos, nenhum dos 10 escores de asma (PRAM incluído) atingiu AUC ≥ 0,80 para prever internação após o broncodilatador inicial. Numa coorte brasileira (428 atendimentos), o PRAM previu melhor a internação na 2ª hora (AUC 0,829) do que na triagem (0,791). O escore mede gravidade e serve para reavaliar; não decide sozinho a internação.',
      ],
    }
  },
}
