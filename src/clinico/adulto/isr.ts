import { fichaAdulto } from './fonte.ts'

// Intubação em sequência rápida do adulto — Anexo 1 do Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022), p. 1480–1482. Dose por kg e
// concentração da apresentação; o volume é calculado (as tabelas do livro vão
// de 40 a 100 kg e batem com a conta).

export const fichaIsrAdulto = fichaAdulto('adulto-isr', 'Intubação em sequência rápida — adulto', 'Anexo 1 — Padrão de diluição de medicações HC – adultos, p. 1480–1482')

export type DrogaIsr = {
  id: string
  nome: string
  papel: 'inducao' | 'analgesia' | 'bloqueio'
  /** mg/kg (ou dose fixa em µg quando `fixa`) */
  mgKg?: number
  fixa?: { minUg: number; maxUg: number }
  /** mg por mL (µg por mL no fentanil) */
  porMl: number
  /** conteúdo de uma ampola, na mesma unidade da dose */
  porAmpola: number
  apresentacao: string
}

export const DROGAS_ISR: DrogaIsr[] = [
  { id: 'propofol', nome: 'Propofol', papel: 'inducao', mgKg: 1.5, porMl: 10, porAmpola: 200, apresentacao: '10 mg/mL, ampola de 20 mL' },
  { id: 'midazolam', nome: 'Midazolam', papel: 'inducao', mgKg: 0.2, porMl: 5, porAmpola: 15, apresentacao: '5 mg/mL, ampola de 3 mL' },
  { id: 'etomidato', nome: 'Etomidato', papel: 'inducao', mgKg: 0.3, porMl: 2, porAmpola: 20, apresentacao: '2 mg/mL, ampola de 10 mL' },
  { id: 'quetamina', nome: 'Quetamina (cetamina)', papel: 'inducao', mgKg: 1.5, porMl: 50, porAmpola: 100, apresentacao: '50 mg/mL, ampola de 2 mL' },
  { id: 'fentanil', nome: 'Fentanil', papel: 'analgesia', fixa: { minUg: 50, maxUg: 150 }, porMl: 50, porAmpola: 500, apresentacao: '50 µg/mL, ampola de 10 mL' },
  { id: 'succinilcolina', nome: 'Succinilcolina', papel: 'bloqueio', mgKg: 1.5, porMl: 10, porAmpola: 100, apresentacao: '100 mg em 10 mL de diluente (10 mg/mL)' },
  { id: 'rocuronio', nome: 'Rocurônio', papel: 'bloqueio', mgKg: 1.2, porMl: 10, porAmpola: 50, apresentacao: '10 mg/mL, ampola de 5 mL' },
  { id: 'cisatracurio', nome: 'Cisatracúrio', papel: 'bloqueio', mgKg: 0.15, porMl: 2, porAmpola: 10, apresentacao: '2 mg/mL, ampola de 5 mL' },
]

export type DoseIsr = { dose: string; volumeMl: string; ampolas: number }

const br = (x: number) => (Math.round(x * 100) / 100).toLocaleString('pt-BR')

/** Dose, volume e nº de ampolas para o peso. Peso inválido não calcula. */
export function calcularIsr(d: DrogaIsr, pesoKg: number): DoseIsr | null {
  if (d.fixa) {
    return { dose: `${d.fixa.minUg}–${d.fixa.maxUg} µg`, volumeMl: `${br(d.fixa.minUg / d.porMl)}–${br(d.fixa.maxUg / d.porMl)}`, ampolas: 1 }
  }
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  const mg = d.mgKg! * pesoKg
  return { dose: `${br(mg)} mg`, volumeMl: br(mg / d.porMl), ampolas: Math.ceil(mg / d.porAmpola - 1e-9) }
}
