import { completo, somar, type Escore } from '../escore.ts'
import type { Ficha, Fonte } from '../ficha.ts'
import { fichaAdulto, pagina } from './fonte.ts'

// Transfusão de hemocomponentes no adulto — cap. 82 do Manual de Medicina de
// Emergência do HCFMUSP (3ª ed., 2022), p. 1075–1085, com o trecho de
// transfusão do trauma (cap. 47, p. 647). A ferramenta mostra os gatilhos e as
// doses que o livro traz e faz as contas de peso, volume, velocidade e
// incremento esperado. A decisão de transfundir é do médico (ADR 0007): nada
// aqui indica transfusão.
//
// Onde o texto do capítulo e a Tabela 4 (p. 1082) divergem, as duas versões
// aparecem, cada uma com a página.
//
// Versão .1 de 28/09/2026: diretrizes AABB 2023 (hemácias; texto integral
// lido), AABB 2025 (IAM; resumo lido) e AABB/ICTMG 2025 (plaquetas; resumo
// lido) ao lado do manual. O manual continua sendo a base da conta.

export const AABB_2023: Fonte = {
  citacao: 'Carson JL, Stanworth SJ, Guyatt G, et al. Red Blood Cell Transfusion: 2023 AABB International Guidelines. JAMA. 2023;330(19):1892–1902. Recomendações 1 e 2 e boa prática (p. 1894).',
  url: 'https://doi.org/10.1001/jama.2023.12914',
}

export const AABB_IAM_2025: Fonte = {
  citacao: 'Carson JL, et al. Red Cell Transfusion in Acute Myocardial Infarction: AABB International Clinical Practice Guidelines. Ann Intern Med. 2025;178:1469–1477 (resumo lido).',
  url: 'https://doi.org/10.7326/ANNALS-25-00706',
}

export const AABB_PLAQUETAS_2025: Fonte = {
  citacao: 'Metcalf RA, et al. Platelet Transfusion: 2025 AABB and ICTMG International Clinical Practice Guidelines. JAMA. 2025;334(7):606–617 (resumo lido).',
  url: 'https://doi.org/10.1001/jama.2025.7529',
}

const PAG_TRANSFUSAO = 'cap. 82 Transfusão de hemocomponentes, p. 1075–1082; cap. 47, p. 647'

export const fichaTransfusaoAdulto: Ficha = {
  ...fichaAdulto('adulto-transfusao-hemocomponentes', 'Transfusão de hemocomponentes — adulto', PAG_TRANSFUSAO),
  versao: '2026-09-28.1',
  fontes: [pagina(PAG_TRANSFUSAO), AABB_2023, AABB_IAM_2025, AABB_PLAQUETAS_2025],
  revisadoEm: '28/09/2026 (AABB 2023 lida no texto; AABB 2025 e AABB/ICTMG 2025 pelos resumos; manual mantido como base)',
}

/** AABB 2023 (adultos hospitalizados) e AABB 2025 (IAM): limiar de Hb por situação. */
export type GatilhoHb2023 = { id: string; situacao: string; hb: number; forca: string; fonte: string }

export const GATILHOS_HB_AABB: GatilhoHb2023[] = [
  { id: 'estavel', situacao: 'Adulto hospitalizado, hemodinamicamente estável (inclusive crítico)', hb: 7, forca: 'forte, evidência moderada (rec. 1)', fonte: 'AABB 2023, p. 1894' },
  { id: 'cardiaca', situacao: 'Cirurgia cardíaca', hb: 7.5, forca: 'observação da rec. 1: limiar usado na maioria dos ensaios', fonte: 'AABB 2023, p. 1894' },
  { id: 'ortopedica-cv', situacao: 'Cirurgia ortopédica ou doença cardiovascular preexistente', hb: 8, forca: 'observação da rec. 1', fonte: 'AABB 2023, p. 1894' },
  { id: 'hemato-onco', situacao: 'Doença hematológica ou oncológica, hospitalizado', hb: 7, forca: 'condicional, evidência baixa (rec. 2)', fonte: 'AABB 2023, p. 1894' },
  { id: 'iam', situacao: 'Infarto agudo do miocárdio, hospitalizado: estratégia LIBERAL', hb: 10, forca: 'condicional, evidência baixa; 7–8 g/dL pode aumentar a mortalidade', fonte: 'AABB 2025 (resumo)' },
]

