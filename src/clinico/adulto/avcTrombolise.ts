import { completo, escolha, somar, type Escore, type Item } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Trombólise endovenosa no AVC isquêmico do adulto — cap. 38 do Manual de
// Medicina de Emergência do HCFMUSP (3ª ed., 2022), p. 513–541 (Tabelas 2–7 e
// 12). Dose de alteplase e tenecteplase, critérios numéricos da Tabela 4, alvos
// de PA, nitroprussiato (Tabela 3), sangramento e angioedema pós-alteplase, e
// as escalas NIHSS e Rankin modificada como o livro traz. A indicação é do
// médico (ADR 0007): a ferramenta mostra o que o livro lista.
// O alteplase e a tenecteplase do IAM/TEP ficam em anticoagulacao.ts.

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0

export const fichaTromboliseAvcAdulto = fichaAdulto(
  'adulto-trombolise-avc',
  'Trombólise no AVC isquêmico — adulto',
  'cap. 38 Acidente vascular cerebral isquêmico, p. 518–529 e 537 (Tabelas 3–7)',
)

// ── Alteplase e tenecteplase ─────────────────────────────────────────────────

export const ALTEPLASE_AVC = { mgKg: 0.9, maxMg: 90, bolusFracao: 0.1, infusaoMin: 60, bolusMin: 1, pagina: 'p. 526 (Tabela 5)' }

export type AlteplaseAvc = { totalMg: number; bolusMg: number; infusaoMg: number; infusaoMgH: number; limitadoAoTeto: boolean }

/** 0,9 mg/kg (máximo 90 mg); 10% em bolus de 1 min e o restante em 60 min. */
export function alteplaseAvc(pesoKg: number): AlteplaseAvc | null {
  if (!valido(pesoKg)) return null
  const bruto = ALTEPLASE_AVC.mgKg * pesoKg
  const total = Math.min(bruto, ALTEPLASE_AVC.maxMg)
  const bolus = total * ALTEPLASE_AVC.bolusFracao
  const infusao = total - bolus
  return { totalMg: total, bolusMg: bolus, infusaoMg: infusao, infusaoMgH: (infusao / ALTEPLASE_AVC.infusaoMin) * 60, limitadoAoTeto: bruto > ALTEPLASE_AVC.maxMg }
}

export const TENECTEPLASE_AVC = {
  mgKg: 0.4,
  texto: 'alternativa à alteplase em déficit leve sem oclusão de grandes artérias intracranianas: 0,4 mg/kg EV em bolus único',
  errata: 'O livro não traz dose máxima para a tenecteplase no AVC (a alteplase tem teto de 90 mg). A conta mostra 0,4 mg/kg sem teto; o teto não é completado de memória.',
  pagina: 'p. 521',
}

export function tenecteplaseAvc(pesoKg: number): number | null {
  return valido(pesoKg) ? TENECTEPLASE_AVC.mgKg * pesoKg : null
}

// ── Critérios numéricos da Tabela 4 (p. 521–526) ─────────────────────────────

export type DadosTrombolise = {
  idadeAnos?: number
  /** horas desde a última vez em que estava assintomático */
  horas?: number
  nihss?: number
  plaquetas?: number
  inr?: number
  ttpaS?: number
  tpS?: number
  pas?: number
  pad?: number
  glicemia?: number
  rankinPrevio?: number
  /** uso de varfarina (situação especial entre 3 e 4,5 h) */
  varfarina?: boolean
  avcPrevioEDiabetes?: boolean
}

export type AvaliacaoTrombolise = {
  /** critérios de indicação da Tabela 4 que o dado informado preenche */
  indicacao: string[]
  /** dado informado fora dos critérios de indicação */
  foraDaIndicacao: string[]
  /** contraindicações absolutas numéricas presentes */
  absolutas: string[]
  /** "situações que merecem consideração de risco e benefício" presentes */
  ponderar: string[]
  /** dados que faltam para conferir os cortes numéricos */
  faltando: string[]
}

const tem = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x)

