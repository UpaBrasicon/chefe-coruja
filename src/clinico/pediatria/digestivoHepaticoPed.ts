import { fichaP4, type DoseLivro } from './fonteP4.ts'
import type { Faixa } from './fonteP2.ts'
import { porPeso, positivoP5, type ItemLivro } from './fonteP5.ts'

// Hemorragia digestiva (cap. 34, p. 343–352) e insuficiência hepática aguda
// (cap. 36, p. 357–366) — livro do ICr. Octreotida e somatostatina como o
// capítulo 34 escreve (com a divergência do Apêndice anotada), omeprazol do
// Apêndice (o capítulo só indica "IBP"), critérios do PALF, dose tóxica de
// paracetamol, amônia, VIG e oferta hídrica restrita da IHA. Sem valor neonatal.

export const fichaDigestivoHepaticoPed = fichaP4('ped-hda-hepatica', 'Hemorragia digestiva e insuficiência hepática aguda — criança', 'cap. 34, p. 343–352; cap. 36, p. 357–366; Apêndice, p. 896, 905–910')

// ------------------------------------------------------------ hemorragia digestiva

export const DOSES_HDA: DoseLivro[] = [
  { id: 'octreotida-bolus', nome: 'Octreotida — bolus (HDA varicosa)', unidade: 'µg', porKgDose: [1, 1], maxDose: 50, via: 'EV, seguido de infusão contínua', pagina: 'p. 349',
    nota: 'Apêndice: ataque 1 a 2 µg/kg (p. 896; "1 – 2 mcg em bolus" na p. 905, sem "/kg"). O capítulo dá 1 µg/kg até 50 µg.' },
  { id: 'omeprazol-iv', nome: 'Omeprazol IV — HDA não varicosa (lesão péptica)', unidade: 'mg', porKgDia: [0.7, 3.3], doses: [1, 2], maxDia: 80, fonteMaximo: 'máx. do Apêndice: 80 mg/dia ou 4 mg/kg/dia (p. 906)', via: 'IV, 1 a 2 vezes ao dia', pagina: 'Apêndice, p. 906',
    nota: 'O capítulo indica IBP, preferindo omeprazol (p. 350), sem dose; dose do Apêndice.' },
]

/** Infusão contínua de octreotida (p. 349): 1 µg/kg/h, podendo chegar a 4 µg/kg/h. */
export const octreotidaInfusaoUgH = (pesoKg: number) => porPeso([1, 4], pesoKg)

/** Somatostatina (p. 349): 1 a 20 µg/kg/h; adolescentes e adultos 250 a 500 µg/h. */
export const somatostatinaUgH = (pesoKg: number) => porPeso([1, 20], pesoKg)
export const SOMATOSTATINA_ADOLESCENTE_UG_H: Faixa = [250, 500]

export const NOTA_VASOATIVOS =
  'Divergência com o Apêndice: octreotida contínua 0,5 a 2 µg/kg/h (p. 896) ou 1 a 2 µg/kg/h (p. 905); somatostatina ataque 3,5 µg/kg (máx. 250 µg) e manutenção 3,5 a 10 µg/kg/h com máximo de 50 µg/h (p. 908). O capítulo (p. 349) diz que as recomendações "variam muito" e dá as faixas mostradas; o teto de 50 µg/h do Apêndice não é aplicado à faixa do capítulo.'

export const REFERENCIAS_HDA: ItemLivro[] = [
  { texto: 'Hipotensão costuma aparecer só com perdas > 25% da volemia.', pagina: 'p. 347' },
  { texto: 'Melena pode ocorrer com sangramentos de 50 a 100 mL em 24 horas.', pagina: 'p. 346' },
  { texto: 'Reposição com SF ou Ringer lactato; CH em volume > 50% da volemia → considerar plasma e plaquetas; plaquetas se < 50.000 (ponderar na hipertensão portal com hiperesplenismo); plasma na coagulopatia.', pagina: 'p. 348' },
  { texto: 'Octreotida/somatostatina: infusão por 48 a 72 h; desmame 24 h após o controle, reduzindo à metade a cada 12 h.', pagina: 'p. 349' },
  { texto: 'EDA idealmente em até 12 h na HDA importante; estudo do ICr mostrou que, na hipertensão portal, pode ser feita após 12 h sem prejuízo.', pagina: 'p. 349' },
  { texto: 'Após hemostasia endoscópica de sangramento importante: jejum por 48 h e internação por pelo menos 72 h.', pagina: 'p. 350' },
  { texto: 'Balão de Sengstaken-Blakemore só em hemorragia maciça não controlada ou sem endoscopia disponível; TIPS após 2 falhas endoscópicas na mesma internação.', pagina: 'p. 349–350' },
]

// ------------------------------------------------------------ insuficiência hepática aguda

/**
 * Critérios do PALF para IHA em crianças (p. 357): sem hepatopatia crônica conhecida,
 * lesão hepática bioquímica, coagulopatia que não corrige com vitamina K e
 * INR > 1,5 ou TP ≥ 15 s COM encefalopatia, ou INR > 2 ou TP ≥ 20 s SEM encefalopatia.
 */
