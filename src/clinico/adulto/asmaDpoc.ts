import { fichaAdulto } from './fonte.ts'
import { MG } from './eletrolitos.ts'

// Exacerbação de asma e de DPOC no adulto — caps. 30 (Asma, p. 406–416) e 31
// (DPOC, p. 417–428) do Manual de Medicina de Emergência do HCFMUSP (3ª ed.,
// 2022). A ferramenta posiciona cada parâmetro na Tabela 1 da asma, conta os
// sintomas cardinais da DPOC, compara a gasometria com os cortes do livro e
// faz as contas de gotas, magnésio e ventilação. Não classifica o paciente
// por conta própria nem indica conduta (ADR 0007): o livro não traz regra para
// combinar parâmetros discordantes da Tabela 1.
//
// As metas de SatO2 de criança e gestante que o cap. 30 cita não são
// implementadas (pediatria usa outra fonte).

export const fichaAsmaAdulto = fichaAdulto('adulto-asma-exacerbacao', 'Exacerbação de asma — adulto', 'cap. 30 Asma, p. 407–416')
export const fichaDpocAdulto = fichaAdulto('adulto-dpoc-exacerbacao', 'Exacerbação de DPOC — adulto', 'cap. 31 DPOC, p. 417–427')

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0

// ---------------------------------------------------------------- asma: Tabela 1

export type Coluna = 'leve' | 'moderada' | 'grave' | 'iminencia'
export const NOME_COLUNA: Record<Coluna, string> = { leve: 'Leve', moderada: 'Moderada', grave: 'Grave', iminencia: 'Iminência de PCR' }

export type ParametroAsma = 'fr' | 'fc' | 'pulsoParadoxal' | 'vef1' | 'sao2' | 'pao2' | 'paco2'

/** Colunas numéricas da Tabela 1 (p. 407–408), exatamente como impressas. */
export const TABELA1_NUMERICA: Record<ParametroAsma, { rotulo: string; unidade: string; texto: Partial<Record<Coluna, string>> }> = {
  fr: { rotulo: 'Frequência respiratória', unidade: 'irpm', texto: { leve: 'Aumentada', moderada: 'Aumentada', grave: '> 30 irpm' } },
  fc: { rotulo: 'Frequência cardíaca', unidade: 'bpm', texto: { leve: '< 100 bpm', moderada: '100–120 bpm', grave: '> 120 bpm', iminencia: 'Bradicardia relativa' } },
  pulsoParadoxal: { rotulo: 'Pulso paradoxal', unidade: 'mmHg', texto: { leve: '< 10 mmHg', moderada: '10–25 mmHg', grave: '> 25 mmHg' } },
  vef1: { rotulo: 'VEF1 ou peak-flow', unidade: '% do predito', texto: { leve: '> 80%', moderada: '60–80%', grave: '< 60%' } },
  sao2: { rotulo: 'SaO2', unidade: '%', texto: { leve: '> 95%', moderada: '91–95%', grave: '< 90%' } },
  pao2: { rotulo: 'PaO2', unidade: 'mmHg', texto: { leve: 'Normal', moderada: '> 60 mmHg', grave: '< 60 mmHg' } },
  paco2: { rotulo: 'PaCO2', unidade: 'mmHg', texto: { leve: '< 45 mmHg', moderada: '< 45 mmHg', grave: '> 45 mmHg' } },
}

/** Linhas qualitativas da Tabela 1 (p. 407–408). */
export const TABELA1_CLINICA: { rotulo: string; colunas: Partial<Record<Coluna, string>> }[] = [
  { rotulo: 'Dispneia', colunas: { leve: 'Com atividade física', moderada: 'Ao falar', grave: 'Repouso' } },
  { rotulo: 'Capacidade de falar', colunas: { leve: 'Várias frases', moderada: 'Frases', grave: 'Palavras', iminencia: 'Incapaz de falar' } },
  { rotulo: 'Posição corporal', colunas: { leve: 'Capaz de deitar', moderada: 'Prefere ficar sentado', grave: 'Incapaz de deitar' } },
  { rotulo: 'Musculatura acessória', colunas: { leve: 'Normalmente não usa', moderada: 'Comumente usa', grave: 'Uso da musculatura acessória', iminencia: 'Respiração paradoxal' } },
  { rotulo: 'Ausculta', colunas: { leve: 'Sibilos expiratórios moderados', moderada: 'Sibilos expiratórios difusos', grave: 'Sibilos inspiratórios e expiratórios', iminencia: 'Tórax silente' } },
  { rotulo: 'Estado mental', colunas: { leve: 'Agitado ou normal', moderada: 'Agitado', grave: 'Agitado', iminencia: 'Confuso ou sonolento' } },
]

