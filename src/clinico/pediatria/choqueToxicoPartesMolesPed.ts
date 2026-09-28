import { fichaP4, type DoseLivro } from './fonteP4.ts'
import type { ItemLivro } from './fonteP5.ts'

// Síndrome do choque tóxico (cap. 46, p. 471–477) e infecções de pele e
// partes moles (cap. 48, p. 487–493) — livro do ICr. Critérios do CDC como o
// capítulo transcreve (Tabelas 2 e 3), penicilina cristalina, clindamicina e
// imunoglobulina da Figura 1 do cap. 46. O cap. 48 só NOMEIA os antibióticos
// (Tabela 1); as doses mostradas saem da Tabela 2 do Apêndice (p. 898–909),
// citadas como tal. Sem valor neonatal.

export const fichaChoqueToxicoPartesMoles = fichaP4('ped-choque-toxico-partes-moles', 'Choque tóxico e infecções de pele e partes moles — criança', 'cap. 46, p. 471–477; cap. 48, p. 487–493; Apêndice, p. 898–909')

/** Tabela 2 (p. 473–474): critérios clínicos da SCT estafilocócica. */
export const CLINICOS_ESTAFILO: { id: string; texto: string }[] = [
  { id: 'febre', texto: 'Febre ≥ 38,9 °C' },
  { id: 'rash', texto: 'Rash: eritrodermia macular difusa' },
  { id: 'descamacao', texto: 'Descamação 1–2 semanas após o rash' },
  { id: 'hipotensao', texto: 'Hipotensão: PAS < p5 para a idade (< 16 anos)' },
  { id: 'multissistemico', texto: 'Envolvimento multissistêmico (3 ou mais sistemas — marque abaixo)' },
]

export const SISTEMAS_ESTAFILO: { id: string; texto: string }[] = [
  { id: 'gi', texto: 'Gastrointestinal: vômito ou diarreia no início' },
  { id: 'muscular', texto: 'Muscular: mialgia intensa ou CPK ≥ 2× o normal' },
  { id: 'mucosa', texto: 'Mucosa: hiperemia vaginal, conjuntival ou de orofaringe' },
  { id: 'renal', texto: 'Renal: ureia ou creatinina ≥ 2× o normal, ou leucocitúria ≥ 5/campo sem ITU' },
  { id: 'hepatico', texto: 'Hepático: AST, ALT ou bilirrubina total ≥ 2× o normal' },
  { id: 'hemato', texto: 'Hematológico: plaquetas ≤ 100.000/mm³' },
  { id: 'neuro', texto: 'Neurológico: desorientação ou alteração de consciência sem sinal focal, sem febre ou hipotensão' },
]

/**
 * Classificação da SCT estafilocócica (p. 473): com critério laboratorial (culturas e
 * sorologias negativas, se obtidas), provável = 4 dos 5 clínicos; confirmado = 5 (inclui descamação).
 * O item "multissistêmico" conta quando 3 ou mais sistemas estão marcados.
 */
export function sctEstafilococica(clinicos: Set<string>, nSistemas: number, laboratorial: boolean): { nClinicos: number; caso: 'confirmado' | 'provável' | 'não preenche' } {
  const ids = new Set(clinicos)
  if (nSistemas >= 3) ids.add('multissistemico')
  else ids.delete('multissistemico')
  const nClinicos = CLINICOS_ESTAFILO.filter((c) => ids.has(c.id)).length
  if (!laboratorial) return { nClinicos, caso: 'não preenche' }
  return { nClinicos, caso: nClinicos === 5 ? 'confirmado' : nClinicos === 4 ? 'provável' : 'não preenche' }
}

/** Tabela 3 (p. 474): envolvimento de múltiplos órgãos na SCT estreptocócica (2 ou mais). */
export const ORGAOS_ESTREPTO: { id: string; texto: string }[] = [
  { id: 'renal', texto: 'Renal: creatinina ≥ 2× o limite superior para a idade' },
  { id: 'coag', texto: 'Coagulopatia: plaquetas ≤ 100.000/mm³ ou CIVD' },
  { id: 'hepatico', texto: 'Hepático: AST, ALT ou bilirrubina ≥ 2× o normal para a idade' },
  { id: 'sdra', texto: 'SDRA ou extravasamento capilar (edema generalizado, derrame com hipoalbuminemia)' },
  { id: 'rash', texto: 'Rash eritematoso macular' },
  { id: 'necrose', texto: 'Necrose de partes moles (fasciíte, miosite, gangrena)' },
]