export function criterioCoagulacaoPalf(v: { inr: number; tpSeg: number; encefalopatia: boolean }): boolean | null {
  const temInr = positivoP5(v.inr)
  const temTp = positivoP5(v.tpSeg)
  if (!temInr && !temTp) return null
  if (v.encefalopatia) return (temInr && v.inr > 1.5) || (temTp && v.tpSeg >= 15)
  return (temInr && v.inr > 2) || (temTp && v.tpSeg >= 20)
}

export type LeituraParacetamol = { mgKg: number | null; toxicaUnica: 'sim' | 'faixa' | 'nao' | null; adolescenteAcima75g: boolean | null }

/**
 * Paracetamol (p. 358): dose tóxica em ingestão única > 150 a 200 mg/kg (criança);
 * adolescente > 7,5 g em dose única; repetida: > 75 mg/kg/dia em < 6 anos.
 */
export function leituraParacetamol(mgIngeridos: number, pesoKg: number): LeituraParacetamol | null {
  if (!positivoP5(mgIngeridos)) return null
  const mgKg = positivoP5(pesoKg) ? mgIngeridos / pesoKg : null
  const toxicaUnica = mgKg === null ? null : mgKg > 200 ? 'sim' : mgKg > 150 ? 'faixa' : 'nao'
  return { mgKg, toxicaUnica, adolescenteAcima75g: mgIngeridos > 7500 }
}

/** Amônia (p. 364): > 150 a 200 µmol/L (255 a 340 µg/dL) é fator de risco para HIC na IHA. */
export function leituraAmonia(umolL: number): 'acima' | 'faixa' | 'abaixo' | null {
  if (!positivoP5(umolL)) return null
  return umolL > 200 ? 'acima' : umolL > 150 ? 'faixa' : 'abaixo'
}

/** Glicose em altas taxas na IHA (p. 364): até 10 a 15 mg/kg/min → mg/min. */
export const glicoseIhaMgMin = (pesoKg: number) => porPeso([10, 15], pesoKg)

/** Oferta hídrica EV restrita a 85 a 95% (p. 361) da necessidade basal informada (mL/dia). */
export function ofertaRestritaIha(basalMlDia: number): Faixa | null {
  return positivoP5(basalMlDia) ? [basalMlDia * 0.85, basalMlDia * 0.95] : null
}

/** Tabela 2 (p. 360): estágios da encefalopatia hepática. */
export const ENCEFALOPATIA: [string, string, string, string, string][] = [
  ['0', 'Nenhum', 'Nenhum', 'Normal', 'Normal'],
  ['1', 'Choro inconsolável, inversão do sono, desatenção', 'Confusão, alteração de humor, inversão de sono, esquecimento', 'Reflexos normais ou aumentados; tremor, apraxia, alteração da caligrafia', 'Normal ou ondas lentas; ritmo teta; ondas trifásicas'],
  ['2', 'Choro inconsolável, inversão do sono, desatenção', 'Letargia, comportamento inadequado, desinibição', 'Reflexos normais ou aumentados; disartria, ataxia', 'Alentecimento generalizado; ondas trifásicas'],
  ['3', 'Sonolência, estupor, agressividade', 'Estupor; responde a comandos simples', 'Reflexos aumentados; Babinski; rigidez', 'Alentecimento generalizado; ondas trifásicas'],
  ['4', 'Coma — dor: sim (4a) / não (4b)', 'Coma — dor: sim (4a) / não (4b)', 'Descerebração ou decorticação; reflexos ausentes', 'Ondas delta'],
]

/** Tabela 3 (p. 361–362): etiologias com tratamento específico. */
export const TRATAMENTO_ESPECIFICO: [string, string][] = [
  ['Herpes simples', 'Aciclovir'],
  ['Induzida por medicamento', 'Retirada do medicamento'],
  ['Acetaminofeno', 'N-acetilcisteína'],
  ['Amanita phalloides', 'Penicilina'],
  ['Tirosinemia tipo 1', 'Nitisona + dieta'],
  ['Galactosemia', 'Retirar galactose da dieta'],
  ['Síndrome hematofagocítica', 'Quimioterapia'],
  ['Doença hepática aloimune gestacional', 'Imunoglobulina EV + exsanguineotransfusão'],
  ['Hepatite autoimune', 'Corticoterapia'],
]

export const REFERENCIAS_IHA: ItemLivro[] = [
  { texto: 'Aminotransferases quase sempre > 1.000 UI/L (até 80.000). Queda acentuada com piora funcional sugere falência iminente.', pagina: 'p. 357, 363' },
  { texto: 'Exames a cada 6 a 12 horas; normovolemia com cristaloide; noradrenalina no choque persistente; hidrocortisona no choque refratário (síndrome hepatoadrenal).', pagina: 'p. 361' },
  { texto: 'Hemocomponentes não no paciente estável; plasma antes de procedimento ou com sangramento ativo; plaquetas se < 50.000 com sangramento ativo; IBP ou sucralfato preferíveis a anti-H2.', pagina: 'p. 363' },
  { texto: 'Edema cerebral: Sat O2 > 95%, cabeça neutra com cabeceira a 20–30°, correção da hiponatremia tendendo à hipernatremia, manitol ou NaCl 3% se necessário.', pagina: 'p. 364' },
  { texto: 'Herpes: RN e lactentes com IHA recebem aciclovir empírico até as sorologias.', pagina: 'p. 366' },
]
