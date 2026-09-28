import { fichaP4, type DoseLivro } from './fonteP4.ts'

// Doença de Kawasaki — livro do ICr, cap. 70 (p. 746–752). Contagem dos
// critérios clássicos, algoritmo da AHA para a forma incompleta (Figura 1,
// p. 748), classificação coronariana por Z-score e doses por peso (Tabela 1,
// p. 750–751). A contagem mostra o que o livro diz; o diagnóstico é do médico.

export const fichaKawasaki = fichaP4('ped-kawasaki', 'Doença de Kawasaki — critérios e doses', 'cap. 70, p. 746–752; Apêndice, p. 897, 904')

export const CRITERIOS_CLINICOS: { id: string; texto: string }[] = [
  { id: 'exantema', texto: 'Exantema polimorfo' },
  { id: 'conjuntivite', texto: 'Conjuntivite bilateral não purulenta' },
  { id: 'orofaringe', texto: 'Alterações de orofaringe (língua em framboesa, enantema, fissuras labiais)' },
  { id: 'extremidades', texto: 'Alterações de extremidades (eritema/edema de palmas e plantas; descamação periungueal na fase subaguda)' },
  { id: 'linfonodo', texto: 'Linfonodomegalia cervical, em geral > 1,5 cm, unilateral' },
]

export type LeituraClassica = { criterios: number; classica: boolean; quartoDia: boolean; incompletaAvaliar: boolean }

/**
 * Forma clássica (p. 747): febre por ao menos 5 dias + ao menos 4 dos 5
 * critérios; com ≥ 4 critérios a AHA admite o diagnóstico já no 4º dia de
 * febre. Forma incompleta (Figura 1): febre ≥ 5 dias com 2 ou 3 critérios, ou
 * lactente < 6 meses com febre ≥ 7 dias sem outra explicação.
 */
export function lerCriterios(diasFebre: number, criterios: number, idadeMeses: number | null): LeituraClassica | null {
  if (!Number.isFinite(diasFebre) || diasFebre < 0 || !Number.isInteger(criterios) || criterios < 0 || criterios > 5) return null
  const classica = diasFebre >= 5 && criterios >= 4
  const quartoDia = diasFebre >= 4 && diasFebre < 5 && criterios >= 4
  const lactente = idadeMeses !== null && Number.isFinite(idadeMeses) && idadeMeses < 6 && diasFebre >= 7
  const incompletaAvaliar = !classica && ((diasFebre >= 5 && (criterios === 2 || criterios === 3)) || lactente)
  return { criterios, classica, quartoDia, incompletaAvaliar }
}

/** Figura 1: alterações laboratoriais da forma incompleta (considerar se PCR ≥ 3 mg/dL ou 30 mg/L e/ou VHS ≥ 40 mm/h). */
export const LAB_INCOMPLETA: { id: string; texto: string }[] = [
  { id: 'anemia', texto: 'Anemia para a idade' },
  { id: 'plaquetas', texto: 'Plaquetas ≥ 450.000 após o 7º dia de febre' },
  { id: 'albumina', texto: 'Albumina ≤ 3,0 g/dL' },
  { id: 'alt', texto: 'Aumento de ALT' },
  { id: 'leucocitos', texto: 'Leucócitos ≥ 15.000/mm³' },
  { id: 'urina', texto: 'Urina ≥ 10 leucócitos/campo' },
]

export type LeituraIncompleta = 'inflamacao-baixa' | 'tratar-lab' | 'depende-eco'

/**
 * Figura 1 (p. 748): PCR < 3 mg/dL e VHS < 40 → avaliação seriada; PCR ≥ 3
 * e/ou VHS ≥ 40 → ≥ 3 alterações laboratoriais: "tratar como doença de
 * Kawasaki"; senão, depende do ecocardiograma (Z ≥ 2,5, ou ≥ 3 achados).
 */
export function lerIncompleta(pcrMgDl: number, vhs: number, alteracoesLab: number): LeituraIncompleta | null {
  if (![pcrMgDl, vhs].every((x) => Number.isFinite(x) && x >= 0) || !Number.isInteger(alteracoesLab) || alteracoesLab < 0) return null
  if (pcrMgDl < 3 && vhs < 40) return 'inflamacao-baixa'
  return alteracoesLab >= 3 ? 'tratar-lab' : 'depende-eco'
}

export type Coronaria = 'normal' | 'dilatacao' | 'aneurisma-pequeno' | 'aneurisma-medio' | 'aneurisma-gigante' | 'abaixo'

