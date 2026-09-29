import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'
import type { Faixa, ItemManual } from './pcr.ts'

// Fibrilação atrial do adulto — Manual de Medicina de Emergência do HCFMUSP
// (3ª ed., 2022), cap. 17, p. 243–256. A ferramenta faz as contas por peso e
// por tempo e converte para mL/h só com a diluição que o próprio livro traz
// (Tabela 3, p. 252–254). A escolha da estratégia é do médico (ADR 0007).
// CHA2DS2-VA e HAS-BLED já existem em src/clinico/escores (não duplicados).
//
// Versão .1 de 28/09/2026: ESC 2024 (PDF lido; páginas do periódico = página
// do PDF + 3313) e Diretriz Brasileira de FA 2025 (PDF lido) ao lado do
// manual — janela de 24 h, CHA₂DS₂-VA, 4 semanas de anticoagulação após
// toda cardioversão, 200 J bifásico e as doses IV das duas diretrizes.

export const ESC_FA_2024: Fonte = {
  citacao: 'Van Gelder IC, Rienstra M, Bunting KV, et al. 2024 ESC Guidelines for the management of atrial fibrillation. Eur Heart J. 2024;45(36):3314–3414. CHA₂DS₂-VA (p. 3323, 3342), cardioversão e 24 h (p. 3324, 3355–3356), Tabela 12 (p. 3353–3354), Tabela 13 (p. 3358).',
  url: 'https://doi.org/10.1093/eurheartj/ehae176',
}

export const SBC_FA_2025: Fonte = {
  citacao: 'Cintra FD, et al. Diretriz Brasileira de Fibrilação Atrial – 2025 (SBC/SOBRAC). Arq Bras Cardiol. 2025;122(9):e20250618. CHA₂DS₂-VA (p. 28), anticoagulação na cardioversão (p. 37–38), controle de frequência e Tabela 19 (p. 55), propafenona (p. 56).',
  url: 'https://doi.org/10.36660/abc.20250618',
}

const PAG_FA = 'cap. 17 Fibrilação atrial, p. 243–256 (texto p. 248–251; Tabela 3, p. 252–254)'

export const fichaFibrilacaoAtrialAdulto: Ficha = {
  ...fichaAdulto('adulto-fibrilacao-atrial', 'Fibrilação atrial — controle de frequência e de ritmo (adulto)', PAG_FA),
  versao: '2026-09-28.1',
  fontes: [pagina(PAG_FA), ESC_FA_2024, SBC_FA_2025],
  revisadoEm: '28/09/2026 (ESC 2024 e SBC 2025 lidas no texto; manual mantido como base)',
}

export type JanelaFa2024 = 'ate-24h' | 'mais-de-24h-ou-indeterminada'

/** ESC 2024 e SBC 2025: a fronteira para cardioverter sem 3 semanas de anticoagulação ou ETE é 24 h (o livro usa 48 h). */
export function janelaFa2024(horas: number | null): JanelaFa2024 {
  if (horas === null || !Number.isFinite(horas) || horas < 0) return 'mais-de-24h-ou-indeterminada'
  return horas <= 24 ? 'ate-24h' : 'mais-de-24h-ou-indeterminada'
}

export const TEXTO_JANELA_2024: Record<JanelaFa2024, string> = {
  'ate-24h': 'Até 24 h: a cardioversão pode ser precedida de ACOD, enoxaparina 1 mg/kg SC ou HNF 60–70 U/kg em bolus (SBC 2025, p. 37); a ESC 2024 admite "esperar e ver" a reversão espontânea por até 48 h no paciente estável (IIa) e diz que a anticoagulação de 4 semanas após a cardioversão é opcional só se o início foi certamente < 24 h e o risco tromboembólico é baixo (Figura 12, p. 3355).',
  'mais-de-24h-ou-indeterminada': 'Mais de 24 h ou tempo desconhecido: cardioversão não recomendada sem ≥ 3 semanas de anticoagulação terapêutica ou ETE sem trombo (ESC 2024, p. 3356; SBC 2025, p. 37); depois, anticoagular por ≥ 4 semanas em todos.',
}

