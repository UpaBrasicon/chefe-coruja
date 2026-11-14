import type { Ficha, Fonte } from '../ficha.ts'
import { completo, escolha, somar, type Escore } from '../escore.ts'
import { NAHCO3_84_MEQ_POR_ML } from './acidobase.ts'
import { fichaAdulto } from './fonte.ts'
import { numero as numeroBr } from '../../lib/formato.ts'

// Lesão renal aguda (cap. 61, p. 824–841) e rabdomiólise (cap. 63,
// p. 852–862) pelo Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022).
// A ferramenta estadia pelo KDIGO como a Tabela 1 escreve, calcula FENa, FEUr,
// Ur/Cr, o teste de furosemida e as soluções da Tabela 3 da rabdomiólise, e
// mostra as indicações de terapia de substituição renal. A decisão é do médico
// (ADR 0007).

// Lote 4 da revisão do HCFMUSP, O4 = A (decisão do RT de 14/11/2026), cap. 61: a
// KDIGO 2026 de LRA e DRA estava em consulta pública, sem texto final, no site da
// KDIGO em 14/11/2026. Vale a KDIGO 2012, lida no PDF do site (resumo das
// recomendações, p. 8–12). As contas do manual não mudam.
export const KDIGO_LRA_2012: Fonte = {
  citacao: 'Kidney Disease: Improving Global Outcomes (KDIGO) Acute Kidney Injury Work Group. KDIGO Clinical Practice Guideline for Acute Kidney Injury. Kidney Int Suppl. 2012;2(1):1–138. Resumo das recomendações lido no PDF do site da KDIGO; GRADE. A KDIGO 2026 ainda era rascunho em consulta pública em 14/11/2026.',
  url: 'https://kdigo.org/wp-content/uploads/2016/10/KDIGO-2012-AKI-Guideline-English.pdf',
}

const SEM_ITEM_LRA = 'sem item do manual na ferramenta'

