import { fichaAdulto } from './fonte.ts'
import type { Faixa, ItemManual } from './pcr.ts'

// Fibrilação atrial do adulto — Manual de Medicina de Emergência do HCFMUSP
// (3ª ed., 2022), cap. 17, p. 243–256. A ferramenta faz as contas por peso e
// por tempo e converte para mL/h só com a diluição que o próprio livro traz
// (Tabela 3, p. 252–254). A escolha da estratégia é do médico (ADR 0007).
// CHA2DS2-VA e HAS-BLED já existem em src/clinico/escores (não duplicados).

export const fichaFibrilacaoAtrialAdulto = fichaAdulto(
  'adulto-fibrilacao-atrial',
  'Fibrilação atrial — controle de frequência e de ritmo (adulto)',
  'cap. 17 Fibrilação atrial, p. 243–256 (texto p. 248–251; Tabela 3, p. 252–254)',
)

const valido = (x: number) => Number.isFinite(x) && x > 0
const vezes = (f: Faixa, k: number): Faixa => [f[0] * k, f[1] * k]

/** Diluições da Tabela 3 (p. 253–254), em mg/mL, como o livro declara. */
export const DILUICOES_FA = {
  esmolol: { mgMl: 10, preparo: 'esmolol 2.500 mg/10 mL — 10 mL + SF 0,9% 240 mL (10 mg/mL)', pagina: 'Tabela 3, p. 253' },
  diltiazem: {
    mgMl: 1, preparo: 'diltiazem "50 mg/frasco 100 mg" + SG 5% 100 mL (1 mg/mL)', pagina: 'Tabela 3, p. 254',
    errata: 'O preparo do diltiazem está escrito de forma ambígua ("50 mg/frasco 100 mg + SG 5% 100 mL"). A conta usa a concentração que o livro declara (1 mg/mL).',
  },
  amiodarona: {
    mgMl: 3.6, preparo: 'amiodarona 150 mg/3 mL — 18 mL + SG 5% 232 mL (3,6 mg/mL)', pagina: 'Tabela 3, p. 254',
    errata: 'Na Tabela 3 a linha vem com o rótulo "Dose sugerida", mas o conteúdo é a diluição. A concentração confere: 18 mL × 50 mg/mL = 900 mg em 250 mL = 3,6 mg/mL.',
  },
}

/** mL/h de uma dose em mg/h numa concentração em mg/mL. */
const mlH = (mgH: number, mgMl: number) => mgH / mgMl

// ── Controle de frequência (p. 248; Tabela 3, p. 253–254) ───────────────────

export const ESMOLOL_FA = { ataqueMgKg: 0.5, ataqueMin: 1, manutUgKgMin: [50, 200] as Faixa, meiaVidaMin: 9, pagina: 'p. 248; Tabela 3, p. 253' }

export type EsmololFa = { ataqueMg: number; manutUgMin: Faixa; manutMlH: Faixa }

/** Esmolol: ataque opcional 0,5 mg/kg em 1 min; manutenção 50 até 200 µg/kg/min; mL/h a 10 mg/mL. */
export function esmololFa(pesoKg: number): EsmololFa | null {
  if (!valido(pesoKg)) return null
  const ugMin = vezes(ESMOLOL_FA.manutUgKgMin, pesoKg)
  return {
    ataqueMg: ESMOLOL_FA.ataqueMgKg * pesoKg,
    manutUgMin: ugMin,
    manutMlH: [mlH((ugMin[0] * 60) / 1000, DILUICOES_FA.esmolol.mgMl), mlH((ugMin[1] * 60) / 1000, DILUICOES_FA.esmolol.mgMl)],
  }
}

export const VERAPAMIL_FA = { bolusMgKg: [0.075, 0.15] as Faixa, bolusMin: 2, manutMgH: 5, referenciaMg: [5, 10] as Faixa, pagina: 'p. 248; Tabela 3, p. 253' }

/** Verapamil: bolus 0,075–0,15 mg/kg em 2 min ("por volta de 5 a 10 mg"). O livro não traz diluição. */
export function verapamilFa(pesoKg: number): { bolusMg: Faixa } | null {
  return valido(pesoKg) ? { bolusMg: vezes(VERAPAMIL_FA.bolusMgKg, pesoKg) } : null
}

