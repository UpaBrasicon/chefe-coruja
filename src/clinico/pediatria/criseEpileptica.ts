import { fichaP2, type DosePeso, type Faixa } from './fonteP2.ts'

// Crise epiléptica na criança — livro do ICr, cap. 9 (p. 123–128). Doses da
// Tabela 1 (p. 127) e do texto (p. 126), com o tempo mínimo de infusão que o
// livro dá (fenitoína até 50 mg/min; valproato 1,5 a 3 mg/kg/min; fenobarbital
// em 10 min). Medicar crises que duram mais de 3 a 5 minutos (p. 126).

export const fichaCriseEpilepticaPediatrica = fichaP2(
  'ped-crise-epileptica-icr',
  'Crise epiléptica — criança',
  'cap. 9, p. 123–128',
)

export type EtapaCrise = 'benzodiazepinico' | 'segunda' | 'terceira' | 'refratario' | 'suporte'

export const ETAPAS_CRISE: Record<EtapaCrise, string> = {
  suporte: 'Glicemia e piridoxina',
  benzodiazepinico: 'Benzodiazepínico (pode repetir até 3 vezes)',
  segunda: 'Sem parada com benzodiazepínico — dose de ataque',
  terceira: 'Crise mantida — fenobarbital',
  refratario: 'EME refratário (terapia intensiva, suporte ventilatório)',
}

export type DoseCrise = DosePeso & { etapa: EtapaCrise }

export const DOSES_CRISE: DoseCrise[] = [
  { etapa: 'suporte', id: 'glicose25', nome: 'Glicose 25% (hipoglicemia)', unidade: 'mL', porKg: [2, 4], via: 'IV em push', pagina: 'p. 126' },
  { etapa: 'benzodiazepinico', id: 'lorazepam', nome: 'Lorazepam IV ou IM', unidade: 'mg', porKg: [0.05, 0.1], maximo: 4, via: 'IV ou IM', pagina: 'p. 127 (Tabela 1)' },
  { etapa: 'benzodiazepinico', id: 'diazepam-iv', nome: 'Diazepam IV', unidade: 'mg', porKg: [0.2, 0.4], maximo: 10, via: 'IV', pagina: 'p. 127 (Tabela 1)' },
  { etapa: 'benzodiazepinico', id: 'diazepam-vr', nome: 'Diazepam retal', unidade: 'mg', porKg: [0.5, 1], via: 'VR (o livro não dá máximo por esta via)', pagina: 'p. 127 (Tabela 1)' },
  { etapa: 'benzodiazepinico', id: 'midazolam-iv', nome: 'Midazolam IV', unidade: 'mg', porKg: [0.1, 0.3], maximo: 10, via: 'IV', pagina: 'p. 127 (Tabela 1)' },
  { etapa: 'benzodiazepinico', id: 'midazolam-im', nome: 'Midazolam IM', unidade: 'mg', porKg: [0.2, 0.4], maximo: 5, via: 'IM', pagina: 'p. 127 (Tabela 1)' },
  { etapa: 'benzodiazepinico', id: 'midazolam-in', nome: 'Midazolam intranasal ou bucal', unidade: 'mg', porKg: [0.2, 0.3], maximo: 7.5, via: 'IN ou bucal', pagina: 'p. 127 (Tabela 1)' },
  { etapa: 'segunda', id: 'fenitoina', nome: 'Fenitoína — ataque', unidade: 'mg', porKg: [10, 20], via: 'IV até 50 mg/min, com monitor cardíaco; precipita em soro com glicose', pagina: 'p. 127 (Tabela 1)',
    nota: 'Em uso crônico, 5 a 10 mg/kg. Manutenção 5 a 7 mg/kg/dia, 12 h após o ataque.' },
  { etapa: 'segunda', id: 'fenitoina-cronico', nome: 'Fenitoína — ataque em uso crônico', unidade: 'mg', porKg: [5, 10], via: 'IV até 50 mg/min', pagina: 'p. 127 (Tabela 1)' },
  { etapa: 'segunda', id: 'valproato', nome: 'Ácido valproico', unidade: 'mg', porKg: [20, 40], via: 'IV a 1,5 a 3 mg/kg/min', pagina: 'p. 127 (Tabela 1)' },
  { etapa: 'segunda', id: 'levetiracetam', nome: 'Levetiracetam', unidade: 'mg', porKg: [60, 60], maximo: 4500, via: 'IV; ajustar na doença renal crônica', pagina: 'p. 127 (Tabela 1)' },
  { etapa: 'terceira', id: 'fenobarbital', nome: 'Fenobarbital — ataque', unidade: 'mg', porKg: [20, 20], via: 'IV (em 10 min) ou IM; início de ação em 15 a 20 min', pagina: 'p. 127 (Tabela 1)',
    nota: 'Manutenção 3 a 5 mg/kg/dia, 24 h após o ataque. Com benzodiazepínico: depressão respiratória, sedação, hipotensão.' },
  { etapa: 'refratario', id: 'midazolam-continuo', nome: 'Midazolam — infusão contínua', unidade: 'µg/min', porKg: [1, 18], via: 'IV contínua: iniciar em 1 µg/kg/min e subir de 1 em 1 a cada 5 min', pagina: 'p. 127 (Tabela 1)' },
  { etapa: 'refratario', id: 'tiopental-bolus', nome: 'Tiopental — bolus', unidade: 'mg', porKg: [5, 5], maximo: 500, via: 'IV', pagina: 'p. 127 (Tabela 1)' },
  { etapa: 'refratario', id: 'tiopental-continuo', nome: 'Tiopental — contínuo', unidade: 'mg/h', porKg: [1, 3], via: 'IV contínua', pagina: 'p. 127 (Tabela 1)' },
  { etapa: 'refratario', id: 'propofol', nome: 'Propofol', unidade: 'mg/h', porKg: [5, 5], via: 'IV contínua', pagina: 'p. 127 (Tabela 1)' },
]

export const PIRIDOXINA = { dose: '50 a 100 mg/dose, IV ou IM', indicacao: 'recém-nascidos e intoxicação por isoniazida', pagina: 'p. 126' }

/** Tempo mínimo da infusão da fenitoína (até 50 mg/min), em minutos. */
export function tempoMinimoFenitoina(doseMg: number): number | null {
  if (!Number.isFinite(doseMg) || doseMg <= 0) return null
  return doseMg / 50
}

/** Valproato a 1,5–3 mg/kg/min: tempo de infusão (min) para a dose por kg — [mais rápido, mais lento]. */
export function tempoValproato(mgPorKg: number): Faixa | null {
  if (!Number.isFinite(mgPorKg) || mgPorKg <= 0) return null
  return [mgPorKg / 3, mgPorKg / 1.5]
}