/**
 * Confere os cortes numéricos da Tabela 4 contra os dados informados. Não
 * decide: devolve o que o livro lista em cada grupo. Os itens não numéricos
 * (TC, história) são marcados na tela pela lista CONTRAINDICACOES_ABSOLUTAS.
 */
export function avaliarTrombolise(d: DadosTrombolise): AvaliacaoTrombolise {
  const r: AvaliacaoTrombolise = { indicacao: [], foraDaIndicacao: [], absolutas: [], ponderar: [], faltando: [] }
  if (tem(d.idadeAnos)) (d.idadeAnos >= 18 ? r.indicacao : r.foraDaIndicacao).push(`Idade ${d.idadeAnos} anos (critério do livro: ≥ 18 anos)`)
  else r.faltando.push('idade')
  if (tem(d.horas)) {
    if (d.horas < 3) r.indicacao.push('< 3 h da última vez assintomático')
    else if (d.horas < 4.5) {
      if (!tem(d.nihss)) r.faltando.push('NIHSS (entre 3 e 4,5 h o critério exige NIHSS ≤ 25)')
      else if (d.nihss <= 25) r.indicacao.push('Entre 3 e 4,5 h com NIHSS ≤ 25')
      else r.foraDaIndicacao.push(`Entre 3 e 4,5 h com NIHSS ${d.nihss} (critério: ≤ 25)`)
      if (tem(d.idadeAnos) && d.idadeAnos > 80) r.ponderar.push('Entre 3 e 4,5 h e > 80 anos (benefício provável, segurança estabelecida)')
      if (d.varfarina && tem(d.inr) && d.inr <= 1.7) r.ponderar.push('Entre 3 e 4,5 h em uso de varfarina com INR ≤ 1,7')
      if (d.avcPrevioEDiabetes) r.ponderar.push('Entre 3 e 4,5 h com antecedente de AVC e diabetes melito')
    } else r.foraDaIndicacao.push(`${d.horas} h da última vez assintomático (janela do livro: < 4,5 h, p. 521)`)
  } else r.faltando.push('tempo desde a última vez assintomático')
  if (tem(d.plaquetas)) { if (d.plaquetas < 100_000) r.absolutas.push(`Plaquetas ${d.plaquetas.toLocaleString('pt-BR')}/mm³ (< 100.000)`) } else r.faltando.push('plaquetas')
  if (tem(d.inr) && d.inr > 1.7) r.absolutas.push(`INR ${d.inr} (> 1,7)`)
  if (tem(d.ttpaS) && d.ttpaS > 40) r.absolutas.push(`TTPa ${d.ttpaS} s (> 40 s)`)
  if (tem(d.tpS) && d.tpS > 15) r.absolutas.push(`TP ${d.tpS} s (> 15 s)`)
  if (tem(d.pas) && tem(d.pad)) {
    if (d.pas >= 185 || d.pad >= 110) r.absolutas.push(`PA ${d.pas} × ${d.pad} mmHg (≥ 185 × 110; pode ser reduzida com medicação, deixando de ser contraindicação)`)
  } else r.faltando.push('PA')
  if (tem(d.glicemia)) { if (d.glicemia < 50 || d.glicemia > 400) r.ponderar.push(`Glicemia ${d.glicemia} mg/dL (< 50 ou > 400: TEV razoável após correção)`) } else r.faltando.push('glicemia')
  if (tem(d.nihss) && d.nihss <= 5) r.ponderar.push(`NIHSS ${d.nihss} (≤ 5): déficit leve — se não incapacitante, considerar risco-benefício`)
  if (tem(d.rankinPrevio) && d.rankinPrevio >= 2) r.ponderar.push(`Rankin prévio ${d.rankinPrevio} (≥ 2): benefício pode ser menor e mortalidade maior`)
  return r
}

