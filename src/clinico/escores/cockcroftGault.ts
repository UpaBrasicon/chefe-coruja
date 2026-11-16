import { completo, escolha, numero, type Escore } from '../escore.ts'

// Clearance de creatinina estimado por Cockcroft-Gault (lacunas da Central,
// lote 1, 23/10/2026). Fórmula conferida no texto: [(140 − idade) × peso] /
// (72 × creatinina em mg/dL), 15% menor na mulher (× 0,85). O estudo original
// usou o peso real (Scappaticci 2017, "using actual body weight"). É o ClCr que
// as bulas usam para ajustar dose; não é a TFG (essa é a CKD-EPI, ao lado).

/** ClCr em mL/min; null fora da faixa adulta ou com dado inválido. */
export function clearanceCockcroftGault(creatinina: number, idade: number, peso: number, mulher: boolean): number | null {
  if (![creatinina, idade, peso].every(Number.isFinite) || creatinina <= 0 || peso <= 0 || idade < 18) return null
  const clcr = ((140 - idade) * peso) / (72 * creatinina)
  return mulher ? clcr * 0.85 : clcr
}

export const cockcroftGault: Escore = {
  ficha: {
    id: 'cockcroft-gault',
    titulo: 'Clearance de creatinina — Cockcroft-Gault (adulto)',
    versao: '2026-11-16.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Cockcroft DW, Gault MH. Prediction of creatinine clearance from serum creatinine. Nephron. 1976;16(1):31–41 (PMID 1244564). Redução de 15% na mulher.', url: 'https://doi.org/10.1159/000180580' },
      { citacao: 'Scappaticci GB, Regal RE. Cockcroft-Gault revisited: new de-liver-ance on recommendations for use in cirrhosis. World J Hepatol. 2017;9(3):131–138 (PMID 28217249), Tabela 1: a fórmula; peso real no estudo original; limitações.', url: 'https://doi.org/10.4254/wjh.v9.i3.131' },
      { citacao: 'Quadri KH, Bernardini J, Greenberg A, et al. Assessment of renal function during pregnancy using a random urine protein to creatinine ratio and Cockcroft-Gault formula. Am J Kidney Dis. 1994;24(3):416–420 (PMID 8079966): creatinina em mg/dL.', url: 'https://doi.org/10.1016/s0272-6386(12)80897-3' },
      { citacao: 'Kidney Disease: Improving Global Outcomes (KDIGO) CKD Work Group. KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease. Kidney Int. 2024;105(4S):S117–S314. PP 1.1.1.2, 1.1.3.2, 3.16.2, 4.1.1, 4.1.2, 4.2.1 a 4.2.5, 4.4.1, 4.4.1.2 e 5.1.1 (Figura 48) lidos no PDF do kdigo.org em 16/11/2026; comentário sobre o Cockcroft-Gault na p. S249.', url: 'https://doi.org/10.1016/j.kint.2023.10.018' },
    ],
    revisadoEm: '16/11/2026 (próximos passos do lote 8 das calculadoras; fontes lidas no texto em 16/11/2026; aguarda aprovação do RT); 23/10/2026 (lacunas da Central, lote 1; fórmula conferida no texto da fonte)',
  },
  descricao: 'Creatinina, idade, peso real e sexo. ClCr em mL/min, o usado nas bulas para ajustar dose; não é a TFG.',
  itens: [
    { tipo: 'numero', id: 'creatinina', rotulo: 'Creatinina sérica', unidade: 'mg/dL', min: 0.1, max: 25, passo: 0.01 },
    { tipo: 'numero', id: 'idade', rotulo: 'Idade', unidade: 'anos', min: 18, max: 120, passo: 1, ajuda: 'A fórmula foi derivada em adultos de 18 a 92 anos.' },
    { tipo: 'numero', id: 'peso', rotulo: 'Peso real', unidade: 'kg', min: 20, max: 300, passo: 0.1, ajuda: 'O estudo original usou o peso real.' },
    { tipo: 'escolha', id: 'sexo', rotulo: 'Sexo', opcoes: [{ rotulo: 'Feminino', valor: 0 }, { rotulo: 'Masculino', valor: 1 }] },
  ],
  calcular(r) {
    if (!completo(cockcroftGault, r)) return null
    const mulher = escolha(cockcroftGault, r, 'sexo')!.valor === 0
    const clcr = clearanceCockcroftGault(numero(cockcroftGault, r, 'creatinina')!, numero(cockcroftGault, r, 'idade')!, numero(cockcroftGault, r, 'peso')!, mulher)
    if (clcr === null) return null
    const v = Math.round(clcr)
    return {
      rotulo: 'ClCr (Cockcroft-Gault)',
      valor: String(v),
      unidade: 'mL/min',
      nota: mulher ? 'com a redução de 15% da mulher' : 'homem',
      estado: v < 30 ? 2 : v < 60 ? 1 : 0,
      derivados: [
        ['Peso usado', 'real (o do estudo original)'],
        ['Fórmula', '[(140 − idade) × peso] / (72 × creatinina)' + (mulher ? ' × 0,85' : '')],
      ],
      cuidados: [
        'Só vale com creatinina estável: na lesão renal aguda o ClCr fica superestimado.',
        'Pressupõe massa muscular proporcional ao peso; obesidade, caquexia, amputação e cirrose (superestima em torno de 50%) geram erro.',
        'Os autores sugeriram peso ideal na obesidade e na ascite, sem dados que sustentem; a ferramenta usa o peso real, como no estudo.',
        'Não vale abaixo de 18 anos; na criança, Schwartz (seção Pediatria).',
      ],
    }
  },
}
