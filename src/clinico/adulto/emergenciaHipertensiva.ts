import { completo, somar, numero, type Escore } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'
import { INFUSOES_ADULTO, concentracao } from './infusoes.ts'
import type { Faixa } from './pcr.ts'

// Emergências hipertensivas (cap. 19, p. 270–276) e síndrome aórtica aguda
// (cap. 20, p. 277–285) — Manual de Medicina de Emergência do HCFMUSP (3ª ed.,
// 2022). Alvos da Tabela 4 com tempo, drogas da Tabela 3 com a diluição do
// livro e o ADD-RS. A escolha do alvo e da droga é do médico (ADR 0007).
// Nitroprussiato e nitroglicerina usam a MESMA concentração do Anexo 1
// (infusoes.ts, 200 µg/mL); a faixa de dose do capítulo é mostrada à parte.

export const fichaEmergenciaHipertensivaAdulto = fichaAdulto(
  'adulto-emergencia-hipertensiva',
  'Emergência hipertensiva — alvos e drogas EV (adulto)',
  'cap. 19 Emergências hipertensivas, p. 270–276 (Tabelas 3 e 4, p. 273–275)',
)

export const fichaSindromeAorticaAdulto = fichaAdulto(
  'adulto-sindrome-aortica',
  'Síndrome aórtica aguda — adulto',
  'cap. 20 Síndrome aórtica aguda, p. 277–285; alvos: cap. 19, Tabela 4, p. 274',
)

const valido = (x: number) => Number.isFinite(x) && x > 0

// ── Tabela 4 — metas pressóricas (p. 274–275) ───────────────────────────────

export type MetaEH = { id: string; condicao: string; alvo: string; tempo: string; reducaoPam?: Faixa; errata?: string }

export const METAS_EH: MetaEH[] = [
  { id: 'avci-trombolise', condicao: 'AVCI — candidato à terapia fibrinolítica', alvo: 'antes do trombolítico: PAS < 185 e PAD < 110 mmHg; após: PAS < 180 e PAD < 105 mmHg', tempo: '1 h, redução de PAM de 15%', reducaoPam: [15, 15] },
  { id: 'avci-sem-trombolise', condicao: 'AVCI — não candidato à terapia fibrinolítica', alvo: 'PAS < 220 e PAD < 120 mmHg (exceção: IAM, edema agudo de pulmão, dissecção de aorta ou encefalopatia hipertensiva associados)', tempo: '1 h, redução de PAM de 15%', reducaoPam: [15, 15] },
  { id: 'avch', condicao: 'AVC hemorrágico', alvo: 'PAS < 140 mmHg se PAS na admissão entre 150–220; PAS < 140–160 mmHg se PAS na admissão > 220', tempo: 'imediato, PAS entre 130 e 180 mmHg' },
  { id: 'disseccao', condicao: 'Dissecção de aorta', alvo: 'PAS < 120 mmHg; FC < 60 bpm, controlada rapidamente e antes da PA', tempo: 'imediato, PAS abaixo de 120 mmHg e FC abaixo de 60 bpm',
    errata: 'A coluna do alvo escreve "< 120 mmHg de sistólica e 60 mmHg de pressão arterial média"; a coluna do tempo e o resto da linha dão FC abaixo de 60 bpm. O "60 mmHg de PAM" não é usado.' },
  { id: 'sca', condicao: 'IAM e angina instável', alvo: 'PAS 140 e PAD 90 mmHg', tempo: 'imediato, PAS < 140 mmHg' },
  { id: 'eclampsia', condicao: 'Pré-eclâmpsia/eclâmpsia ou HELLP', alvo: 'PAS 150 e PAD 80–100 mmHg', tempo: 'imediato, PAS < 160 e PAD < 105 mmHg' },
  { id: 'encefalopatia', condicao: 'Encefalopatia hipertensiva', alvo: 'redução de 20 a 25%', tempo: 'imediato, reduzir PAM em 20 a 25%', reducaoPam: [20, 25] },
  { id: 'eap', condicao: 'Edema pulmonar agudo', alvo: 'PAS < 140 mmHg', tempo: 'imediato, PAS < 140 mmHg' },
  { id: 'maligna', condicao: 'Hipertensão maligna com ou sem MAT ou IRA', alvo: 'redução de 20 a 25%', tempo: 'várias horas, reduzir PAM em 20 a 25%', reducaoPam: [20, 25] },
]