export const CONTRAINDICACOES_ABSOLUTAS = [
  'Sinais de hemorragia na TC de crânio',
  'Área extensa de hipoatenuação evidente em TC de crânio',
  'Suspeita clínica e/ou radiológica de hemorragia subaracnóidea',
  'AVCi nos últimos 3 meses',
  'Traumatismo cranioencefálico grave nos últimos 3 meses',
  'Cirurgia intracraniana ou intraespinhal nos últimos 3 meses',
  'Antecedente de sangramento intracraniano',
  'Neoplasia gastrointestinal ou sangramento gastrointestinal nos últimos 21 dias',
  'Inibidor direto de trombina ou de fator Xa em ≤ 48 h, exceto se todas as provas de coagulação normais',
  'Uso recente (há > 48 h) de inibidor direto de trombina ou de fator Xa com função renal alterada',
  'Dose terapêutica de heparina de baixo peso molecular nas últimas 24 h',
  'Uso concomitante de antagonista de glicoproteína IIb/IIIa',
  'Suspeita de dissecção de aorta',
  'Suspeita de endocardite infecciosa',
  'Neoplasia intracraniana intra-axial (p. ex., glioblastoma)',
]

export const TABELA4_PAGINA = 'p. 521–526 (Tabela 4)'

// ── Pressão arterial ─────────────────────────────────────────────────────────

export const ALVOS_PA_AVC = [
  { situacao: 'Antes da trombólise', texto: 'PA ≥ 185 × 110 mmHg é contraindicação, mas pode ser reduzida com medicação, deixando de ser contraindicação', pagina: 'p. 522 (Tabela 4)' },
  { situacao: 'Após trombólise (24 h)', texto: 'manter PA < 180 × 105 mmHg; aferir a cada 15 min por 2 h, a cada 30 min por 6 h e a cada 1 h até completar 24 h', pagina: 'p. 526 (Tabela 5)' },
  { situacao: 'Após trombectomia (24 h)', texto: 'é razoável manter PA ≤ 180 × 105 mmHg', pagina: 'p. 529' },
  { situacao: 'Sem trombólise', texto: 'se PA ≥ 220 × 120 mmHg, considerar reduzir 15% da PA nas primeiras 24 h', pagina: 'p. 537' },
  { situacao: 'Após a fase aguda', texto: 'é seguro iniciar ou reiniciar anti-hipertensivo com PA persistentemente > 140 × 90 mmHg e paciente neurologicamente estável', pagina: 'p. 537–538' },
]

export const ERRATA_PA_AVC = 'Na p. 518–519 o livro inverte as situações: diz manter < 180 × 105 mmHg "caso NÃO haja indicação de TEV" e reduzir 15% com PA ≥ 220 × 110 mmHg "caso haja indicação de TEV". A própria Tabela 5 (p. 526) põe < 180 × 105 como alvo depois da alteplase, a Tabela 4 (p. 522) contraindica a trombólise com PA ≥ 185 × 110 e a p. 537 põe a redução de 15% em quem não recebeu trombólise. A ferramenta segue p. 522, 526 e 537. O corte diastólico da redução de 15% também diverge: 110 (p. 519) e 120 (p. 537).'

/** Redução de 15% da PA (p. 537): valores-alvo a partir da PA inicial. */
export function reducao15(pas: number, pad: number): { pas: number; pad: number } | null {
  if (!valido(pas) || !valido(pad)) return null
  return { pas: pas * 0.85, pad: pad * 0.85 }
}

export type SituacaoPa = 'pre-trombolise' | 'pos-trombolise' | 'sem-trombolise'

/** Compara a PA informada com o corte do livro para a situação. */
export function conferirPa(sit: SituacaoPa, pas: number, pad: number): { acimaDoCorte: boolean; corte: string; pagina: string } | null {
  if (!valido(pas) || !valido(pad)) return null
  if (sit === 'pre-trombolise') return { acimaDoCorte: pas >= 185 || pad >= 110, corte: '≥ 185 × 110 mmHg é contraindicação (redutível)', pagina: 'p. 522' }
  if (sit === 'pos-trombolise') return { acimaDoCorte: pas >= 180 || pad >= 105, corte: 'alvo < 180 × 105 mmHg nas 24 h', pagina: 'p. 526' }
  return { acimaDoCorte: pas >= 220 || pad >= 120, corte: '≥ 220 × 120 mmHg: considerar reduzir 15% nas primeiras 24 h', pagina: 'p. 537' }
}

