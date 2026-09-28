import { fichaAdulto } from './fonte.ts'

// Ressuscitação volêmica no choque e na sepse do adulto — cap. 4 (Choque
// circulatório, p. 66–79) e cap. 7 (Sepse, p. 114–129) do Manual de Medicina
// de Emergência do HCFMUSP (3ª ed., 2022). A ferramenta faz as contas de
// volume por peso, alíquotas, metas e o gatilho de vasopressina que o livro
// escreve; não decide expansão nem droga (ADR 0007).
//
// Os valores pediátricos que os capítulos citam (20 mL/kg em até 3 infusões,
// diurese 1–2 mL/kg/h, teto de 20 mL/kg no hemorrágico) NÃO entram: pediatria
// usa outra fonte. As drogas vasoativas (diluição e mL/h) já estão em
// infusoes.ts (Anexo 1); aqui entra só o gatilho de associação.

export const fichaRessuscitacaoAdulto = fichaAdulto('adulto-ressuscitacao-volemica', 'Ressuscitação volêmica no choque e na sepse — adulto', 'cap. 4 Choque circulatório, p. 67–77; cap. 7 Sepse, p. 118–128')

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0

// ---------------------------------------------------------------- volume

/** Sepse: 30 mL/kg de cristaloide na 1ª hora, se hipotenso ou lactato > 36 mg/dL (cap. 7, p. 122; Figura 2, p. 128). */
export const SEPSE_VOLUME = {
  mlKg: 30,
  minutos: 60,
  gatilho: 'Adulto hipotenso ou com lactato > 36 mg/dL (Figura 2, p. 128: PAS < 100 mmHg / má perfusão → Ringer lactato 30 mL/kg EV)',
  lactatoGatilhoMgDl: 36,
  aliquotaMl: [250, 500] as Faixa,
  aliquotaMin: 10,
  preferencia: 'Preferencialmente em bolus, com preferência, embora controversa, para o Ringer lactato',
  pagina: 'cap. 7, p. 122',
}

/** Choque (cap. 4): 30 mL/kg em 1 hora no adulto com choque séptico, individualizado (p. 73); alíquotas de 200 mL a cada 10 min (p. 74). */
export const CHOQUE_ALIQUOTA = { ml: 200, aCadaMin: 10, pagina: 'cap. 4, p. 74' }
/** Figura 2 (p. 75): 100–200 mL a cada 10 min (basal, 10, 20, 30 min). */
export const CHOQUE_FIGURA2 = { ml: [100, 200] as Faixa, aCadaMin: 10, pagina: 'cap. 4, Figura 2, p. 75' }

export type VolumeSepse = { totalMl: number; mlH: number; aliquotas: Faixa; aliquotasDe200: number }

/**
 * 30 mL/kg (p. 122): volume total, a vazão se corrido em 1 hora e quantas
 * alíquotas de 250–500 mL (p. 122) ou de 200 mL (p. 74) somam o total.
 */
export function volumeSepse(pesoKg: number): VolumeSepse | null {
  if (!valido(pesoKg)) return null
  const totalMl = SEPSE_VOLUME.mlKg * pesoKg
  return {
    totalMl,
    mlH: totalMl * (60 / SEPSE_VOLUME.minutos),
    aliquotas: [Math.ceil(totalMl / SEPSE_VOLUME.aliquotaMl[1]), Math.ceil(totalMl / SEPSE_VOLUME.aliquotaMl[0])],
    aliquotasDe200: Math.ceil(totalMl / CHOQUE_ALIQUOTA.ml),
  }
}

/** mL/h de uma alíquota de `ml` corrida em `minutos` (vazão da bomba equivalente). */
export const vazaoAliquota = (ml: number, minutos: number) => (valido(ml) && valido(minutos) ? ml * (60 / minutos) : null)

/** Choque hemorrágico (cap. 4, p. 77; cap. 47, p. 646–647). */
export const HEMORRAGICO = {
  cristaloideMaxL: 1,
  aliquotaTraumaMl: [250, 500] as Faixa,
  transfusaoAposL: [1, 3] as Faixa,
  acidoTranexamico: '1 g em 10 minutos seguido por 1 g em 8 horas, até 3 h após trauma significativo',
  itens: [
    { texto: 'Priorizar hemocomponentes, evitando cristaloide > 1 L no adulto', pagina: 'cap. 4, p. 77' },
    { texto: 'Trauma: volumes restritos, alíquotas de 250–500 mL para manter a PA no alvo até o controle do sangramento', pagina: 'cap. 47, p. 646' },
    { texto: 'Trauma: transfusão bem indicada se instabilidade após 1–3 L de cristaloides', pagina: 'cap. 47, p. 647' },
    { texto: 'Ácido tranexâmico até 3 h após trauma significativo: 1 g em 10 minutos seguido por 1 g em 8 horas', pagina: 'cap. 4, p. 77; cap. 47, p. 649' },
    { texto: 'Cristaloide aquecido a 38 °C', pagina: 'cap. 47, p. 644' },
  ],
}