export type Posicao = { colunas: Coluna[]; nota?: string }

/**
 * Em que coluna(s) da Tabela 1 cai um valor. Lacunas e sobreposições do livro
 * aparecem como estão: SaO2 entre 90 e 91% não tem coluna; PaCO2 < 45 vale
 * para leve e moderada; FR ≤ 30 é "aumentada" (leve ou moderada) sem número.
 */
export function posicaoTabela1(p: ParametroAsma, v: number): Posicao | null {
  if (!Number.isFinite(v) || v < 0) return null
  switch (p) {
    case 'fr':
      return v > 30 ? { colunas: ['grave'] } : { colunas: ['leve', 'moderada'], nota: 'A tabela só diz "aumentada" em leve e moderada; o único número é > 30 irpm (grave).' }
    case 'fc':
      return v < 100 ? { colunas: ['leve'], nota: 'Bradicardia relativa aparece na coluna de iminência de PCR, sem número.' } : v <= 120 ? { colunas: ['moderada'] } : { colunas: ['grave'] }
    case 'pulsoParadoxal':
      return v < 10 ? { colunas: ['leve'] } : v <= 25 ? { colunas: ['moderada'] } : { colunas: ['grave'] }
    case 'vef1':
      return v > 80 ? { colunas: ['leve'] } : v >= 60 ? { colunas: ['moderada'] } : { colunas: ['grave'] }
    case 'sao2':
      if (v > 95) return { colunas: ['leve'] }
      if (v >= 91) return { colunas: ['moderada'] }
      if (v < 90) return { colunas: ['grave'] }
      return { colunas: [], nota: 'Lacuna da tabela: moderada vai até 91% e grave começa abaixo de 90%. A Figura 1 (p. 415) escreve "SaO2 90%" no quadro grave e "90–95%" no leve/moderado.' }
    case 'pao2':
      if (v > 60) return { colunas: ['leve', 'moderada'], nota: 'Leve está como "Normal", sem número; moderada é > 60 mmHg.' }
      if (v < 60) return { colunas: ['grave'] }
      return { colunas: [], nota: 'Exatamente 60 mmHg não cabe em "> 60" nem em "< 60".' }
    case 'paco2':
      if (v < 45) return { colunas: ['leve', 'moderada'] }
      if (v > 45) return { colunas: ['grave'], nota: 'PaCO2 > 45 mmHg: o texto (p. 410) diz que estes pacientes devem ser considerados candidatos a UTI.' }
      return { colunas: [], nota: 'Exatamente 45 mmHg não cabe em "< 45" nem em "> 45".' }
  }
}

export type Posicionamento = { parametro: ParametroAsma; valor: number; posicao: Posicao }

/** Posiciona todos os parâmetros informados; a coluna mais à direita atingida vem junto, como informação. */
export function posicionarAsma(valores: Partial<Record<ParametroAsma, number>>): { itens: Posicionamento[]; maisGrave: Coluna | null } {
  const ordem: Coluna[] = ['leve', 'moderada', 'grave', 'iminencia']
  const itens: Posicionamento[] = []
  let idx = -1
  for (const p of Object.keys(TABELA1_NUMERICA) as ParametroAsma[]) {
    const v = valores[p]
    if (v === undefined) continue
    const posicao = posicaoTabela1(p, v)
    if (!posicao) continue
    itens.push({ parametro: p, valor: v, posicao })
    // só conta como "mais grave" quando o parâmetro cai numa coluna só
    if (posicao.colunas.length === 1) idx = Math.max(idx, ordem.indexOf(posicao.colunas[0]))
  }
  return { itens, maisGrave: idx >= 0 ? ordem[idx] : null }
}

/** Figura 1 (p. 415): cortes do fluxograma, que diferem da Tabela 1. */
export const FIGURA1_ASMA = {
  leveModerada: 'Fala em frases, prefere ficar sentado, não agitado, sem musculatura acessória, FC 100–120 bpm, SaO2 90–95%, peak flow ou VEF1 > 50%',
  grave: 'Fala em palavras, senta-se inclinado, agitado, musculatura acessória, FC > 120 bpm, SaO2 90%, peak flow ou VEF1 < 50%',
  imediato: 'Confuso, sonolento ou tórax silencioso: IOT imediatamente',
  reavaliacao: 'VEF1 ou peak flow > 60%: preparar alta; < 60%: internação',
  pagina: 'Figura 1, p. 415',
}