export const NITROPRUSSIATO_AVC = {
  mgAmpola: 50,
  mlFinal: 250,
  ugMl: 200,
  doseInicialUgKgMin: 0.25,
  texto: 'nitroprussiato de sódio 50 mg/2 mL + SG 5% 248 mL (200 µg/mL); dose inicial 0,25 µg/kg/min. Risco teórico de hipertensão intracraniana e disfunção plaquetária.',
  errata: 'A nota da Tabela 3 cita "micardipina" (nicardipina) e diz que labetalol e nicardipina EV não estão disponíveis no Brasil.',
  pagina: 'p. 519 (Tabela 3)',
}

/** mL/h do nitroprussiato a 200 µg/mL para uma dose em µg/kg/min. */
export function nitroprussiatoMlH(pesoKg: number, ugKgMin = NITROPRUSSIATO_AVC.doseInicialUgKgMin): number | null {
  if (!valido(pesoKg) || !valido(ugKgMin)) return null
  return (ugKgMin * pesoKg * 60) / NITROPRUSSIATO_AVC.ugMl
}

// ── Complicações (Tabelas 6 e 7, p. 527–528) ─────────────────────────────────

export const SANGRAMENTO_POS_ALTEPLASE = {
  itens: [
    'Interromper a infusão de alteplase.',
    'Colher hemograma, INR, TTPa, fibrinogênio e tipagem sanguínea.',
    'Crioprecipitado 10 unidades EV em 10–30 min; se depois o fibrinogênio estiver < 200 mg/dL, considerar dose adicional.',
    'Alternativas: ácido tranexâmico 10–15 mg/kg EV em 20 min OU ácido ε-aminocaproico 4–5 g EV.',
    'Avaliação de neurocirurgia e hematologia.',
  ],
  crioUnidades: 10,
  fibrinogenioAlvo: 200,
  txaMgKg: [10, 15] as Faixa,
  epsilonG: [4, 5] as Faixa,
  errata: 'O livro escreve "crioprecipitado 10 UI" e "Reversão de angicoagulação" (p. 528). Crioprecipitado é contado em unidades (bolsas), não em UI; a tela mostra "10 unidades".',
  sinaisAlarme: 'náuseas, vômitos, hipertensão aguda e/ou refratária, cefaleia intensa e deterioração neurológica (p. 526–527)',
  pagina: 'p. 527–528 (Tabela 6)',
}

export function tranexamicoPosAlteplase(pesoKg: number): Faixa | null {
  if (!valido(pesoKg)) return null
  return [SANGRAMENTO_POS_ALTEPLASE.txaMgKg[0] * pesoKg, SANGRAMENTO_POS_ALTEPLASE.txaMgKg[1] * pesoKg]
}

export const ANGIOEDEMA_POS_ALTEPLASE = {
  itens: [
    'Proteção de via aérea: considerar IOT se insuficiência respiratória ou edema de laringe, palato, assoalho da boca ou orofaringe e/ou progressão em menos de 30 min.',
    'Suspender alteplase e inibidores da ECA.',
    'Metilprednisolona 125 mg EV + difenidramina 50 mg EV + ranitidina 50 mg EV.',
    'Se progressão: epinefrina 0,1% 0,3 mL SC (0,3 mg) ou 0,5 mL por nebulização (0,5 mg).',
  ],
  errata: 'O livro escreve "difeniframina" (difenidramina).',
  pagina: 'p. 528 (Tabela 7)',
}

export const CUIDADOS_AVC = [
  { texto: 'IOT a considerar se Glasgow ≤ 8 ou risco de aspiração significativo; SatO2 > 94% (sem benefício de O2 se ≥ 95% em ar ambiente)', pagina: 'p. 518' },
  { texto: 'Corrigir hipoglicemia se glicemia capilar < 60 mg/dL; hiperglicemia com alvo de 140–180 mg/dL, especialmente nas primeiras 24 h', pagina: 'p. 519 e 540' },
  { texto: 'Primeiras 24 h após alteplase: evitar SNE, SVD e cateter intra-arterial; evitar anticoagulante e antiplaquetário; TC ou RM após 24 h', pagina: 'p. 527 (Tabela 5)' },
  { texto: 'AAS 160–300 mg 1 x/dia, iniciado em até 48 h; após TEV, depois de 24 h da infusão', pagina: 'p. 537' },
  { texto: 'NIHSS ≤ 3 ou AIT com ABCD2 ≥ 4: dupla antiagregação por 21 dias — AAS 100 mg/dia + clopidogrel 300 mg no 1º dia (se ≤ 75 anos), depois 75 mg/dia', pagina: 'p. 537' },
  { texto: 'Evitar hipertermia (axilar > 38 °C)', pagina: 'p. 538' },
]