/** KDIGO 2012 × manual, na LRA do adulto; um tema por linha. */
export const DIRETRIZ_LRA: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Versão da diretriz', diretriz: 'A KDIGO 2026 de lesão renal aguda e doença renal aguda existe só como rascunho de consulta pública (março de 2026; https://kdigo.org/wp-content/uploads/2026/03/KDIGO-2026-AKI-AKD-Guideline-Public-Review-Draft-March-2026.pdf). A própria KDIGO diz que o conteúdo vai mudar e que o rascunho não deve ser usado fora da consulta. Vale a KDIGO 2012; a 2026 entra quando sair a versão final', grau: 'sem grau', fonte: 'KDIGO 2012', livro: 'o manual estadia pela KDIGO (cap. 61, Tabela 1, p. 825)' },
  { tema: 'Definição e estádio', diretriz: 'LRA: creatinina sobe 0,3 mg/dL ou mais em 48 h, ou chega a 1,5 vez o basal conhecido ou presumido dos 7 dias anteriores, ou diurese < 0,5 mL/kg/h por 6 h. Estádio 1: 1,5–1,9 × ou + 0,3 mg/dL, ou diurese < 0,5 por 6–12 h; 2: 2,0–2,9 ×, ou < 0,5 por 12 h ou mais; 3: 3 ×, creatinina ≥ 4 mg/dL, início de TSR, diurese < 0,3 por 24 h ou mais, ou anúria por 12 h ou mais', grau: 'sem grau', fonte: 'KDIGO 2012', livro: 'os mesmos cortes da Tabela 1 (cap. 61, p. 825), que a ferramenta calcula' },
  { tema: 'Causa e seguimento', diretriz: 'Procurar a causa sempre, com atenção às reversíveis; reavaliar 3 meses depois da LRA para ver recuperação, doença renal crônica nova ou piora da prévia', grau: 'sem grau', fonte: 'KDIGO 2012', livro: 'FENa, FEUr, ureia/creatinina e índices urinários para separar pré-renal de NTA (cap. 61, Tabelas 2 e 3, p. 826–832)' },
  { tema: 'Medidas por estádio', diretriz: 'Todo paciente de risco: suspender nefrotóxicos quando possível, garantir volemia e pressão de perfusão, monitorar creatinina e diurese, evitar hiperglicemia, considerar alternativa ao contraste. A partir do estádio 2: ajustar a dose dos medicamentos e considerar TSR e UTI. Estádio 3: evitar cateter subclávio se possível', grau: 'Figura 4, sem grau', fonte: 'KDIGO 2012', livro: SEM_ITEM_LRA },
  { tema: 'Fluido e vasopressor', diretriz: 'Sem choque hemorrágico, cristaloide isotônico em vez de coloide (albumina ou amido) para expandir volume na LRA ou no risco de LRA (2B). Vasopressor junto com fluido no choque vasoplégico (1C). Protocolo de metas hemodinâmicas no perioperatório de alto risco e no choque séptico (2C)', grau: '2B; 1C; 2C', fonte: 'KDIGO 2012', livro: SEM_ITEM_LRA },
  { tema: 'Diurético', diretriz: 'Não usar diurético para prevenir LRA (1B) nem para tratá-la, exceto na sobrecarga de volume (2C); não usar diurético para apressar a recuperação ou reduzir a diálise (2B)', grau: '1B; 2C; 2B', fonte: 'KDIGO 2012', livro: 'teste de estresse com furosemida 1 mg/kg (1,5 mg/kg com uso prévio): diurese < 200 mL em 2 h prediz estádio 3 (cap. 61, p. 836)' },
  { tema: 'Dopamina e outros', diretriz: 'Não usar dopamina em dose baixa para prevenir ou tratar LRA (1A); nem fenoldopam (2C), peptídeo natriurético atrial (2C para prevenir, 2B para tratar) ou IGF-1 (1B)', grau: '1A; 2C; 2B; 1B', fonte: 'KDIGO 2012', livro: 'dopamina em dose renal (0,5–3 µg/kg/min): sem benefício (cap. 61, p. 836)' },
  { tema: 'Glicemia e nutrição', diretriz: 'Doente crítico: insulina com alvo de glicemia 110–149 mg/dL (2C). Energia de 20–30 kcal/kg/dia (2C). Não restringir proteína para evitar ou adiar a diálise (2D); proteína 0,8–1,0 g/kg/dia sem diálise, 1,0–1,5 com diálise e até 1,7 na TSR contínua ou no hipercatabolismo (2D). Via enteral de preferência (2C)', grau: '2C; 2D', fonte: 'KDIGO 2012', livro: SEM_ITEM_LRA },
  { tema: 'Aminoglicosídeo e anfotericina', diretriz: 'Não usar aminoglicosídeo se houver alternativa menos nefrotóxica (2A); com função renal normal e estável, dose única diária (2B); dosar nível com várias doses por dia por mais de 24 h (1A) ou dose única por mais de 48 h (2C). Anfotericina lipídica em vez da convencional (2A)', grau: '2A; 2B; 1A; 2C', fonte: 'KDIGO 2012', livro: SEM_ITEM_LRA },
  { tema: 'N-acetilcisteína', diretriz: 'Não usar NAC para prevenir LRA no doente crítico com hipotensão (2D) nem para prevenir LRA pós-cirúrgica (1A)', grau: '2D; 1A', fonte: 'KDIGO 2012', livro: SEM_ITEM_LRA },
  { tema: 'Contraste iodado', diretriz: 'Avaliar o risco e a função renal antes do contraste; menor dose possível; contraste iso ou hipo-osmolar no paciente de risco (1B). Expansão EV com soro fisiológico ou bicarbonato isotônico no paciente de risco (1A), não só fluido oral (1C); NAC oral com cristaloide EV (2D). Não usar hemodiálise ou hemofiltração profilática (2C)', grau: '1B; 1A; 1C; 2D; 2C', fonte: 'KDIGO 2012', livro: SEM_ITEM_LRA },
  { tema: 'Quando iniciar a diálise', diretriz: 'Iniciar a TSR com urgência quando houver alteração de volume, eletrólitos ou ácido-base que ameace a vida. Decidir pelo contexto clínico, pelas condições que a TSR corrige e pela tendência dos exames, não por um corte isolado de ureia ou creatinina', grau: 'sem grau', fonte: 'KDIGO 2012', livro: 'hipervolemia refratária, acidose refratária (pH < 7,1), hipercalemia refratária, síndrome urêmica, intoxicação dialisável, azotemia progressiva ou oligúria sem resposta a fluido (cap. 61, Tabela 5, p. 837–838)' },
  { tema: 'Anticoagulação na diálise', diretriz: 'Anticoagular a TSR se não houver risco de sangramento, coagulopatia ou anticoagulação sistêmica (1B). Intermitente: heparina não fracionada ou de baixo peso (1C). Contínua: citrato regional (2B); heparina se houver contraindicação ao citrato (2C)', grau: '1B; 1C; 2B; 2C', fonte: 'KDIGO 2012', livro: SEM_ITEM_LRA },
]

