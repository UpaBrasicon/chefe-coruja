import { fichaP4 } from './fonteP4.ts'

// Recursos hemoterápicos — livro do ICr, cap. 67 (p. 723–732) — e anemia
// aguda, cap. 62 (p. 655–663). Volumes por peso de concentrado de hemácias,
// plasma, plaquetas (fórmula da p. 727), fator VIII/crioprecipitado, fator IX,
// albumina e cálcio na transfusão maciça. A volemia NÃO é estimada: o livro diz
// "calcular volemia em função do peso" (p. 727) sem dar mL/kg, então o médico a
// informa. RN: o capítulo dá limiares de plaquetas neonatais, mas nenhum
// volume neonatal — os volumes não são calculados para o RN.

export const fichaHemoterapiaPed = fichaP4('ped-hemoterapia', 'Hemocomponentes — volumes por peso', 'cap. 67, p. 723–732; cap. 62, p. 659')

const ok = (...xs: number[]) => xs.every((x) => Number.isFinite(x) && x > 0)

/** CH: 10 mL/kg sobe ≈ 3 g/dL de Hb; 3 mL/kg por 1 g/dL desejado (p. 725; Tabela 1, p. 729). */
export function chPadraoMl(pesoKg: number): number | null {
  return ok(pesoKg) ? 10 * pesoKg : null
}
export function chPorIncrementoMl(pesoKg: number, incrementoGdl: number): number | null {
  return ok(pesoKg, incrementoGdl) ? 3 * pesoKg * incrementoGdl : null
}
/** Anemia aguda com repercussão (cap. 62, p. 659): 10 a 15 mL/kg em até 3 a 4 h (mínimo de 1 h). */
export function chAnemiaAgudaMl(pesoKg: number): [number, number] | null {
  return ok(pesoKg) ? [10 * pesoKg, 15 * pesoKg] : null
}
/** Tempo de infusão a 2,5 mL/min (p. 725), em minutos. O livro limita a 4 h. */
export function minutosA25(volumeMl: number): number | null {
  return ok(volumeMl) ? volumeMl / 2.5 : null
}
export const LIMITE_INFUSAO_MIN = 240
/** Diluição opcional com SF de até 20% do volume solicitado (p. 725). */
export function sfDiluicaoMaxMl(volumeMl: number): number | null {
  return ok(volumeMl) ? 0.2 * volumeMl : null
}
/** Uma unidade inteira de CH ≈ 300 mL; < 30 kg recebem unidades fracionadas (p. 725). */
export const UNIDADE_CH_ML = 300
export const PESO_UNIDADE_FRACIONADA_KG = 30

/** PFC: 10 a 15 mL/kg (p. 728). Unidade de 200 a 250 mL. */
export function pfcMl(pesoKg: number): [number, number] | null {
  return ok(pesoKg) ? [10 * pesoKg, 15 * pesoKg] : null
}

/** Concentração de plaquetas (p. 727): STD 9,1 × 10⁸/mL; aférese 1,5 × 10⁹/mL. */
export const PLAQ_STD_ML = 9.1e8
export const PLAQ_AF_ML = 1.5e9
/** Rendimento após 1 h, "geralmente 0,80" (p. 727). */
export const RENDIMENTO_PLAQ = 0.8

/** V (mL) = Δplaq (/mm³) × 1.000 × volemia (mL) / (concentração × 0,80) (p. 727). */
export function plaquetasVolumeMl(deltaPlaqMm3: number, volemiaMl: number, produto: 'std' | 'af', rendimento = RENDIMENTO_PLAQ): number | null {
  if (!ok(deltaPlaqMm3, volemiaMl, rendimento)) return null
  return (deltaPlaqMm3 * 1000 * volemiaMl) / ((produto === 'std' ? PLAQ_STD_ML : PLAQ_AF_ML) * rendimento)
}

/** Fator VIII (e crioprecipitado): UI = peso × 0,5 × fator desejado (%) (p. 728–729). Repetir 1/3 a cada 8 h. */
export function fatorVIIIUI(pesoKg: number, deltaPct: number): { dose: number; repeticao8h: number } | null {
  if (!ok(pesoKg, deltaPct)) return null
  const dose = pesoKg * 0.5 * deltaPct
  return { dose, repeticao8h: dose / 3 }
}
/** Crioprecipitado: 80 a 120 UI de fator VIII por unidade (p. 728) → nº de unidades [mín, máx]. */
export function crioUnidades(doseUI: number): [number, number] | null {
  return ok(doseUI) ? [doseUI / 120, doseUI / 80] : null
}
/** Fator IX: UI = peso × fator desejado (%) (p. 729). */
export function fatorIXUI(pesoKg: number, deltaPct: number): number | null {
  return ok(pesoKg, deltaPct) ? pesoKg * deltaPct : null
}

