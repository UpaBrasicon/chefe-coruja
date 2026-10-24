import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Cólica nefrética no adulto (lacunas da Central, lote 2, 24/10/2026). Manual de
// Medicina de Emergência do HCFMUSP (3ª ed., 2022), cap. 62 Cólica nefrética
// (p. 842–851), lido no PDF (página do livro = página do PDF + 1). A tansulosina
// aparece como o livro traz e, ao lado, o ensaio de Meltzer 2018 (resumo), que
// não mostrou benefício abaixo de 9 mm. O escore STONE ficou de fora: o resumo não
// traz os pontos de cada item e um dos itens é a raça; fica para decisão do RT.
// A conduta é do médico (ADR 0007).

export const MELTZER_2018: Fonte = {
  citacao: 'Meltzer AC, Burrows PK, Wolfson AB, et al. Effect of tamsulosin on passage of symptomatic ureteral stones: a randomized clinical trial. JAMA Intern Med. 2018;178(8):1051–1057 (PMID 29913020): cálculo ureteral < 9 mm na TC; eliminação em 28 dias 50% com tansulosina 0,4 mg × 47% com placebo, diferença não significativa.',
  url: 'https://doi.org/10.1001/jamainternmed.2018.2259',
}

const PAG_COLICA = 'cap. 62 Cólica nefrética, p. 842–851'

export const fichaColicaRenalAdulto: Ficha = {
  ...fichaAdulto('adulto-colica-renal', 'Cólica nefrética — analgesia, cálculo e internação (adulto)', PAG_COLICA),
  versao: '2026-10-24.1',
  fontes: [pagina(PAG_COLICA), MELTZER_2018],
  revisadoEm: '24/10/2026 (lacunas da Central, lote 2; doses conferidas no texto do manual, com página; Meltzer 2018 pelo resumo)',
}

export type Analgesia = { linha: string; droga: string; dose: string; pagina: string; nota?: string }

/** Analgesia em degraus (p. 848). */
export const ANALGESIA: Analgesia[] = [
  { linha: '1ª linha', droga: 'AINE intravenoso — cetorolaco', dose: '10 mg EV (a ampola tem 30 mg; 10 mg já dá o efeito analgésico máximo)', pagina: 'p. 848', nota: 'Não está claro se um AINE é melhor que outro.' },
  { linha: 'Adjuvante', droga: 'Dipirona', dose: 'como adjuvante do AINE (o capítulo não traz dose)', pagina: 'p. 848' },
  { linha: '2ª linha', droga: 'Morfina', dose: '2 a 5 mg EV como dose inicial, se a dor ainda passa de 8 em 10', pagina: 'p. 848', nota: 'AINE com opioide é superior a cada um isolado.' },
  { linha: 'Alternativa ou refratária', droga: 'Quetamina', dose: '0,2 a 0,4 mg/kg EV lenta (pelo menos 5 minutos)', pagina: 'p. 848' },
  { linha: 'Náusea e vômito', droga: 'Ondansetrona', dose: '4 a 8 mg EV, repetida conforme a necessidade', pagina: 'p. 848' },
]

/** Quetamina analgésica 0,2–0,4 mg/kg (p. 848). */
export function quetaminaMg(pesoKg: number): [number, number] | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return [0.2 * pesoKg, 0.4 * pesoKg]
}

export type CondutaCalculo = { texto: string; pagina: string; tansulosina: boolean }

/** O que o capítulo diz pelo tamanho do cálculo ureteral (p. 849). */
export function condutaPorTamanho(mm: number): CondutaCalculo | null {
  if (!Number.isFinite(mm) || mm <= 0) return null
  if (mm < 5) return { texto: 'Menor que 5 mm: alta chance de eliminação espontânea sem intervenção.', pagina: 'p. 849', tansulosina: false }
  const partes: string[] = []
  if (mm <= 10) partes.push('Entre 5 e 10 mm: pode-se tentar a tansulosina 0,4 mg para aumentar a chance de eliminação espontânea.')
  if (mm > 6) partes.push('Acima de 6 mm na alta: encaminhar para avaliação ambulatorial com urologista.')
  if (mm > 10) partes.push('Acima de 10 mm: pedir avaliação urológica, porque a resolução sem intervenção é improvável.')
  return { texto: partes.join(' '), pagina: 'p. 849', tansulosina: mm <= 10 }
}

/** Indicações de internação (Tabela 5, p. 849–850). */
export const INTERNACAO: string[] = [
  'Febre ou sinais de sepse',
  'Dor intratável',
  'Rim único com cálculo obstrutivo ou transplantado renal',
  'Suspeita de nefrolitíase obstrutiva bilateral',
  'Insuficiência renal',
  'Possibilidade de outro diagnóstico com risco à vida',
  'Indicação cirúrgica em paciente sem controle adequado da dor',
]

/** Exames e infecção (p. 846–849). */
export const EXAMES_E_INFECCAO: { texto: string; pagina: string }[] = [
  { texto: 'Urina I como rastreio rápido e para afastar infecção; 10% das cólicas cursam sem hematúria.', pagina: 'p. 846' },
  { texto: 'Ultrassonografia como exame inicial; comparada à TC, não teve diferença de sensibilidade, especificidade, eventos graves ou controle da dor, com muito menos radiação.', pagina: 'p. 846–847' },
  { texto: 'TC helicoidal sem contraste é o padrão-ouro (sensibilidade 96%, especificidade 100%).', pagina: 'p. 847' },
  { texto: 'Hemograma, função renal e eletrólitos se houver infecção, oligúria ou indicação de internação.', pagina: 'p. 847' },
  { texto: 'Febre ou suspeita de infecção: considerar antibiótico com cobertura obrigatória para E. coli. Sepse de foco urinário: antibiótico é mandatório e há indicação de desobstrução urológica de emergência (duplo J ou nefrostomia).', pagina: 'p. 849' },
  { texto: 'Hidratação para eliminar o cálculo, apesar de comum, não tem evidência de benefício.', pagina: 'p. 848' },
]