export const DIFERENCAS_LRA: string[] = [
  'Versão: a KDIGO 2026 é só rascunho de consulta pública, que a KDIGO pede para não usar fora da consulta; a nota usa a KDIGO 2012, que o manual também segue no estadiamento, até sair a versão final de 2026.',
  'Diurético: a KDIGO 2012 não usa diurético para tratar LRA fora da sobrecarga de volume (2C); o manual traz o teste de estresse com furosemida, que serve para prever a evolução.',
  'Início da diálise: a KDIGO 2012 decide pelo contexto e pela tendência dos exames; o manual lista as indicações e dá pH < 7,1 para a acidose refratária.',
  'Fluido, nutrição, aminoglicosídeo, contraste e anticoagulação da diálise: a KDIGO 2012 traz; a ferramenta do manual não.',
]

const fichaLraLivro = fichaAdulto('adulto-lesao-renal-aguda', 'Lesão renal aguda — adulto', 'cap. 61 Lesão renal aguda, p. 824–841')
export const fichaLesaoRenalAguda: Ficha = {
  ...fichaLraLivro,
  versao: '2026-11-14.2',
  fontes: [...fichaLraLivro.fontes, KDIGO_LRA_2012],
  revisadoEm: '14/11/2026, .2: aviso de que a KDIGO 2026 é só rascunho, por decisão do RT; 14/11/2026 (KDIGO 2012 ao lado do manual, porque a KDIGO 2026 ainda era rascunho; lote 4 da revisão do HCFMUSP; aguarda aprovação do RT)',
}
// Revisão PubMed, itens médios (decisão do RT de 06/11/2026, H9 = A): o corte
// de CPK do workshop ENMC diverge do livro e entra como nota de divergência no
// bloco do diagnóstico. A ferramenta mantém o critério do livro.
export const ENMC_RABDO_2025: Fonte = {
  citacao: 'Kruijt N, Laforet P, Vissing J, et al. 276th ENMC International Workshop: recommendations on optimal diagnostic pathway and management strategy for patients with acute rhabdomyolysis worldwide. 15th–17th March 2024, Hoofddorp, The Netherlands. Neuromuscul Disord. 2025;50:105344 (PMID 40220353).',
  url: 'https://doi.org/10.1016/j.nmd.2025.105344',
}

export const NOTA_ENMC_RABDO =
  'Divergência — ENMC 2024 (workshop internacional com 21 especialistas, publicado em 2025, posterior ao livro): o diagnóstico exige sintomas musculares (edema muscular intenso, fraqueza e/ou mialgia), CPK > 10.000 UI/L na rabdomiólise por esforço ou > 5.000 UI/L na não relacionada ao esforço, com pico em 1 a 4 dias e normalização em 1 a 2 semanas de repouso; com doença neuromuscular de base, CPK acima de 5 a 10 vezes o basal do paciente. Recomenda tratar só quando o risco de LRA é alto, estimado pelo escore de McMahon. O livro usa CPK > 5–10 × LSN (usualmente > 1.000 UI/L), sem corte rigoroso; a ferramenta mantém o critério do livro.'

const fichaRabdoLivro = fichaAdulto('adulto-rabdomiolise', 'Rabdomiólise — adulto', 'cap. 63 Rabdomiólise, p. 852–862')
export const fichaRabdomiolise: Ficha = {
  ...fichaRabdoLivro,
  versao: '2026-11-06.1',
  fontes: [...fichaRabdoLivro.fontes, ENMC_RABDO_2025],
  revisadoEm: '06/11/2026 (nota de divergência do corte de CPK do ENMC; revisão PubMed, itens médios)',
}

export type Faixa = [number, number]
export type Referencia = { texto: string; pagina: string; errata?: string }

const valido = (x: number) => Number.isFinite(x) && x > 0
const fmt = (x: number, casas = 2) => numeroBr(Math.round(x * 10 ** casas) / 10 ** casas)

// ── KDIGO (p. 824–825) ──────────────────────────────────────────────────────

export type EntradaKdigo = {
  crBasal?: number
  crAtual?: number
  /** aumento absoluto observado em 48 h (mg/dL), se conhecido */
  aumento48h?: number
  pesoKg?: number
  diureseMl?: number
  periodoH?: number
  anuriaH?: number
  tsr?: boolean
}

