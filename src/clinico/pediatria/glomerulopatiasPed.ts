import { fichaP4, type DoseLivro } from './fonteP4.ts'
import type { Faixa } from './fonteP2.ts'
import { porPeso, porSC, positivoP5, type ItemLivro } from './fonteP5.ts'

// Síndrome nefrítica, síndrome nefrótica e SHU — livro do ICr, caps. 58 (p.
// 602–619), 59 (p. 620–627) e 60 (p. 628–640). Definições numéricas da
// síndrome nefrótica (Tabela 1), restrições da GNPE, albumina 20% e diuréticos
// da Figura 1 do cap. 59, pulsos de metilprednisolona e os limiares da SHU
// (transfusão, furosemida, plasmaférese, diálise). Superfície corpórea, quando
// usada, é informada pelo médico. Sem valor neonatal explícito.

export const fichaGlomerulopatiasPed = fichaP4('ped-glomerulopatias-shu', 'Síndromes nefrítica e nefrótica e SHU — criança', 'caps. 58–60, p. 602–640; Apêndice, p. 907')

// ------------------------------------------------------------ nefrótica (cap. 59)

export type LeituraPrCr = 'nefrotico' | 'remissao-completa' | 'remissao-parcial' | 'intermediario'

/**
 * Tabela 1 (p. 620): Pr/Cr ≥ 2 (primeira urina da manhã) = nível nefrótico;
 * ≤ 0,2 = faixa da remissão completa (exige ≥ 3 medidas consecutivas);
 * entre 0,2 e 2 com albumina ≥ 3 g/dL = remissão parcial.
 */
export function lerPrCr(prCr: number, albumina?: number): LeituraPrCr | null {
  if (!Number.isFinite(prCr) || prCr < 0) return null
  if (prCr >= 2) return 'nefrotico'
  if (prCr <= 0.2) return 'remissao-completa'
  return albumina !== undefined && positivoP5(albumina) && albumina >= 3 ? 'remissao-parcial' : 'intermediario'
}

/** Proteinúria nefrótica: ≥ 1.000 mg/m²/dia (cap. 59, p. 620) ou > 50 mg/kg/dia (cap. 58, p. 606). */
export function proteinuriaNefrotica(mgDia: number, pesoKg: number, scM2: number): { porKg: number | null; porM2: number | null; nefroticaKg: boolean | null; nefroticaM2: boolean | null } | null {
  if (!positivoP5(mgDia)) return null
  const porKg = positivoP5(pesoKg) ? mgDia / pesoKg : null
  const porM2 = positivoP5(scM2) ? mgDia / scM2 : null
  return { porKg, porM2, nefroticaKg: porKg === null ? null : porKg > 50, nefroticaM2: porM2 === null ? null : porM2 >= 1000 }
}

/** Hipotensão postural (p. 624): queda ≥ 20 mmHg da sistólica ou ≥ 10 mmHg da diastólica (deitado → sentado). */
export function hipotensaoPostural(pasDeitado: number, padDeitado: number, pasSentado: number, padSentado: number): boolean | null {
  if (!positivoP5(pasDeitado, padDeitado, pasSentado, padSentado)) return null
  return pasDeitado - pasSentado >= 20 || padDeitado - padSentado >= 10
}

/** Albumina 20%: 0,5 a 1 g/kg em 4 h (texto, p. 624; Figura 1: 1 g/kg). Volume de 20% = gramas × 5 mL. */
export function albumina20(pesoKg: number): { gramas: Faixa; mL: Faixa } | null {
  const g = porPeso([0.5, 1], pesoKg)
  return g ? { gramas: g, mL: [g[0] * 5, g[1] * 5] } : null
}

/** Sal na dieta (p. 624): 2 a 3 mEq/kg/dia; o livro põe "máximo 2 g/dia, a depender da idade". */
export const salNefroticaMeqDia = (pesoKg: number) => porPeso([2, 3], pesoKg)

