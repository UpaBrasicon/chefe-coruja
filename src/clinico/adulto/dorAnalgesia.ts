import { completo, escolha, numero, somar, type Escore, type Item } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'
import { INFUSOES_ADULTO, concentracao } from './infusoes.ts'

// Dor e analgesia do adulto — Manual de Medicina de Emergência do HCFMUSP
// (3ª ed., 2022): cap. 9 Manejo da dor (p. 140–151: Figura 1, Tabelas 1–3,
// Figura 2) e cap. 104 Sintomas em cuidados paliativos (p. 1383–1391: Tabelas
// 1–3). Escalas como escores, doses da Tabela 3 com a conta por peso ou por
// dia, e as regras de resgate/escalonamento que o livro dá. O livro não traz
// tabela de equianalgesia: não há conversão entre opioides aqui. A decisão é
// do médico (ADR 0007).

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0

export const fichaDorAnalgesiaAdulto = fichaAdulto(
  'adulto-dor-analgesia',
  'Dor e analgesia — adulto',
  'cap. 9 Manejo da dor no departamento de emergência, p. 140–151 (Figuras 1 e 2, Tabela 3)',
)

export const fichaPaliativoAdulto = fichaAdulto(
  'adulto-sintomas-paliativos',
  'Dor, dispneia e sedação em cuidados paliativos — adulto',
  'cap. 104 Manejo de sintomas em pacientes em cuidados paliativos, p. 1383–1391 (Tabelas 1–3); quetamina: preparo do Anexo 1, p. 1482–1485',
)

// ── Escalas (escores) ────────────────────────────────────────────────────────

export type IntensidadeDor = 'sem dor' | 'leve' | 'moderada' | 'intensa'

/** Faixas da escada analgésica (Figura 2, p. 147): 1–3 leve, 4–6 moderada, 7–10 intensa. */
export function intensidadeNumerica(n: number): IntensidadeDor | null {
  if (!Number.isFinite(n) || n < 0 || n > 10) return null
  if (n === 0) return 'sem dor'
  if (n <= 3) return 'leve'
  if (n <= 6) return 'moderada'
  return 'intensa'
}

export const ESCADA_ANALGESICA = [
  { degrau: 1, dor: 'Dor leve (1–3)', classe: 'Analgésicos não opioides (paracetamol, dipirona, AINE, salicilatos, tópicos como lidocaína e AINE tópico)' },
  { degrau: 2, dor: 'Dor moderada (4–6)', classe: 'Opioides fracos (codeína, tramadol) ± analgésicos não opioides' },
  { degrau: 3, dor: 'Dor intensa (7–10)', classe: 'Opioides fortes (morfina, oxicodona, fentanil) ± analgésicos não opioides' },
  { degrau: 4, dor: 'Dor de difícil controle', classe: 'Procedimentos invasivos (analgesia espinhal, ACP, bloqueios de nervos e plexos) + opioides fracos ± analgésicos não opioides' },
]

export const ESCADA_PAGINA = 'p. 140, 146–147 (Figura 2)'
export const ADJUVANTES_TEXTO = 'Medicações adjuvantes podem ser iniciadas em qualquer degrau: alfa-agonistas, ansiolíticos, anticonvulsivantes, antidepressivos tricíclicos, antieméticos, laxantes e neurolépticos (p. 146–147).'
export const DOR_NEUROPATICA = {
  sequencia: ['Antidepressivos tricíclicos', 'Tricíclicos + antiepilépticos tradicionais', 'Tricíclicos + gabapentina', 'Tricíclicos + gabapentina + morfina'],
  pagina: 'p. 146–147',
}