export type ResultadoKdigo = {
  estadioCreatinina: 0 | 1 | 2 | 3 | null
  estadioDiurese: 0 | 1 | 2 | 3 | null
  estadio: 0 | 1 | 2 | 3 | null
  razao: number | null
  mlKgH: number | null
  motivos: string[]
  avisos: string[]
}

/**
 * Tabela 1 (p. 825): I = 1,5–1,9 × ou ≥ 0,3 mg/dL ou DU < 0,5 mL/kg/h por 6–12 h;
 * II = 2–2,9 × ou DU < 0,5 por ≥ 12 h; III = 3 × ou ≥ 4 mg/dL ou DU < 0,3 por
 * ≥ 24 h ou anúria ≥ 12 h ou TSR. O estádio final é o maior dos dois critérios.
 */
export function kdigo(e: EntradaKdigo): ResultadoKdigo {
  const motivos: string[] = []
  const avisos: string[] = []
  let estCr: ResultadoKdigo['estadioCreatinina'] = null
  let razao: number | null = null
  if (e.crBasal !== undefined && e.crAtual !== undefined && valido(e.crBasal) && valido(e.crAtual)) {
    razao = e.crAtual / e.crBasal
    const delta = e.aumento48h !== undefined && Number.isFinite(e.aumento48h) ? e.aumento48h : null
    if (razao >= 3) { estCr = 3; motivos.push(`creatinina ${fmt(razao)} × o basal (3 ×)`) }
    else if (e.crAtual >= 4) { estCr = 3; motivos.push('creatinina ≥ 4 mg/dL') }
    else if (razao >= 2) { estCr = 2; motivos.push(`creatinina ${fmt(razao)} × o basal (2 a 2,9 ×)`) }
    else if (razao >= 1.5) { estCr = 1; motivos.push(`creatinina ${fmt(razao)} × o basal (1,5 a 1,9 ×)`) }
    else if (delta !== null && delta >= 0.3) { estCr = 1; motivos.push(`aumento de ${fmt(delta)} mg/dL em 48 h (≥ 0,3)`) }
    else estCr = 0
    if (razao >= 1.9 && razao < 2) avisos.push('Razão entre 1,9 e 2: a tabela escreve "1,5 a 1,9" e "2 a 2,9"; a ferramenta põe no estágio I.')
    if (razao >= 2.9 && razao < 3) avisos.push('Razão entre 2,9 e 3: a tabela escreve "2 a 2,9" e "3 ×"; a ferramenta põe no estágio II.')
    if (e.crAtual >= 4) avisos.push('A tabela escreve "elevação ≥ 4 mg/dL" sem repetir a exigência de aumento agudo; a ferramenta lê como creatinina ≥ 4.')
  }
  let estDu: ResultadoKdigo['estadioDiurese'] = null
  let mlKgH: number | null = null
  if (e.pesoKg !== undefined && e.diureseMl !== undefined && e.periodoH !== undefined && valido(e.pesoKg) && Number.isFinite(e.diureseMl) && e.diureseMl >= 0 && valido(e.periodoH)) {
    mlKgH = e.diureseMl / e.pesoKg / e.periodoH
    const h = e.periodoH
    if (mlKgH < 0.3 && h >= 24) { estDu = 3; motivos.push(`diurese ${fmt(mlKgH)} mL/kg/h por ${fmt(h, 0)} h (< 0,3 por ≥ 24 h)`) }
    else if (mlKgH < 0.5 && h >= 12) { estDu = 2; motivos.push(`diurese ${fmt(mlKgH)} mL/kg/h por ${fmt(h, 0)} h (< 0,5 por ≥ 12 h)`) }
    else if (mlKgH < 0.5 && h >= 6) { estDu = 1; motivos.push(`diurese ${fmt(mlKgH)} mL/kg/h por ${fmt(h, 0)} h (< 0,5 por 6–12 h)`) }
    else estDu = 0
    if (mlKgH < 0.5 && h < 6) avisos.push('Diurese < 0,5 mL/kg/h por menos de 6 h: ainda fora do critério (a definição pede mais de 6 h, p. 825).')
    if (h === 6) avisos.push('Exatamente 6 h: a definição diz "maior que 6 horas" (p. 825) e a Tabela 1 diz "6–12 horas"; a ferramenta usa a tabela.')
  }
  if (e.anuriaH !== undefined && e.anuriaH >= 12) { estDu = 3; motivos.push(`anúria por ${fmt(e.anuriaH, 0)} h (≥ 12 h)`) }
  if (e.tsr) motivos.push('início de terapia de substituição renal')
  const estadios = [estCr, estDu, e.tsr ? 3 : null].filter((x): x is 0 | 1 | 2 | 3 => x !== null)
  const estadio = estadios.length ? (Math.max(...estadios) as 0 | 1 | 2 | 3) : null
  return { estadioCreatinina: estCr, estadioDiurese: estDu, estadio, razao, mlKgH, motivos, avisos }
}