export const NOTA_SAL =
  'O livro escreve "2 a 3 mEq/kg/dia, máximo 2 g/dia" (p. 624) sem dizer se os 2 g são de sal ou de sódio; a ferramenta mostra os mEq e não converte o máximo.'

export const DOSES_NEFROTICA: DoseLivro[] = [
  { id: 'furo-albumina', nome: 'Furosemida — durante a albumina (hipovolemia com repercussão e PA elevada)', unidade: 'mg', porKgDose: [1, 1], via: 'EV, dividida: metade no meio e metade no fim da albumina', pagina: 'Figura 1, p. 626' },
  { id: 'furo-hiper', nome: 'Furosemida — hipervolemia', unidade: 'mg', porKgDose: [0.5, 1], via: 'EV', pagina: 'Figura 1, p. 626' },
  { id: 'hctz', nome: 'Hidroclorotiazida — hipervolemia', unidade: 'mg', porKgDia: [1, 2], via: 'VO', pagina: 'Figura 1, p. 626',
    nota: 'Apêndice (p. 903): edema 1 a 2 mg/kg/dia em 2 doses, máx. 100 mg/dia (≥ 2 anos) e 37,5 mg/dia (< 2 anos). O capítulo não traz máximo.' },
  { id: 'espiro', nome: 'Espironolactona — hipervolemia (se injúria renal ou hipocalemia)', unidade: 'mg', porKgDia: [1, 3], via: 'VO', pagina: 'Figura 1, p. 626',
    nota: 'Apêndice (p. 901): dose inicial 1 a 3 mg/kg/dia, máx. 100 mg/dia. O capítulo não traz máximo.' },
]

export const INDICACOES_ALBUMINA: string[] = [
  'Hemoconcentração com hematócrito > 40% com hipovolemia, hipotensão postural e choque',
  'Ascite grave',
  'Edema genital',
  'Derrames cavitários extensos',
  'Piora da função renal na presença de hipovolemia',
]

// ------------------------------------------------------------ nefrítica (cap. 58)

/** GNPE: perdas insensíveis subtraídas da água endógena = 400 mL/m²/dia, + reposição parcial da diurese (p. 608). */
export const restricaoHidricaGnpe = (scM2: number) => porSC([400, 400], scM2)

export const DOSES_NEFRITICA: DoseLivro[] = [
  { id: 'furo-gnpe', nome: 'Furosemida — GNPE com congestão e HAS', unidade: 'mg', porKgDia: [1, 2], via: 'VO (IV nos casos graves de HAS, ICC e edema pulmonar)', pagina: 'p. 609' },
  { id: 'mp-pulso', nome: 'Metilprednisolona — pulso na GNRP', unidade: 'mg', porKgDose: [30, 30], doses: [1, 1], maxDose: 1000, via: 'EV em 2 a 4 h, diária ou em dias alternados, 3 a 6 pulsos', pagina: 'p. 611',
    nota: 'Nefrite lúpica III/IV: 30 mg/kg/dose (máx. 1 g) por 3 dias (p. 617).' },
  { id: 'prednisona', nome: 'Prednisona — após os pulsos', unidade: 'mg', porKgDia: [2, 2], maxDia: 60, fonteMaximo: 'máx. do Apêndice: 60 mg/dia (síndrome nefrótica, p. 907)', via: 'VO; tempo e redução pela doença de base', pagina: 'p. 611' },
]

export const BIOPSIA_GNPE: string[] = [
  'Oligoanúria por 48–72 h',
  'Piora progressiva da função renal em dias (GNRP)',
  'Proteinúria nefrótica por mais de 2–3 semanas',
  'Hipocomplementemia por mais de 8–12 semanas',
  'Hematúria macroscópica persistente por 3–4 semanas',
]

// ------------------------------------------------------------ SHU (cap. 60)

