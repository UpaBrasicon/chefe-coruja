import { completo, escolha, somar, type Escore } from '../escore.ts'

// SOFA-2 (Ranzani et al., JAMA 2025), lacunas da Central, lote 3 (25/10/2026).
// Fica em paralelo ao SOFA original da ferramenta de sepse: a SSC 2026 e o
// protocolo do ILAS (jul/2026) não citam o SOFA-2, e a definição de sepse
// (Sepsis-3) usa o SOFA original. Pontos e cortes da Tabela 2 e das notas de
// rodapé, conferidos no texto completo (PMC12573119). O escore foi desenvolvido
// só em UTI; a faixa de cor fica neutra porque o artigo não define cortes.

const SISTEMAS = ['cerebro', 'resp', 'cv', 'figado', 'rim', 'hemostasia']

export const sofa2: Escore = {
  ficha: {
    id: 'sofa-2',
    titulo: 'SOFA-2 — disfunção orgânica no adulto em UTI (2025)',
    versao: '2026-10-25.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Ranzani OT, Singer M, Salluh JIF, et al. Development and Validation of the Sequential Organ Failure Assessment (SOFA)-2 Score. JAMA. 2025;334(23):2090–2103. Tabela 2 e notas a–q (texto completo, PMC12573119); AUROC no resumo e em "Predictive Validity".', url: 'https://doi.org/10.1001/jama.2025.20516' },
    ],
    revisadoEm: '25/10/2026 (lacunas da Central, lote 3; aguarda aprovação do RT)',
  },
  descricao: 'Seis sistemas de 0 a 4 pontos (0 a 24), com suporte orgânico atual e novos cortes. Desenvolvido e validado em UTI; o critério de sepse continua no SOFA original.',
  itens: [
    { tipo: 'escolha', id: 'cerebro', rotulo: 'Cérebro · Glasgow', ajuda: 'Sedado: use o último Glasgow antes da sedação; se desconhecido, 0. Sem os 3 domínios, use a melhor resposta motora.', opcoes: [
      { rotulo: '15 (ou faz sinal de positivo, fecha a mão ou faz "paz")', valor: 0 },
      { rotulo: '13 a 14 (ou localiza a dor), ou droga para delirium', valor: 1 },
      { rotulo: '9 a 12 (ou retirada à dor)', valor: 2 },
      { rotulo: '6 a 8 (ou flexão à dor)', valor: 3 },
      { rotulo: '3 a 5 (ou extensão, sem resposta à dor, mioclonia generalizada)', valor: 4 },
    ] },
    { tipo: 'escolha', id: 'resp', rotulo: 'Respiratório · PaO₂/FiO₂', ajuda: '3 e 4 pontos exigem suporte ventilatório avançado (cateter nasal de alto fluxo, CPAP, BiPAP, VNI, ventilação invasiva ou domiciliar); sem ele, no máximo 2, salvo se indisponível ou fora do teto terapêutico.', opcoes: [
      { rotulo: 'Acima de 300', valor: 0 },
      { rotulo: '300 ou menos', valor: 1 },
      { rotulo: '225 ou menos', valor: 2 },
      { rotulo: '150 ou menos, com suporte ventilatório avançado', valor: 3 },
      { rotulo: '75 ou menos, com suporte ventilatório avançado, ou ECMO', valor: 4 },
    ] },
    { tipo: 'escolha', id: 'cv', rotulo: 'Cardiovascular · nora + adrenalina (µg/kg/min, em base)', ajuda: 'Vasopressor só conta em infusão contínua por pelo menos 1 hora. Dose de noradrenalina expressa em base (1 mg de base = 2 mg de bitartarato mono-hidratado).', opcoes: [
      { rotulo: 'PAM de 70 ou mais, sem vasopressor ou inotrópico', valor: 0 },
      { rotulo: 'PAM abaixo de 70, sem vasopressor ou inotrópico', valor: 1 },
      { rotulo: 'Dose baixa (soma até 0,2), ou qualquer dose de outro vasopressor ou inotrópico', valor: 2 },
      { rotulo: 'Dose média (acima de 0,2 até 0,4), ou dose baixa com outro vasopressor ou inotrópico', valor: 3 },
      { rotulo: 'Dose alta (acima de 0,4), ou dose média com outro, ou suporte mecânico', valor: 4 },
    ] },
    { tipo: 'escolha', id: 'figado', rotulo: 'Fígado · bilirrubina total (mg/dL)', opcoes: [
      { rotulo: '1,2 ou menos', valor: 0 },
      { rotulo: 'Acima de 1,2 até 3,0', valor: 1 },
      { rotulo: 'Acima de 3,0 até 6,0', valor: 2 },
      { rotulo: 'Acima de 6,0 até 12,0', valor: 3 },
      { rotulo: 'Acima de 12', valor: 4 },
    ] },
    { tipo: 'escolha', id: 'rim', rotulo: 'Rim · creatinina (mg/dL) ou diurese', opcoes: [
      { rotulo: '1,2 ou menos', valor: 0 },
      { rotulo: 'Até 2,0, ou diurese abaixo de 0,5 mL/kg/h por 6–12 h', valor: 1 },
      { rotulo: 'Até 3,5, ou diurese abaixo de 0,5 mL/kg/h por 12 h ou mais', valor: 2 },
      { rotulo: 'Acima de 3,5, ou diurese abaixo de 0,3 mL/kg/h por 24 h ou mais, ou anúria por 12 h ou mais', valor: 3 },
      { rotulo: 'Em terapia renal substitutiva ou com critério para ela', valor: 4 },
    ] },
    { tipo: 'escolha', id: 'hemostasia', rotulo: 'Hemostasia · plaquetas (×10³/µL)', opcoes: [
      { rotulo: 'Acima de 150', valor: 0 },
      { rotulo: '150 ou menos', valor: 1 },
      { rotulo: '100 ou menos', valor: 2 },
      { rotulo: '80 ou menos', valor: 3 },
      { rotulo: '50 ou menos', valor: 4 },
    ] },
  ],
  calcular(r) {
    if (!completo(sofa2, r)) return null
    const total = somar(sofa2, r, SISTEMAS)
    const comDisfuncao = SISTEMAS.filter((k) => (escolha(sofa2, r, k)?.valor ?? 0) > 0).length
    const graves = SISTEMAS.filter((k) => (escolha(sofa2, r, k)?.valor ?? 0) >= 3).length
    return {
      rotulo: 'SOFA-2',
      valor: String(total),
      unidade: 'de 24',
      nota: `${comDisfuncao} de 6 sistemas com pontos`,
      estado: 0,
      derivados: [
        ['Sistemas com 3 ou 4 pontos', `${graves} de 6`],
        ['Discriminação da mortalidade na UTI', 'AUROC 0,79 (SOFA-2) × 0,77 (SOFA original) na metanálise das 10 coortes, 3,34 milhões de internações'],
      ],
      cuidados: [
        'Desenvolvido e validado só em UTI; o próprio artigo diz que o uso fora dela (pronto-socorro, pediatria) ainda precisa de estudo.',
        'O critério de sepse (Sepsis-3), a SSC 2026 e o protocolo do ILAS usam o SOFA original, que está na ferramenta de sepse do adulto; os cortes de um não valem para o outro.',
        'Some o pior valor de cada sistema nas 24 horas. Dado ausente no 1º dia conta 0; depois, repete-se o último valor.',
        'Sem gasometria: SpO₂/FiO₂ só se a SpO₂ estiver abaixo de 98% — acima de 300 (0), 300 ou menos (1), 250 ou menos (2), 200 ou menos com suporte (3), 120 ou menos com suporte ou ECMO (4).',
        'Dopamina isolada: até 20 µg/kg/min (2), acima de 20 até 40 (3), acima de 40 (4). Sem droga vasoativa disponível ou por teto terapêutico, pela PAM: 70 ou mais (0), 60–69 (1), 50–59 (2), 40–49 (3), abaixo de 40 (4).',
        'ECMO por falência respiratória pontua 4 só no respiratório; por indicação cardiovascular, pontua nos dois sistemas.',
        'Sem terapia renal por teto, falta de máquina ou adiamento: 4 pontos se creatinina acima de 1,2 ou diurese abaixo de 0,3 mL/kg/h por mais de 6 h, com potássio de 6,0 ou mais ou acidose (pH até 7,20 e bicarbonato até 12).',
        'Errata da Tabela 2: na célula de 4 pontos do cardiovascular a dose média aparece como "> .02 a ≤ 0,4"; na célula de 3 pontos é "> 0,2 a ≤ 0,4". A ferramenta usa 0,2.',
      ],
    }
  },
}