// ── Frações excretórias e índices (Tabela 2 p. 826–827; Tabela 3 p. 832) ────

export type Leitura = { valor: number; texto: string }

/** FENa (%) = (NaU × CrP) / (NaP × CrU) × 100 (p. 832). < 1% pré-renal; > 2% NTA. */
export function fena(naU: number, crP: number, naP: number, crU: number): Leitura | null {
  if (![naU, crP, naP, crU].every(valido)) return null
  const v = ((naU * crP) / (naP * crU)) * 100
  const texto = v < 1 ? '< 1%: pré-renal (Tabela 3, p. 832)' : v > 2 ? '> 2%: NTA (Tabela 3, p. 832)' : 'entre 1% e 2%: sem classe na Tabela 3'
  return { valor: v, texto }
}

/** FEUr (%) = (UrU × CrP) / (UrP × CrU) × 100 (p. 832). < 35% pré-renal; usar em quem recebe diurético. */
export function feur(urU: number, crP: number, urP: number, crU: number): Leitura | null {
  if (![urU, crP, urP, crU].every(valido)) return null
  const v = ((urU * crP) / (urP * crU)) * 100
  return { valor: v, texto: v < 35 ? '< 35%: pré-renal (Tabela 3, p. 832)' : '≥ 35%: o livro não traz interpretação acima de 35%' }
}

export const NOTAS_FRACOES: Referencia[] = [
  { texto: 'FENa falsamente elevada: diurético, DRC. Falsamente reduzida: ICC, hepatorrenal, grande queimado, rabdomiólise, nefropatia por contraste', pagina: 'cap. 61, Tabela 3, p. 832' },
  { texto: 'FENa < 1% só aparece em reduções importantes da TFG; não é específica de pré-renal', pagina: 'cap. 61, p. 831' },
  { texto: 'FEUr: quando utilizar — uso de diurético', pagina: 'cap. 61, Tabela 3, p. 832' },
  { texto: 'Na cirrose o livro usa outros cortes de FENa: pré-renal < 0,5%, SHR < 0,1–0,5%, NTA > 0,5–2%', pagina: 'cap. 58, Tabela 4, p. 793' },
]

/** Índices da Tabela 2 (p. 826–827): pré-renal x NTA. */
export function indicesUrinarios(e: { ureiaP?: number; crP?: number; naU?: number; osmU?: number }) {
  const r: { indice: string; valor: string; leitura: string }[] = []
  if (e.ureiaP !== undefined && e.crP !== undefined && valido(e.ureiaP) && valido(e.crP)) {
    const x = e.ureiaP / e.crP
    r.push({ indice: 'Ureia/creatinina', valor: fmt(x, 1), leitura: x > 40 ? '> 40: sugere pré-renal' : '≤ 40: sem corte de NTA na tabela' })
  }
  if (e.naU !== undefined && valido(e.naU)) {
    r.push({ indice: 'Sódio urinário', valor: `${fmt(e.naU, 0)} mEq/L`, leitura: e.naU < 20 ? '< 20: sugere pré-renal' : e.naU > 40 ? '> 40: sugere NTA' : '20–40: sem classe na tabela' })
  }
  if (e.osmU !== undefined && valido(e.osmU)) {
    r.push({ indice: 'Osmolaridade urinária', valor: `${fmt(e.osmU, 0)} mOsm/kg`, leitura: e.osmU > 500 ? '> 500: sugere pré-renal' : e.osmU < 350 ? '< 350: sugere NTA' : '350–500: sem classe na tabela' })
  }
  return r
}

// ── Teste de estresse com furosemida (p. 836) ───────────────────────────────

export const FUROSEMIDA_ESTRESSE = { mgKg: 1, mgKgUsoPrevio: 1.5, corteMl: 200, horas: 2, pagina: 'cap. 61, p. 836',
  texto: 'AKIN 1 ou 2, euvolêmico: furosemida EV 1 mg/kg (1,5 mg/kg se uso prévio). Diurese < 200 mL nas 2 horas seguintes prediz evolução para AKIN 3 (sensibilidade 87,1%, especificidade 84,1%)' }