/**
 * Z-score (p. 749–750): normal entre −2 e +2; dilatação +2 a +2,5; aneurisma
 * > +2,5 (pequeno ≥ +2,5 e < +5; médio ≥ +5 e < +10; gigante ≥ +10 ou > 8 mm).
 */
export function classificarZ(z: number, diametroMm?: number): Coronaria | null {
  if (!Number.isFinite(z)) return null
  if (z >= 10 || (diametroMm !== undefined && Number.isFinite(diametroMm) && diametroMm > 8)) return 'aneurisma-gigante'
  if (z >= 5) return 'aneurisma-medio'
  if (z >= 2.5) return 'aneurisma-pequeno'
  if (z > 2) return 'dilatacao'
  if (z >= -2) return 'normal'
  return 'abaixo'
}

export const ROTULO_CORONARIA: Record<Coronaria, string> = {
  normal: 'Normal (−2 a +2)',
  dilatacao: 'Dilatação (+2 a +2,5)',
  'aneurisma-pequeno': 'Aneurisma pequeno (≥ +2,5 e < +5): AAS 3–5 mg/kg/dia',
  'aneurisma-medio': 'Aneurisma médio (≥ +5 e < +10): AAS 3–5 mg/kg/dia + clopidogrel',
  'aneurisma-gigante': 'Aneurisma gigante (≥ +10 ou > 8 mm): anticoagulante + antiagregante',
  abaixo: 'Abaixo de −2 (o livro não classifica)',
}

export const ERRATA_Z =
  'Em Z = +2,5 o texto diz "aneurismas são definidos por Z-score maior que +2,5" (p. 749), mas a seção antitrombótica classifica aneurisma pequeno como "≥ +2,5" (p. 750) e a Figura 1 usa "≥ 2,5". A ferramenta segue o "≥".'

export const DOSES_KAWASAKI: DoseLivro[] = [
  { id: 'ivig', nome: 'Imunoglobulina EV', unidade: 'g', porKgDose: [2, 2], doses: [1, 1], via: 'EV, dose única, infusão lenta (10 a 12 h pelo Apêndice); preferencialmente até o 10º dia', pagina: 'p. 749; Tabela 1, p. 750',
    nota: 'Refratário (febre 36–48 h após o fim da infusão): 2ª dose de 2 g/kg e/ou metilprednisolona (p. 749).' },
  { id: 'aas-alta', nome: 'AAS — fase aguda', unidade: 'mg', porKgDia: [30, 50], doses: [3, 4], via: 'VO de 6/6 ou 8/8 h até 48–72 h afebril', pagina: 'p. 749; Tabela 1, p. 750',
    nota: 'O Apêndice (p. 897) dá 30 a 100 mg/kg/dia em 4 doses; o capítulo diz que 80 a 100 mg/kg/dia têm sido evitados (p. 749).' },
  { id: 'aas-baixa', nome: 'AAS — antiagregante', unidade: 'mg', porKgDia: [3, 5], doses: [1, 1], maxDia: 100, via: 'VO 1 vez ao dia; 6 a 8 semanas sem aneurisma', pagina: 'p. 749; Tabela 1, p. 751' },
  { id: 'metilpred-pulso', nome: 'Metilprednisolona — pulso', unidade: 'mg', porKgDose: [30, 30], maxDose: 1000, via: 'EV 1 vez ao dia, 1 a 3 pulsos', pagina: 'p. 749; Tabela 1, p. 750' },
  { id: 'metilpred-dia', nome: 'Metilprednisolona — dose alta diária', unidade: 'mg', porKgDia: [1, 2], doses: [3, 4], via: 'EV de 6/6 ou 8/8 h até afebril; depois VO com redução em 2 a 3 semanas', pagina: 'p. 749; Tabela 1, p. 750',
    nota: 'A Tabela 1 escreve "de 8/8h" e o texto "de 6/6h ou de 8/8h".' },
  { id: 'infliximabe', nome: 'Infliximabe (refratário, 2ª opção)', unidade: 'mg', porKgDose: [5, 5], doses: [1, 1], via: 'EV, dose única', pagina: 'p. 749; Tabela 1, p. 750' },
]

/** Velocidade da imunoglobulina (Apêndice, p. 904): 0,01 mL/kg/min, dobrando a cada 15–30 min até 0,08 mL/kg/min. Em mL/h. */
export function velocidadeIvigMlH(pesoKg: number): { inicial: number; maxima: number } | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return { inicial: 0.01 * pesoKg * 60, maxima: 0.08 * pesoKg * 60 }
}