// ---------------------------------------------------------------- metas

export const METAS = [
  { id: 'pam-septico', parametro: 'PAM — choque séptico', meta: '65–75 mmHg', pagina: 'cap. 4, Tabela 4, p. 72' },
  { id: 'pam-sepse', parametro: 'PAM — sepse (maioria)', meta: '≥ 65 mmHg; HAS crônica provavelmente se beneficia de 80–85 mmHg; idoso > 65 anos: PAM > 60 mmHg permite desmame um pouco mais rápido', pagina: 'cap. 7, p. 122' },
  { id: 'pam-indiferenciado', parametro: 'PAM — choque sem etiologia definida', meta: '65 mmHg', pagina: 'cap. 4, p. 73' },
  { id: 'pas-hemorragico', parametro: 'PAS — choque hemorrágico', meta: '80–90 mmHg (TCE grave: PAM ≥ 80 mmHg)', pagina: 'cap. 4, Tabela 4, p. 72; cap. 47, p. 646 (PAS 80–90 e PAM 50–60)' },
  { id: 'pas-permissiva', parametro: 'Hipotensão permissiva (sem TCE grave)', meta: 'PAS 70–90 mmHg', pagina: 'cap. 4, p. 77' },
  { id: 'diurese', parametro: 'Débito urinário (adulto)', meta: '> 0,5 mL/kg/h (a tabela imprime "µg/kg/min")', pagina: 'cap. 4, Tabela 4, p. 72; oligúria < 0,5 mL/kg/h na p. 67' },
  { id: 'svco2', parametro: 'SvcO2', meta: '> 70% (utilidade controversa no adulto)', pagina: 'cap. 4, Tabela 4, p. 72' },
  { id: 'lactato', parametro: 'Lactato', meta: 'Redução de 20% em 2 h', pagina: 'cap. 4, Tabela 4, p. 72' },
  { id: 'tec', parametro: 'Tempo de enchimento capilar', meta: 'Anormal > 3 segundos', pagina: 'cap. 4, p. 67; cap. 7, Tabela 6, p. 121' },
  { id: 'sato2', parametro: 'SatO2 no choque', meta: '94–98% (máscara não reinalante)', pagina: 'cap. 4, p. 73' },
]

export const DIURESE_MIN_ML_KG_H = 0.5

/** Diurese mínima em mL/h pelo peso (0,5 mL/kg/h, p. 67 e 72). */
export const diureseMinimaMlH = (pesoKg: number) => (valido(pesoKg) ? DIURESE_MIN_ML_KG_H * pesoKg : null)

/** Diurese medida (mL em h horas) em mL/kg/h. */
export function diureseMlKgH(ml: number, horas: number, pesoKg: number): { mlKgH: number; abaixoDe05: boolean } | null {
  if (!Number.isFinite(ml) || ml < 0 || !valido(horas) || !valido(pesoKg)) return null
  const mlKgH = ml / horas / pesoKg
  return { mlKgH, abaixoDe05: mlKgH < DIURESE_MIN_ML_KG_H }
}

/** Equivalência do próprio livro: 18 mg/dL = 2 mmol/L (cap. 7, Tabela 5, p. 120). */
export const MG_DL_POR_MMOL_L = 18 / 2
export const lactatoMmol = (mgDl: number) => mgDl / MG_DL_POR_MMOL_L
export const lactatoMgDl = (mmol: number) => mmol * MG_DL_POR_MMOL_L