export function furosemidaEstresse(pesoKg: number, usoPrevio: boolean): number | null {
  if (!valido(pesoKg)) return null
  return (usoPrevio ? FUROSEMIDA_ESTRESSE.mgKgUsoPrevio : FUROSEMIDA_ESTRESSE.mgKg) * pesoKg
}

// ── Terapia de substituição renal (Tabela 5, p. 837–838) ────────────────────

export const INDICACOES_TSR: Referencia[] = [
  { texto: 'Hipervolemia não responsiva a diurético', pagina: 'cap. 61, p. 837' },
  { texto: 'Acidose metabólica refratária (pH < 7,1) ao manejo clínico — não há ponto de corte de pH estabelecido', pagina: 'cap. 61, p. 837' },
  { texto: 'Hipercalemia refratária ao manejo clínico — sem ponto de corte específico (miocardiotoxicidade pouco provável com K < 6,5 mEq/L)', pagina: 'cap. 61, p. 838' },
  { texto: 'Síndrome urêmica (pericardite urêmica requer TSR urgente)', pagina: 'cap. 61, p. 838' },
  { texto: 'Intoxicação por droga ou toxina dialisável: lítio, etilenoglicol, salicilato, valproato, paracetamol, metanol, etanol, teofilina', pagina: 'cap. 61, p. 838' },
  { texto: 'Azotemia progressiva ou oligúria não responsiva a fluido — não há cutoffs estabelecidos', pagina: 'cap. 61, p. 838' },
]

export const OUTROS_LRA: Referencia[] = [
  { texto: 'Hiperfosfatemia grave (> 6 mg/dL): quelantes à base de cálcio ou sevelamer', pagina: 'cap. 61, p. 837' },
  { texto: 'Relação proteína/creatinina urinária > 0,21: solicitar proteinúria de 24 h; > 2 g/24 h sugere glomerulopatia', pagina: 'cap. 61, Tabela 4, p. 833–834' },
  { texto: 'Dopamina em "dose renal" (0,5–3 µg/kg/min): sem benefício', pagina: 'cap. 61, p. 836' },
  { texto: 'Bicarbonato (BICAR): "sugere-se alvo de pH > 7,2 para indicar reposição"', pagina: 'cap. 61, p. 837',
    errata: 'Frase invertida: no estudo citado o bicarbonato foi dado com pH ≤ 7,20 (ver inventário). A ferramenta não usa esse número em conta.' },
]

// ── Rabdomiólise (cap. 63) ──────────────────────────────────────────────────

export const RABDO_DIAGNOSTICO: Referencia[] = [
  { texto: 'Estímulo miotóxico agudo ou urina escura + elevação aguda da CPK (> 5–10 × LSN, usualmente > 1.000 UI/L); não há corte rigoroso', pagina: 'cap. 63, p. 854' },
  { texto: 'Dipstick positivo para "sangue" com < 5 hemácias/campo na microscopia', pagina: 'cap. 63, p. 854' },
  { texto: 'Lesão renal aguda em 15–50%; menor risco se CPK < 15.000–20.000 UI/L na apresentação', pagina: 'cap. 63, p. 855' },
  { texto: 'CPK < 5 × LSN em mais de uma dosagem em 12–24 h: rabdomiólise afastada', pagina: 'cap. 63, Figura 1, p. 860' },
]

export function cpkVezesLsn(cpk: number, lsn: number): { vezes: number; texto: string } | null {
  if (!valido(cpk) || !valido(lsn)) return null
  const vezes = cpk / lsn
  const texto = vezes > 10 ? '> 10 × LSN' : vezes > 5 ? 'entre 5 e 10 × LSN (o livro dá "5–10 ×")' : '< 5 × LSN (Figura 1: afastada se repetido em 12–24 h)'
  return { vezes, texto }
}

export const FLUIDO_RABDO = {
  inicialMlH: [400, 1000] as Faixa,
  manutencaoMlH: [200, 300] as Faixa,
  alvoDuMlH: [200, 300] as Faixa,
  alvoDuMlKgH: [1, 3] as Faixa,
  cpkIndicacao: 5000,
  cpkParar: 5000,
  pagina: 'cap. 63, Tabela 3, p. 857',
  texto: 'SF 0,9% 400 mL–1 L/hora inicial; após restauração volêmica, manutenção de 200–300 mL/hora; alvo de débito urinário 200–300 mL/h (1–3 mL/kg/hora); para CPK > 5.000 UI/L ou em ascensão; interromper com CPK < 5.000 UI/L',
  nota: 'A velocidade não é regra rígida: varia com a causa, comorbidades e sinais de congestão. Não há contraindicação a Ringer lactato.',
}