// ── NIHSS (Tabela 2, p. 515–518) ─────────────────────────────────────────────

export const fichaNihssAdulto = fichaAdulto('adulto-nihss', 'NIHSS — escala de AVC do NIH (manual do HC)', 'cap. 38, p. 515–518 (Tabela 2); cortes citados nas p. 520–540')

const NT = { rotulo: 'Não testável — amputação ou fusão articular', valor: 0, naoTestavel: true }
const motorSup = (lado: string): Item => ({ tipo: 'escolha', id: `5${lado === 'esquerdo' ? 'a' : 'b'}`, rotulo: `5${lado === 'esquerdo' ? 'a' : 'b'} — Motricidade do membro superior ${lado}`, opcoes: [
  { rotulo: '0 — sem queda por 10 s', valor: 0 },
  { rotulo: '1 — queda em menos de 10 s, sem encostar em suporte ou leito', valor: 1 },
  { rotulo: '2 — queda em menos de 10 s, encostando em suporte ou leito', valor: 2 },
  { rotulo: '3 — não vence gravidade', valor: 3 },
  { rotulo: '4 — sem movimento', valor: 4 },
  NT,
] })
const motorInf = (lado: string): Item => ({ tipo: 'escolha', id: `6${lado === 'esquerdo' ? 'a' : 'b'}`, rotulo: `6${lado === 'esquerdo' ? 'a' : 'b'} — Motricidade do membro inferior ${lado}`, opcoes: [
  { rotulo: '0 — sem queda por 5 s', valor: 0 },
  { rotulo: '1 — queda em menos de 5 s, sem encostar em suporte ou leito', valor: 1 },
  { rotulo: '2 — queda em menos de 5 s, encostando em suporte ou leito', valor: 2 },
  { rotulo: '3 — não vence gravidade', valor: 3 },
  { rotulo: '4 — sem movimento', valor: 4 },
  NT,
] })