/** SCT estreptocócica (p. 473): hipotensão + ≥ 2 órgãos; provável com isolamento de sítio não estéril, confirmado de sítio estéril. */
export function sctEstreptococica(hipotensao: boolean, nOrgaos: number, isolamento: 'nenhum' | 'nao-esteril' | 'esteril'): 'confirmado' | 'provável' | 'critério clínico sem isolamento' | 'não preenche' {
  if (!hipotensao || nOrgaos < 2) return 'não preenche'
  if (isolamento === 'esteril') return 'confirmado'
  if (isolamento === 'nao-esteril') return 'provável'
  return 'critério clínico sem isolamento'
}

const AP = (pag: string, max: string) => `máx. do Apêndice: ${max} (${pag})`

/** Figura 1 do cap. 46 (p. 476). */
export const DOSES_SCT: DoseLivro[] = [
  { id: 'penicilina', nome: 'Penicilina cristalina', unidade: 'UI', porKgDia: [200_000, 400_000], doses: [6, 6], maxDia: 24_000_000, fonteMaximo: AP('p. 906', '24 milhões de UI/dia'), via: 'EV de 4/4 h por 10 a 14 dias', pagina: 'Figura 1, p. 476' },
  { id: 'clindamicina', nome: 'Clindamicina (associação obrigatória; reduz a síntese de toxinas)', unidade: 'mg', porKgDia: [25, 40], doses: [3, 3], maxDia: 4800, fonteMaximo: AP('p. 900', '4,8 g/dia IV'), via: 'de 8/8 h', pagina: 'Figura 1, p. 476' },
  { id: 'igiv-unica', nome: 'Imunoglobulina IV — dose única (adjuvante, sem recomendação formal)', unidade: 'g', porKgDose: [1, 2], via: 'EV; alternativa: 1 g/kg no 1º dia e 0,5 g/kg nos 2 dias seguintes', pagina: 'Figura 1, p. 476' },
]

/** Cap. 48: antibióticos nomeados na Tabela 1 (p. 492–493); doses do Apêndice. */
export const DOSES_PELE: DoseLivro[] = [
  { id: 'cefalexina', nome: 'Cefalexina VO (cefalosporina de 1ª geração)', unidade: 'mg', porKgDia: [50, 100], doses: [3, 4], maxDia: 4000, fonteMaximo: AP('p. 899', '4 g/dia'), via: 'VO a cada 6 a 8 h', pagina: 'Apêndice, p. 899' },
  { id: 'clinda-vo', nome: 'Clindamicina VO', unidade: 'mg', porKgDia: [10, 30], doses: [3, 3], maxDia: 1800, fonteMaximo: AP('p. 900', '1,8 g/dia'), via: 'VO de 8/8 h', pagina: 'Apêndice, p. 900' },
  { id: 'clinda-iv', nome: 'Clindamicina IV', unidade: 'mg', porKgDia: [20, 40], doses: [3, 3], maxDia: 4800, fonteMaximo: AP('p. 900', '4,8 g/dia'), via: 'IV de 8/8 h, em 10 a 60 min', pagina: 'Apêndice, p. 900' },
  { id: 'amoxclav', nome: 'Amoxicilina-clavulanato 7:1 VO', unidade: 'mg', porKgDia: [25, 45], doses: [2, 2], maxDia: 1750, fonteMaximo: AP('p. 898', '1.750 mg/dia'), via: 'VO em 2 doses; dose da amoxicilina', pagina: 'Apêndice, p. 898' },
  { id: 'smxtmp', nome: 'Sulfametoxazol-trimetoprima — infecção moderada', unidade: 'mg', porKgDia: [6, 12], doses: [2, 2], via: 'VO ou IV em 2 doses; dose do trimetoprim', pagina: 'Apêndice, p. 908' },
  { id: 'doxi', nome: 'Doxiciclina (> 8 anos)', unidade: 'mg', porKgDia: [2.2, 2.2], doses: [1, 2], maxDose: 100, maxDia: 200, fonteMaximo: AP('p. 901', '200 mg/dia, 100 mg/dose'), via: 'VO/IV 1 a 2x/dia', pagina: 'Apêndice, p. 901' },
  { id: 'oxacilina', nome: 'Oxacilina IV', unidade: 'mg', porKgDia: [100, 200], doses: [4, 4], via: 'IV ou IM, 4 vezes ao dia', pagina: 'Apêndice, p. 906',
    errata: 'Apêndice (p. 906, conferido no PDF): "100 a 200 mg/kg/dia ... (máx. 2 g/dia)". Com 200 mg/kg/dia esse teto seria atingido já aos 10 kg, e o cap. 49 (p. 498) usa 200 mg/kg/dia na osteomielite; a ferramenta mostra o teto impresso mas não o aplica.' },
  { id: 'ceftriaxona', nome: 'Ceftriaxona (cefalosporina de 3ª geração)', unidade: 'mg', porKgDia: [50, 100], doses: [1, 2], maxDose: 2000, fonteMaximo: AP('p. 899', '2 g/dose'), via: 'IV ou IM, 1x/dia ou 12/12 h', pagina: 'Apêndice, p. 899' },
  { id: 'vancomicina', nome: 'Vancomicina', unidade: 'mg', porKgDose: [10, 15], doses: [4, 4], maxDia: 2000, fonteMaximo: AP('p. 909', '2.000 mg/dia'), via: 'IV de 6/6 h em ≥ 60 min', pagina: 'Apêndice, p. 909' },
  { id: 'linezolida', nome: 'Linezolida (< 12 anos)', unidade: 'mg', porKgDose: [10, 10], doses: [3, 3], maxDose: 600, fonteMaximo: AP('p. 904', '600 mg/dose'), via: 'VO/IV de 8/8 h', pagina: 'Apêndice, p. 904' },
  { id: 'piptazo', nome: 'Piperacilina-tazobactam', unidade: 'mg', porKgDia: [240, 400], doses: [3, 4], maxDia: 16_000, fonteMaximo: AP('p. 906', '16 g/dia'), via: 'IV 3 a 4 vezes ao dia; dose da piperacilina', pagina: 'Apêndice, p. 906' },
  { id: 'metronidazol', nome: 'Metronidazol IV', unidade: 'mg', porKgDia: [22.5, 40], doses: [3, 4], maxDia: 4000, fonteMaximo: AP('p. 905', '4.000 mg/dia'), via: 'IV a cada 6 a 8 h', pagina: 'Apêndice, p. 905' },
]