/** Alvo de diurese em mL/h pelo peso (1–3 mL/kg/h), ao lado do alvo fixo de 200–300 mL/h. */
export function alvoDiureseRabdo(pesoKg: number) {
  if (!valido(pesoKg)) return null
  const porPeso: Faixa = [FLUIDO_RABDO.alvoDuMlKgH[0] * pesoKg, FLUIDO_RABDO.alvoDuMlKgH[1] * pesoKg]
  const discordante = porPeso[0] > FLUIDO_RABDO.alvoDuMlH[1] || porPeso[1] < FLUIDO_RABDO.alvoDuMlH[0]
  return { porPesoMlH: porPeso, fixoMlH: FLUIDO_RABDO.alvoDuMlH, discordante }
}

export const NOTA_ALVO_DU = 'O livro põe "200–300 mL/h" e "1–3 mL/kg/hora" como o mesmo alvo; os dois só coincidem em parte conforme o peso. A tela mostra os dois.'

export const BICARBONATO_RABDO = {
  mlNaHCO3: 150,
  diluenteMl: 1000,
  diluente: 'SG 5%',
  velocidadeMlH: 200,
  pagina: 'cap. 63, Tabela 3, p. 858',
  indicacao: 'CPK > 5.000 UI/L ou lesão muscular grave + CPK em ascensão',
  alvo: 'pH urinário > 6,5',
  parar: 'pH urinário < 6,5 mesmo após 4–6 horas; hipocalcemia sintomática; pH sérico > 7,5; bicarbonato > 30 mEq/L; ou CPK < 5.000 UI/L',
  cuidado: 'monitorizar cálcio iônico de 2/2 h',
}

/** Conta da solução da Tabela 3: 150 mL de NaHCO3 8,4% (1 mEq/mL, p. 938) + 1.000 mL de SG 5% a 200 mL/h. */
export function solucaoBicarbonatoRabdo() {
  const b = BICARBONATO_RABDO
  const meq = b.mlNaHCO3 * NAHCO3_84_MEQ_POR_ML
  const volume = b.mlNaHCO3 + b.diluenteMl
  const meqMl = meq / volume
  return { meq, volumeMl: volume, meqPorMl: meqMl, meqPorHora: meqMl * b.velocidadeMlH, horasPorBolsa: volume / b.velocidadeMlH }
}

export const MANITOL_RABDO = {
  mlPorLitro: 50,
  gKgDia: [1, 2] as Faixa,
  cpk: 30000,
  duMlH: 200,
  pararGapOsmolar: 55,
  pagina: 'cap. 63, Tabela 3, p. 858',
  texto: 'Não utilizado de rotina. Manitol 20%: adicionar 50 mL por litro de solução salina; dose 1–2 g/kg/dia. Considerar com CPK > 30.000 UI/L e débito urinário > 200 mL/h (benefício questionável). Contraindicado na oligoanúria; interromper com gap osmolar > 55 mOsm/kg',
}

/** 50 mL de manitol 20% (20 g/100 mL) = 10 g por litro de salina; e a faixa de g/dia pelo peso. */
export function manitolRabdo(pesoKg: number) {
  const gPorLitro = MANITOL_RABDO.mlPorLitro * 0.2
  if (!valido(pesoKg)) return { gPorLitro, gDia: null }
  return { gPorLitro, gDia: [MANITOL_RABDO.gKgDia[0] * pesoKg, MANITOL_RABDO.gKgDia[1] * pesoKg] as Faixa }
}

export const OUTROS_RABDO: Referencia[] = [
  { texto: 'Furosemida: não utilizada de rotina, salvo congestão; pode piorar a hipocalcemia', pagina: 'cap. 63, p. 859' },
  { texto: 'Indicações de diálise iguais às da LRA: hipervolemia, hipercalemia, acidose e uremia; hemodiálise não remove pigmento para prevenir IRA', pagina: 'cap. 63, p. 859' },
  { texto: 'Cálcio só em hipocalcemia sintomática ou cardioproteção na hipercalemia (risco de hipercalcemia rebote)', pagina: 'cap. 63, p. 861' },
]