export const escalaNumericaDor: Escore = {
  ficha: fichaAdulto('adulto-escala-numerica-dor', 'Escala numérica de dor (0–10) — adulto', 'cap. 9, p. 141, 145 (Figura 1) e p. 147 (Figura 2)'),
  descricao: 'Intensidade informada pelo paciente de 0 (sem dor) a 10 (pior dor possível), com o degrau da escada analgésica do manual do HC.',
  itens: [{ tipo: 'numero', id: 'nota', rotulo: 'Nota dada pelo paciente', unidade: '0 a 10', min: 0, max: 10, passo: 1 }],
  calcular(r) {
    const n = numero(escalaNumericaDor, r, 'nota')
    if (n === undefined) return null
    const i = intensidadeNumerica(n)!
    const degrau = ESCADA_ANALGESICA.find((e) => e.dor.toLowerCase().startsWith(`dor ${i}`))
    return {
      rotulo: 'Escala numérica',
      valor: String(n),
      unidade: 'de 10',
      nota: i === 'sem dor' ? 'Sem dor' : `Dor ${i}`,
      estado: i === 'intensa' ? 2 : i === 'moderada' ? 1 : 0,
      derivados: degrau ? [['Escada analgésica (Figura 2, p. 147)', `${degrau.degrau}º degrau: ${degrau.classe}`]] : [],
      cuidados: [
        'A escala visual analógica tem bom desempenho na dor aguda; na dor crônica o desempenho é questionável (p. 145).',
        'Reavaliar a intensidade para verificar a eficácia do tratamento (p. 141).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

const ITENS_PAINAD: Item[] = [
  { tipo: 'escolha', id: 'respiracao', rotulo: 'Respiração (independente de vocalização)', opcoes: [
    { rotulo: '0 — normal', valor: 0 },
    { rotulo: '1 — dificuldade ocasional para respirar; curto período de hiperventilação', valor: 1 },
    { rotulo: '2 — respiração ruidosa e com dificuldades; longo período de hiperventilação; Cheyne-Stokes', valor: 2 },
  ] },
  { tipo: 'escolha', id: 'vocalizacao', rotulo: 'Vocalização negativa', opcoes: [
    { rotulo: '0 — nenhuma', valor: 0 },
    { rotulo: '1 — resmungos ou gemidos ocasionais; fala baixa, de conteúdo desaprovador ou negativo', valor: 1 },
    { rotulo: '2 — chamados perturbadores repetitivos; resmungos ou gemidos altos; choro', valor: 2 },
  ] },
  { tipo: 'escolha', id: 'facial', rotulo: 'Expressão facial', opcoes: [
    { rotulo: '0 — sorrindo ou inexpressiva', valor: 0 },
    { rotulo: '1 — triste; assustada; franzida', valor: 1 },
    { rotulo: '2 — careta', valor: 2 },
  ] },
  { tipo: 'escolha', id: 'corporal', rotulo: 'Linguagem corporal', opcoes: [
    { rotulo: '0 — relaxada', valor: 0 },
    { rotulo: '1 — tensa; andar angustiado de um lado para o outro; inquietação', valor: 1 },
    { rotulo: '2 — rígida; punhos cerrados; joelhos encolhidos; puxar ou empurrar para longe; comportamento agressivo', valor: 2 },
  ] },
  { tipo: 'escolha', id: 'consolabilidade', rotulo: 'Consolabilidade', opcoes: [
    { rotulo: '0 — sem necessidade de consolar', valor: 0 },
    { rotulo: '1 — distraído(a) ou tranquilizado(a) por voz ou toque', valor: 1 },
    { rotulo: '2 — incapaz de ser consolado(a), distraído(a) ou tranquilizado(a)', valor: 2 },
  ] },
]

export function faixaPainad(total: number): string {
  if (total === 0) return 'sem faixa no livro (0 ponto)'
  if (total <= 3) return 'dor leve (1–3)'
  if (total <= 6) return 'dor moderada (4–6)'
  return 'dor grave (7–10)'
}

export const painad: Escore = {
  ficha: fichaAdulto('adulto-painad', 'PAINAD — dor na demência avançada (adulto)', 'cap. 9, p. 141–143 (Tabela 1, adaptada de Valera et al., 2014); cap. 104, p. 1383'),
  descricao: 'Pain Assessment in Advanced Dementia, versão traduzida do manual do HC. Observar o paciente por 5 minutos antes de pontuar.',
  itens: ITENS_PAINAD,
  calcular(r) {
    if (!completo(painad, r)) return null
    const total = somar(painad, r)
    return {
      rotulo: 'PAINAD',
      valor: String(total),
      unidade: 'de 10',
      nota: faixaPainad(total),
      estado: total >= 7 ? 2 : total >= 4 ? 1 : 0,
      derivados: [['Interpretação (p. 143)', `${faixaPainad(total)} — o livro diz que essas faixas vêm da escala padrão de 0–10 e não foram comprovadas na literatura para a PAINAD`]],
      cuidados: [
        'Pode ser aplicada em repouso, em atividade agradável, durante cuidados ou após medicação para dor (p. 142).',
        'Sinais não verbais (taquicardia, taquipneia, expressão facial) têm especificidade baixa (p. 141).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

const ITENS_BPS: Item[] = [
  { tipo: 'escolha', id: 'facial', rotulo: 'Expressão facial', opcoes: [
    { rotulo: '1 — relaxada', valor: 1 },
    { rotulo: '2 — parcialmente contraída (p. ex., abaixamento palpebral)', valor: 2 },
    { rotulo: '3 — completamente contraída (olhos fechados)', valor: 3 },
    { rotulo: '4 — contorção facial', valor: 4 },
  ] },
  { tipo: 'escolha', id: 'membros', rotulo: 'Movimentos dos membros superiores', opcoes: [
    { rotulo: '1 — sem movimento', valor: 1 },
    { rotulo: '2 — movimentação parcial', valor: 2 },
    { rotulo: '3 — movimentação completa com flexão dos dedos', valor: 3 },
    { rotulo: '4 — permanentemente contraídos', valor: 4 },
  ] },
  { tipo: 'escolha', id: 'ventilador', rotulo: 'Conforto com o ventilador mecânico', opcoes: [
    { rotulo: '1 — tolerante', valor: 1 },
    { rotulo: '2 — tosse, mas tolerante à VM a maior parte do tempo', valor: 2 },
    { rotulo: '3 — brigando com o ventilador', valor: 3 },
    { rotulo: '4 — sem controle da ventilação', valor: 4 },
  ] },
]

export const bps: Escore = {
  ficha: fichaAdulto('adulto-bps', 'BPS — Escala Comportamental de Dor (adulto)', 'cap. 9, p. 143 (Tabela 2); cap. 104, p. 1383'),
  descricao: 'Behavioural Pain Scale traduzida, para paciente inconsciente, sedado ou em ventilação mecânica. Três itens de 1 a 4 pontos.',
  itens: ITENS_BPS,
  calcular(r) {
    if (!completo(bps, r)) return null
    const total = somar(bps, r)
    const itensAltos = bps.itens.filter((i) => (escolha(bps, r, i.id)?.valor ?? 0) >= 3).map((i) => i.rotulo)
    return {
      rotulo: 'BPS',
      valor: String(total),
      unidade: 'de 3 a 12',
      nota: 'O livro não traz ponto de corte nem faixas de interpretação para a BPS.',
      estado: 0,
      derivados: [
        ['Soma', `${total} (mínimo 3, máximo 12)`],
        ['Itens com 3 ou 4 pontos', itensAltos.length ? itensAltos.join('; ') : 'nenhum'],
      ],
      cuidados: ['Sem faixa de interpretação no manual: a leitura do total é do profissional.', 'Sem referência pediátrica declarada.'],
    }
  },
}

// ── Opioides da Tabela 3 (p. 147–149) ────────────────────────────────────────

export type Opioide = {
  id: string
  nome: string
  forca: 'fraco' | 'forte'
  texto: string
  vias: string
  /** dose por tomada citada (mg), para a conta de dose diária */
  dosesMg?: number[]
  /** intervalo entre doses (h) para a conta diária */
  intervalosH?: number[]
  maxDiaMg?: number
  /** dose por peso (EV/IM) */
  porKg?: { faixa: Faixa; unidade: 'mg' | 'µg'; rotulo: string }
  pagina: string
  errata?: string
  nota?: string
}

export const OPIOIDES: Opioide[] = [
  { id: 'codeina', nome: 'Codeína', forca: 'fraco', texto: '30/60 mg; a cada 4–6 h; máximo 360 mg/dia', vias: 'VO', dosesMg: [30, 60], intervalosH: [4, 6], maxDiaMg: 360, pagina: 'p. 147' },
  { id: 'tramadol', nome: 'Tramadol', forca: 'fraco', texto: '50/100 mg (LP 50/100 mg); 6/6 h, 12/12 h se LP; máximo 400 mg/dia', vias: 'VO, EV, IM', dosesMg: [50, 100], intervalosH: [6], maxDiaMg: 400, pagina: 'p. 147',
    nota: 'Evitar em epilepsia e em usuários de ISRS ou antipsicóticos (p. 150).' },
  { id: 'fentanil', nome: 'Fentanil EV', forca: 'forte', texto: 'ampola 0,05 mg/mL; inicial 25–100 µg (0,5 a 2 mL) ou 1–2 µg/kg; manutenção 50–500 µg/h em infusão contínua', vias: 'EV',
    porKg: { faixa: [1, 2], unidade: 'µg', rotulo: 'dose inicial' }, pagina: 'p. 148', nota: 'Analgesia 100 vezes a da morfina, início mais rápido e meia-vida de 30–60 min (p. 150).' },
  { id: 'fentanil-td', nome: 'Fentanil transdérmico', forca: 'forte', texto: '2,5/5/7,5/10/25/50 µg; substituir a cada 3 dias', vias: 'TD', pagina: 'p. 148',
    errata: 'A tabela lista as apresentações só em "µg", sem dizer se é conteúdo do adesivo ou liberação por hora. A ferramenta não calcula.' },
  { id: 'meperidina', nome: 'Meperidina (petidina)', forca: 'forte', texto: 'ampola 100 mg/2 mL; EV inicial 10–30 mg (diluir uma ampola para 10 mL e fazer 1 a 3 mL); IM 50–150 mg (1–3 mg/kg) a cada 3 ou 4 h; máximo diário 1 g (20 mg/kg)', vias: 'EV, IM',
    porKg: { faixa: [1, 3], unidade: 'mg', rotulo: 'IM' }, pagina: 'p. 148',
    errata: 'Os dois máximos diários não batem entre si: 20 mg/kg passa de 1 g acima de 50 kg (70 kg = 1,4 g). A tela mostra os dois e não escolhe.' },
  { id: 'morfina', nome: 'Morfina', forca: 'forte', texto: '10 mg, 10 mg EV, 30 mg, LP 30/60/100 mg; 4–6 h, 12 h se LP; EV inicial 0,05–0,1 mg/kg (diluir uma ampola de 10 mg para 10 mL e fazer 2,5 a 5 mL); manutenção em infusão contínua 0,8–10 mg/h', vias: 'VO, EV, SC',
    porKg: { faixa: [0.05, 0.1], unidade: 'mg', rotulo: 'EV inicial' }, pagina: 'p. 148',
    nota: 'Os "2,5 a 5 mL" do livro (1 mg/mL) correspondem a 0,05–0,1 mg/kg em 50 kg; o volume para o peso informado vem da conta.' },
  { id: 'oxicodona', nome: 'Oxicodona', forca: 'forte', texto: 'LP 10/20/40 mg; 12/12 h; máximo 80 mg/dia (doses maiores em pacientes com tolerância)', vias: 'VO', dosesMg: [10, 20, 40], intervalosH: [12], maxDiaMg: 80, pagina: 'p. 149' },
]

/** Dose diária de um esquema fixo (mg por tomada × tomadas por dia). */
export function doseDiariaMg(doseMg: number, intervaloH: number): number | null {
  if (!valido(doseMg) || !valido(intervaloH) || intervaloH > 24) return null
  return doseMg * (24 / intervaloH)
}

export type EsquemaOpioide = { doseMg: number; intervaloH: number; diaMg: number; acimaDoMaximo: boolean }

/** Todos os esquemas dose × intervalo da Tabela 3 com a dose diária e o máximo do livro. */
export function esquemasOpioide(o: Opioide): EsquemaOpioide[] {
  if (!o.dosesMg || !o.intervalosH) return []
  return o.dosesMg.flatMap((doseMg) => o.intervalosH!.map((intervaloH) => {
    const diaMg = doseDiariaMg(doseMg, intervaloH)!
    return { doseMg, intervaloH, diaMg, acimaDoMaximo: o.maxDiaMg !== undefined && diaMg > o.maxDiaMg }
  }))
}

export function opioidePorPeso(o: Opioide, pesoKg: number): Faixa | null {
  if (!o.porKg || !valido(pesoKg)) return null
  return [o.porKg.faixa[0] * pesoKg, o.porKg.faixa[1] * pesoKg]
}

/** Morfina EV diluída a 1 mg/mL (10 mg em 10 mL, p. 148): mL da dose inicial. */
export function morfinaEvMl(pesoKg: number): Faixa | null {
  const mg = opioidePorPeso(OPIOIDES.find((x) => x.id === 'morfina')!, pesoKg)
  return mg && [mg[0] / 1, mg[1] / 1]
}

/** Meperidina IM por peso e os dois máximos diários do livro (1 g e 20 mg/kg). */
export function meperidinaMaximos(pesoKg: number): { fixoMg: number; porPesoMg: number; divergem: boolean } | null {
  if (!valido(pesoKg)) return null
  const porPesoMg = 20 * pesoKg
  return { fixoMg: 1000, porPesoMg, divergem: porPesoMg !== 1000 }
}

export const OCTREOTIDE = { texto: 'obstrução intestinal inoperável: octreotide 0,3 mg SC 1 x/dia', pagina: 'p. 147' }

// ── Quetamina analgésica ─────────────────────────────────────────────────────

export const QUETAMINA_ANALGESICA = {
  cap9: { mgKg: [0.1, 0.5] as Faixa, texto: 'doses baixas (0,1–0,5 mg/kg) em infusão lenta; não administrar em bolus', pagina: 'cap. 9, p. 150' },
  cap104: {
    bolusMgKg: [0.2, 0.4] as Faixa,
    bolusTexto: '0,2–0,4 mg/kg EV em 15–30 min',
    infusaoUgKgMin: [1, 2] as Faixa,
    sedativaUgKgMin: [2, 7] as Faixa,
    texto: 'dor refratária ou com sinais de intoxicação por opioide: 0,2–0,4 mg/kg EV em 15–30 min; infusão contínua 1–2 µg/kg/min; 2–7 µg/kg/min tem efeito sedativo',
    pagina: 'cap. 104, p. 1384',
  },
  errata: 'O cap. 10 (p. 165) dá a dose subdissociativa como 0,1–0,3 mg/kg; o cap. 9 (p. 150), 0,1–0,5 mg/kg. As faixas analgésica (1–2) e sedativa (2–7 µg/kg/min) do cap. 104 se tocam em 2 µg/kg/min.',
}

/** mg/mL do preparo de quetamina do Anexo 1 (p. 1482–1485). */
export function quetaminaMgMlAnexo(): number {
  return concentracao(INFUSOES_ADULTO.find((x) => x.id === 'quetamina')!)
}

export type QuetaminaCalculada = { bolusMg: Faixa; bolusCap9Mg: Faixa; infusaoMgH: Faixa; infusaoMlH: Faixa; mgMl: number }

export function quetaminaAnalgesica(pesoKg: number): QuetaminaCalculada | null {
  if (!valido(pesoKg)) return null
  const q = QUETAMINA_ANALGESICA
  const mgH: Faixa = [(q.cap104.infusaoUgKgMin[0] * pesoKg * 60) / 1000, (q.cap104.infusaoUgKgMin[1] * pesoKg * 60) / 1000]
  const c = quetaminaMgMlAnexo()
  return {
    bolusMg: [q.cap104.bolusMgKg[0] * pesoKg, q.cap104.bolusMgKg[1] * pesoKg],
    bolusCap9Mg: [q.cap9.mgKg[0] * pesoKg, q.cap9.mgKg[1] * pesoKg],
    infusaoMgH: mgH,
    infusaoMlH: [mgH[0] / c, mgH[1] / c],
    mgMl: c,
  }
}

// ── Cuidados paliativos (cap. 104, Tabelas 1 e 2) ────────────────────────────

export const DOR_PALIATIVO_SEM_OPIOIDE = [
  { droga: 'Morfina VO', texto: '5–10 mg VO a cada 60 min' },
  { droga: 'Morfina EV', texto: '2–3 mg EV a cada 30 min' },
  { droga: 'Gabapentina (adjuvante, dor neuropática)', texto: '300 mg 8/8 h' },
  { droga: 'Dexametasona (anti-inflamatório)', texto: '12–20 mg/dia divididos em duas doses' },
]

export const DOR_PALIATIVO_PAGINA = 'p. 1384 (Tabela 1) — dor aguda intensa (escala 7–10)'

export type Resgate = { resgateMg: number; novaTotalMg: Faixa }

/**
 * Usuário de opioide com dor intensa (p. 1384): resgate de morfina (ou
 * equivalente) = 1/6 da dose total diária; aumentar a dose total em 50–100%.
 */
export function resgateOpioide(totalDiarioMg: number): Resgate | null {
  if (!valido(totalDiarioMg)) return null
  return { resgateMg: totalDiarioMg / 6, novaTotalMg: [totalDiarioMg * 1.5, totalDiarioMg * 2] }
}

export const DISPNEIA_PALIATIVO = {
  furosemidaMgKg: [0.5, 1] as Faixa,
  morfinaBolusInicialMg: 2,
  morfinaTexto: 'morfina 2 mg EV em bolus; se o desconforto persistir, aumentar a dose em 50–100% (3–4 mg) e repetir a cada 5–15 min até alívio; manter infusão/hora de 50% da dose bolus',
  midazolamBolusMg: [2.5, 5] as Faixa,
  midazolamTexto: 'refratária a opioide: midazolam 2,5–5 mg EV em bolus a cada 5–15 min até alívio; manter infusão/hora de 50% da dose bolus',
  pagina: 'p. 1385 (Tabela 1)',
}

export function furosemidaDispneia(pesoKg: number): Faixa | null {
  if (!valido(pesoKg)) return null
  return [DISPNEIA_PALIATIVO.furosemidaMgKg[0] * pesoKg, DISPNEIA_PALIATIVO.furosemidaMgKg[1] * pesoKg]
}

/** Próximo bolus (+50 a +100%) e infusão por hora (50% do bolus) a partir do bolus atual. */
export function escalonarBolus(bolusMg: number): { proximoMg: Faixa; infusaoMgH: number } | null {
  if (!valido(bolusMg)) return null
  return { proximoMg: [bolusMg * 1.5, bolusMg * 2], infusaoMgH: bolusMg / 2 }
}

export const SEDACAO_PALIATIVA = {
  mgMl: 1,
  bolusMg: [2.5, 5] as Faixa,
  manutencaoMgH: [0.5, 2.5] as Faixa,
  limiteAssociarMgH: [15, 20] as Faixa,
  texto: 'midazolam (solução padrão 1 mg/mL): bolus 2,5–5 mg EV ou SC, repetir conforme necessário a cada 10–15 min; manutenção 0,5–2,5 mg/h ou 50% da dose bolus utilizada inicialmente, ajustando a cada 15–30 min; se a dose necessária for maior que 15–20 mg/h, considerar associação',
  pagina: 'p. 1388 (Tabela 2)',
}

export type SedacaoPaliativaCalc = { manutencaoPeloBolusMgH: number; mlH: number; acimaDoLimite: boolean | 'faixa' }

/** Manutenção = 50% do bolus inicial; mL/h a 1 mg/mL; sinaliza a faixa de 15–20 mg/h. */
export function sedacaoPaliativa(bolusMg: number, mgHAtual?: number): SedacaoPaliativaCalc | null {
  if (!valido(bolusMg)) return null
  const mgH = bolusMg / 2
  const ref = mgHAtual !== undefined && Number.isFinite(mgHAtual) && mgHAtual > 0 ? mgHAtual : mgH
  const [a, b] = SEDACAO_PALIATIVA.limiteAssociarMgH
  return { manutencaoPeloBolusMgH: mgH, mlH: mgH / SEDACAO_PALIATIVA.mgMl, acimaDoLimite: ref > b ? true : ref > a ? 'faixa' : false }
}

export const EXTUBACAO_PALIATIVA = {
  itens: [
    'Opcional antes: metilprednisolona 40 mg 12/12 h nas 24 h pré-extubação (risco de edema de via aérea) e furosemida 40–60 mg (congestão).',
    'Bolus EV do opioide (morfina 5–10 mg ou fentanil 25–50 µg) + midazolam 2,5–5 mg; infusão contínua de morfina 50% da dose bolus/hora ou fentanil 25–50 µg/h + midazolam 1 mg/h.',
    'Alternativa: propofol 1–2 mg/kg em bolus + 1–2 mg/kg/h.',
    'Aguardar 15 minutos após a pré-medicação; estar pronto para aumentar a dose em 200–300%.',
    'Meta: evitar sinais de desconforto respiratório (FR > 30 irpm, fácies de dor, gemência).',
  ],
  errata: 'O livro escreve "PEEP < 8, OS < 10" (p. 1391); "OS" deve ser PS (pressão de suporte).',
  pagina: 'p. 1390–1391 (Tabela 3)',
}

export const DOR_NAO_VERBAL_PALIATIVO = 'Sinais indiretos de dor: FR acima de 30 irpm ou FC acima de 110 bpm; inquietação; musculatura acessória/respiração paradoxal; gemência ou olhar de medo (p. 1383).'
