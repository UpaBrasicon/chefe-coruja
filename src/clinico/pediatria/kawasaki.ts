import type { Ficha, Fonte } from '../ficha.ts'
import { fichaP4, type DoseLivro } from './fonteP4.ts'

// Doença de Kawasaki — livro do ICr, cap. 70 (p. 746–752). Contagem dos
// critérios clássicos, algoritmo da AHA para a forma incompleta (Figura 1,
// p. 748), classificação coronariana por Z-score e doses por peso (Tabela 1,
// p. 750–751). A contagem mostra o que o livro diz; o diagnóstico é do médico.
//
// Versão .1 de 25/10/2026 (lacunas da Central, lote 3): declaração científica
// da AHA 2024 lida no PDF da revista (página = página da revista, e481–e500).
// O livro continua a base; a AHA aparece ao lado: alto risco de aneurisma e
// intensificação inicial, doses da Tabela 3 e diferenças com o livro.

export const AHA_KAWASAKI_2024: Fonte = {
  citacao: 'Jone PN, Tremoulet A, Choueiter N, et al. Update on Diagnosis and Management of Kawasaki Disease: A Scientific Statement From the American Heart Association. Circulation. 2024;150(23):e481–e500. Diagnóstico e alto risco (p. e482), classificação coronariana (Tabela 1, p. e484), seguimento (Tabela 2, p. e486), tratamento (p. e485–e491; Tabela 3, p. e489).',
  url: 'https://doi.org/10.1161/CIR.0000000000001295',
  pediatrica: true,
}

const baseKawasaki = fichaP4('ped-kawasaki', 'Doença de Kawasaki — critérios e doses', 'cap. 70, p. 746–752; Apêndice, p. 897, 904')

export const fichaKawasaki: Ficha = {
  ...baseKawasaki,
  versao: '2026-10-25.1',
  fontes: [...baseKawasaki.fontes, AHA_KAWASAKI_2024],
  revisadoEm: '25/10/2026 (lacunas da Central, lote 3: AHA 2024 lida no PDF; livro do ICr mantido como base)',
}

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

// ── AHA 2024 (Jone et al., Circulation 2024) ────────────────────────────────

export type AltoRiscoAha2024 = { altoRisco: boolean; motivos: string[] }

/**
 * Alto risco de aneurisma na AHA 2024: idade < 6 meses ou Z ≥ 2,5 da
 * coronária direita ou da descendente anterior no ecocardiograma do
 * diagnóstico (Key Point 5, p. e482; p. e489). No choque do Kawasaki a
 * intensificação "precisa ser considerada" (p. e491). O escore de Son (p. e482)
 * tem item de raça e não é calculado.
 */
export function altoRiscoAha2024(idadeMeses: number | null, zBasal: number | null, choque = false): AltoRiscoAha2024 {
  const motivos: string[] = []
  if (idadeMeses !== null && Number.isFinite(idadeMeses) && idadeMeses >= 0 && idadeMeses < 6) motivos.push('idade abaixo de 6 meses')
  if (zBasal !== null && Number.isFinite(zBasal) && zBasal >= 2.5) motivos.push('Z ≥ 2,5 no ecocardiograma do diagnóstico')
  if (choque) motivos.push('choque do Kawasaki (p. e491)')
  return { altoRisco: motivos.length > 0, motivos }
}

/** Tabela 3 (p. e489): terapia inicial e intensificação no resistente à imunoglobulina ou de alto risco. */
export const DOSES_AHA_2024: DoseLivro[] = [
  { id: 'aha-ivig', nome: 'Imunoglobulina EV', unidade: 'g', porKgDose: [2, 2], doses: [1, 1], via: 'EV em 8 a 12 h; mais lenta no choque ou na disfunção miocárdica; na obesidade, considerar a massa magra', pagina: 'Tabela 3, p. e489' },
  { id: 'aha-aas', nome: 'AAS — fase aguda', unidade: 'mg', porKgDia: [30, 50], doses: [4, 4], via: 'VO de 6/6 h; depois 3–5 mg/kg/dia, 1 vez ao dia, afebril há 48–72 h', pagina: 'Tabela 3, p. e489',
    nota: 'Dose usada em muitos centros; há estudo prospectivo em andamento para definir a dose (Tabela 3). Não usar com AINE.' },
  { id: 'aha-prednisolona', nome: 'Prednisolona (esquema RAISE)', unidade: 'mg', porKgDia: [2, 2], doses: [3, 3], maxDia: 60, fonteMaximo: 'AHA 2024, Tabela 3', via: 'EV de 8/8 h por 5 dias internado; depois VO 2 mg/kg/dia de 8/8 h com retirada lenta em 15 dias (máximo 30 mg/dose) após normalizar a PCR', pagina: 'Tabela 3, p. e489' },
  { id: 'aha-metilpred', nome: 'Metilprednisolona (esquema norte-americano)', unidade: 'mg', porKgDia: [2, 2], doses: [2, 2], maxDia: 60, fonteMaximo: 'AHA 2024, Tabela 3', via: 'EV de 12/12 h por 5 dias internado; depois prednisona VO 2 mg/kg/dia de 12/12 h; com PCR < 1 mg/dL, retirar em 2–4 semanas cortando a dose pela metade a cada 5 dias', pagina: 'Tabela 3, p. e489' },
  { id: 'aha-infliximabe', nome: 'Infliximabe', unidade: 'mg', porKgDose: [10, 10], doses: [1, 1], via: 'EV em 2 h', pagina: 'Tabela 3, p. e489; KIDCARE, p. e488' },
]

