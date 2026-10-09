import { completo, escolha, numero, type Escore } from '../escore.ts'

// TFG estimada pela CKD-EPI 2021 com creatinina, sem coeficiente de raça
// (Inker 2021). eTFG = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^−1,200 ×
// 0,9938^idade × 1,012 (mulher); κ 0,7 (mulher) / 0,9 (homem); α −0,241
// (mulher) / −0,302 (homem). Categorias G1–G5 da KDIGO. Só vale com
// creatinina estável e idade ≥ 18 anos; criança: Schwartz (livro do ICr).

export type Sexo = 'f' | 'm'

/** CKD-EPI 2021, creatinina em mg/dL, resultado em mL/min/1,73 m². */
export function ckdEpi2021(creatinina: number, idade: number, sexo: Sexo): number | null {
  if (!Number.isFinite(creatinina) || creatinina <= 0 || !Number.isFinite(idade) || idade < 18) return null
  const k = sexo === 'f' ? 0.7 : 0.9
  const a = sexo === 'f' ? -0.241 : -0.302
  const x = creatinina / k
  return 142 * Math.min(x, 1) ** a * Math.max(x, 1) ** -1.2 * 0.9938 ** idade * (sexo === 'f' ? 1.012 : 1)
}

/**
 * CKD-EPI 2009 sem o coeficiente racial (Levey 2009): 141 × min(Scr/κ, 1)^α ×
 * max(Scr/κ, 1)^−1,209 × 0,993^idade × 1,018 (mulher); κ 0,7/0,9; α −0,329
 * (mulher) / −0,411 (homem). Revisão PubMed de 09/10/2026: estudo brasileiro
 * (Escott 2024, PMID 38913268) recomenda não trocar a de 2009 pela de 2021.
 */
export function ckdEpi2009(creatinina: number, idade: number, sexo: Sexo): number | null {
  if (!Number.isFinite(creatinina) || creatinina <= 0 || !Number.isFinite(idade) || idade < 18) return null
  const k = sexo === 'f' ? 0.7 : 0.9
  const a = sexo === 'f' ? -0.329 : -0.411
  const x = creatinina / k
  return 141 * Math.min(x, 1) ** a * Math.max(x, 1) ** -1.209 * 0.993 ** idade * (sexo === 'f' ? 1.018 : 1)
}

/** Categoria de TFG da KDIGO. */
export function categoriaTfg(tfg: number): string {
  if (tfg >= 90) return 'G1 (≥ 90)'
  if (tfg >= 60) return 'G2 (60–89)'
  if (tfg >= 45) return 'G3a (45–59)'
  if (tfg >= 30) return 'G3b (30–44)'
  if (tfg >= 15) return 'G4 (15–29)'
  return 'G5 (< 15)'
}

export const ckdEpi: Escore = {
  ficha: {
    id: 'ckd-epi-2021',
    titulo: 'TFG estimada — CKD-EPI 2021 e 2009 (adulto)',
    versao: '2026-10-09.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Inker LA, Eneanya ND, Coresh J, et al. New Creatinine- and Cystatin C–Based Equations to Estimate GFR without Race. N Engl J Med. 2021;385(19):1737–1749.', url: 'https://doi.org/10.1056/NEJMoa2102953' },
      { citacao: 'Levey AS, Stevens LA, Schmid CH, et al. A New Equation to Estimate Glomerular Filtration Rate. Ann Intern Med. 2009;150(9):604–612 (PMID 19414839). Usada aqui sem o coeficiente racial.', url: 'https://doi.org/10.7326/0003-4819-150-9-200905050-00006' },
      { citacao: 'Escott GM, Zingano CP, Ferlin E, et al. Is race adjustment necessary to estimate glomerular filtration rate in South Brazilians? J Nephrol. 2024;37(9):2635–2645 (PMID 38913268).', url: 'https://doi.org/10.1007/s40620-024-02001-x' },
      { citacao: 'Kidney Disease: Improving Global Outcomes (KDIGO) CKD Work Group. KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease. Kidney Int. 2024;105(4S):S117–S314. Categorias de TFG G1–G5.', url: 'https://doi.org/10.1016/j.kint.2023.10.018' },
    ],
    revisadoEm: '09/10/2026 (2009 ao lado da 2021, pelo estudo brasileiro de 2024)',
  },
  descricao: 'Creatinina, idade e sexo. Equações de 2021 e de 2009, ambas sem coeficiente de raça; resultado em mL/min/1,73 m² com a categoria G da KDIGO.',
  itens: [
    { tipo: 'numero', id: 'creatinina', rotulo: 'Creatinina sérica', unidade: 'mg/dL', min: 0.1, max: 25, passo: 0.01 },
    { tipo: 'numero', id: 'idade', rotulo: 'Idade', unidade: 'anos', min: 18, max: 120, passo: 1, ajuda: 'A equação vale a partir de 18 anos.' },
    { tipo: 'escolha', id: 'sexo', rotulo: 'Sexo', opcoes: [{ rotulo: 'Feminino', valor: 0 }, { rotulo: 'Masculino', valor: 1 }] },
  ],
  calcular(r) {
    if (!completo(ckdEpi, r)) return null
    const sexo: Sexo = escolha(ckdEpi, r, 'sexo')!.valor === 0 ? 'f' : 'm'
    const tfg = ckdEpi2021(numero(ckdEpi, r, 'creatinina')!, numero(ckdEpi, r, 'idade')!, sexo)
    if (tfg === null) return null
    // A eTFG é relatada em número inteiro e a categoria G é lida sobre o valor
    // relatado: 59,6 aparece como 60 e tem de cair em G2, não em G3a.
    const relatada = Math.round(tfg)
    const cat = categoriaTfg(relatada)
    return {
      rotulo: 'eTFG (CKD-EPI 2021)',
      valor: String(relatada),
      unidade: 'mL/min/1,73 m²',
      nota: `categoria ${cat} da KDIGO`,
      estado: relatada < 30 ? 2 : relatada < 60 ? 1 : 0,
      derivados: [
        ['Categoria de TFG (KDIGO)', cat],
        ...((): [string, string][] => {
          const t09 = ckdEpi2009(numero(ckdEpi, r, 'creatinina')!, numero(ckdEpi, r, 'idade')!, sexo)
          return t09 === null ? [] : [['CKD-EPI 2009 (sem coeficiente racial)', `${Math.round(t09)} mL/min/1,73 m² · ${categoriaTfg(Math.round(t09))}`]]
        })(),
      ],
      cuidados: [
        'Estudo brasileiro (Porto Alegre, 354 adultos; J Nephrol 2024): nenhuma equação atingiu a acurácia desejada; a de 2021 não superou a de 2009 e subestimou DRC em brancos, e os autores não recomendam trocar a de 2009 pela de 2021 no Brasil. O estudo usou o coeficiente racial para autodeclarados negros; a KDIGO 2024 recomenda equações sem raça. As duas aparecem aqui; a escolha é do médico ou do protocolo da unidade.',
        'Só vale com creatinina estável: na lesão renal aguda a estimativa não representa a filtração real.',
        'O resultado é indexado a 1,73 m² de superfície corporal.',
        'Categoria G isolada não define doença renal crônica (exige cronicidade e/ou marcador de lesão).',
        'Abaixo de 18 anos a CKD-EPI não vale. Até 13 anos, 11 meses e 29 dias: Schwartz (livro do ICr). De 14 a 17 anos a Central não tem fórmula com referência para este cálculo.',
      ],
    }
  },
}