/** PAM depois da redução: o livro não traz fórmula da PAM, então ela é informada. */
export function pamAlvo(pamAtual: number, reducaoPct: Faixa): Faixa | null {
  if (!valido(pamAtual)) return null
  return [pamAtual * (1 - reducaoPct[1] / 100), pamAtual * (1 - reducaoPct[0] / 100)]
}

export type RegraGeral = { pasEmAte1h: Faixa; alvo2a6h: { pas: number; pad: number }; texto24a48h: string }

/** "Nos demais casos" (rodapé da Tabela 4, p. 275): PAS −20 a 25% em minutos a 1 h; 160/100 em 2–6 h; normal em 24–48 h. */
export function regraGeralEH(pas: number): RegraGeral | null {
  if (!valido(pas)) return null
  return { pasEmAte1h: [pas * 0.75, pas * 0.8], alvo2a6h: { pas: 160, pad: 100 }, texto24a48h: 'níveis normais nas próximas 24 a 48 horas' }
}

// ── Tabela 3 — drogas EV (p. 273) ───────────────────────────────────────────

export const ESMOLOL_EH = {
  ataqueMgKg: [0.5, 1] as Faixa, manutUgKgMin: [50, 200] as Faixa, mgMl: 10, pagina: 'Tabela 3, p. 273',
  preparo: 'esmolol (2.500 mg/10 mL) 10 mL + SF 240 mL (10 mg/mL)',
  errata: 'A Tabela 3 escreve o ataque como "0,5-1 mg/kg/min em 1 minuto". Em 1 minuto a unidade é mg/kg (é como está no cap. 17, p. 248, que dá 0,5 mg/kg). A conta usa mg/kg.',
}

export function esmololEH(pesoKg: number): { ataqueMg: Faixa; manutMlH: Faixa } | null {
  if (!valido(pesoKg)) return null
  const [a, b] = ESMOLOL_EH.manutUgKgMin
  const ml = (ugKgMin: number) => (ugKgMin * pesoKg * 60) / 1000 / ESMOLOL_EH.mgMl
  return { ataqueMg: [ESMOLOL_EH.ataqueMgKg[0] * pesoKg, ESMOLOL_EH.ataqueMgKg[1] * pesoKg], manutMlH: [ml(a), ml(b)] }
}

const anexo = (id: string) => INFUSOES_ADULTO.find((i) => i.id === id)!

export const NITROPRUSSIATO_EH = {
  ugKgMin: [0.25, 10] as Faixa, pagina: 'Tabela 3, p. 273', preparo: 'nitroprussiato (50 mg/2 mL) + SG 5% 248 mL (200 µg/mL)',
  nota: 'Mesma concentração do Anexo 1 (infusoes.ts). Faixas do livro: 0,25–10 µg/kg/min (cap. 19), 0,3–10 (cap. 21, p. 296) e 0,5–10 (Anexo 1, p. 1488).',
}

/** mL/h do nitroprussiato no preparo de 200 µg/mL (igual ao Anexo 1). */
export function nitroprussiatoMlH(pesoKg: number, ugKgMin: number): number | null {
  if (!valido(pesoKg) || !Number.isFinite(ugKgMin) || ugKgMin < 0) return null
  return (ugKgMin * pesoKg * 60) / concentracao(anexo('nitroprussiato'))
}

export const NITROGLICERINA_EH = {
  ugMin: [5, 10] as Faixa, pagina: 'Tabela 3, p. 273', preparo: 'nitroglicerina (25 mg/5 mL) 10 mL + SG 5% 240 mL (0,2 mg/mL)',
  nota: 'Mesma concentração do Anexo 1 (200 µg/mL). Aqui a dose é em µg/min (5–10 µg/min); no cap. 21 é 10–200 µg/min (p. 296); o Anexo 1 escreve em µg/kg/min.',
}

/** mL/h da nitroglicerina em µg/min (sem peso) a 200 µg/mL. */
export function nitroglicerinaMlH(ugMin: number): number | null {
  if (!Number.isFinite(ugMin) || ugMin < 0) return null
  return (ugMin * 60) / concentracao(anexo('nitroglicerina'))
}