export const BOA_PRATICA_AABB_2023 = 'Boa prática: decidir pela Hb e também por sintomas, sinais, outros exames, alternativas à transfusão e preferências do paciente; o limiar de 7 g/dL não se aplica a sangramento maciço, hipoxemia grave ou instabilidade (AABB 2023, p. 1894).'

/** Linhas da AABB em que a Hb informada está abaixo do limiar (só informação). */
export function gatilhosAbaixoAabb(hb: number): string[] {
  if (!Number.isFinite(hb) || hb <= 0) return []
  return GATILHOS_HB_AABB.filter((g) => hb < g.hb).map((g) => g.id)
}

/** AABB/ICTMG 2025 — plaquetas por situação (resumo da diretriz). `limiar` null = não transfundir. */
export type GatilhoPlaquetas2025 = { situacao: string; limiar: number | null; forca: 'forte' | 'condicional' }

export const PLAQUETAS_AABB_2025: GatilhoPlaquetas2025[] = [
  { situacao: 'Plaquetopenia hipoproliferativa sem sangramento, em quimioterapia ou transplante alogênico', limiar: 10_000, forca: 'forte' },
  { situacao: 'Plaquetopenia de consumo em neonato sem sangramento maior', limiar: 25_000, forca: 'forte' },
  { situacao: 'Punção lombar', limiar: 20_000, forca: 'forte' },
  { situacao: 'Dengue com plaquetopenia de consumo, sem sangramento maior: NÃO transfundir', limiar: null, forca: 'forte' },
  { situacao: 'Transplante autólogo ou anemia aplásica sem sangramento: sem transfusão profilática', limiar: null, forca: 'condicional' },
  { situacao: 'Plaquetopenia de consumo no adulto sem sangramento maior', limiar: 10_000, forca: 'condicional' },
  { situacao: 'Cateter venoso central em sítio compressível', limiar: 10_000, forca: 'condicional' },
  { situacao: 'Radiologia intervencionista: baixo risco', limiar: 20_000, forca: 'condicional' },
  { situacao: 'Radiologia intervencionista: alto risco', limiar: 50_000, forca: 'condicional' },
  { situacao: 'Cirurgia maior não neuroaxial', limiar: 50_000, forca: 'condicional' },
  { situacao: 'Cirurgia cardiovascular sem plaquetopenia e sem hemorragia maior (inclusive com circulação extracorpórea): NÃO transfundir', limiar: null, forca: 'condicional' },
  { situacao: 'Hemorragia intracraniana não operatória com plaquetas > 100.000/µL, inclusive em uso de antiagregante: NÃO transfundir', limiar: null, forca: 'condicional' },
]

/** Onde as diretrizes e o manual não coincidem. */
export const DIFERENCAS_TRANSFUSAO_2023: string[] = [
  'Síndrome coronariana aguda: o manual usa Hb < 8 g/dL (Tabela 1, p. 1076); a AABB 2025 sugere estratégia liberal (< 10 g/dL) no IAM hospitalizado, condicional, porque 7–8 g/dL pode aumentar a mortalidade.',
  'Anemia sintomática: o manual manda considerar Hb < 10 g/dL (Tabela 1); a AABB 2023 não traz esse limiar — trata sintomas e sinais como parte da boa prática, com 7 g/dL para o estável.',
  'Cirurgia cardíaca 7,5 g/dL e ortopédica/doença cardiovascular 8 g/dL (AABB 2023) coincidem com o "considerar ≤ 8" do manual (p. 1076).',
  'Plaquetas com febre/infecção: o manual usa < 20.000/µL (Tabela 3, p. 1078); a AABB/ICTMG 2025 usa < 10.000 na hipoproliferativa sem sangramento, sem linha própria para febre.',
  'Cateter venoso central: manual < 20.000 (Tabela 3) × AABB/ICTMG 2025 < 10.000 em sítio compressível (condicional).',
  'Dengue sem sangramento maior: a AABB/ICTMG 2025 recomenda NÃO transfundir plaquetas (forte); o manual não trata do tema neste capítulo.',
  'Hemorragia intracraniana sob antiagregante sem cirurgia e plaquetas > 100.000: a AABB/ICTMG 2025 recomenda não transfundir; o manual traz "sangramento de SNC < 100.000" (Tabela 3).',
]

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0
const faixaVezes = (f: Faixa, k: number): Faixa => [f[0] * k, f[1] * k]