export const ITENS_NIHSS: Item[] = [
  { tipo: 'escolha', id: '1a', rotulo: '1A — Nível de consciência', opcoes: [
    { rotulo: '0 — alerta', valor: 0 }, { rotulo: '1 — desperta a estímulos leves', valor: 1 },
    { rotulo: '2 — desperta a estímulos vigorosos, repetitivos e/ou dolorosos', valor: 2 }, { rotulo: '3 — não desperta', valor: 3 },
  ] },
  { tipo: 'escolha', id: '1b', rotulo: '1B — Orientação (idade do paciente e mês atual)', opcoes: [
    { rotulo: '0 — responde adequadamente às 2 questões', valor: 0 }, { rotulo: '1 — responde adequadamente a 1 questão', valor: 1 },
    { rotulo: '2 — não responde adequadamente a ambas', valor: 2 },
  ] },
  { tipo: 'escolha', id: '1c', rotulo: '1C — Comandos simples (abrir e fechar a mão, abrir e fechar os olhos)', opcoes: [
    { rotulo: '0 — realiza adequadamente os 2 comandos', valor: 0 }, { rotulo: '1 — realiza adequadamente 1 comando', valor: 1 },
    { rotulo: '2 — não realiza adequadamente ambos', valor: 2 },
  ] },
  { tipo: 'escolha', id: '2', rotulo: '2 — Olhar conjugado horizontal', opcoes: [
    { rotulo: '0 — normal', valor: 0 },
    { rotulo: '1 — alteração do olhar conjugado horizontal em um ou ambos os olhos, sem critérios para 2', valor: 1 },
    { rotulo: '2 — desvio conjugado não suprimível pelo reflexo oculocefálico OU oftalmoparesia de todos os movimentos horizontais', valor: 2 },
  ] },
  { tipo: 'escolha', id: '3', rotulo: '3 — Campo visual', opcoes: [
    { rotulo: '0 — normal', valor: 0 }, { rotulo: '1 — hemianopsia incompleta ou quadrantanopsia OU extinção visual', valor: 1 },
    { rotulo: '2 — hemianopsia completa', valor: 2 }, { rotulo: '3 — cegueira', valor: 3 },
  ] },
  { tipo: 'escolha', id: '4', rotulo: '4 — Paralisia facial', opcoes: [
    { rotulo: '0 — ausente', valor: 0 }, { rotulo: '1 — discreta', valor: 1 },
    { rotulo: '2 — evidente, apenas em andar inferior da hemiface', valor: 2 }, { rotulo: '3 — evidente, em andares superior e inferior da hemiface', valor: 3 },
  ] },
  motorSup('esquerdo'), motorSup('direito'), motorInf('esquerdo'), motorInf('direito'),
  { tipo: 'escolha', id: '7', rotulo: '7 — Ataxia de membro', opcoes: [
    { rotulo: '0 — ausente', valor: 0 }, { rotulo: '1 — presente em 1 membro', valor: 1 }, { rotulo: '2 — presente em 2 membros', valor: 2 }, NT,
  ] },
  { tipo: 'escolha', id: '8', rotulo: '8 — Sensitivo', opcoes: [
    { rotulo: '0 — normal', valor: 0 }, { rotulo: '1 — hemi-hipoestesia', valor: 1 },
    { rotulo: '2 — hemianestesia OU comprometimento sensitivo bilateral OU paciente em coma', valor: 2 },
  ] },
  { tipo: 'escolha', id: '9', rotulo: '9 — Linguagem', opcoes: [
    { rotulo: '0 — normal', valor: 0 }, { rotulo: '1 — leve: presente, com limitação pequena à comunicação', valor: 1 },
    { rotulo: '2 — grave: limitação importante à comunicação', valor: 2 }, { rotulo: '3 — mutismo, comunicação impossibilitada ou coma', valor: 3 },
  ] },
  { tipo: 'escolha', id: '10', rotulo: '10 — Disartria', opcoes: [
    { rotulo: '0 — normal', valor: 0 }, { rotulo: '1 — presente, porém compreensível', valor: 1 },
    { rotulo: '2 — comunicação não compreensível ou anartria', valor: 2 },
    { rotulo: 'X — não testável (barreira à avaliação, p. ex., cânula endotraqueal)', valor: 0, naoTestavel: true },
  ] },
  { tipo: 'escolha', id: '11', rotulo: '11 — Extinção ou heminegligência', opcoes: [
    { rotulo: '0 — ausente', valor: 0 }, { rotulo: '1 — extinção para 1 modalidade (visual, auditiva, somestésica)', valor: 1 },
    { rotulo: '2 — extinção para mais de 1 modalidade, não reconhece parte do próprio corpo ou orienta-se para apenas 1 hemimundo', valor: 2 },
  ] },
]

export const ERRATA_NIHSS = 'Na Tabela 2 (p. 517) o item 6 (membro inferior) repete o rótulo "5a – esquerdo e 5b – direito" do item 5; aqui está como 6a/6b.'

/** Cortes de NIHSS que o próprio capítulo usa, para leitura do total. */
export function cortesNihss(total: number): string[] {
  const c: string[] = []
  if (total <= 3) c.push('≤ 3: dupla antiagregação pode ser considerada (p. 537)')
  if (total <= 5) c.push('≤ 5: déficit leve — risco-benefício da trombólise se não incapacitante (p. 523)')
  if (total <= 25) c.push('≤ 25: dentro do critério da trombólise entre 3 e 4,5 h (p. 521)')
  else c.push('> 25: fora do critério da trombólise entre 3 e 4,5 h (p. 521)')
  if (total >= 6) c.push('≥ 6: critério clínico de angio-TC/trombectomia até 16 h (p. 520, 529, 540)')
  if (total >= 10) c.push('≥ 10: critério clínico de trombectomia entre 16 e 24 h (p. 540)')
  if (total > 15) c.push('> 15: um dos critérios de hemicraniectomia (Tabela 11, p. 535)')
  return c
}