export type ItemKawasaki2024 = { tema: string; aha: string; pagina: string; livro: string }

export const DIFERENCAS_KAWASAKI_2024: ItemKawasaki2024[] = [
  { tema: 'Alto risco e intensificação', aha: 'Idade < 6 meses ou Z ≥ 2,5 (coronária direita ou descendente anterior) no diagnóstico são de alto risco e devem ser considerados para intensificar a terapia inicial: imunoglobulina com outro anti-inflamatório (corticoide, infliximabe, entre outros). Faltam ensaios randomizados de eficácia', pagina: 'p. e482, e489–e491', livro: 'Escores asiáticos (Kobayashi, Egami, Sano); corticoide na fase inicial a critério de cada avaliador (p. 749)' },
  { tema: 'Infliximabe', aha: '10 mg/kg EV em 2 h', pagina: 'Tabela 3, p. e489', livro: '5 mg/kg EV, dose única (Tabela 1, p. 750)' },
  { tema: 'Corticoide', aha: 'Prednisolona 2 mg/kg/dia de 8/8 h (RAISE) ou metilprednisolona 2 mg/kg/dia de 12/12 h (norte-americano), 5 dias EV, máximo 60 mg/dia, com retirada oral', pagina: 'Tabela 3, p. e489', livro: 'No refratário: pulso de metilprednisolona 30 mg/kg (máx. 1 g) ou 1–2 mg/kg/dia de 6/6 ou 8/8 h (p. 749; Tabela 1, p. 750)' },
  { tema: 'Resistência à imunoglobulina', aha: 'Febre persistente ou recrudescente ≥ 36 h após o fim da infusão', pagina: 'p. e485, e488', livro: '36 a 48 h após o fim da imunoglobulina (p. 749)' },
  { tema: 'AAS na fase aguda', aha: 'Doses moderada (30–50) ou alta (80–100 mg/kg/dia) provavelmente não melhoram o desfecho coronariano; a Tabela 3 traz 30–50 mg/kg/dia, com estudo em andamento', pagina: 'p. e487–e488; Tabela 3, p. e489', livro: '30–50 mg/kg/dia; 80–100 têm sido evitados (p. 749)' },
  { tema: 'Antiagregação e anticoagulação', aha: 'Dupla antiagregação pode ser considerada com Z ≥ 5. Aneurisma gigante: AAS em dose baixa e varfarina, HBPM ou anticoagulante oral direto; anticoagulação pode ser considerada no gigante que regrediu a médio (nível 5.2)', pagina: 'p. e488, e491; Tabela 2, p. e486', livro: 'Médio: AAS + clopidogrel; gigante: anticoagulante + antiagregante (p. 750)' },
  { tema: 'Diagnóstico', aha: 'Critérios inalterados; com 4 ou mais critérios, diagnóstico no 4º dia de febre, e clínicos experientes podem fazê-lo no 3º. MIS-C entra no diagnóstico diferencial', pagina: 'p. e482', livro: '4º dia com ≥ 4 critérios (p. 747)' },
  { tema: 'Ecocardiograma', aha: 'Não deve atrasar o tratamento. Repetir antes da alta no alto risco ou na resistência; com Z ≥ 2,5, pelo menos 2 vezes por semana até parar de progredir. Usar a mesma equação de Z ao longo do seguimento', pagina: 'p. e484–e485', livro: '—' },
  { tema: 'Vacinas e imunoglobulina', aha: 'Vacinas de vírus vivo adiadas por 11 meses após a imunoglobulina; VHS não serve como marcador depois dela', pagina: 'p. e487', livro: '—' },
]

export const ERRATA_GIGANTE_AHA_2024 =
  'A AHA 2024 define aneurisma gigante como Z ≥ 10 ou diâmetro "≥ 8 mm" na Tabela 1 (p. e484) e "> 8 mm" na Tabela 2 (p. e486). O livro usa > 8 mm (p. 750), e a ferramenta segue o livro; em exatamente 8 mm as duas tabelas da AHA divergem.'

/** Velocidade da imunoglobulina (Apêndice, p. 904): 0,01 mL/kg/min, dobrando a cada 15–30 min até 0,08 mL/kg/min. Em mL/h. */
export function velocidadeIvigMlH(pesoKg: number): { inicial: number; maxima: number } | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  return { inicial: 0.01 * pesoKg * 60, maxima: 0.08 * pesoKg * 60 }
}