/** Albumina: g = peso × 0,8 × Δalbuminemia (g/dL) (p. 730). Frasco 20% de 50 mL = 10 g; +18 mL de volemia por grama. */
export function albumina(pesoKg: number, deltaGdl: number): { g: number; frascos20: number; mL20: number; expansaoMl: number } | null {
  if (!ok(pesoKg, deltaGdl)) return null
  const g = pesoKg * 0.8 * deltaGdl
  return { g, frascos20: g / 10, mL20: g * 5, expansaoMl: g * 18 }
}

/** Transfusão maciça: 1 mL de gluconato de cálcio 10% a cada 100 mL de CH além da volemia (p. 725). */
export function gluconatoMacicaMl(volumeChMl: number, volemiaMl: number): number | null {
  if (!ok(volumeChMl, volemiaMl)) return null
  return Math.max(0, volumeChMl - volemiaMl) / 100
}

/** Imunoglobulina anti-D: 20 µg por unidade de plaquetas Rh+ em receptor Rh−, até 24 h, IV (p. 727). */
export const ANTI_D_MCG_POR_UNIDADE = 20

export const LIMIARES: { texto: string; pagina: string }[] = [
  { texto: 'Anemia aguda: Hb entre 6 e 7 g/dL é tolerada. Reposição de CH na criança a partir de perda aguda ≥ 15 a 20% (adulto ≥ 25%); a indicação se baseia mais nos sinais clínicos que em Hb/Ht.', pagina: 'p. 724' },
  { texto: 'Anemia normovolêmica: consenso de evitar CH com Hb > 10 g/dL e de não evitar com Hb < 7 g/dL; onco-hematológicos em regime crônico: aceitável com Hb < 8 g/dL.', pagina: 'p. 726' },
  { texto: 'Plaquetas: sangramento ativo com < 100.000/mm³; profilaxia com produção comprometida 10.000–20.000/mm³; procedimento invasivo < 50.000/mm³ (oftalmológico ou SNC < 100.000/mm³). PTI/hiperesplenismo: só terapêutica (sangramento > grau II).', pagina: 'p. 726; Tabela 1, p. 729' },
  { texto: 'RN: profilaxia de plaquetas com 25.000 a 50.000/mm³ nos estáveis e 100.000/mm³ nos prematuros extremos.', pagina: 'p. 726' },
  { texto: 'Plaquetas com antígenos ABO incompatíveis com o plasma da criança: rendimento 20% menor.', pagina: 'p. 727' },
  { texto: 'Albumina: indicação mais rigorosa com albuminemia entre 2 e 2,5 g/dL; acima de 4 g/dL a taxa de catabolismo aumenta; repetir a dosagem em 24 h.', pagina: 'p. 730' },
  { texto: 'Concentrado de granulócitos: RN < 2 semanas com sepse e neutrófilos < 3.000/mm³ (recurso de exceção).', pagina: 'p. 728' },
  { texto: 'Ringer lactato e soluções glicosadas não devem correr junto do CH. Transfusão maciça: 1 ou mais volemias em < 24 h; bicarbonato contraindicado.', pagina: 'p. 724–725' },
]

/** Tabela 2 (p. 731): reações transfusionais — referência. */
export const REACOES: [string, string, string][] = [
  ['Hemolítica', 'Febre, tremores, náuseas, vômitos, dor, desconforto respiratório, hipotensão; pode evoluir com IRA, icterícia e distúrbio da hemostasia', 'Interromper a transfusão; enviar hemocomponente e amostra; urina para hemoglobinúria; suporte avançado; diferenciar de contaminação bacteriana'],
  ['Febril não hemolítica', 'Febre, tremores, calafrios, rubor; 30 min a 2 h do início; comum em politransfundidos', 'Interromper e enviar para testes; sintomáticos; profilaxia com filtro leucocitário'],
  ['Alérgica', 'Urticária; anafilaxia', 'Interromper; anti-histamínico/corticoide; adrenalina se anafilaxia'],
  ['TACO', 'Sinais agudos de insuficiência cardíaca congestiva', 'Suporte avançado'],
  ['TRALI', 'Insuficiência respiratória aguda sem ICC, durante ou até 24 h após', 'Suporte ventilatório'],
]

export const ERRATAS_HEMOTERAPIA: string[] = [
  'Tabela 1 (p. 729): "3 mL/kg para cada 1 mg/dL de aumento desejado da hemoglobina" — o texto da p. 725 diz g/dL. A ferramenta usa g/dL.',
  'p. 728: a UI de fator VIII é definida como a quantidade em "1 mL de um pool de perfluorocarbono (PFC)" — no contexto, PFC é o plasma fresco congelado.',
  'Aférese: o texto diz equipamentos para crianças "de até 10 a 12 kg" (p. 728) e a conclusão, "limite inferior de peso ... 10 kg" (p. 731).',
  'Crioprecipitado: 80 a 120 UI de fator VIII por unidade no texto (p. 728); "aproximadamente 100 UI" na conclusão (p. 731). A tela mostra a faixa.',
]