// ---------------------------------------------------------------- hemácias

/** Tabela 1 (p. 1076): gatilho de Hb por condição clínica. `hb` null = o livro não dá número. */
export type GatilhoHb = { id: string; condicao: string; hb: number | null; comparador: '<' | null; considerar: boolean; texto: string }

export const GATILHOS_HB: GatilhoHb[] = [
  { id: 'anemia-sintomatica', condicao: 'Anemia sintomática (isquemia miocárdica, hipotensão ortostática, taquicardia não responsiva a fluido; dispneia ou intolerância ao esforço não contam)', hb: 10, comparador: '<', considerar: true, texto: 'Considerar se Hb < 10 g/dL' },
  { id: 'sca', condicao: 'Síndrome coronariana aguda', hb: 8, comparador: '<', considerar: false, texto: 'Hb < 8 g/dL' },
  { id: 'dac-assintomatico', condicao: 'Assintomático + doença arterial coronariana', hb: 8, comparador: '<', considerar: true, texto: 'Considerar se Hb < 8 g/dL' },
  { id: 'cirurgia-cardiaca', condicao: 'Cirurgia cardíaca', hb: 8, comparador: '<', considerar: false, texto: 'Hb < 8 g/dL' },
  { id: 'critico-estavel', condicao: 'Paciente crítico, estável hemodinamicamente', hb: 7, comparador: '<', considerar: false, texto: 'Hb < 7 g/dL' },
  { id: 'hda', condicao: 'Sangramento agudo do trato gastrointestinal', hb: 7, comparador: '<', considerar: false, texto: 'Hb < 7 g/dL' },
  { id: 'macico', condicao: 'Sangramento maciço ou com instabilidade hemodinâmica', hb: null, comparador: null, considerar: false, texto: 'Em vez de Hb → parâmetros hemodinâmicos e estimativa de sangramento' },
]

export const PAGINA_GATILHOS_HB = 'Tabela 1, p. 1076'

/** Texto corrido (p. 1075–1076): regra geral e exceções. */
export const REGRA_HB_TEXTO = [
  { texto: 'Hb < 7 g/dL para todos os pacientes, exceto instabilidade hemodinâmica, doença cardiovascular estável ou síndrome coronariana aguda, cirurgia ortopédica ou cardíaca', pagina: 'p. 1075–1076' },
  { texto: 'Considerar Hb ≤ 8 g/dL como gatilho na doença cardiovascular estável, na síndrome coronariana aguda e no perioperatório de cirurgias ortopédicas e cardíacas', pagina: 'p. 1076' },
  { texto: 'Preferência pela estratégia restritiva (7–8 g/dL)', pagina: 'p. 1075' },
  { texto: 'Prescrição de 1 unidade de CH por vez, com reavaliação clínica e de Hb/Ht 15 minutos após o término; mais de 1 unidade como exceção se Hb < 4 g/dL ou politrauma em protocolo de transfusão maciça', pagina: 'p. 1075–1076' },
  { texto: 'Sepse: transfusão reservada para Hb ≤ 7 g/dL, exceto choque hemorrágico concomitante ou isquemia miocárdica ativa', pagina: 'cap. 7, p. 126' },
]

