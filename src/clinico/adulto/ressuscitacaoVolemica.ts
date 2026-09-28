import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Ressuscitação volêmica no choque e na sepse do adulto — cap. 4 (Choque
// circulatório, p. 66–79) e cap. 7 (Sepse, p. 114–129) do Manual de Medicina
// de Emergência do HCFMUSP (3ª ed., 2022). A ferramenta faz as contas de
// volume por peso, alíquotas, metas e o gatilho de vasopressina que o livro
// escreve; não decide expansão nem droga (ADR 0007).
//
// Versão .1 de 28/09/2026: ao lado do livro entram, com página, a Surviving
// Sepsis Campaign 2026 e o protocolo do ILAS revisado em julho de 2026
// (decisão do RT em 28/09/2026: mostrar a evidência de cada um e as
// diferenças). Onde as três fontes divergem, as três aparecem.
//
// Os valores pediátricos que os capítulos citam (20 mL/kg em até 3 infusões,
// diurese 1–2 mL/kg/h, teto de 20 mL/kg no hemorrágico) NÃO entram: pediatria
// usa outra fonte. As drogas vasoativas (diluição e mL/h) já estão em
// infusoes.ts (Anexo 1); aqui entra só o gatilho de associação.

export const SSC_2026: Fonte = {
  citacao: 'Prescott HC, Antonelli M, Alhazzani W, et al. Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock 2026. Crit Care Med. 2026;54(4):725–812.',
  url: 'https://doi.org/10.1097/CCM.0000000000007075',
}

export const ILAS_2026: Fonte = {
  citacao: 'Instituto Latino Americano de Sepse (ILAS). Implementação de protocolo gerenciado de sepse — protocolo clínico, adulto. Revisado em julho de 2026.',
  url: 'https://ilas.org.br/wp-content/uploads/2022/02/Protocolo-de-tratamento-da-sepse-adulto-Revisao-julho-2026.pdf',
}

const PAGINAS_LIVRO = 'cap. 4 Choque circulatório, p. 67–77; cap. 7 Sepse, p. 118–128'

export const fichaRessuscitacaoAdulto: Ficha = {
  ...fichaAdulto('adulto-ressuscitacao-volemica', 'Ressuscitação volêmica no choque e na sepse — adulto', PAGINAS_LIVRO),
  versao: '2026-09-28.1',
  fontes: [
    pagina(PAGINAS_LIVRO),
    { ...SSC_2026, citacao: `${SSC_2026.citacao} Recomendações 4, 10, 13, 14, 16–18, 44, 45, 51, 52, 55–57, 79, 95 e 96 (p. 15–56 do PDF).` },
    { ...ILAS_2026, citacao: `${ILAS_2026.citacao} p. 3–15.` },
  ],
  revisadoEm: '28/09/2026 (SSC 2026 e ILAS jul/2026 conferidos no texto; manual do HC mantido como base)',
}

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

export type VolumeSepse = { totalMl: number; mlH: number; mlHEm3h: number; aliquotas: Faixa; aliquotasDe200: number }

/** SSC 2026, rec. 10 (p. 18): pelo menos 30 mL/kg nas primeiras 3 h; ILAS (p. 12): até 30 mL/kg, começando na 1ª hora e terminando em 3 h. */
export const SEPSE_VOLUME_2026 = { mlKg: 30, horas: 3, paginaSsc: 'SSC 2026, rec. 10, p. 18', paginaIlas: 'ILAS jul/2026, p. 12' }

/**
 * 30 mL/kg (p. 122): volume total, a vazão se corrido em 1 hora (livro) ou em
 * 3 horas (SSC 2026/ILAS) e quantas alíquotas de 250–500 mL (p. 122) ou de
 * 200 mL (p. 74) somam o total.
 */
export function volumeSepse(pesoKg: number): VolumeSepse | null {
  if (!valido(pesoKg)) return null
  const totalMl = SEPSE_VOLUME.mlKg * pesoKg
  return {
    totalMl,
    mlH: totalMl * (60 / SEPSE_VOLUME.minutos),
    mlHEm3h: totalMl / SEPSE_VOLUME_2026.horas,
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

export type GatilhoVasopressina = {
  ugMin: number
  cap4Seis: boolean
  cap4Tres: boolean
  cap7: boolean
  /** µg/kg/min, quando o peso é conhecido */
  ugKgMin: number | null
  /** prática do painel da SSC 2026 (p. 42): vasopressina a partir de 0,3 µg/kg/min de noradrenalina (mediana; IQR 0,2–0,5) — prática, não recomendação numérica */
  sscPratica: boolean | null
}

/** SSC 2026 (p. 42): mediana de início da vasopressina na prática do painel, em µg/kg/min de noradrenalina. */
export const VASOPRESSINA_SSC_PRATICA = { ugKgMin: 0.3, iqr: [0.2, 0.5] as Faixa, pagina: 'SSC 2026, p. 42 (prática do painel; a rec. 56 diz só "doses ascendentes de noradrenalina")' }

/**
 * Gatilho de vasopressina em choque séptico com noradrenalina.
 * Cap. 4 (p. 76): > 5 µg/min após 6 horas OU > 15 µg/min nas últimas 3 horas, mantendo hipotensão.
 * Cap. 7 (p. 122): > 5 µg/min por mais de 6 horas.
 * SSC 2026 (rec. 56, p. 41): com doses ascendentes de noradrenalina, sugere-se adicionar vasopressina; a prática do painel é ≥ 0,3 µg/kg/min (p. 42).
 * A dose pode vir em µg/min ou em µg/kg/min com o peso (a Tabela 6 dá a faixa em µg/kg/min).
 */
export function gatilhoVasopressina(dose: number, unidade: 'ug/min' | 'ug/kg/min', horas: number, pesoKg?: number): GatilhoVasopressina | null {
  if (!Number.isFinite(dose) || dose < 0 || !Number.isFinite(horas) || horas < 0) return null
  let ugMin = dose
  const temPeso = pesoKg !== undefined && valido(pesoKg)
  if (unidade === 'ug/kg/min') {
    if (!temPeso) return null
    ugMin = dose * pesoKg
  }
  const ugKgMin = temPeso ? ugMin / pesoKg : null
  return {
    ugMin,
    cap4Seis: ugMin > 5 && horas >= 6,
    cap4Tres: ugMin > 15 && horas >= 3,
    cap7: ugMin > 5 && horas > 6,
    ugKgMin,
    sscPratica: ugKgMin === null ? null : ugKgMin >= VASOPRESSINA_SSC_PRATICA.ugKgMin,
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

// ---------------------------------------------------------------- SSC 2026 × ILAS jul/2026 × manual do HC

export type LinhaDiretriz = { texto: string; pagina: string }

export type Diretriz2026 = {
  tema: string
  ssc?: LinhaDiretriz
  ilas?: LinhaDiretriz
  livro?: LinhaDiretriz
  /** onde as fontes divergem ou o que muda em relação ao livro */
  nota?: string
}

/**
 * O que cada fonte escreve, lado a lado, com página. Decisão do RT (28/09/2026):
 * ILAS jul/2026 como referência brasileira ao lado da SSC 2026; o livro fica
 * como base histórica. A ferramenta mostra; não escolhe (ADR 0007).
 */
export const DIRETRIZES_2026: Diretriz2026[] = [
  {
    tema: 'Rastreio de sepse',
    ssc: { texto: 'NEWS, NEWS2, MEWS ou SIRS em vez do qSOFA como ferramenta única de rastreio no paciente agudo internado (recomendação forte, certeza moderada)', pagina: 'rec. 4, p. 15' },
    ilas: { texto: 'qSOFA não é estratégia de triagem (baixa sensibilidade); paciente com qSOFA ≥ 2 merece atenção especial como escore de gravidade', pagina: 'p. 5 e 7' },
    nota: 'O NEWS2 é ferramenta própria na Central; a de sepse mantém o qSOFA só como alerta.',
  },
  {
    tema: 'O que conta como hipoperfusão / disfunção orgânica',
    ssc: { texto: 'Hipotensão (PAM < 65 mmHg, PAS < 90 mmHg ou hipotensão relativa à basal) ou lactato elevado', pagina: 'p. 18' },
    ilas: { texto: 'PAS < 90 ou PAM < 65 ou hipotensão relativa; oligúria ≤ 0,5 mL/kg/h ou creatinina > 2; PaO₂/FiO₂ < 300 ou O₂ para SpO₂ > 90%; plaquetas < 100.000 ou queda de 50%; lactato acima da referência (2 mmol/L = 18 mg/dL); rebaixamento/agitação; bilirrubinas > 2× o normal', pagina: 'p. 3' },
    livro: { texto: 'Gatilho dos 30 mL/kg: hipotensão ou lactato > 36 mg/dL (4 mmol/L)', pagina: 'cap. 7, p. 122' },
    nota: 'O corte de 36 mg/dL do livro é o antigo "lactato ≥ 4"; ILAS abre o protocolo com lactato acima de 18 mg/dL e o SSC fala em "lactato elevado".',
  },
  {
    tema: 'Volume inicial',
    ssc: { texto: 'Pelo menos 30 mL/kg de cristaloide IV nas primeiras 3 horas em hipoperfusão induzida por sepse ou choque séptico (recomendação condicional, certeza baixa); considerar características e contexto do paciente', pagina: 'rec. 10, p. 18' },
    ilas: { texto: 'Até 30 mL/kg de cristaloide, começando na 1ª hora da hipotensão, o mais rápido que a situação permitir, terminando em 3 horas; avaliar fluido-responsividade e fluido-tolerância; decisão de não repor deve ficar registrada. TEC > 3 s manda ressuscitar mesmo com lactato normal', pagina: 'p. 8 e 12' },
    livro: { texto: '30 mL/kg na 1ª hora, em alíquotas de 250–500 mL em 10 min com reavaliação', pagina: 'cap. 7, p. 122' },
    nota: 'A janela passa de 1 h (livro) para 3 h (SSC e ILAS) e a recomendação da SSC virou condicional. A conta abaixo mostra as duas vazões.',
  },
  {
    tema: 'Qual cristaloide',
    ssc: { texto: 'Cristaloide balanceado em vez de SF 0,9% na ressuscitação inicial (condicional, certeza moderada); em TCE, SF 0,9%. Cristaloide isolado em vez de cristaloide + albumina (condicional, certeza moderada); albumina só em quem já recebeu grandes volumes', pagina: 'rec. 44 e 45, p. 36' },
    ilas: { texto: 'Cristaloide balanceado (Ringer lactato) preferido ao SF 0,9%; SF no TCE; albumina fora da reposição inicial de rotina', pagina: 'p. 12' },
    livro: { texto: 'Preferência, "embora controversa", pelo Ringer lactato', pagina: 'cap. 7, p. 122' },
  },
  {
    tema: 'Meta de PAM',
    ssc: { texto: 'Alvo inicial de 65 mmHg em vez de alvos maiores (forte, certeza moderada), numa faixa razoável (± 5 mmHg). Com 65 anos ou mais: faixa inicial de 60–65 mmHg em vez de maiores (condicional, certeza baixa)', pagina: 'rec. 13 e 14, p. 21' },
    ilas: { texto: 'PAM 65 mmHg (± 5); em idosos de 65 anos ou mais pode-se individualizar entre 60 e 65 mmHg em situações selecionadas', pagina: 'p. 11' },
    livro: { texto: '65–75 mmHg (Tabela 4) / ≥ 65 mmHg; HAS crônica 80–85; idoso > 65 anos: PAM > 60', pagina: 'cap. 4, p. 72; cap. 7, p. 122' },
  },
  {
    tema: 'Vasopressor: qual e por onde',
    ssc: { texto: 'Hipotensão induzida por sepse: bolus inicial de cristaloide e depois vasopressor se a hipotensão persistir (condicional, certeza muito baixa); no choque instável, vasopressor junto com o fluido caso a caso. Começar o vasopressor por veia periférica em vez de esperar o acesso central (condicional, certeza muito baixa). Noradrenalina como 1ª linha em vez de vasopressina ou angiotensina II (condicional)', pagina: 'rec. 11 e 12, p. 19–20; rec. 55, p. 41' },
    ilas: { texto: 'Noradrenalina é a 1ª escolha; não tolerar PAM < 65 por mais de 30–40 min; iniciar o vasopressor dentro da 1ª hora, por acesso periférico enquanto não há central', pagina: 'p. 13' },
    livro: { texto: 'Drogas vasoativas podem começar em acesso periférico; noradrenalina é a preferencial', pagina: 'cap. 7, p. 122' },
  },
  {
    tema: 'Vasopressina e adrenalina',
    ssc: { texto: 'Com doses ascendentes de noradrenalina, sugere-se adicionar vasopressina (condicional, certeza moderada); na prática do painel, a partir de 0,3 µg/kg/min de noradrenalina (mediana; IQR 0,2–0,5). PAM inadequada apesar de noradrenalina + vasopressina: adicionar adrenalina (condicional, certeza muito baixa); sem vasopressina disponível, adrenalina direto', pagina: 'rec. 56 e 57, p. 41–42' },
    ilas: { texto: 'Vasopressina nos casos com doses ascendentes de noradrenalina; adrenalina em situações selecionadas (baixo débito ou sinais clínicos)', pagina: 'p. 13' },
    livro: { texto: 'Vasopressina se noradrenalina > 5 µg/min após 6 h ou > 15 µg/min nas últimas 3 h (cap. 4) / > 5 µg/min por mais de 6 h (cap. 7)', pagina: 'cap. 4, p. 76; cap. 7, p. 122' },
    nota: 'O livro fixa um gatilho em µg/min e horas; a SSC não fixa número (a mediana de 0,3 µg/kg/min é prática do painel, não recomendação).',
  },
  {
    tema: 'Lactato e tempo de enchimento capilar',
    ssc: { texto: 'Lactato seriado para guiar a ressuscitação em sepse com lactato elevado ou choque (condicional, certeza baixa); o texto cita clareamento ≥ 10%. TEC como adjunto a outras medidas de perfusão (condicional, certeza baixa)', pagina: 'rec. 51 e 52, p. 39–40' },
    ilas: { texto: 'Lactato na 1ª hora; 2ª medida em 4 h da abertura do protocolo se > 2× o normal; reavaliação das 6 horas para normalizar a hipoperfusão; TEC em todos os suspeitos', pagina: 'p. 8 e 14' },
    livro: { texto: 'Meta de redução de 20% em 2 h', pagina: 'cap. 4, Tabela 4, p. 72' },
  },
  {
    tema: 'Antimicrobiano — o que as diretrizes escrevem',
    ssc: { texto: 'Choque séptico possível/provável/definido e sepse provável/definida sem choque: antimicrobiano imediato, idealmente em até 1 h do reconhecimento (forte, certeza muito baixa). Sepse possível sem choque: investigação rápida limitada no tempo e, persistindo a suspeita, antimicrobiano em até 3 h da primeira suspeita (condicional, certeza muito baixa)', pagina: 'rec. 16–18, p. 22' },
    ilas: { texto: 'Antimicrobiano de amplo espectro EV na 1ª hora da identificação, conforme a CCIH; 1ª dose plena em bolus; betalactâmicos de meia-vida curta (cefepima, piperacilina-tazobactam, meropenem): 1ª dose em bolus e as seguintes em infusão estendida ou contínua', pagina: 'p. 9–10' },
    nota: 'A escolha do antimicrobiano é do serviço (CCIH). Aqui só o que as fontes escrevem sobre tempo e forma de infusão.',
  },
  {
    tema: 'Corticoide no choque séptico',
    ssc: { texto: 'Sugere corticoide IV no choque séptico (condicional, certeza baixa); regime de referência 200 mg/dia de hidrocortisona por 7 dias (ADRENAL); 90% do painel usa 200 mg/24 h, 86% em doses intermitentes; sem benefício adicional acima de ~260 mg/dia', pagina: 'rec. 79, p. 51' },
    ilas: { texto: 'Hidrocortisona IV 200 mg/dia (50 mg 6/6 h ou infusão contínua), decisão individualizada pelo contexto e pela resposta hemodinâmica', pagina: 'p. 15' },
    livro: { texto: 'Choque séptico com vasopressor ou VM: considerar hidrocortisona 200 mg/dia por 7 dias', pagina: 'cap. 7, p. 125' },
  },
  {
    tema: 'Bicarbonato',
    ssc: { texto: 'Contra bicarbonato para melhorar hemodinâmica ou reduzir vasopressor na acidemia láctica do choque séptico (condicional, certeza baixa). Com acidemia metabólica grave (pH ≤ 7,2) e LRA AKIN 2–3: sugere bicarbonato (condicional, certeza muito baixa)', pagina: 'rec. 95 e 96, p. 56' },
  },
  {
    tema: 'Transfusão de hemácias',
    ilas: { texto: 'Com sinais de hipoperfusão e hemoglobina abaixo de 7 g/dL pode-se transfundir, salvo situações específicas (o texto imprime "mg/dL")', pagina: 'p. 14' },
    livro: { texto: 'Hb ≤ 7 g/dL, exceto choque hemorrágico ou isquemia miocárdica ativa', pagina: 'cap. 7, p. 126' },
  },
  {
    tema: 'Ventilação mecânica',
    ilas: { texto: 'SDRA: VC 6 mL/kg de peso predito, platô ≤ 30 cmH₂O; IRpA hipoxêmica sem SDRA: VC 6–8 mL/kg de peso predito', pagina: 'p. 15' },
    livro: { texto: 'VC 4–6 mL/kg "de peso", platô ≤ 30, driving pressure ≤ 15', pagina: 'cap. 7, Tabela 12, p. 127' },
    nota: 'O livro não diz se é peso predito; o ILAS diz.',
  },
]

/** Relatados, não implementados (pediatria usa outra fonte). */
export const PEDIATRICO_NAO_IMPLEMENTADO = [
  { texto: '20 mL/kg em até 3 infusões em crianças', pagina: 'cap. 4, p. 73–74' },
  { texto: 'Débito urinário na população pediátrica 1–2 mL/kg/h', pagina: 'cap. 4, Tabela 4, p. 72' },
  { texto: 'Choque hemorrágico: evitar cristaloide > 20 mL/kg em crianças', pagina: 'cap. 4, p. 77' },
  { texto: 'Hipotensão é sinal pouco sensível (tardio), principalmente em crianças', pagina: 'cap. 4, p. 67' },
]
