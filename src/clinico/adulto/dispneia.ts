import { fichaAdulto } from './fonte.ts'

// Abordagem inicial da dispneia no adulto — cap. 26 (p. 359–369) do Manual de
// Medicina de Emergência do HCFMUSP (3ª ed., 2022), com os cortes de
// respiração do ABCDE do cap. 1 (p. 40–41). A ferramenta compara números com
// os cortes do livro e lista o que cada um significa no texto; não faz
// diagnóstico nem indica conduta (ADR 0007).
//
// Wells para TEP (Tabela 2, p. 362) fica fora: já existe escore próprio no
// pacote (escores/wellsTep.ts) e a versão do livro diverge da original.

export const fichaDispneiaAdulto = fichaAdulto('adulto-dispneia-abordagem', 'Dispneia — cortes da abordagem inicial (adulto)', 'cap. 26, p. 359–368; cap. 1, p. 40–41')

const valido = (x: number | undefined): x is number => x !== undefined && Number.isFinite(x) && x > 0

export type EntradaDispneia = {
  fr?: number
  sat?: number
  pao2?: number
  fc?: number
  tec?: number
  ict?: number
  bnp?: number
  idade?: number
  macosAno?: number
}

export type Achado = { texto: string; pagina: string }

/** p. 360: sinais para avaliação e tratamento imediatos (a parte qualitativa fica em lista). */
export const SINAIS_GRAVIDADE_QUALITATIVOS = [
  'Uso de musculatura acessória, fala entrecortada, estridor, murmúrio vesicular assimétrico e estertores difusos',
  'Cianose e sudorese',
  'Agitação psicomotora',
]

export const ACHADOS_IC = ['Taquicardia', 'Hipotensão sistólica', 'Estase jugular', 'Refluxo hepatojugular', 'Estertores crepitantes bibasais', 'Presença de B3', 'Edema de membros inferiores', 'Radiografia com cardiomegalia ou congestão pulmonar']

export const INTERNACAO_DISPNEIA = ['Prejuízo de trocas gasosas independentemente da causa', 'Suspeita de embolia pulmonar até o diagnóstico definitivo', 'Sintomas suspeitos de intoxicação por cianeto']