/** Linhas da Tabela 1 em que a Hb informada está abaixo do número do livro (só informação, sem indicação). */
export function gatilhosAbaixo(hb: number): string[] {
  if (!Number.isFinite(hb) || hb <= 0) return []
  return GATILHOS_HB.filter((g) => g.hb !== null && hb < g.hb).map((g) => g.id)
}

/** Incremento esperado por CH, sem sangramento: Hb +1 g/dL e Ht +3% (p. 1075). */
export const INCREMENTO_CH = { hbGdl: 1, htPct: 3, pagina: 'p. 1075' }

export type ExpectativaCh = { hb: number; ht: number | null }

/** Hb (e Ht, se informado) esperados após n unidades de CH, na ausência de sangramento. */
export function expectativaCh(hbAtual: number, unidades: number, htAtual?: number): ExpectativaCh | null {
  if (!valido(hbAtual) || !Number.isInteger(unidades) || unidades < 1) return null
  const ht = htAtual !== undefined && valido(htAtual) ? htAtual + INCREMENTO_CH.htPct * unidades : null
  return { hb: hbAtual + INCREMENTO_CH.hbGdl * unidades, ht }
}

/** Considerações práticas do CH (p. 1076). */
export const CH = {
  volumeMl: [300, 400] as Faixa,
  duracaoH: [1, 2] as Faixa,
  duracaoMaxH: 4,
  inicial: { minutos: 15, mlMin: [1, 2] as Faixa },
  depois: { mlMin: 4 },
  sobrecargaMlKgH: 1,
  pagina: 'p. 1076',
}

/** Tabela 4 (p. 1082) — versão da tabela, que diverge do texto. */
export const CH_TABELA4 = { volumeMl: [250, 350] as Faixa, mlKgH: [2, 4] as Faixa, lentoMin: 30, pagina: 'Tabela 4, p. 1082' }

export const mlMinParaMlH = (mlMin: number) => mlMin * 60

export type VelocidadeCh = { inicialMlH: Faixa; depoisMlH: number; sobrecargaMlH: number | null; tabela4MlH: Faixa | null }

/** Velocidades do CH em mL/h: as do texto (p. 1076) e, com peso, a de sobrecarga e a da Tabela 4. */
export function velocidadeCh(pesoKg?: number): VelocidadeCh {
  const temPeso = pesoKg !== undefined && valido(pesoKg)
  return {
    inicialMlH: [mlMinParaMlH(CH.inicial.mlMin[0]), mlMinParaMlH(CH.inicial.mlMin[1])],
    depoisMlH: mlMinParaMlH(CH.depois.mlMin),
    sobrecargaMlH: temPeso ? CH.sobrecargaMlKgH * pesoKg : null,
    tabela4MlH: temPeso ? faixaVezes(CH_TABELA4.mlKgH, pesoKg) : null,
  }
}

// ---------------------------------------------------------------- transfusão maciça

export const TRANSFUSAO_MACICA = {
  definicao: 'Transfusão de 1 volemia ou aproximadamente 10 concentrados de hemácias (CH) em 24 horas ou > 4 unidades em 1 hora',
  ch24h: 10,
  ch1hAcimaDe: 4,
  proporcao: '1 CH : 1 PFC : 1 plaqueta — o capítulo diz que a terapia não deve ser guiada por fórmulas rígidas; benefício de sobrevida em estudos observacionais',
  citrato: 'Complicações da infusão do citrato: alcalose metabólica (1 mmol de citrato → 3 mEq de HCO3⁻); ↓ Ca²⁺ (o citrato se liga ao cálcio iônico); hipotermia; hipercalemia',
  pagina: 'p. 1077',
}

/** 1 mmol de citrato → 3 mEq de HCO3⁻ (p. 1077). */
export const HCO3_POR_MMOL_CITRATO = 3
export const bicarbonatoDoCitrato = (mmolCitrato: number) => (Number.isFinite(mmolCitrato) && mmolCitrato >= 0 ? mmolCitrato * HCO3_POR_MMOL_CITRATO : null)