export const PREDITORES_ASMA_GRAVE = [
  'História de intubação ou de necessidade de UTI (mais importante preditor de evolução desfavorável)',
  'História de exacerbação grave, de aparecimento súbito',
  'Má percepção dos sintomas',
  'Rápida piora clínica',
  'Uso de mais de 2 frascos de beta-2-agonista/mês',
  'Acompanhamento ambulatorial inadequado',
  'Comorbidades (cardiovasculares ou DPOC)',
  'Hospitalização ou visita ao departamento de emergência há menos de 1 mês',
  'Duas ou mais internações hospitalares em período menor que 1 ano',
  'Três ou mais visitas ao pronto-socorro em período inferior a 1 ano',
]

export const EXAMES_ASMA = [
  { texto: 'Gasometria arterial se desconforto importante ou VEF1/PFE < 50% do predito; PaCO2 > 45 mmHg → candidato a UTI', pagina: 'p. 410' },
  { texto: 'SatO2 em todos; < 90% → oxigênio suplementar', pagina: 'p. 410' },
  { texto: 'Radiografia se suspeita de complicação (febre > 38,3 °C, entre outras)', pagina: 'p. 410' },
  { texto: 'ECG se doença cardíaca, DPOC associada ou idade > 50 anos', pagina: 'p. 410' },
  { texto: 'Reavaliar a cada 1 ou no máximo 2 horas; decisão de internar em no máximo 6 a 8 horas', pagina: 'p. 411' },
]

/** VEF1 ou PFE medido em % do predito. */
export function percentualPredito(medido: number, predito: number): number | null {
  return valido(medido) && valido(predito) ? (medido / predito) * 100 : null
}

// ---------------------------------------------------------------- asma: drogas

/** Equivalência do próprio livro (cap. 31, p. 423): salbutamol/fenoterol 10–20 gotas = 2,5–5 mg → 0,25 mg por gota. */
export const MG_POR_GOTA_BETA2 = 2.5 / 10

export const mgBeta2 = (gotas: number) => (Number.isFinite(gotas) && gotas >= 0 ? gotas * MG_POR_GOTA_BETA2 : null)

export type ItemDroga = { id: string; nome: string; texto: string; pagina: string; nota?: string }

export const DROGAS_ASMA: ItemDroga[] = [
  { id: 'beta2-spray', nome: 'β2 em bomba com espaçador', texto: '4–8 jatos a cada 15–20 minutos na primeira hora', pagina: 'p. 411' },
  { id: 'beta2-neb', nome: 'Fenoterol em nebulizador', texto: '10–20 gotas diluídas em 3–5 mL de soro fisiológico a cada 15–20 minutos na primeira hora (três inalações); depois, conforme a necessidade, no máximo de 1/1 hora', pagina: 'p. 411–412',
    nota: 'Em mg (equivalência da p. 423, 10–20 gotas = 2,5–5 mg): 2,5–5 mg por inalação.' },
  { id: 'ipratropio-neb', nome: 'Brometo de ipratrópio (inalação)', texto: '30–50 gotas repetidas em inalações juntamente com o β2; indicado em múltiplas doses se VEF1 < 60%; 500 µg parece obter dilatação máxima', pagina: 'p. 412',
    nota: 'O livro não traz a concentração em gotas; a equivalência gotas → µg não é feita.' },
  { id: 'ipratropio-spray', nome: 'Brometo de ipratrópio (aerossol)', texto: '2 a 3 puffs (400 a 600 µg) com intervalo de 6 a 8 horas', pagina: 'p. 412' },
  { id: 'adrenalina-anafilaxia', nome: 'Adrenalina IM (asma como manifestação de anafilaxia)', texto: '0,3 a 0,5 mg IM a cada 20 minutos (máximo 3 doses)', pagina: 'p. 412' },
  { id: 'adrenalina-grave', nome: 'Adrenalina ou terbutalina IM (crise grave sem via inalatória)', texto: 'adrenalina 0,3 mg ou terbutalina intramuscular a cada 20 minutos (máximo 3 doses)', pagina: 'p. 412',
    nota: 'O livro não traz a dose da terbutalina.' },
  { id: 'prednisona', nome: 'Prednisona', texto: '20–60 mg/dia por 5–14 dias; sem retirada gradual se < 3 semanas', pagina: 'p. 413' },
  { id: 'metilprednisolona', nome: 'Metilprednisolona EV', texto: '20–60 mg de 6/6 horas (dose parenteral inicial)', pagina: 'p. 413' },
  { id: 'ci-inalatorio', nome: 'Corticoide inalatório (quem já usa)', texto: 'quadruplicar a dose; dobrar não é eficaz', pagina: 'p. 413' },
  { id: 'oxigenio', nome: 'Oxigênio', texto: 'SatO2 > 92% no adulto (Figura 1, p. 415: SaO2 93–95%)', pagina: 'p. 413' },
]