/** Concentrado de hemácias na SHU (p. 634–635): Hb < 6 g/dL ou Ht < 18%. */
export function shuIndicaCH(hb: number, ht: number): boolean | null {
  const temHb = positivoP5(hb)
  const temHt = positivoP5(ht)
  if (!temHb && !temHt) return null
  return (temHb && hb < 6) || (temHt && ht < 18)
}

/** 10 mL/kg em 3 a 4 h (costuma elevar Hb em 1 g/dL); meta pós-transfusional 8 a 9 g/dL (p. 635). */
export function chShu(pesoKg: number): { mL: number; mlH: Faixa } | null {
  if (!positivoP5(pesoKg)) return null
  const mL = 10 * pesoKg
  return { mL, mlH: [mL / 4, mL / 3] }
}

export const DOSES_SHU: DoseLivro[] = [
  { id: 'furo-shu', nome: 'Furosemida — tentativa de induzir diurese (sobrecarga cardiopulmonar)', unidade: 'mg', porKgDose: [2, 5], via: 'EV; não continuar se não houver resposta', pagina: 'p. 635',
    nota: 'Apêndice (p. 902): dose máxima de 6 mg/kg/dose, não exceder 200 mg/dose.' },
]

/** Plasmaférese (p. 636): volume de troca 40 a 60 mL/kg, com PFC como reposição. */
export const plasmafereseShuMl = (pesoKg: number) => porPeso([40, 60], pesoKg)

/** Tabela 2 (p. 633): tríade. */
export const TRIADE_SHU: [string, string][] = [
  ['Anemia hemolítica microangiopática', 'Hb geralmente < 8 g/dL; Coombs negativo; esquistócitos; DHL ↑, haptoglobina ↓, bilirrubina indireta discretamente ↑'],
  ['Trombocitopenia', 'Plaquetas < 140.000/mm³, geralmente próximas de 40.000/mm³'],
  ['Lesão renal aguda', 'De hematúria e proteinúria até insuficiência renal grave com oligoanúria'],
]

export const DIALISE_SHU: string[] = [
  'Sinais e sintomas de uremia',
  'Ureia ≥ 80 a 100 mg/dL',
  'Sobrecarga grave de fluidos refratária à terapia médica',
  'Hipercalemia e acidose graves refratárias',
  'Necessidade de suporte nutricional em criança oligúrica ou anúrica',
]

export const REFERENCIAS_GLOMERULOPATIAS: ItemLivro[] = [
  { texto: 'GNPE: restrição de sódio 1 a 2 g/dia na fase de edema, oligúria e HAS; restrição proteica (100 a 150% do recomendado) e de potássio se FG cair > 50%.', pagina: 'p. 609' },
  { texto: 'GNPE: penicilina ou amoxicilina VO por 10 dias se prova rápida/cultura positiva ou infecção evidente; profilaxia para contactantes íntimos.', pagina: 'p. 609' },
  { texto: 'Nefrótica: FeNa < 0,2% pode indicar hipovolemia (interpretar com a clínica); sinais de hipovolemia: taquicardia, oligúria, vasoconstrição, hipotensão postural, ureia e ácido úrico elevados.', pagina: 'p. 623' },
  { texto: 'Nefrótica: na hipovolemia considerar suspender iECA e inibidores de calcineurina; antibiótico profilático não é recomendado; vacina pneumocócica.', pagina: 'p. 623–624' },
  { texto: 'Nefrótica: tromboembolismo — HBPM SC no estável, heparina não fracionada EV no instável, com hipotensão grave ou insuficiência renal (doses: ferramenta de hemostasia e trombose, cap. 65).', pagina: 'p. 625' },
  { texto: 'SHU: plaquetas só com sangramento significativo ou procedimento invasivo; bloqueador de canal de cálcio como anti-hipertensivo inicial; sem antibiótico nem antimotilidade na suspeita de E. coli entero-hemorrágica.', pagina: 'p. 635–637' },
  { texto: 'SHU por pneumococo: cefalosporina de amplo espectro e considerar vancomicina.', pagina: 'p. 637' },
]