/** Cortes de lactato que os capítulos citam, em mg/dL. */
export const CORTES_LACTATO = [
  { mmol: 1.5, mgDl: lactatoMgDl(1.5), texto: 'Choque: lactato > 1,5 mmol/L (normal ≈ 1 mmol/L)', pagina: 'cap. 4, p. 67–68' },
  { mmol: 2, mgDl: 18, texto: 'Hiperlactatemia > 18 mg/dL (2 mmol/L); com vasopressor para PAM ≥ 65, define choque séptico', pagina: 'cap. 7, p. 118 e 120' },
  { mmol: lactatoMmol(36), mgDl: 36, texto: 'Lactato > 36 mg/dL: gatilho dos 30 mL/kg no adulto', pagina: 'cap. 7, p. 122' },
]

export type Lactato = { reducaoPct: number; atingiuMeta20: boolean; alvoMax: number }

/** Queda do lactato entre duas medidas e a meta de 20% em 2 h (Tabela 4, p. 72). Mesma unidade nas duas. */
export function reducaoLactato(inicial: number, atual: number): Lactato | null {
  if (!valido(inicial) || !Number.isFinite(atual) || atual < 0) return null
  const reducaoPct = ((inicial - atual) / inicial) * 100
  return { reducaoPct, atingiuMeta20: reducaoPct >= 20 - 1e-9, alvoMax: inicial * 0.8 }
}

// ---------------------------------------------------------------- vasopressina e corticoide

export type GatilhoVasopressina = { ugMin: number; cap4Seis: boolean; cap4Tres: boolean; cap7: boolean }

/**
 * Gatilho de vasopressina em choque séptico com noradrenalina.
 * Cap. 4 (p. 76): > 5 µg/min após 6 horas OU > 15 µg/min nas últimas 3 horas, mantendo hipotensão.
 * Cap. 7 (p. 122): > 5 µg/min por mais de 6 horas.
 * A dose pode vir em µg/min ou em µg/kg/min com o peso (a Tabela 6 dá a faixa em µg/kg/min).
 */
export function gatilhoVasopressina(dose: number, unidade: 'ug/min' | 'ug/kg/min', horas: number, pesoKg?: number): GatilhoVasopressina | null {
  if (!Number.isFinite(dose) || dose < 0 || !Number.isFinite(horas) || horas < 0) return null
  let ugMin = dose
  if (unidade === 'ug/kg/min') {
    if (pesoKg === undefined || !valido(pesoKg)) return null
    ugMin = dose * pesoKg
  }
  return {
    ugMin,
    cap4Seis: ugMin > 5 && horas >= 6,
    cap4Tres: ugMin > 15 && horas >= 3,
    cap7: ugMin > 5 && horas > 6,
  }
}

export const CORTICOIDE_SEPSE = [
  { texto: 'Choque séptico em uso de vasopressores ou em ventilação mecânica: considerar hidrocortisona 200 mg IV por dia por 7 dias', pagina: 'cap. 7, p. 125' },
  { texto: 'Sepse por COVID-19 com necessidade de oxigenioterapia: dexametasona 6 mg por 10 dias', pagina: 'cap. 7, p. 125' },
  { texto: 'Sepse bacteriana: uso rotineiro de corticoide não recomendado', pagina: 'cap. 7, p. 125' },
]

export const OUTROS_SEPSE = [
  { texto: 'Transfusão de hemácias reservada para Hb ≤ 7 g/dL (exceto choque hemorrágico concomitante ou isquemia miocárdica ativa)', pagina: 'cap. 7, p. 126' },
  { texto: 'Glicemia < 180 mg/dL, se necessário com insulina de ação rápida', pagina: 'cap. 7, p. 126' },
  { texto: 'VM: VC 4–6 mL/kg de peso, platô ≤ 30 cmH2O, driving pressure ≤ 15 cmH2O, FiO2 mínima para SpO2 ≥ 92%', pagina: 'cap. 7, Tabela 12, p. 127' },
  { texto: 'Drogas vasoativas podem ser iniciadas em acesso periférico no início da estabilização; noradrenalina é a preferencial', pagina: 'cap. 7, p. 122' },
]

/** VC da Tabela 12 (p. 127): 4–6 mL/kg "de peso" — o livro não diz se é peso predito. */
export const vcSepse = (pesoKg: number): Faixa | null => (valido(pesoKg) ? [4 * pesoKg, 6 * pesoKg] : null)

// ---------------------------------------------------------------- soluções

export type Solucao = { id: string; nome: string; osm: number | null; na: number; cl: number | null; k: number | null; ca: number | null; lactato: number | null; pagina: string; nota?: string }

