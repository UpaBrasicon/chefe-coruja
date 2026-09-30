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
    titulo: 'TFG estimada — CKD-EPI 2021 (adulto)',
    versao: '2026-09-30.1',
    publico: 'adulto',
    fontes: [
      { citacao: 'Inker LA, Eneanya ND, Coresh J, et al. New Creatinine- and Cystatin C–Based Equations to Estimate GFR without Race. N Engl J Med. 2021;385(19):1737–1749.', url: 'https://doi.org/10.1056/NEJMoa2102953' },
      { citacao: 'Kidney Disease: Improving Global Outcomes (KDIGO) CKD Work Group. KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease. Kidney Int. 2024;105(4S):S117–S314. Categorias de TFG G1–G5.', url: 'https://doi.org/10.1016/j.kint.2023.10.018' },
    ],
    revisadoEm: '30/09/2026 (referência primária; aguarda aprovação do RT)',
  },
  descricao: 'Creatinina, idade e sexo. Equação de 2021 sem coeficiente de raça; resultado em mL/min/1,73 m² com a categoria G da KDIGO.',
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
      derivados: [['Categoria de TFG (KDIGO)', cat]],
      cuidados: [
        'Só vale com creatinina estável: na lesão renal aguda a estimativa não representa a filtração real.',
        'O resultado é indexado a 1,73 m² de superfície corporal.',
        'Categoria G isolada não define doença renal crônica (exige cronicidade e/ou marcador de lesão).',
        'Criança e adolescente abaixo de 18 anos: use a Schwartz (livro do ICr).',
      ],
    }
  },
}