/** O número de CH informado cabe na definição do livro (≈ 10 em 24 h ou > 4 em 1 h)? */
export function criterioMacica(ch24h?: number, ch1h?: number): { por24h: boolean; por1h: boolean } {
  return {
    por24h: ch24h !== undefined && Number.isFinite(ch24h) && ch24h >= TRANSFUSAO_MACICA.ch24h,
    por1h: ch1h !== undefined && Number.isFinite(ch1h) && ch1h > TRANSFUSAO_MACICA.ch1hAcimaDe,
  }
}

export const TRAUMA_TRANSFUSAO = [
  { texto: 'Transfusão bem indicada em quem mantém instabilidade hemodinâmica após ressuscitação volêmica inicial (1–3 L de cristaloides) ou com hemorragia severa/moderada persistente', pagina: 'cap. 47, p. 647' },
  { texto: 'Transfusão maciça = 10 unidades de CH nas primeiras 24 h (não confundir com protocolo de transfusão maciça)', pagina: 'cap. 47, p. 647' },
  { texto: 'Se a transfusão maciça é necessária, proporção 1:1:1 de plasma, plaquetas e hemácias', pagina: 'cap. 47, p. 647' },
]

// ABC score. O cap. 82 (p. 1077) dá corte ≥ 2 e "trauma penetrante"; o cap. 47
// (p. 647) dá corte > 2 e "trauma penetrante torácico". A soma é a mesma; o
// resultado mostra os dois cortes, cada um com a página.

const NAO_SIM = [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }]

export const abcTransfusaoAdulto: Escore = {
  ficha: fichaAdulto('adulto-abc-score', 'ABC score — previsão de transfusão maciça (adulto)', 'cap. 82, p. 1077; cap. 47, p. 647'),
  descricao: 'Quatro critérios de 1 ponto (Assessment of Blood Consumption), com os dois cortes que o manual traz',
  itens: [
    { tipo: 'escolha', id: 'penetrante', rotulo: 'Trauma penetrante (cap. 47: penetrante torácico)', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'fast', rotulo: 'FAST positivo', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'pas', rotulo: 'PAS ≤ 90 mmHg', opcoes: NAO_SIM },
    { tipo: 'escolha', id: 'fc', rotulo: 'FC ≥ 120 bpm', opcoes: NAO_SIM },
  ],
  calcular(r) {
    if (!completo(abcTransfusaoAdulto, r)) return null
    const total = somar(abcTransfusaoAdulto, r)
    const cap82 = total >= 2
    const cap47 = total > 2
    return {
      rotulo: 'ABC score',
      valor: String(total),
      unidade: 'de 4',
      nota: cap82 ? (cap47 ? 'atinge os dois cortes do manual (≥ 2 e > 2)' : 'atinge o corte ≥ 2 (cap. 82), não o > 2 (cap. 47)') : 'abaixo dos dois cortes do manual',
      estado: cap47 ? 2 : cap82 ? 1 : 0,
      derivados: [
        ['Corte ≥ 2 (cap. 82, p. 1077)', cap82 ? 'atingido' : 'não atingido'],
        ['Corte > 2 (cap. 47, p. 647)', cap47 ? 'atingido' : 'não atingido'],
      ],
      cuidados: [
        'Divergência interna do manual: p. 1077 escreve "ABC score ≥ 2 (ao menos dois dos seguintes)"; p. 647 escreve "escore > 2" e "trauma penetrante torácico".',
        'Cap. 82: a previsão é por julgamento clínico e ABC score; a indicação de protocolo de transfusão maciça varia entre serviços (cap. 47).',
      ],
    }
  },
}

// ---------------------------------------------------------------- plaquetas