export const DILTIAZEM_FA = { bolusMgKg: 0.25, bolusMin: 2, manutMgH: [5, 15] as Faixa, pagina: 'p. 248; Tabela 3, p. 254' }

/** Diltiazem: bolus 0,25 mg/kg em 2 min; manutenção 5–15 mg/h (a 1 mg/mL = 5–15 mL/h). */
export function diltiazemFa(pesoKg: number): { bolusMg: number; manutMlH: Faixa } | null {
  if (!valido(pesoKg)) return null
  const c = DILUICOES_FA.diltiazem.mgMl
  return { bolusMg: DILTIAZEM_FA.bolusMgKg * pesoKg, manutMlH: [mlH(DILTIAZEM_FA.manutMgH[0], c), mlH(DILTIAZEM_FA.manutMgH[1], c)] }
}

export const DIGOXINA_FA = { bolusMg: [0.25, 0.5] as Faixa, maximoMg: 1, maximoUgKg: [8, 12] as Faixa, pagina: 'p. 248; Tabela 3, p. 254' }

export type DigoxinaFa = { maximoPorPesoMg: Faixa; maximoAbsolutoMg: number; tetoMenorMg: Faixa }

/** Digoxina: bolus 0,25–0,5 mg até 1 mg; dose máxima por peso 8–12 µg/kg. Mostra os dois tetos e o menor. */
export function digoxinaFa(pesoKg: number): DigoxinaFa | null {
  if (!valido(pesoKg)) return null
  const porPeso = vezes(DIGOXINA_FA.maximoUgKg, pesoKg / 1000)
  return {
    maximoPorPesoMg: porPeso,
    maximoAbsolutoMg: DIGOXINA_FA.maximoMg,
    tetoMenorMg: [Math.min(porPeso[0], DIGOXINA_FA.maximoMg), Math.min(porPeso[1], DIGOXINA_FA.maximoMg)],
  }
}

export const AMIODARONA_FA = { ataqueMg: 150, ataqueMin: 10, manutMgMin: [0.5, 1] as Faixa, pagina: 'p. 248; Tabela 3, p. 254' }

/** Amiodarona: 150 mg em 10 min; manutenção 0,5–1 mg/min → mL/h a 3,6 mg/mL e mg em 24 h. */
export function amiodaronaFa() {
  const c = DILUICOES_FA.amiodarona.mgMl
  const [a, b] = AMIODARONA_FA.manutMgMin
  return {
    ataqueMgMin: AMIODARONA_FA.ataqueMg / AMIODARONA_FA.ataqueMin,
    manutMlH: [mlH(a * 60, c), mlH(b * 60, c)] as Faixa,
    manut24hMg: [a * 60 * 24, b * 60 * 24] as Faixa,
  }
}

// ── Controle de ritmo (p. 249) ──────────────────────────────────────────────

export const PROPAFENONA_FA = { abaixo70Mg: 450, aPartir70Mg: 600, corteKg: 70, naoRepetirH: 24, monitorH: 6, pagina: 'p. 249; Tabela 3, p. 252' }

/** Propafenona para cardioversão: 450 mg (< 70 kg) e 600 mg (≥ 70 kg). */
export function propafenonaFa(pesoKg: number): number | null {
  if (!valido(pesoKg)) return null
  return pesoKg < PROPAFENONA_FA.corteKg ? PROPAFENONA_FA.abaixo70Mg : PROPAFENONA_FA.aPartir70Mg
}

export const MAGNESIO_FA = { g: [1, 2] as Faixa, pagina: 'p. 249; Tabela 3, p. 252' }

// ── Tempo de FA e anticoagulação (p. 247–252) ───────────────────────────────

export type JanelaFa = 'menos-de-48h' | 'exatamente-48h' | 'mais-de-48h-ou-indeterminada'

/**
 * O livro separa "menos que 48 horas" de "mais de 48 horas ou indeterminado"
 * (p. 248–249). Exatamente 48 h não cai em nenhum dos dois textos.
 */
export function janelaFa(horas: number | null): JanelaFa {
  if (horas === null || !Number.isFinite(horas) || horas < 0) return 'mais-de-48h-ou-indeterminada'
  if (horas < 48) return 'menos-de-48h'
  if (horas === 48) return 'exatamente-48h'
  return 'mais-de-48h-ou-indeterminada'
}