export const ANTICOAGULACAO_FA_2025: { tema: string; texto: string; fonte: string }[] = [
  { tema: 'Escore', texto: 'CHA₂DS₂-VA em todos (I A); ≥ 2: anticoagular (I A); 0: sem antitrombótico (I A); 1: pode, individualizando (IIa B). ESC 2024: ≥ 2 recomendado, 1 deve ser considerado', fonte: 'SBC 2025 p. 28; ESC 2024 p. 3323, 3342' },
  { tema: 'Após a cardioversão', texto: 'Anticoagulação por pelo menos 4 semanas em todos, independentemente da duração e do perfil de risco (SBC I C); depois, indefinida se CHA₂DS₂-VA ≥ 2, suspende se 0, individualiza se 1. ESC 2024: 4 semanas para todos, mesmo com CHA₂DS₂-VA = 0 (opcional se início certamente < 24 h e baixo risco)', fonte: 'SBC 2025 p. 37–38; ESC 2024 p. 3355–3356' },
  { tema: 'Cardioversão elétrica na instabilidade', texto: 'Imediata, sincronizada, 200 J bifásico, com anticoagulante o mais cedo possível; carga máxima é alternativa nos refratários', fonte: 'SBC 2025 p. 55' },
  { tema: 'Esperar e ver', texto: 'No estável, aguardar reversão espontânea por até 48 h do início é alternativa à cardioversão imediata (IIa)', fonte: 'ESC 2024 p. 3324' },
  { tema: 'ACOD × varfarina', texto: 'ACOD preferido, exceto prótese mecânica ou estenose mitral moderada/grave; AAS não substitui o anticoagulante', fonte: 'SBC 2025; ESC 2024' },
]

export type DoseFa2024 = { droga: string; esc: string; sbc: string; livro: string }

/** Tabela 12 e 13 da ESC 2024 (p. 3353–3354, 3358) e Tabela 19 da SBC 2025 (p. 55), ao lado da Tabela 3 do manual. */
export const DOSES_FA_2024: DoseFa2024[] = [
  { droga: 'Esmolol', esc: '500 µg/kg em 1 min; 50–300 µg/kg/min', sbc: '500 µg/kg em 1 min; 10–40 µg/kg/min (1–10 na disfunção ventricular); preferido pela meia-vida curta', livro: '0,5 mg/kg em 1 min; 50–200 µg/kg/min (p. 248)' },
  { droga: 'Metoprolol tartarato', esc: '2,5–5 mg em bolus em 2 min; até 15 mg cumulativos', sbc: '2,5–5 mg IV em bolus; no máximo 4 doses', livro: 'não listado' },
  { droga: 'Verapamil', esc: '2,5–10 mg IV em 5 min; contraindicado com FEVE ≤ 40%', sbc: 'antagonistas do cálcio IV com disponibilidade reduzida no Brasil', livro: '0,075–0,15 mg/kg em 2 min (p. 248)' },
  { droga: 'Diltiazem', esc: '0,25 mg/kg IV em 5 min, depois 5–15 mg/h', sbc: 'idem (disponibilidade reduzida)', livro: '0,25 mg/kg em 2 min; 5–15 mg/h (p. 248)' },
  { droga: 'Digoxina', esc: '0,5 mg IV em bolus (0,75–1,5 mg em 24 h, fracionados)', sbc: 'digitálico IV como 2ª opção; deslanosídeo', livro: '0,25–0,5 mg até 1 mg (p. 248)' },
  { droga: 'Amiodarona', esc: '300 mg em 250 mL SG 5% em 30–60 min (via central de preferência), depois 900–1.200 mg/24 h', sbc: '300 mg em SG 5% em 30–60 min; 900–1.200 mg/24 h; última opção farmacológica', livro: '150 mg em 10 min; 0,5–1 mg/min (p. 248)' },
  { droga: 'Propafenona', esc: 'IV 1,5–2 mg/kg em 10 min; oral 450–600 mg', sbc: 'pill-in-the-pocket 600 mg (450 mg se < 70 kg), 1ª vez no hospital, coração estruturalmente normal', livro: '450 mg (< 70 kg) ou 600 mg (p. 249)' },
  { droga: 'Sulfato de magnésio', esc: '—', sbc: 'adjuvante: 4,5 g em 100 mL em 30 min (dose baixa)', livro: '1–2 g (p. 249)' },
]

export const DIFERENCAS_FA_2024: string[] = [
  'Janela: o manual separa 48 h (p. 248–249); ESC 2024 e SBC 2025 usam 24 h — acima disso, 3 semanas de anticoagulação ou ETE antes de cardioverter.',
  'Escore: o manual usa CHA₂DS₂-VASc com limiares por sexo (p. 249–250); ESC 2024 e SBC 2025 usam CHA₂DS₂-VA (0 não; 1 individualiza; ≥ 2 sim) — a ferramenta CHA₂DS₂-VA do pacote é a de referência.',
  'Após a cardioversão: o manual anticoagula 4 semanas só quando houve CV com escore baixo; SBC 2025 e ESC 2024 anticoagulam 4 semanas em todos.',
  'Esmolol: três faixas de manutenção (livro 50–200; ESC 50–300; SBC 10–40 µg/kg/min) — as três aparecem; nenhuma é escolhida pela ferramenta.',
  'Amiodarona: o manual dá 150 mg em 10 min; ESC e SBC dão 300 mg em 30–60 min com 900–1.200 mg/24 h.',
  'Cardioversão elétrica: o manual não traz carga; a SBC 2025 dá 200 J bifásico.',
]

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