/** Tabela 1 do cap. 48 (p. 492–493). */
export const TABELA1_PELE: [string, string, string][] = [
  ['Impetigo e ectima', 'S. aureus, estreptococo do grupo A', 'Tópico: mupirocina ou retapamulina 2x/dia por 5 dias. Sistêmico (lesões numerosas, recorrentes, surtos): cefalosporina de 1ª geração, clindamicina ou SMX-TMP por 7 dias'],
  ['Erisipela e celulite', 'Estreptococos (A, B, C, G), S. aureus', 'Oral (5 a 10 dias): amoxicilina-clavulanato, cefalosporina de 1ª geração, clindamicina ou doxiciclina. IV (moderada/grave): oxacilina, cefalosporina de 1ª ou 3ª geração ou clindamicina; teicoplanina ou vancomicina se suspeita de MRSA'],
  ['Pele escaldada estafilocócica', 'S. aureus', 'Internação; IV: oxacilina, cefalosporina de 1ª geração ou clindamicina'],
  ['Choque tóxico', 'S. aureus (TSST-1)', 'IV: clindamicina e oxacilina (ou vancomicina se MRSA); IVIG se refratário a volume e vasopressor'],
  ['Celulite, fasceíte, miosite necrotizante', 'S. aureus, estreptococo do grupo A, polimicrobiano', 'Cirurgia; IV: (vancomicina ou linezolida) + (piperacilina-tazobactam ou carbapenêmico ou ceftriaxona + metronidazol)'],
  ['Gangrena de Fournier', 'Polimicrobiano', 'Cirurgia; mesmo esquema das necrotizantes'],
]

export const REFERENCIAS_SCT: ItemLivro[] = [
  { texto: 'Os sete Rs: reconhecimento, ressuscitação agressiva, remover a fonte (desbridamento, drenagem, tampões), racionalizar antibiótico (considerar MRSA), adjuvante (IGIV), reavaliar e reduzir risco em contactantes (quimioprofilaxia na estreptocócica).', pagina: 'Tabela 4, p. 476' },
  { texto: 'Muitos casos não preenchem os critérios na chegada; a suspeita é o que importa.', pagina: 'p. 473' },
  { texto: 'Mortalidade: estafilocócica 3–5%; estreptocócica 5–10%. Bacteremia < 5% x 60%.', pagina: 'p. 471–472' },
  { texto: 'Imunoglobulina: extrapolação da doença de Kawasaki, sem recomendação formal.', pagina: 'p. 476' },
]