export const TEXTO_JANELA: Record<JanelaFa, string> = {
  'menos-de-48h': 'Menos de 48 h: o livro diz que o risco de embolização é baixo quando a FA dura menos de 48 h e não há cardiopatia estrutural, e manda avaliar pelo CHA2DS2-VASc (p. 249).',
  'exatamente-48h': 'Exatamente 48 h: o livro fala em "menos que 48 horas" e "mais de 48 horas"; o valor de 48 h não está em nenhum dos dois textos.',
  'mais-de-48h-ou-indeterminada': 'Mais de 48 h ou tempo indeterminado: o livro diz que o risco de embolismo sistêmico é maior; pode-se aguardar período de anticoagulação ou excluir trombo com ecocardiograma transesofágico; após a cardioversão, pelo menos 4 semanas de anticoagulação (p. 248–249). A Figura 2 fala em ACOD ou varfarina por 3 semanas ou ETE antes da CV (p. 247).',
}

export const ANTICOAGULACAO_FA: ItemManual[] = [
  { id: 'cha2ds2vasc', nome: 'CHA2DS2-VASc (Tabela 1)', dose: '0 em homens ou 1 em mulheres: anticoagular por 4 semanas só se houve cardioversão; ≥ 1 em homens ou ≥ 2 em mulheres: anticoagulação por prazo indefinido', quando: 'FA < 48 h', pagina: 'p. 249–250' },
  { id: 'cv-anticoag', nome: 'Anticoagulação peri-cardioversão', dose: 'NOAC, ou uma dose de enoxaparina, ou heparina EV 6 horas antes da CV; na CV de emergência, logo após a CV', quando: 'cardioversão', pagina: 'Figura 2, p. 247' },
  { id: 'fa-curta', nome: 'FA muito curta', dose: 'pode-se optar por não anticoagular FA de no máximo 24 horas', quando: 'FA ≤ 24 h', pagina: 'p. 252; Figura 2, p. 247' },
  { id: 'varfarina', nome: 'Varfarina', dose: 'iniciar 5 mg/d, ou 2,5 mg/d se idoso ou < 60 kg; INR a partir do 3º dia; efeito pleno com pelo menos 7 dias', quando: 'FA; única opção na figura para EM moderada/grave ou prótese valvar metálica', pagina: 'p. 251; Figura 2, p. 247' },
  { id: 'dabigatrana', nome: 'Dabigatrana', dose: '150 mg 2×/d; 110 mg 2×/d se risco de sangramento', quando: 'FA não valvar', pagina: 'p. 251' },
  { id: 'rivaroxabana', nome: 'Rivaroxabana', dose: '20 mg 1×/d', quando: 'FA não valvar', pagina: 'p. 251' },
  { id: 'apixabana', nome: 'Apixabana', dose: '5 mg 2×/d; 2,5 mg 2×/d se risco de sangramento', quando: 'FA não valvar', pagina: 'p. 251' },
  { id: 'edoxabana', nome: 'Edoxabana', dose: '60 mg/d; não deve ser a preferência com clearance de creatinina ≥ 95 mL/min', quando: 'FA não valvar', pagina: 'p. 251' },
]

/** Varfarina inicial (p. 251): 5 mg/d, ou 2,5 mg/d se idoso ou < 60 kg. "Idoso" sem idade no livro: marcado pelo médico. */
export function varfarinaInicialMg(pesoKg: number, idoso: boolean): number | null {
  if (!valido(pesoKg)) return null
  return idoso || pesoKg < 60 ? 2.5 : 5
}

/** Edoxabana: o livro desaconselha como preferência com ClCr ≥ 95 mL/min (p. 251). */
export const edoxabanaClcrAlto = (clcr: number) => Number.isFinite(clcr) && clcr >= 95

export const DDIMERO_FA = { corteNgMl: 270, vpn: '98,8%', pagina: 'p. 245', nota: 'Estudo único (Milhem, JACC:EP 2019); o livro registra que o uso ainda não está descrito em consensos.' }

export const ERRATA_FA = [
  'HAS-BLED (Tabela 2, p. 251): o livro escreve "creatinina > 2,6" e, no texto, "escore > 3" como alto risco. Use a tela do HAS-BLED do pacote; o livro não é a fonte dela.',
  'Tabela 3 (p. 254): diltiazem com preparo ambíguo e amiodarona com o rótulo "Dose sugerida" na linha da diluição (ver cada item).',
  'Cardioversão elétrica: o capítulo não traz carga em joules (p. 247–249).',
]