/** Sulfato de magnésio (p. 413): 1,2–2,0 g em SF 100–500 mL EV em 20 minutos; VEF1 < 30% ou sem melhora além de 60% após 1 h. */
export const MGSO4_ASMA = {
  gramas: [1.2, 2] as Faixa,
  diluenteMl: [100, 500] as Faixa,
  minutos: 20,
  indicacao: 'Crises graves com VEF1 < 30%, falência em responder à terapêutica inicial ou em melhorar além de VEF1 > 60% após 1 hora',
  pagina: 'p. 413',
}

export type InfusaoMg = { gramas: number; mlMgSO4_10: number; mEq: number; volumeTotalMl: number; mlH: number; foraDaFaixa: boolean }

/**
 * Magnésio da asma: gramas → mL de MgSO4 10% e mEq (Anexo 5, p. 1501: 1 g =
 * 10 mL = 8 mEq), volume total com o diluente escolhido e vazão em 20 minutos.
 */
export function infusaoMgAsma(gramas: number, diluenteMl: number): InfusaoMg | null {
  if (!valido(gramas) || !valido(diluenteMl)) return null
  const mlMgSO4_10 = gramas * MG.mlPorGrama10
  const volumeTotalMl = diluenteMl + mlMgSO4_10
  const [a, b] = MGSO4_ASMA.gramas
  return { gramas, mlMgSO4_10, mEq: gramas * MG.mEqPorGrama, volumeTotalMl, mlH: volumeTotalMl * (60 / MGSO4_ASMA.minutos), foraDaFaixa: gramas < a || gramas > b }
}

/** VM na asma (p. 416): baixo VC, FR 6–12, tempo inspiratório curto. */
export const VM_ASMA = { fr: [6, 12] as Faixa, texto: 'Modo controlado com baixos volumes correntes, FR 6–12 irpm e tempo inspiratório curto, mesmo com aumentos moderados da PaCO2; quetamina como sedativo de escolha', pagina: 'p. 414 e 416' }

// ---------------------------------------------------------------- DPOC

export const SINTOMAS_CARDINAIS = [
  { id: 'dispneia', rotulo: 'Piora da dispneia' },
  { id: 'expectoracao', rotulo: 'Aumento da expectoração' },
  { id: 'purulencia', rotulo: 'Escarro purulento (alteração da característica)' },
]

export type ClasseDpoc = { classe: 'leve' | 'moderada' | 'grave'; definicao: string }

/** Tabela 1 (p. 418): 1, 2 ou 3 manifestações cardinais. */
export function classificarDpoc(n: number): ClasseDpoc | null {
  if (n === 1) return { classe: 'leve', definicao: '1 manifestação cardinal — broncodilatador de curta duração suficiente' }
  if (n === 2) return { classe: 'moderada', definicao: '2 manifestações cardinais — necessita corticoide e/ou antibiótico sistêmico' }
  if (n === 3) return { classe: 'grave', definicao: '3 manifestações cardinais — hospitalização por sintomas graves (hipoxemia, taquipneia importante, alteração do nível de consciência)' }
  return null
}

export type Gasometria = { pao2?: number; paco2?: number; ph?: number }

export type LeituraGaso = { irpa: string[]; granGravidade: string[]; vni: string[]; uti: string[] }

