import { fichaIcr, ok, positivo } from './fonteIcr.ts'

// Diarreia aguda — desidratação e planos de hidratação. Cap. 32 do
// Pronto-Socorro ICr-HCFMUSP (4ª ed., 2023), p. 326–334. A escala e os volumes
// são os do livro; a classificação é apoio, a decisão é do profissional (ADR 0007).

export const fichaDesidratacaoPed = fichaIcr('ped-diarreia-desidratacao', 'Diarreia aguda — desidratação e planos A, B e C', 'cap. 32, p. 326–334')

// ---------------------------------------------------------------- grau pelo peso

export type GrauPeso = 'leve' | 'moderada' | 'grave'

/** Pela porcentagem de peso perdido (p. 328): leve < 5%; moderada 5–10%; grave > 10%. */
export function grauPorPeso(pesoAnteriorKg: number, pesoAtualKg: number): { perdaPct: number; grau: GrauPeso | null } | null {
  if (!positivo(pesoAnteriorKg, pesoAtualKg) || pesoAtualKg > pesoAnteriorKg) return null
  const perdaPct = ((pesoAnteriorKg - pesoAtualKg) / pesoAnteriorKg) * 100
  const grau: GrauPeso = perdaPct < 5 ? 'leve' : perdaPct <= 10 ? 'moderada' : 'grave'
  return { perdaPct, grau }
}

export const GRAU_PESO_TEXTO: Record<GrauPeso, string> = {
  leve: 'Grau 1 ou leve (< 5%)',
  moderada: 'Grau 2 ou moderada (5 a 10%)',
  grave: 'Grau 3 ou grave (> 10%)',
}

// ---------------------------------------------------------------- escala clínica

export type ItemEscala = { id: 'aparencia' | 'olhos' | 'mucosas' | 'lagrimas'; nome: string; opcoes: [string, string, string] }

/** Tabela 1 — escala de desidratação clínica (p. 329; adaptada de Friedman et al., 2004). */
export const ESCALA_CLINICA: ItemEscala[] = [
  { id: 'aparencia', nome: 'Aparência geral', opcoes: ['Normal', 'Sedenta, inquieta ou letárgica, mas irritada quando tocada', 'Sonolenta, hipotônica, fria ou sudorética ± comatosa'] },
  { id: 'olhos', nome: 'Olhos', opcoes: ['Normal', 'Levemente encovados', 'Extremamente encovados'] },
  { id: 'mucosas', nome: 'Mucosas', opcoes: ['Úmidas', 'Saliva espessa', 'Secas'] },
  { id: 'lagrimas', nome: 'Lágrimas', opcoes: ['Presentes', 'Diminuídas', 'Ausentes'] },
]

export type ClasseClinica = 'sem' | 'alguma' | 'grave'

/** Escore 0 → nenhuma desidratação; 1–4 → alguma; 5–8 → grave (p. 328–329). */
export function classificarEscore(pontos: number[]): { escore: number; classe: ClasseClinica } | null {
  if (pontos.length !== ESCALA_CLINICA.length || !ok(...pontos) || pontos.some((p) => ![0, 1, 2].includes(p))) return null
  const escore = pontos.reduce((a, b) => a + b, 0)
  return { escore, classe: escore === 0 ? 'sem' : escore <= 4 ? 'alguma' : 'grave' }
}

export const CLASSE_TEXTO: Record<ClasseClinica, string> = {
  sem: 'Escore 0 — nenhuma desidratação (Plano A no algoritmo, p. 333)',
  alguma: 'Escore 1 a 4 — alguma desidratação (Plano B no algoritmo, p. 333)',
  grave: 'Escore 5 a 8 — desidratação grave (Plano C no algoritmo, p. 333)',
}

export const NOTA_ESCALA =
  'A referência da escala citada pelo livro (Friedman et al., 2004) foi desenvolvida para crianças de 1 a 36 meses (título da referência 3, p. 333).'

// ---------------------------------------------------------------- planos

/** Plano A: líquidos após cada evacuação diarreica, por idade (p. 330). */
export function planoA(idadeAnos: number): { texto: string; faixaMl: [number, number] | null } | null {
  if (!ok(idadeAnos) || idadeAnos < 0) return null
  if (idadeAnos < 2) return { texto: '< 2 anos: 50–100 mL após cada evacuação', faixaMl: [50, 100] }
  if (idadeAnos <= 10) return { texto: '2–10 anos: 100–200 mL após cada evacuação', faixaMl: [100, 200] }
  return { texto: '> 10 anos: volume livre, de acordo com a aceitação', faixaMl: null }
}

export const NOTA_PLANO_A_IDADE =
  'O livro escreve "2-10 anos" e "> 10 anos" (p. 330): a criança com 10 anos completos fica na faixa de 100–200 mL.'

/** Plano B: SRO 75 mL/kg em 4 horas, em observação até terminar a reidratação (p. 330). */
export const SRO_ML_KG = 75
export const SRO_HORAS = 4

export function planoB(pesoKg: number): { totalMl: number; mlH: number } | null {
  if (!positivo(pesoKg)) return null
  const totalMl = SRO_ML_KG * pesoKg
  return { totalMl, mlH: totalMl / SRO_HORAS }
}

/**
 * Plano C: via parenteral com solução isotônica (SF 0,9% ou Ringer lactato). O livro diz que não há
 * consenso e cita duas referências (p. 330): ESPGHAN 20 mL/kg/h por 2 a 4 h; OMS 100 mL/kg em 3 a 6 h.
 */
export function planoC(pesoKg: number) {
  if (!positivo(pesoKg)) return null
  return {
    espghan: { mlH: 20 * pesoKg, totalMl: [20 * pesoKg * 2, 20 * pesoKg * 4] as [number, number], texto: 'ESPGHAN: 20 mL/kg/h por 2 a 4 horas' },
    oms: { totalMl: 100 * pesoKg, mlH: [(100 * pesoKg) / 6, (100 * pesoKg) / 3] as [number, number], texto: 'OMS: 100 mL/kg em 3 a 6 horas, a depender da idade' },
  }
}

export const NOTA_PLANO_C =
  'O livro não define como a idade escolhe entre 3 e 6 horas no esquema da OMS; a ferramenta mostra a faixa inteira. Reavaliar a desidratação a cada 30 minutos no início e depois a cada 1 hora (p. 330).'

// ---------------------------------------------------------------- medicações citadas

/** Ondansetrona 0,1 mg/kg (p. 331). O livro não traz dose máxima. */
export function ondansetronaMg(pesoKg: number): number | null {
  return positivo(pesoKg) ? 0.1 * pesoKg : null
}

/** Zinco: 10 mg/dia < 6 meses; 20 mg/dia > 6 meses, por 10 a 14 dias (p. 331). */
export function zincoMgDia(idadeMeses: number): number | null {
  if (!ok(idadeMeses) || idadeMeses < 0) return null
  if (idadeMeses < 6) return 10
  if (idadeMeses > 6) return 20
  return null
}

export const NOTA_ZINCO = 'O livro escreve "< 6 meses" e "> 6 meses" (p. 331): com 6 meses exatos a ferramenta não escolhe dose.'

/** Racecadotrila 1,5 mg/kg três vezes ao dia enquanto houver diarreia (p. 331). */
export function racecadotrilaMgDose(pesoKg: number): number | null {
  return positivo(pesoKg) ? 1.5 * pesoKg : null
}