// ── Escore de McMahon (Tabela 2, p. 856–857) ────────────────────────────────

export const fichaMcMahon = fichaAdulto('adulto-mcmahon-rabdomiolise', 'Escore de McMahon — rabdomiólise (adulto)', 'cap. 63, p. 856–857')

const opm = (rotulo: string, valor: number) => ({ rotulo: `${rotulo} — ${String(valor).replace('.', ',')} ${valor === 1 ? 'ponto' : 'pontos'}`, valor })

export const ERRATA_MCMAHON = 'O inventário do projeto aponta que, no escore publicado, fósforo > 5,4 mg/dL vale 3 pontos; o livro imprime 2 (conferido no PDF, p. 856). A soma usa o livro.'

export const mcmahon: Escore = {
  ficha: fichaMcMahon,
  descricao: 'Risco de óbito ou diálise na lesão muscular pela Tabela 2 do manual do HC (p. 856–857).',
  itens: [
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [opm('≤ 50 anos (sem linha na tabela)', 0), opm('> 50 a ≤ 70 anos', 1.5), opm('> 70 a ≤ 80 anos', 2.5), opm('> 80 anos', 3)] },
    { tipo: 'escolha', id: 'sexo', rotulo: 'Sexo', opcoes: [opm('Masculino (sem linha na tabela)', 0), opm('Feminino', 1)] },
    { tipo: 'escolha', id: 'cr', rotulo: 'Creatinina inicial', opcoes: [opm('< 1,4 mg/dL (sem linha na tabela)', 0), opm('1,4–2,2 mg/dL', 1.5), opm('> 2,2 mg/dL', 3)] },
    { tipo: 'escolha', id: 'ca', rotulo: 'Cálcio total inicial', opcoes: [opm('≥ 7,5 mg/dL (sem linha na tabela)', 0), opm('< 7,5 mg/dL', 2)] },
    { tipo: 'escolha', id: 'cpk', rotulo: 'CPK inicial', opcoes: [opm('≤ 40.000 UI/L (sem linha na tabela)', 0), opm('> 40.000 UI/L', 2)] },
    { tipo: 'escolha', id: 'causa', rotulo: 'Causa de base', opcoes: [opm('Convulsão, síncope, exercício, estatina ou miosite', 0), opm('Diferente dessas', 3)] },
    { tipo: 'escolha', id: 'fosforo', rotulo: 'Fósforo inicial', opcoes: [opm('< 4 mg/dL (sem linha na tabela)', 0), opm('4–5,4 mg/dL', 1.5), opm('> 5,4 mg/dL', 2)] },
    { tipo: 'escolha', id: 'bic', rotulo: 'Bicarbonato', opcoes: [opm('≥ 19 mEq/L (sem linha na tabela)', 0), opm('< 19 mEq/L', 2)] },
  ],
  calcular(r) {
    if (!completo(mcmahon, r)) return null
    const total = somar(mcmahon, r)
    const faixa = total < 5 ? '< 5 pontos: risco de óbito ou diálise de 2,3%' : total > 10 ? '> 10 pontos: risco de óbito ou diálise de 61%' : '5 a 10 pontos: o livro não dá o risco desta faixa'
    return {
      rotulo: 'McMahon',
      valor: numeroBr(total),
      unidade: 'de 18',
      nota: `${faixa} (p. 857)`,
      estado: total > 10 ? 2 : total >= 5 ? 1 : 0,
      derivados: [
        ['Corte de 5 pontos', 'valor preditivo negativo 98% e positivo 27% (p. 857)'],
        ['Fósforo', escolha(mcmahon, r, 'fosforo')!.rotulo],
      ],
      cuidados: [
        ERRATA_MCMAHON,
        'O livro diz que o escore ainda precisa de mais estudos para validação clínica (p. 857).',
        'Escore prognóstico: não define conduta. Sem referência pediátrica declarada.',
      ],
    }
  },
}

export const FORA_RENAL = [
  'Creatinina basal quando não há exame prévio: o cap. 61 não traz fórmula de estimativa.',
  'Doses de quelante de fósforo e de bicarbonato na LRA: não informadas no cap. 61.',
  'Cortes numéricos de ureia ou de potássio para iniciar TSR: o livro diz que não existem.',
  'Tratamento da hipercalemia com doses: cap. 67 (já no produto, ReposicaoPotassio/hiperpotassemia).',
]