/**
 * Cortes gasométricos do cap. 31:
 * - p. 422: PaO2 < 60 e/ou PaCO2 > 50 = insuficiência respiratória;
 *   PaO2 < 50, PaCO2 > 70 e pH < 7,3 = episódio de grande gravidade (cada corte é listado);
 * - Tabela 6 (p. 424): "pH 7,35 e PaCO2 > 60" — lido como pH < 7,35 (errata);
 * - Tabela 9 (p. 426): PaO2 < 40 ou pH < 7,25 → UTI.
 */
export function lerGasometriaDpoc(g: Gasometria): LeituraGaso {
  const n = (x?: number) => x !== undefined && Number.isFinite(x)
  const r: LeituraGaso = { irpa: [], granGravidade: [], vni: [], uti: [] }
  if (n(g.pao2) && g.pao2! < 60) r.irpa.push('PaO2 < 60 mmHg')
  if (n(g.paco2) && g.paco2! > 50) r.irpa.push('PaCO2 > 50 mmHg')
  if (n(g.pao2) && g.pao2! < 50) r.granGravidade.push('PaO2 < 50 mmHg')
  if (n(g.paco2) && g.paco2! > 70) r.granGravidade.push('PaCO2 > 70 mmHg')
  if (n(g.ph) && g.ph! < 7.3) r.granGravidade.push('pH < 7,3')
  if (n(g.ph) && n(g.paco2) && g.ph! < 7.35 && g.paco2! > 60) r.vni.push('Acidose respiratória: pH < 7,35 e PaCO2 > 60 mmHg')
  if (n(g.pao2) && g.pao2! < 40) r.uti.push('PaO2 < 40 mmHg')
  if (n(g.ph) && g.ph! < 7.25) r.uti.push('pH < 7,25')
  return r
}

export const DROGAS_DPOC: ItemDroga[] = [
  { id: 'oxigenio', nome: 'Oxigênio', texto: 'SaO2 entre 88–92%', pagina: 'p. 423', nota: 'Figura 1 (p. 427): alvo SaO2 ≥ 89%. Na VM: SaO2 90–94% e PaO2 60–72 mmHg (p. 425).' },
  { id: 'beta2-neb', nome: 'Salbutamol ou fenoterol (inalação)', texto: '10 a 20 gotas (2,5 a 5 mg) diluídas em 3 a 5 mL de SF; três inalações a cada 15–20 minutos ou contínuas; depois de 1/1 hora ou mais', pagina: 'p. 423',
    nota: 'Na mesma página: "a maioria dos autores recomenda que a dose não ultrapasse 10 gotas em cada inalação".' },
  { id: 'beta2-spray', nome: 'Salbutamol spray com espaçador', texto: '4 puffs (alternativa aceitável)', pagina: 'p. 423' },
  { id: 'ipratropio', nome: 'Anticolinérgico (ipratrópio)', texto: '20–40 gotas em cada inalação com β2; tendência a usar dose máxima', pagina: 'p. 423' },
  { id: 'prednisona', nome: 'Prednisona', texto: '40 mg VO por 5 dias', pagina: 'p. 423–424' },
  { id: 'metilprednisolona', nome: 'Metilprednisolona EV', texto: '20–60 mg a cada 6 horas em casos graves nas primeiras 72 horas', pagina: 'p. 424' },
  { id: 'antibiotico', nome: 'Antibiótico', texto: 'Exacerbações moderadas e graves; duração de 5 a 7 dias; sem fatores de risco (VEF1 > 50%, sem exacerbações prévias) pode ser só amoxicilina', pagina: 'p. 424' },
]

/** VNI na DPOC (p. 424): IPAP 8–12, EPAP ("CPAP") 3–5 cmH2O. */
export const VNI_DPOC = { ipap: [8, 12] as Faixa, epap: [3, 5] as Faixa, pagina: 'p. 424' }

/** Pressão de suporte (IPAP − EPAP) nas pontas da faixa do livro. */
export const suporteVni = (): Faixa => [VNI_DPOC.ipap[0] - VNI_DPOC.epap[1], VNI_DPOC.ipap[1] - VNI_DPOC.epap[0]]

/** Parâmetros iniciais da VM invasiva na DPOC (p. 425). */
export const VM_DPOC = {
  sao2: [90, 94] as Faixa,
  pao2: [60, 72] as Faixa,
  vcMlKg: [5, 6] as Faixa,
  fr: [8, 12] as Faixa,
  picoMenorQue: 45,
  plato: 30,
  ieImpressa: '3/1',
  peep: [3, 5] as Faixa,
  pagina: 'p. 425',
}