/** Tabela 3 (p. 1078): gatilhos de plaquetas. */
export const GATILHOS_PLAQUETAS: { limiar: number | null; condicoes: string[] }[] = [
  { limiar: 10_000, condicoes: ['Estável, sem sangramento'] },
  { limiar: 20_000, condicoes: ['Infecção/febre ou ↑ risco de sangramento', 'Broncoscopia/lavado broncoalveolar; passagem de CVC'] },
  { limiar: 50_000, condicoes: ['Sangramento ativo; procedimentos cirúrgicos/endoscópicos; punção lombar'] },
  { limiar: 100_000, condicoes: ['Sangramento de SNC ou associado a CIVD', 'Neurocirurgia, cirurgia ocular ou cirurgia cardíaca'] },
  { limiar: null, condicoes: ['Disfunção plaquetária: julgamento clínico'] },
]

export const PLAQUETAS = {
  randomicasPorKg: 1 / 10,
  randomicasPorAferese: 6,
  incrementoAferese: [30_000, 60_000] as Faixa,
  inicial: { minutos: 15, mlMin: [2, 5] as Faixa },
  depoisMlH: 300,
  sobrecargaMlKgH: 1,
  duracaoH: [1, 2] as Faixa,
  respostaNormal: 'Aumento > 10.000/µL após 30–60 minutos, com retorno aos níveis basais em 48–72 horas; aumentos menores em duas ocasiões definem refratariedade',
  contraProfilatica: 'Não usar profilaticamente na púrpura trombocitopênica trombótica e na trombocitopenia induzida por heparina',
  pagina: 'p. 1078–1079',
}

/** Tabela 4 (p. 1082): aférese 1 unidade ou 5 mL/kg, 250–300 mL, 30–60 min. */
export const AFERESE_TABELA4 = { mlKg: 5, volumeMl: [250, 300] as Faixa, minutos: [30, 60] as Faixa, incremento: [30_000, 60_000] as Faixa, pagina: 'Tabela 4, p. 1082' }

export type DosePlaquetas = { randomicas: number; afereseEquivalente: number; afereseMlKg: number; sobrecargaMlH: number }

/** 1 unidade randômica/10 kg (p. 1078); 6 randômicas ≈ 1 aférese (p. 1078); aférese 5 mL/kg (Tabela 4). */
export function dosePlaquetas(pesoKg: number): DosePlaquetas | null {
  if (!valido(pesoKg)) return null
  const randomicas = pesoKg * PLAQUETAS.randomicasPorKg
  return {
    randomicas,
    afereseEquivalente: randomicas / PLAQUETAS.randomicasPorAferese,
    afereseMlKg: AFERESE_TABELA4.mlKg * pesoKg,
    sobrecargaMlH: PLAQUETAS.sobrecargaMlKgH * pesoKg,
  }
}

/** Incremento da contagem após a transfusão; "resposta normal" do livro é > 10.000/µL em 30–60 min (p. 1079). */
export function respostaPlaquetas(antes: number, depois: number): { incremento: number; acimaDe10mil: boolean } | null {
  if (!Number.isFinite(antes) || !Number.isFinite(depois) || antes < 0 || depois < 0) return null
  const incremento = depois - antes
  return { incremento, acimaDe10mil: incremento > 10_000 }
}

// ---------------------------------------------------------------- plasma

export const PFC = {
  mlKg: [10, 20] as Faixa,
  bolsas: [3, 5] as Faixa,
  mlPorBolsa: [200, 250] as Faixa,
  mlKgH: [2, 5] as Faixa,
  iccMlKgH: 1,
  alvo: '30–40% dos níveis normais dos fatores = INR 1,7 (níveis hemostáticos)',
  inrProcedimento: 'Alguns autores transfundem antes de procedimento se INR ≥ 1,6 sem tempo para vitamina K (sem evidência de qualidade); o serviço não usa PFC para profilaxia de procedimento invasivo se INR < 2',
  pagina: 'p. 1079–1080',
}

/** Tabela 4 (p. 1082): 3–5 unidades ou 10–15 mL/kg; 2–4 mL/kg/h. */
export const PFC_TABELA4 = { mlKg: [10, 15] as Faixa, mlKgH: [2, 4] as Faixa, pagina: 'Tabela 4, p. 1082' }