export const HIDRALAZINA_EH = { inicialMg: 5, repeticaoMg: [5, 10] as Faixa, intervaloMin: 20, maximo24hMg: 30, pagina: 'Tabela 3, p. 273' }

/** Saldo até o teto de 30 mg em 24 h, a partir do total já feito. */
export function hidralazinaSaldo(jaFeitoMg: number): number | null {
  if (!Number.isFinite(jaFeitoMg) || jaFeitoMg < 0) return null
  return Math.max(0, HIDRALAZINA_EH.maximo24hMg - jaFeitoMg)
}

export const CAPTOPRIL_SEM_DOMH = { mg: [6.25, 12.5] as Faixa, pagina: 'p. 276', nota: 'Sem DOMH o livro não vê benefício comprovado em medicar no PS; cita captopril VO se houver dificuldade de aderência ao plano, e contraindica nifedipina.' }

export const DOMH = ['Encefalopatia hipertensiva', 'IAM ou angina instável', 'Retinopatia bilateral avançada (hemorragias, manchas algodonosas e papiledema)', 'Edema agudo de pulmão', 'AVE', 'Dissecção de aorta', 'Insuficiência renal aguda', 'Hemólise e trombocitopenia', 'Pré-eclâmpsia ou eclâmpsia']

// ── Síndrome aórtica (cap. 20) ──────────────────────────────────────────────

const col = (grupo: string, id: string, rotulo: string) => ({ tipo: 'marca' as const, id, rotulo, pontos: 1, grupo })

const ANTECEDENTES = ['marfan', 'familiar', 'cirurgia', 'aneurisma', 'valvar']
const HISTORIA = ['abrupta', 'intensa', 'rasgante']
const EXAME = ['pulso', 'neuro', 'sopro', 'hipotensao', 'choque']

/** ADD-RS (Tabela 2, p. 281–282): 1 ponto por coluna com qualquer item; 0 a 3. D-dímero opcional. */
export const addRs: Escore = {
  ficha: fichaAdulto('adulto-add-rs', 'ADD-RS — risco de dissecção de aorta (adulto)', 'cap. 20 Síndrome aórtica aguda, Tabela 2, p. 281–282'),
  descricao: 'Um ponto para cada coluna (antecedentes, história, exame físico) com qualquer item presente; com o D-dímero para 0 ou 1 ponto',
  itens: [
    col('Antecedentes', 'marfan', 'Síndrome de Marfan'),
    col('Antecedentes', 'familiar', 'História familiar de doença aórtica'),
    col('Antecedentes', 'cirurgia', 'Cirurgia ou manipulação aórtica'),
    col('Antecedentes', 'aneurisma', 'Aneurisma de aorta torácico conhecido'),
    col('Antecedentes', 'valvar', 'Doença aórtica valvar'),
    col('Características da história', 'abrupta', 'História abrupta de dor'),
    col('Características da história', 'intensa', 'Dor intensa torácica, dorsal ou abdominal'),
    col('Características da história', 'rasgante', 'Dor lancinante, rasgante'),
    col('Exame físico', 'pulso', 'Déficit de pulso ou diferencial de pressão sistólica'),
    col('Exame físico', 'neuro', 'Déficit neurológico na presença de dor'),
    col('Exame físico', 'sopro', 'Novo sopro de insuficiência aórtica na presença de dor'),
    col('Exame físico', 'hipotensao', 'Hipotensão'),
    col('Exame físico', 'choque', 'Choque'),
    { tipo: 'numero', id: 'ddimero', rotulo: 'D-dímero (se colhido)', unidade: 'ng/mL FEU', min: 0, max: 1_000_000, opcional: true },
  ],
  calcular(r) {
    if (!completo(addRs, r)) return null
    const coluna = (ids: string[]) => (somar(addRs, r, ids) > 0 ? 1 : 0)
    const total = coluna(ANTECEDENTES) + coluna(HISTORIA) + coluna(EXAME)
    const dd = numero(addRs, r, 'ddimero')
    let leitura: string
    if (total >= 2) leitura = 'O livro indica angiotomografia de aorta torácica direto para 2 ou 3 pontos.'
    else if (dd === undefined) leitura = 'Para 0 ou 1 ponto o livro indica dosar o D-dímero.'
    else if (dd < 500) leitura = 'D-dímero < 500 ng/mL FEU com 0 ou 1 ponto: o livro diz que não é necessário continuar a investigação de síndrome aórtica (falso-negativo de 0,3%).'
    else leitura = 'D-dímero ≥ 500 ng/mL FEU com 0 ou 1 ponto: o livro indica angiotomografia de aorta torácica.'
    return {
      rotulo: 'ADD-RS',
      valor: String(total),
      unidade: 'de 3',
      nota: leitura,
      estado: total >= 2 || (dd !== undefined && dd >= 500) ? 2 : dd === undefined ? 1 : 0,
      derivados: [
        ['Antecedentes', coluna(ANTECEDENTES) ? '1 ponto' : '0'],
        ['Características da história', coluna(HISTORIA) ? '1 ponto' : '0'],
        ['Exame físico', coluna(EXAME) ? '1 ponto' : '0'],
      ],
      cuidados: [
        'Cada coluna vale no máximo 1 ponto, mesmo com vários itens marcados (p. 282).',
        'Exames aceitáveis no lugar da angiotomografia: ecocardiografia transesofágica e angiorressonância (p. 282).',
        'Com suspeita de síndrome aórtica o livro diz para não prescrever antiagregantes nem anticoagulantes (p. 283).',
      ],
    }
  },
}

