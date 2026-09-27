import { fichaPediatrica } from './fonte.ts'

// Doses pediátricas por peso — só o que o manual do HCFMUSP (3ª ed., 2022)
// traz para a criança, com página. Cálculo puro: dose = porKg × peso (limitada
// ao máximo/mínimo do livro); volume = dose ÷ concentração da apresentação.

export const fichaBolusPediatrico = fichaPediatrica(
  'ped-bolus',
  'Doses pediátricas por peso',
  'Anexo 2 (p. 1490–1494); cap. 3 (p. 59–62); cap. 11 (p. 177); cap. 99 (p. 1337); cap. 101 (p. 1352)',
)

export type Grupo = 'isr' | 'bloqueioContinuo' | 'anafilaxia' | 'antidoto'

export const GRUPOS: Record<Grupo, string> = {
  isr: 'Intubação — sequência rápida (Anexo 2)',
  bloqueioContinuo: 'Bloqueio neuromuscular após a intubação (cap. 3)',
  anafilaxia: 'Anafilaxia — segunda linha (cap. 11)',
  antidoto: 'Antídotos (caps. 99 e 101)',
}

export type Bolus = {
  id: string
  nome: string
  grupo: Grupo
  unidade: 'mg' | 'µg' | 'g' | 'mL' | 'mg/h'
  /** faixa por kg na unidade acima (por kg por hora nas infusões) */
  faixa: [number, number]
  /** valor por kg usado no cálculo; na faixa larga, o ponto que a tabela do livro usa */
  calcularEm: number
  maximo?: number
  minimo?: number
  /** unidade por mL da solução usada (mesma unidade da dose; mg/mL nas infusões) */
  porMl?: number
  apresentacao: string
  via: string
  pagina: string
  nota?: string
  errata?: string
}

const B = (b: Bolus) => b