export type DosePfc = { ml: Faixa; bolsas: Faixa; mlH: Faixa; iccMlH: number; tabela4Ml: Faixa; tabela4MlH: Faixa }

/**
 * PFC por peso: 10–20 mL/kg; nº de bolsas = volume ÷ 200–250 mL (a faixa vai
 * da menor dose na bolsa maior à maior dose na bolsa menor); 2–5 mL/kg/h;
 * 1 mL/kg/h na hipervolemia/ICC (p. 1080).
 */
export function dosePfc(pesoKg: number): DosePfc | null {
  if (!valido(pesoKg)) return null
  const ml = faixaVezes(PFC.mlKg, pesoKg)
  return {
    ml,
    bolsas: [ml[0] / PFC.mlPorBolsa[1], ml[1] / PFC.mlPorBolsa[0]],
    mlH: faixaVezes(PFC.mlKgH, pesoKg),
    iccMlH: PFC.iccMlKgH * pesoKg,
    tabela4Ml: faixaVezes(PFC_TABELA4.mlKg, pesoKg),
    tabela4MlH: faixaVezes(PFC_TABELA4.mlKgH, pesoKg),
  }
}

// ---------------------------------------------------------------- crioprecipitado

export const CRIO = {
  gatilho: 100,
  gatilhoTrauma: [150, 200] as Faixa,
  alvoAcimaDe: 100,
  incrementoPorUnidade: [7, 10] as Faixa,
  unidadesPorKg: 1 / 10,
  unidadesUsuais: [5, 10] as Faixa,
  pagina: 'p. 1080',
}

/** Tabela 4 (p. 1082): 5–10 unidades elevam o fibrinogênio em 50–100 mg/dL; 5–20 mL por unidade. */
export const CRIO_TABELA4 = { unidades: [5, 10] as Faixa, incremento: [50, 100] as Faixa, mlPorUnidade: [5, 20] as Faixa, pagina: 'Tabela 4, p. 1082' }

export type DoseCrio = { unidadesPeso: number; incremento: Faixa; fibrinogenioEsperado: Faixa | null; unidadesParaAlvo: Faixa | null }

/**
 * Crioprecipitado: 1 unidade/10 kg; cada unidade eleva 7–10 mg/dL (p. 1080).
 * `unidades` = quantas se pretende (padrão: peso ÷ 10, arredondado para cima).
 * Com o fibrinogênio atual, mostra o esperado e quantas unidades o incremento
 * do livro levaria a passar de 100 mg/dL (alvo do livro).
 */
export function doseCrio(pesoKg: number, fibrinogenio?: number, unidades?: number): DoseCrio | null {
  if (!valido(pesoKg)) return null
  const unidadesPeso = pesoKg * CRIO.unidadesPorKg
  const n = unidades !== undefined && Number.isInteger(unidades) && unidades > 0 ? unidades : Math.ceil(unidadesPeso)
  const incremento = faixaVezes(CRIO.incrementoPorUnidade, n)
  const temFib = fibrinogenio !== undefined && Number.isFinite(fibrinogenio) && fibrinogenio >= 0
  let unidadesParaAlvo: Faixa | null = null
  if (temFib) {
    const falta = CRIO.alvoAcimaDe - fibrinogenio
    unidadesParaAlvo = falta < 0 ? [0, 0] : [Math.floor(falta / CRIO.incrementoPorUnidade[1]) + 1, Math.floor(falta / CRIO.incrementoPorUnidade[0]) + 1]
  }
  return { unidadesPeso, incremento, fibrinogenioEsperado: temFib ? [fibrinogenio + incremento[0], fibrinogenio + incremento[1]] : null, unidadesParaAlvo }
}

// ---------------------------------------------------------------- complexo protrombínico