/** Cortes numéricos do cap. 26 e do ABCDE do cap. 1 atingidos pelos valores informados. */
export function lerDispneia(v: EntradaDispneia): { gravidade: Achado[]; abcde: Achado[]; exames: Achado[]; oxigenio: Achado[]; historia: Achado[] } {
  const gravidade: Achado[] = []
  const abcde: Achado[] = []
  const exames: Achado[] = []
  const oxigenio: Achado[] = []
  const historia: Achado[] = []

  if (valido(v.fr) && v.fr > 30) gravidade.push({ texto: 'FR acima de 30 irpm — critério do livro para avaliação e tratamento imediatos', pagina: 'cap. 26, p. 360' })
  if (valido(v.sat) && v.sat < 90) gravidade.push({ texto: 'Saturação abaixo de 90% — critério do livro para avaliação e tratamento imediatos', pagina: 'cap. 26, p. 360' })

  if (valido(v.fr) && v.fr > 16) abcde.push({ texto: v.fr > 20 ? 'Taquipneia (FR > 16–20 irpm: acima dos dois números)' : 'FR entre 16 e 20: taquipneia pelo corte de 16, não pelo de 20 (o livro escreve "> 16–20")', pagina: 'cap. 1, p. 40' })
  if (valido(v.fr) && v.fr < 12) abcde.push({ texto: 'Bradipneia (FR < 12 irpm) — sinal tardio e de maior gravidade', pagina: 'cap. 1, p. 40' })
  if (valido(v.sat) && v.sat < 90) abcde.push({ texto: v.sat < 88 ? 'Hipoxemia (oximetria < 88–90%: abaixo dos dois números)' : 'Oximetria entre 88 e 90%: hipoxemia pelo corte de 90, não pelo de 88 (o livro escreve "< 88–90%")', pagina: 'cap. 1, p. 40' })
  if (valido(v.fc) && v.fc < 60) abcde.push({ texto: 'Bradicardia (FC < 60 bpm)', pagina: 'cap. 1, p. 41' })
  if (valido(v.fc) && v.fc > 100) abcde.push({ texto: 'Taquicardia (FC > 100 bpm)', pagina: 'cap. 1, p. 41' })
  if (valido(v.tec) && v.tec > 3) abcde.push({ texto: 'Tempo de enchimento capilar > 3 segundos', pagina: 'cap. 1, p. 41' })

  if (valido(v.ict)) {
    if (v.ict > 0.6) exames.push({ texto: 'Índice cardiotorácico > 0,6 — maior especificidade para IC', pagina: 'cap. 26, p. 363' })
    else if (v.ict > 0.5) exames.push({ texto: 'Índice cardiotorácico > 0,5 — sensível para IC (a especificidade é maior acima de 0,6)', pagina: 'cap. 26, p. 363' })
    else exames.push({ texto: 'Índice cardiotorácico ≤ 0,5 — abaixo dos cortes do livro', pagina: 'cap. 26, p. 363' })
  }
  if (valido(v.bnp)) {
    exames.push(v.bnp > 100
      ? { texto: 'BNP > 100 pg/mL — no livro, sensibilidade 90%, especificidade 76% e VPP 83% para IC', pagina: 'cap. 26, p. 364' }
      : { texto: 'BNP ≤ 100 pg/mL — o livro diz que níveis normais tornam IC extremamente improvável (não imprime o limite de normalidade)', pagina: 'cap. 26, p. 364' })
  }

  if (valido(v.pao2) && v.pao2 < 55) oxigenio.push({ texto: 'PaO2 < 55 mmHg — hipoxemia significativa, em que o livro diz que a oxigenoterapia é benéfica', pagina: 'cap. 26, p. 368' })
  if (valido(v.sat) && v.sat < 90) oxigenio.push({ texto: 'SaO2 < 90% — hipoxemia significativa, em que o livro diz que a oxigenoterapia é benéfica', pagina: 'cap. 26, p. 368' })

  if (valido(v.macosAno) && v.macosAno > 40) historia.push({ texto: 'Tabagismo > 40 maços-ano — sugere doença obstrutiva', pagina: 'cap. 26, p. 361' })
  if (valido(v.idade) && v.idade > 45) historia.push({ texto: 'Idade > 45 anos — citada entre as manifestações sugestivas de doença obstrutiva', pagina: 'cap. 26, p. 361' })

  return { gravidade, abcde, exames, oxigenio, historia }
}

/** p. 361: embolia pulmonar deve ser suspeitada com história recente (< 4 semanas) de cirurgia, estrógeno ou outros fatores de TVP. */
export const TEP_JANELA_SEMANAS = 4

export const ERRATA_DISPNEIA = [
  'Cap. 1 (p. 40): taquipneia "FR > 16–20" e hipoxemia "oximetria < 88–90%" — dois números em cada corte; a tela diz quando o valor fica entre eles.',
  'Hipoxemia significativa: "PaO2 < 55 mmHg" (p. 368) x IRpA com "PaO2 < 60 mmHg" (cap. 27, p. 370) — cortes de contextos diferentes, os dois citados.',
  'Tabela 2 (Wells, p. 362): hemoptise e neoplasia valem 1,5 no livro; o escore original (Wells 2000, usado em escores/wellsTep.ts) dá 1 ponto a cada. Alta probabilidade "≥ 6" e intermediária "entre 2 e 6" se tocam em 6. Não implementado aqui.',
  'Tabela 4 (p. 367): "EEG: avaliar isquemia" na linha de congestão (a legenda expande EEG como eletroencefalograma) — provável troca de sigla; só texto, sem efeito em conta.',
]