export const nihss: Escore = {
  ficha: fichaNihssAdulto,
  descricao: 'National Institutes of Health Stroke Scale como na Tabela 2 do manual do HC (itens 1A a 11; membros separados por lado).',
  itens: ITENS_NIHSS,
  calcular(r) {
    if (!completo(nihss, r)) return null
    const total = somar(nihss, r)
    const nt = nihss.itens.filter((i) => escolha(nihss, r, i.id)?.naoTestavel).map((i) => i.rotulo.split(' — ')[0])
    return {
      rotulo: 'NIHSS',
      valor: String(total),
      unidade: 'de 42',
      nota: 'Soma dos itens da Tabela 2 (p. 515–518).',
      estado: total > 25 ? 2 : total >= 6 ? 1 : 0,
      derivados: [['Cortes citados no capítulo', cortesNihss(total).join(' · ')]],
      alerta: nt.length ? `Itens não testáveis (${nt.join(', ')}) entraram com 0; o livro não diz como pontuá-los na soma.` : undefined,
      cuidados: [ERRATA_NIHSS, 'Os cortes são os que o livro usa em cada critério; a decisão é do médico.', 'Sem referência pediátrica declarada.'],
    }
  },
}

// ── Rankin modificada (Tabela 12, p. 536–537) ────────────────────────────────

export const fichaRankinAdulto = fichaAdulto('adulto-rankin-modificada', 'Escala de Rankin modificada (manual do HC)', 'cap. 38, p. 536–537 (Tabela 12); cortes nas p. 523, 529–535')

export const rankin: Escore = {
  ficha: fichaRankinAdulto,
  descricao: 'Grau de incapacidade funcional de 0 (assintomático) a 6 (morte), como na Tabela 12 do manual do HC.',
  itens: [{ tipo: 'escolha', id: 'grau', rotulo: 'Grau', opcoes: [
    { rotulo: '0 — assintomático', valor: 0 },
    { rotulo: '1 — sintomático, porém sem limitação funcional', valor: 1 },
    { rotulo: '2 — limitação funcional leve, sem necessidade de auxílio', valor: 2 },
    { rotulo: '3 — limitação moderada, precisa de auxílio, mas anda sem assistência', valor: 3 },
    { rotulo: '4 — incapaz de andar sem auxílio', valor: 4 },
    { rotulo: '5 — restrito ao leito, incontinente, requer cuidados de enfermagem constantes', valor: 5 },
    { rotulo: '6 — morte', valor: 6 },
  ] }],
  calcular(r) {
    const g = escolha(rankin, r, 'grau')
    if (!g) return null
    const cortes: string[] = []
    if (g.valor <= 1) cortes.push('0–1: critério de trombectomia < 6 h e do DAWN (p. 529–530)')
    if (g.valor <= 2) cortes.push('0–2: critério do DEFUSE 3 (p. 532)')
    if (g.valor >= 2) cortes.push('≥ 2 prévio: trombólise com benefício possivelmente menor e mortalidade maior (p. 523)')
    if (g.valor >= 3) cortes.push('≥ 3 prévio: hemicraniectomia provavelmente desvantajosa (p. 535)')
    return {
      rotulo: 'Rankin modificada',
      valor: String(g.valor),
      unidade: 'de 6',
      nota: g.rotulo.replace(/^\d — /, ''),
      estado: g.valor >= 4 ? 2 : g.valor >= 2 ? 1 : 0,
      derivados: cortes.length ? [['Cortes citados no capítulo (Rankin prévio)', cortes.join(' · ')]] : [],
      cuidados: ['Sem referência pediátrica declarada.'],
    }
  },
}

export const ASPECTS_LIVRO = 'ASPECTS: pontuação máxima 10; quanto menor, mais extensa a isquemia; < 8 sugere pior prognóstico funcional. O livro não traz as 10 regiões, então a escala não é montada aqui (p. 520).'