/** Tabela 5 (cap. 4, p. 74), em mmol/L; osmolaridade em mOsm/L. */
export const SOLUCOES_TABELA5: Solucao[] = [
  { id: 'sf', nome: 'Solução fisiológica 0,9%', osm: 308, na: 154, cl: 154, k: null, ca: null, lactato: null, pagina: 'Tabela 5, p. 74' },
  { id: 'rl', nome: 'Ringer lactato', osm: 208, na: 131, cl: 111, k: 5.4, ca: 2, lactato: 29, pagina: 'Tabela 5, p. 74',
    nota: 'Osmolaridade impressa 208 mOsm/L; a soma dos solutos da própria linha (131 + 111 + 5,4 + 2 + 29) já passa de 278 — valor provavelmente com erro de digitação; o livro não traz outro.' },
  { id: 'plasmalyte', nome: 'PlasmaLyte', osm: 294, na: 140, cl: 98, k: 5, ca: null, lactato: null, pagina: 'Tabela 5, p. 74' },
]

/** Soma dos solutos listados numa linha da Tabela 5 (conferência da osmolaridade impressa). */
export const somaSolutos = (s: Solucao) => [s.na, s.cl, s.k, s.ca, s.lactato].reduce<number>((a, x) => a + (x ?? 0), 0)

/** Tabela 7 (cap. 7, p. 122), em mEq/L — diverge da Tabela 5 no Ringer lactato. */
export const SOLUCOES_TABELA7 = [
  { nome: 'Solução fisiológica', texto: 'Na 154 mEq/L; K e Ca 0' },
  { nome: 'Ringer simples', texto: 'Na 147 mEq/L; K e Ca 4 mEq/L' },
  { nome: 'Ringer lactato', texto: 'Na 130 mEq/L; K e Ca 4 mEq/L' },
]

/** Carga de sódio (mmol) de um volume de solução da Tabela 5. */
export function sodioNoVolume(id: string, ml: number): number | null {
  const s = SOLUCOES_TABELA5.find((x) => x.id === id)
  if (!s || !valido(ml)) return null
  return (s.na * ml) / 1000
}

// ---------------------------------------------------------------- errata e pediatria

export const ERRATA_RESSUSCITACAO = [
  'Tabela 4 (p. 72): débito urinário "> 0,5 µg/kg/min em adultos" — unidade trocada; a p. 67 e a Tabela 1 (p. 68) definem oligúria como < 0,5 mL/kg/h. A conta usa mL/kg/h.',
  'Tabela 5 (p. 74): osmolaridade do Ringer lactato impressa 208 mOsm/L, incoerente com os solutos da própria linha. Mostrada como está, com nota; não entra em conta.',
  'Alíquotas: 200 mL a cada 10 min (texto, p. 74) x 100–200 mL a cada 10 min (Figura 2, p. 75) x 250–500 mL em 10 min na sepse (p. 122). As três aparecem com página.',
  'Hipotensão permissiva: PAS 80–90 mmHg (Tabela 4, p. 72; cap. 47, p. 646) x PAS 70–90 mmHg (p. 77). As duas aparecem.',
  'PAM no choque séptico: 65–75 mmHg (Tabela 4, p. 72) x ≥ 65 mmHg (p. 122; Figura 2, p. 128 usa PAM ≤ 65 para iniciar drogas).',
  'Vasopressina: cap. 4 (p. 76) dá "> 5 µg/min após 6 horas ou > 15 µg/min nas últimas 3 horas"; cap. 7 (p. 122) dá só "> 5 µg/min por mais de 6 horas". Os dois critérios aparecem separados.',
  'Ringer lactato: Na 131 mmol/L (Tabela 5, p. 74) x 130 mEq/L com K e Ca 4 mEq/L (Tabela 7, p. 122).',
  'p. 77: "cristaloides maiores do que 1 L de em adultos" — lido como "1 L em adultos".',
]

/** Relatados, não implementados (pediatria usa outra fonte). */
export const PEDIATRICO_NAO_IMPLEMENTADO = [
  { texto: '20 mL/kg em até 3 infusões em crianças', pagina: 'cap. 4, p. 73–74' },
  { texto: 'Débito urinário na população pediátrica 1–2 mL/kg/h', pagina: 'cap. 4, Tabela 4, p. 72' },
  { texto: 'Choque hemorrágico: evitar cristaloide > 20 mL/kg em crianças', pagina: 'cap. 4, p. 77' },
  { texto: 'Hipotensão é sinal pouco sensível (tardio), principalmente em crianças', pagina: 'cap. 4, p. 67' },
]