/** VC 5–6 mL/kg (p. 425) — o livro não diz se é peso real ou predito; a conta usa o peso informado. */
export const vcDpoc = (pesoKg: number): Faixa | null => (valido(pesoKg) ? [VM_DPOC.vcMlKg[0] * pesoKg, VM_DPOC.vcMlKg[1] * pesoKg] : null)

export type Ciclo = { cicloS: number; tiS: number; teS: number }

/**
 * Tempo de ciclo, Ti e Te para uma FR e uma relação I:E 1:n. O livro imprime
 * "I/E: 3/1" (p. 425); a conta não assume a leitura — recebe a relação que o
 * usuário escolher.
 */
export function cicloVentilatorio(fr: number, inspiracao: number, expiracao: number): Ciclo | null {
  if (!valido(fr) || !valido(inspiracao) || !valido(expiracao)) return null
  const cicloS = 60 / fr
  const tiS = (cicloS * inspiracao) / (inspiracao + expiracao)
  return { cicloS, tiS, teS: cicloS - tiS }
}

export const INDICACOES_VNI_DPOC = ['Acidose respiratória, pH 7,35 e PaCO2 > 60 mmHg (sic)', 'Dispneia moderada a grave com uso de musculatura acessória sem melhora com as medidas', 'Hipoxemia refratária']
export const INDICACOES_VM_DPOC = ['Falência da VNI ou ela é contraindicada', 'Pós-PCR', 'Rebaixamento do nível de consciência', 'Períodos de pausa respiratória com rebaixamento do nível de consciência', 'Persistente inabilidade para remover secreções respiratórias ou aspiração', 'Instabilidade hemodinâmica grave sem resposta a cristaloide e droga vasopressora', 'Graves arritmias ventriculares']
export const INDICACOES_UTI_DPOC = ['Dispneia severa com pouca resposta ao tratamento', 'Alterações do estado mental', 'Hipoxemia com PaO2 < 40 mmHg ou acidose respiratória importante, pH < 7,25', 'Necessidade de ventilação invasiva', 'Instabilidade hemodinâmica']

// ---------------------------------------------------------------- errata

export const ERRATA_ASMA = [
  'Tabela 1 (p. 408): SaO2 moderada 91–95% e grave < 90% — 90% até 91% fica sem coluna; a Figura 1 (p. 415) escreve "SaO2 90%" no grave e "90–95%" no leve/moderado.',
  'Tabela 1 (p. 408): PaO2 moderada "> 60" e grave "< 60"; PaCO2 "< 45" e "> 45" — os valores exatos 60 e 45 ficam sem coluna.',
  'Figura 1 (p. 415) usa peak flow/VEF1 50% para separar leve/moderada de grave; a Tabela 1 usa 60% (e 80%). As duas aparecem.',
  'Oxigênio: SatO2 > 92% (p. 413) x SaO2 93–95% (Figura 1, p. 415).',
  'p. 407: "> 30 irm" lido como irpm.',
  'p. 412: terbutalina IM sem dose no texto — não calculada.',
  'Ipratrópio: 30–50 gotas na asma (p. 412) x 20–40 gotas na DPOC (p. 423); sem concentração declarada, gotas não viram µg.',
]

export const ERRATA_DPOC = [
  'Tabela 6 (p. 424): "Acidose respiratória, pH 7,35 e PaCO2 > 60 mmHg" — falta o sinal; a leitura usada na conta é pH < 7,35 (conferido no PDF: o sinal não está impresso).',
  'p. 425: "I/E : 3/1" (conferido no PDF). Não é convertido em tempo inspiratório: a calculadora de ciclo recebe a relação escolhida pelo usuário.',
  'p. 424: "pressão expiratória (CPAP) 3 a 5 cmH2O" — é a EPAP da VNI em dois níveis.',
  'Alvo de SaO2: 88–92% (p. 423) x ≥ 89% (Figura 1, p. 427) x 90–94% na VM (p. 425).',
  'β2: 10–20 gotas (p. 423) e, na mesma página, "não ultrapasse 10 gotas" por inalação.',
  'p. 422: "PaO2 < 50, PaCO2 > 70 e pH < 7,3: grande gravidade" — o texto não diz se basta um corte; cada corte atingido é listado.',
  'VC 5–6 mL/kg (p. 425) sem dizer qual peso (real ou predito); o livro não traz fórmula de peso predito.',
]