export const CCP = {
  fixas: [
    { id: 'maior', texto: '1.000 UI para qualquer sangramento maior', ui: 1000 },
    { id: 'snc', texto: '1.500 UI para sangramento do SNC', ui: 1500 },
  ],
  porInr: [
    { id: 'inr2-4', de: 2, ate: 4, uiKg: 25, maxUi: 2500, texto: 'INR 2–4: 25 UI/kg (máximo de 2.500 UI)' },
    { id: 'inr4-6', de: 4, ate: 6, uiKg: 35, maxUi: 3500, texto: 'INR 4–6: 35 UI/kg (máximo de 3.500 UI)' },
    { id: 'inr>6', de: 6, ate: Infinity, uiKg: 50, maxUi: 5000, texto: 'INR > 6: 50 UI/kg (máximo de 5.000 UI)' },
  ],
  uiMin: 100,
  indicacao: 'Reversão de sangramento maior/hemorragia intracraniana associada a antagonistas da vitamina K; não para reversão não emergencial',
  nota: 'Doses fixas não são inferiores às condicionadas a massa corporal e INR. Administrar conjuntamente vitamina K (o capítulo não traz a dose).',
  pagina: 'p. 1081',
}

export type DoseCcp = { faixa: string; uiKg: number; uiCalculada: number; maxUi: number; ui: number; limitada: boolean; minutos: number }

/**
 * CCP pelo INR (p. 1081). As faixas do livro se tocam em 4 e 6: INR exatamente
 * 4 cabe em "2–4" e "4–6" e volta com as duas; 6 cabe em "4–6" (o "> 6" é
 * estrito). INR < 2 não tem dose por peso no livro (lista vazia).
 */
export function doseCcp(pesoKg: number, inr: number): DoseCcp[] | null {
  if (!valido(pesoKg) || !Number.isFinite(inr) || inr <= 0) return null
  return CCP.porInr
    .filter((f) => (f.ate === Infinity ? inr > f.de : inr >= f.de && inr <= f.ate))
    .map((f) => {
      const uiCalculada = f.uiKg * pesoKg
      const ui = Math.min(uiCalculada, f.maxUi)
      return { faixa: f.texto, uiKg: f.uiKg, uiCalculada, maxUi: f.maxUi, ui, limitada: uiCalculada > f.maxUi, minutos: ui / CCP.uiMin }
    })
}

/** Tempo mínimo de infusão a 100 UI/min (p. 1081). */
export const minutosCcp = (ui: number) => (valido(ui) ? ui / CCP.uiMin : null)

// ---------------------------------------------------------------- errata

export const ERRATA_TRANSFUSAO = [
  'Velocidade do CH: o texto (p. 1076) traz 1–2 mL/min nos 15 min iniciais e 4 mL/min depois; a Tabela 4 (p. 1082) traz "os 30 minutos iniciais são lentos" e 2–4 mL/kg/h. Volume do CH: 300–400 mL (p. 1076) x 250–350 mL (Tabela 4). As duas versões aparecem.',
  'PFC: 10–20 mL/kg e 2–5 mL/kg/h (p. 1080) x 10–15 mL/kg e 2–4 mL/kg/h (Tabela 4, p. 1082). As duas versões aparecem.',
  'Crioprecipitado: 7–10 mg/dL por unidade × 5–10 unidades = 35–100 mg/dL (p. 1080), enquanto a Tabela 4 (p. 1082) diz que 5–10 unidades elevam 50–100 mg/dL. A conta usa o incremento por unidade.',
  'ABC score: "≥ 2" e "trauma penetrante" (p. 1077) x "> 2" e "trauma penetrante torácico" (p. 647). O resultado mostra os dois cortes.',
  'p. 647: "10 UI de concentrado de hemácias" — lido como 10 unidades (a p. 1077 fala em aproximadamente 10 CH).',
  'p. 1081: "fatores VII, IV e X" e "dose de acorto com INR" — erros de digitação (a própria página define o CCP como fatores vitamina K-dependentes, que a p. 1079 lista como II, VII, IX e X); não mudam a dose.',
  'CCP: as faixas "INR 2–4" e "INR 4–6" se tocam em 4 — o INR 4 exato mostra as duas doses.',
]