export const BOLUS: Bolus[] = [
  // ── Anexo 2 — Padrão de diluição HC, crianças ──
  B({ id: 'atropina', nome: 'Atropina', grupo: 'isr', unidade: 'mg', faixa: [0.02, 0.02], calcularEm: 0.02, minimo: 0.1, maximo: 1, porMl: 0.25, apresentacao: '0,25 mg/mL (ampola 1 mL)', via: 'EV, 1 a 2 min antes da intubação', pagina: 'p. 1490',
    errata: 'A tabela 1 do livro dá volumes abaixo da dose mínima de 0,1 mg nos pesos baixos (ex.: 0,24 mL = 0,06 mg a 3 kg); aqui vale o mínimo que o próprio livro define.' }),
  B({ id: 'lidocaina', nome: 'Lidocaína', grupo: 'isr', unidade: 'mg', faixa: [1.5, 1.5], calcularEm: 1.5, porMl: 2, apresentacao: '20 mg/mL diluída 1:10 em SG 5% (2 mg/mL)', via: 'EV, 2 a 5 min antes da laringoscopia', pagina: 'p. 1490' }),
  B({ id: 'fentanil', nome: 'Fentanil', grupo: 'isr', unidade: 'µg', faixa: [2, 2], calcularEm: 2, porMl: 5, apresentacao: '50 µg/mL: 1 ampola (10 mL) + SF 90 mL = 5 µg/mL', via: 'EV lento', pagina: 'p. 1490–1491' }),
  B({ id: 'morfina', nome: 'Morfina', grupo: 'isr', unidade: 'mg', faixa: [0.05, 0.05], calcularEm: 0.05, porMl: 1, apresentacao: '1 mg/mL (ampola 10 mL)', via: 'EV', pagina: 'p. 1491',
    errata: 'A tabela 4 do livro repete os volumes do fentanil (ex.: 1,2 mL a 3 kg); pela dose de 0,05 mg/kg a 1 mg/mL, 3 kg dão 0,15 mL.' }),
  B({ id: 'etomidato', nome: 'Etomidato', grupo: 'isr', unidade: 'mg', faixa: [0.2, 0.4], calcularEm: 0.3, porMl: 2, apresentacao: '2 mg/mL (ampola 10 mL)', via: 'EV em 30 a 60 s', pagina: 'p. 1491',
    nota: 'O cap. 3 (p. 59) dá 0,3 mg/kg para o paciente acima de 10 anos.' }),
  B({ id: 'midazolam', nome: 'Midazolam', grupo: 'isr', unidade: 'mg', faixa: [0.1, 0.3], calcularEm: 0.2, porMl: 5, apresentacao: '5 mg/mL (ampola 3 mL); pode diluir 1:10 em SF', via: 'EV', pagina: 'p. 1491–1492' }),
  B({ id: 'diazepam', nome: 'Diazepam', grupo: 'isr', unidade: 'mg', faixa: [0.3, 0.6], calcularEm: 0.3, porMl: 5, apresentacao: '5 mg/mL (ampola 2 mL); pode diluir 1:10 em SF', via: 'EV', pagina: 'p. 1492' }),
  B({ id: 'propofol', nome: 'Propofol', grupo: 'isr', unidade: 'mg', faixa: [1, 3], calcularEm: 1, porMl: 10, apresentacao: '10 mg/mL (ampola 20 mL); pode diluir 1:10 em SG 5%', via: 'EV', pagina: 'p. 1492–1493',
    nota: 'O cap. 3 (p. 59) dá 2,5 mg/kg como dose pediátrica habitual de indução.' }),
  B({ id: 'quetamina-ev', nome: 'Quetamina — EV', grupo: 'isr', unidade: 'mg', faixa: [1, 4], calcularEm: 1, porMl: 50, apresentacao: '50 mg/mL (ampola 2 mL); pode diluir 1:10 ou 1:100 em SF', via: 'EV', pagina: 'p. 1493' }),
  B({ id: 'quetamina-im', nome: 'Quetamina — IM', grupo: 'isr', unidade: 'mg', faixa: [3, 6], calcularEm: 3, porMl: 50, apresentacao: '50 mg/mL (ampola 2 mL)', via: 'IM', pagina: 'p. 1493' }),
  B({ id: 'rocuronio', nome: 'Rocurônio', grupo: 'isr', unidade: 'mg', faixa: [0.6, 1.2], calcularEm: 1.2, porMl: 10, apresentacao: '10 mg/mL (ampola 5 mL); pode diluir 1:10 em SF', via: 'EV', pagina: 'p. 1493',
    nota: 'O cap. 3 (p. 60) dá 0,6 mg/kg como dose pediátrica habitual.' }),
  B({ id: 'succinilcolina-lactente', nome: 'Succinilcolina — lactente', grupo: 'isr', unidade: 'mg', faixa: [2, 2], calcularEm: 2, porMl: 10, apresentacao: '100 mg em 10 mL de diluente (10 mg/mL)', via: 'EV (IM: 4 mg/kg)', pagina: 'p. 1494',
    nota: 'O cap. 3 (p. 60) dá 2–3 mg/kg EV ou 4 mg/kg IM (máx. 150 mg) para a criança.' }),
  B({ id: 'succinilcolina-crianca', nome: 'Succinilcolina — criança não lactente', grupo: 'isr', unidade: 'mg', faixa: [1, 1.5], calcularEm: 1, porMl: 10, apresentacao: '100 mg em 10 mL de diluente (10 mg/mL)', via: 'EV (IM: 2–3 mg/kg)', pagina: 'p. 1494',
    nota: 'O cap. 3 (p. 60) dá 2–3 mg/kg EV ou 4 mg/kg IM (máx. 150 mg) para a criança.' }),

  // ── cap. 3 — manutenção do bloqueio (adulto e pediátrico) ──
  B({ id: 'cisatracurio-ataque', nome: 'Cisatracúrio — dose inicial', grupo: 'bloqueioContinuo', unidade: 'mg', faixa: [0.18, 0.18], calcularEm: 0.18, porMl: 1, apresentacao: '2 mg/mL: 100 mg + SF 50 mL (1 mg/mL)', via: 'EV', pagina: 'p. 61–62' }),
  B({ id: 'cisatracurio-infusao', nome: 'Cisatracúrio — manutenção', grupo: 'bloqueioContinuo', unidade: 'mg/h', faixa: [0.06, 0.12], calcularEm: 0.06, porMl: 1, apresentacao: '100 mg + SF 50 mL (1 mg/mL)', via: 'EV contínua, após evidência de bloqueio', pagina: 'p. 62' }),
  B({ id: 'rocuronio-infusao', nome: 'Rocurônio — manutenção', grupo: 'bloqueioContinuo', unidade: 'mg/h', faixa: [0.6, 0.6], calcularEm: 0.6, porMl: 2, apresentacao: '500 mg + SF 200 mL (2 mg/mL)', via: 'EV contínua, após os primeiros sinais de recuperação da dose de intubação', pagina: 'p. 61' }),

  // ── cap. 11 — anafilaxia (terapias de segunda linha) ──
  B({ id: 'metilprednisolona', nome: 'Metilprednisolona', grupo: 'anafilaxia', unidade: 'mg', faixa: [1, 2], calcularEm: 1, maximo: 125, apresentacao: '—', via: 'EV', pagina: 'p. 177' }),
  B({ id: 'hidrocortisona', nome: 'Hidrocortisona', grupo: 'anafilaxia', unidade: 'mg', faixa: [5, 10], calcularEm: 5, maximo: 300, apresentacao: '—', via: 'EV', pagina: 'p. 177' }),
  B({ id: 'magnesio', nome: 'Sulfato de magnésio (broncoespasmo grave)', grupo: 'anafilaxia', unidade: 'mg', faixa: [25, 50], calcularEm: 25, apresentacao: '—', via: 'EV em 20 a 30 min', pagina: 'p. 177' }),
  B({ id: 'cristaloide-anafilaxia', nome: 'Cristaloide no choque', grupo: 'anafilaxia', unidade: 'mL', faixa: [10, 20], calcularEm: 20, apresentacao: '—', via: 'EV nos primeiros minutos', pagina: 'p. 177' }),

  // ── antídotos ──
  B({ id: 'hidroxicobalamina', nome: 'Hidroxicobalamina (cianeto)', grupo: 'antidoto', unidade: 'mg', faixa: [70, 70], calcularEm: 70, apresentacao: '—', via: 'EV em 15 min; repetir se necessário', pagina: 'cap. 99, p. 1337' }),
  B({ id: 'nitrito-sodio', nome: 'Nitrito de sódio 3% (cianeto, sem hidroxicobalamina)', grupo: 'antidoto', unidade: 'mL', faixa: [0.15, 0.33], calcularEm: 0.15, apresentacao: 'ampola de 10 mL a 3%, diluída em 100 mL de SF', via: 'EV em 10 min', pagina: 'cap. 99, p. 1337' }),
  B({ id: 'tiossulfato', nome: 'Tiossulfato de sódio (cianeto, sem hidroxicobalamina)', grupo: 'antidoto', unidade: 'mg', faixa: [400, 400], calcularEm: 400, maximo: 12500, apresentacao: '—', via: 'EV, após o nitrito', pagina: 'cap. 99, p. 1337' }),
  B({ id: 'neostigmina', nome: 'Neostigmina (manifestação paralítica grave)', grupo: 'antidoto', unidade: 'mg', faixa: [0.01, 0.04], calcularEm: 0.01, porMl: 0.5, apresentacao: '0,5 mg/mL', via: 'EV', pagina: 'cap. 101, p. 1352' }),
]

export type DoseCalculada = {
  dose: number
  volumeMl: number | null
  noMaximo: boolean
  noMinimo: boolean
  faixaTotal: [number, number]
}

/** Dose para o peso. Peso inválido não calcula. Nas infusões, volume = mL/h. */
export function calcularBolus(b: Bolus, pesoKg: number): DoseCalculada | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  let dose = b.calcularEm * pesoKg
  const noMaximo = b.maximo !== undefined && dose > b.maximo
  if (noMaximo) dose = b.maximo!
  const noMinimo = b.minimo !== undefined && dose < b.minimo
  if (noMinimo) dose = b.minimo!
  const lim = (x: number) => Math.max(b.minimo ?? 0, b.maximo !== undefined ? Math.min(x, b.maximo) : x)
  return { dose, volumeMl: b.porMl ? dose / b.porMl : null, noMaximo, noMinimo, faixaTotal: [lim(b.faixa[0] * pesoKg), lim(b.faixa[1] * pesoKg)] }
}