/** Tabela 3 (p. 284): complicações anuais por diâmetro. */
export const COMPLICACOES_DIAMETRO = [
  { acimaDeCm: 3.5, ruptura: '0%', disseccao: '2,2%', morte: '5,9%', total: '7,2%' },
  { acimaDeCm: 4, ruptura: '0,3%', disseccao: '1,5%', morte: '4,6%', total: '5,3%' },
  { acimaDeCm: 5, ruptura: '1,7%', disseccao: '2,5%', morte: '4,8%', total: '6,5%' },
  { acimaDeCm: 6, ruptura: '3,6%', disseccao: '3,7%', morte: '10,8%', total: '14,1%' },
]

/** Linha da Tabela 3 para um diâmetro: a maior faixa "> X cm" que o diâmetro ultrapassa; ≤ 3,5 cm não tem linha. */
export function linhaDiametro(cm: number) {
  if (!valido(cm)) return null
  return [...COMPLICACOES_DIAMETRO].reverse().find((l) => cm > l.acimaDeCm) ?? null
}

export const CORTES_AORTA = [
  { texto: 'Cirurgia eletiva: aneurisma de aorta ascendente > 5 cm', pagina: 'p. 278' },
  { texto: 'Cirurgia eletiva: aneurisma de aorta descendente > 5,5 cm', pagina: 'p. 278' },
  { texto: 'Síndrome de Marfan: diâmetro de 4,5 cm indica cirurgia', pagina: 'p. 278' },
  { texto: 'Úlcera aórtica penetrante assintomática: nova imagem em 3 meses; avaliação mais precoce com HAS, dislipidemia, diabetes, profundidade > 20 mm, trombose da úlcera ou aneurisma sacular', pagina: 'p. 278' },
  { texto: 'Stanford A: mortalidade de 1–2% por hora, 50% nas primeiras 48 horas; tratamento preconizado é cirurgia de emergência', pagina: 'p. 283' },
  { texto: 'Stanford B: mortalidade em 30 dias de 10–25%; sem indicação cirúrgica de emergência salvo isquemia de órgãos ou membros, progressão, ruptura iminente, dor ou hipertensão refratárias', pagina: 'p. 284' },
  { texto: 'Enquanto aguarda a cirurgia: controle agressivo da PA e da FC com betabloqueadores (nitroprussiato e esmolol, por exemplo)', pagina: 'p. 284' },
]

export const ERRATA_EH = [
  'Tabela 3, p. 273 — esmolol "0,5-1 mg/kg/min em 1 minuto" (ver item).',
  'Tabela 4, p. 274 — dissecção de aorta "60 mmHg de pressão arterial média" (ver item).',
  'p. 284 — "a frequência cardíaca com betabloqueadores (nitroprussiato de sódio e esmolol, por exemplo)": o nitroprussiato não é betabloqueador; lido como exemplos de droga para PA (nitroprussiato) e FC (esmolol).',
  'Tabela 4, p. 274 — AVCH: a linha "< 140-160 mmHg de sistólica se PAS na admissão > 220 mmHg" quebra em duas linhas no PDF; lida como uma frase só.',
]
