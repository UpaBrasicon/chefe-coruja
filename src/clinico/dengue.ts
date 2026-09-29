import type { Ficha, Fonte } from './ficha.ts'

// Dengue do adulto pelo manual do Ministério da Saúde "Dengue: diagnóstico e
// manejo clínico — adulto e criança", 6ª ed., 2024 (PDF lido; páginas
// impressas do manual). Grupos A–D, hidratação por peso, grupo D com
// hemocomponentes e inotrópicos, correção de eletrólitos, internação e alta,
// hipertensos, cardiopatas por classe NYHA, gestante, antiagregantes e
// anticoagulantes pela contagem de plaquetas, analgésicos e diagnóstico.
// O grupo sai dos achados que quem atende marca; a conduta é do médico
// (ADR 0007). A criança tem ferramenta própria (livro do ICr + este manual).
//
// Versão .1 de 28/09/2026: substitui a versão de 27/09, que citava o MS sem
// edição nem página e não tinha o grupo B por condição especial.

export const MS_DENGUE_2024: Fonte = {
  citacao: 'Ministério da Saúde. Dengue: diagnóstico e manejo clínico — adulto e criança. 6ª ed. Brasília: MS/SVSA; 2024. Fluxograma (Figura 2, p. 27), grupos A–D (p. 28–40), eletrólitos (p. 41), hemoderivados (p. 38, 42), internação e alta (p. 43), hipertensão (p. 44–45), cardiopatas (p. 46–51), gestação (p. 52–54), classificação de casos (p. 55–57), antitrombóticos (p. 58–63), Apêndices G e H (p. 76–77).',
  url: 'https://www.gov.br/saude/pt-br/centrais-de-conteudo/publicacoes/svsa/dengue/dengue-diagnostico-e-manejo-clinico-adulto-e-crianca',
}

export const fichaDengue: Ficha = {
  id: 'dengue-classificacao',
  titulo: 'Dengue — classificação e hidratação',
  versao: '2026-09-28.1',
  publico: 'adulto',
  fontes: [
    MS_DENGUE_2024,
    { citacao: 'World Health Organization. Dengue: guidelines for diagnosis, treatment, prevention and control. Geneva: WHO; 2009 (base dos sinais de alarme, Quadro 1 do manual do MS).' },
  ],
  revisadoEm: '28/09/2026 (manual do MS 6ª ed. 2024 lido no PDF)',
}

const ok = (x: number) => Number.isFinite(x) && x > 0

// ---------------------------------------------------------------- caso e sinais

export const CASO_SUSPEITO = 'Quem vive em área com casos de dengue ou viajou nos últimos 14 dias para área com transmissão, com febre, usualmente de 2 a 7 dias, e duas ou mais entre: náuseas, vômitos, exantema, mialgias, artralgias, cefaleia, dor retro-orbital, petéquias, prova do laço positiva e leucopenia (p. 55).'

/** Quadro 1 (p. 13) + aumento progressivo do hematócrito (p. 32, 56). */
export const SINAIS_ALARME = [
  'Dor abdominal intensa (referida ou à palpação) e contínua',
  'Vômitos persistentes',
  'Acúmulo de líquidos (ascite, derrame pleural, derrame pericárdico)',
  'Hipotensão postural e/ou lipotimia',
  'Hepatomegalia > 2 cm abaixo do rebordo costal',
  'Sangramento de mucosa',
  'Letargia e/ou irritabilidade',
  'Aumento progressivo do hematócrito',
]

/** Sinais de choque (p. 36) e demais critérios de gravidade (p. 56). */
export const SINAIS_GRAVIDADE = [
  'Choque: taquicardia, extremidades frias, pulso fraco e filiforme, enchimento capilar > 2 s, PA convergente < 20 mmHg, taquipneia, oligúria < 1,5 mL/kg/h, hipotensão e cianose (fase tardia)',
  'Acúmulo de líquidos com insuficiência respiratória',
  'Sangramento grave (hematêmese, melena, metrorragia volumosa, SNC)',
  'Comprometimento grave de órgãos (AST/ALT > 1.000, alteração de consciência, miocardite, outros)',
]

/** Condições clínicas especiais, risco social ou comorbidades que põem no grupo B (Figura 2, p. 27). */
export const CONDICOES_ESPECIAIS = [
  'Lactente (< 24 meses)', 'Gestante', 'Adulto > 65 anos', 'Hipertensão arterial ou outra doença cardiovascular grave', 'Diabetes mellitus', 'DPOC', 'Asma', 'Obesidade',
  'Doença hematológica crônica', 'Doença renal crônica', 'Doença ácido-péptica', 'Hepatopatia', 'Doença autoimune', 'Risco social',
]

export const HIPOTENSAO = 'Hipotensão: PAS < 90 mmHg ou PAM < 70 mmHg no adulto, ou queda da PAS > 40 mmHg; pressão de pulso ≤ 20 mmHg. No adulto, queda da PAM com taquicardia é muito significativa (p. 16).'

/** Tabela 1 (p. 15): sequência de alterações hemodinâmicas. */
export const TABELA_HEMODINAMICA: { parametro: string; ausente: string; compensado: string; hipotensao: string }[] = [
  { parametro: 'Consciência', ausente: 'clara e lúcida', compensado: 'clara e lúcida (o choque pode passar despercebido)', hipotensao: 'agitação/agressividade' },
  { parametro: 'Enchimento capilar', ausente: '≤ 2 s', compensado: '3 a 5 s', hipotensao: '> 5 s, pele mosqueada' },
  { parametro: 'Extremidades', ausente: 'quentes e rosadas', compensado: 'frias', hipotensao: 'muito frias e úmidas, pálidas ou cianóticas' },
  { parametro: 'Pulso periférico', ausente: 'normal', compensado: 'fraco e filiforme', hipotensao: 'tênue ou ausente' },
  { parametro: 'Ritmo cardíaco', ausente: 'normal', compensado: 'taquicardia', hipotensao: 'taquicardia, bradicardia no choque tardio' },
  { parametro: 'Pressão arterial', ausente: 'normal', compensado: 'PAS normal, PAD crescente; pressão de pulso ≤ 20 mmHg; hipotensão postural', hipotensao: 'hipotensão; pressão diferencial < 10 mmHg; PA não detectável' },
  { parametro: 'Respiração', ausente: 'normal', compensado: 'taquipneia', hipotensao: 'acidose metabólica, polipneia, Kussmaul' },
]

// ---------------------------------------------------------------- grupo

export type GrupoDengue = 'A' | 'B' | 'C' | 'D'

export type SinaisDengue = {
  sangramentoPele: boolean
  sangramentoMucosa: boolean
  sinaisAlarme: number
  sinaisChoque: number
  /** condição clínica especial, risco social ou comorbidade (Figura 2, p. 27) */
  condicaoEspecial?: boolean
}

/** O achado mais grave define o grupo (Figura 2, p. 27; p. 28–36). */
export function grupoDengue(s: SinaisDengue): GrupoDengue {
  if (s.sinaisChoque > 0) return 'D'
  if (s.sinaisAlarme > 0 || s.sangramentoMucosa) return 'C'
  if (s.sangramentoPele || s.condicaoEspecial) return 'B'
  return 'A'
}

/** Quadro 2 (p. 25): cor da classificação de risco de cada grupo — referência do protocolo; a classificação do paciente é da enfermagem. */
export const QUADRO2_PRIORIDADE: { grupo: GrupoDengue; cor: string; texto: string }[] = [
  { grupo: 'A', cor: 'Azul', texto: 'atendimento conforme horário de chegada' },
  { grupo: 'B', cor: 'Verde', texto: 'prioridade não urgente' },
  { grupo: 'C', cor: 'Amarelo', texto: 'urgência, atendimento o mais rápido possível' },
  { grupo: 'D', cor: 'Vermelho', texto: 'emergência, atendimento imediato' },
]

// ---------------------------------------------------------------- hidratação

export type FaseHidratacao = { etapa: string; regra: string; volumeMl: number | null; mlH?: number | null }

/** Volumes do adulto por grupo (Quadro 3, p. 30; p. 33–36). Peso inválido não gera volume. */
export function hidratacaoAdulto(grupo: GrupoDengue, pesoKg: number): FaseHidratacao[] {
  const temPeso = ok(pesoKg)
  const v = (mlKg: number) => (temPeso ? Math.round(mlKg * pesoKg) : null)
  const h = (mlKg: number, horas: number) => (temPeso ? Math.round((mlKg * pesoKg) / horas) : null)
  switch (grupo) {
    case 'A':
      return [
        { etapa: 'Volume em 24 h', regra: 'via oral, 60 mL/kg/dia, iniciada ainda na sala de espera', volumeMl: v(60) },
        { etapa: 'Primeiras 4 a 6 h', regra: 'um terço do volume, com SRO', volumeMl: v(20) },
        { etapa: 'Restante do dia', regra: 'dois terços em líquidos caseiros (água, suco, soro caseiro, chá, água de coco)', volumeMl: v(40) },
      ]
    case 'B':
      return [
        { etapa: 'Hemograma', regra: 'obrigatório; colher no atendimento e liberar em até 2 h (máximo 4 h); observação até o resultado', volumeMl: null },
        { etapa: 'Enquanto aguarda', regra: 'hidratação oral do grupo A (60 mL/kg/dia)', volumeMl: v(60) },
        { etapa: 'Hematócrito normal', regra: 'ambulatorial, reavaliação clínica e laboratorial diária até 48 h após a queda da febre', volumeMl: null },
        { etapa: 'Hemoconcentração ou alarme', regra: 'conduzir como grupo C', volumeMl: null },
      ]
    case 'C':
      return [
        { etapa: '1ª hora', regra: 'SF 0,9%, 10 mL/kg, em qualquer ponto de atenção, mesmo sem exames', volumeMl: v(10), mlH: h(10, 1) },
        { etapa: '2ª hora', regra: 'SF 0,9%, 10 mL/kg/h até o hematócrito (em até 2 h); máximo de 20 mL/kg por fase de expansão', volumeMl: v(10), mlH: h(10, 1) },
        { etapa: 'Repetir a expansão', regra: 'até 3 fases se não houver melhora do Ht ou da hemodinâmica; sem melhora, conduzir como grupo D', volumeMl: v(60) },
        { etapa: 'Manutenção — 1ª fase', regra: 'SF 0,9%, 25 mL/kg em 6 h; se melhora, 2ª fase', volumeMl: v(25), mlH: h(25, 6) },
        { etapa: 'Manutenção — 2ª fase', regra: 'SF 0,9%, 25 mL/kg em 8 h', volumeMl: v(25), mlH: h(25, 8) },
      ]
    case 'D':
      return [
        { etapa: 'Expansão rápida', regra: 'SF 0,9%, 20 mL/kg em até 20 min, em qualquer nível de complexidade e durante a transferência', volumeMl: v(20), mlH: h(20, 1 / 3) },
        { etapa: 'Repetição', regra: 'até 3 vezes conforme a avaliação clínica (teto)', volumeMl: v(60) },
        { etapa: 'Com melhora', regra: 'voltar à fase de expansão do grupo C e seguir a conduta dele', volumeMl: null },
      ]
  }
}

export const REAVALIACAO: Record<GrupoDengue, string> = {
  A: 'Retorno no dia da melhora da febre (possível início da fase crítica) ou no 5º dia de doença; imediato com sinais de alarme ou sangramento (p. 28).',
  B: 'Observação até o resultado; com Ht normal, retorno diário até 48 h após a remissão da febre (p. 31–32).',
  C: 'Reavaliação clínica após a 1ª hora (sinais vitais, PA, diurese desejável 1 mL/kg/h) e Ht a cada 2 h, após cada etapa; leito de internação até estabilizar, mínimo 48 h (p. 33–35).',
  D: 'Reavaliação clínica a cada 15–30 min e Ht a cada 2 h; monitoramento contínuo; leito de UTI até estabilizar, mínimo 48 h (p. 36–37).',
}

export const EXAMES: Record<GrupoDengue, string> = {
  A: 'A critério médico; exames específicos não são necessários para a conduta (p. 28–29).',
  B: 'Hemograma completo obrigatório; outros conforme comorbidade descompensada (p. 31).',
  C: 'Obrigatórios: hemograma, albumina e transaminases. Recomendados: RX de tórax (PA, perfil e Hjelm-Laurell) e USG de abdome. Conforme a necessidade: glicemia, ureia, creatinina, eletrólitos, gasometria, TAP e ecocardiograma (p. 33).',
  D: 'Os mesmos do grupo C (p. 37).',
}

export const IDOSOS_ALERTA = 'Idosos: maior risco de choque e também de sobrecarga de fluidos (comorbidades, lesão renal, função miocárdica reduzida) — acompanhar a hidratação buscando crepitação pulmonar (p. 34, 36).'

// ---------------------------------------------------------------- grupo D: resposta inadequada

export type GrupoDPeso = {
  albuminaG: [number, number]
  albumina5Ml: [number, number]
  albumina20Ml: [number, number]
  sfParaAlbuminaMl: [number, number]
  coloideMlH: number
  concentradoHemaciasMlDia: [number, number]
  plasmaMl: number
  crioU: [number, number]
}

/**
 * Grupo D com choque persistente (p. 38): Ht em ascensão → albumina 0,5–1 g/kg
 * em solução a 5% (100 mL = 25 mL de albumina 20% + 75 mL de SF; 5 g por 100 mL)
 * ou, na falta, coloide sintético 10 mL/kg/h; Ht em queda com hemorragia → CH
 * 10–15 mL/kg/dia; coagulopatia → plasma 10 mL/kg, vitamina K IV e
 * crioprecipitado 1 U para cada 5–10 kg.
 */
export function grupoDPorPeso(pesoKg: number): GrupoDPeso | null {
  if (!ok(pesoKg)) return null
  const g: [number, number] = [0.5 * pesoKg, 1 * pesoKg]
  const ml5: [number, number] = [g[0] * 20, g[1] * 20]
  return {
    albuminaG: g,
    albumina5Ml: ml5,
    albumina20Ml: [ml5[0] * 0.25, ml5[1] * 0.25],
    sfParaAlbuminaMl: [ml5[0] * 0.75, ml5[1] * 0.75],
    coloideMlH: 10 * pesoKg,
    concentradoHemaciasMlDia: [10 * pesoKg, 15 * pesoKg],
    plasmaMl: 10 * pesoKg,
    crioU: [Math.ceil(pesoKg / 10), Math.ceil(pesoKg / 5)],
  }
}

export const PLAQUETAS_GRUPO_D = 'Transfusão de plaquetas só com sangramento persistente não controlado, depois de corrigidos a coagulação e o choque, e com trombocitopenia e INR > 1,5 vez o normal (p. 38).'

export const HIPERIDRATACAO = 'Ht em queda com resolução do choque, sem sangramento, mas com desconforto respiratório ou sinais de ICC: investigar hiper-hidratação e tratar com redução importante da infusão, diurético e inotrópico se preciso (p. 38–39).'

export const INTERROMPER_INFUSAO = [
  'Término do extravasamento plasmático',
  'Normalização da PA, do pulso e da perfusão periférica',
  'Queda do hematócrito na ausência de sangramento',
  'Diurese normalizada',
  'Resolução dos sintomas abdominais',
]

/** Inotrópicos no choque com disfunção miocárdica (p. 40). */
export const INOTROPICOS: { droga: string; ugKgMin: [number, number] }[] = [
  { droga: 'Dopamina', ugKgMin: [5, 10] },
  { droga: 'Dobutamina', ugKgMin: [5, 20] },
  { droga: 'Milrinona', ugKgMin: [0.5, 0.8] },
]

export const CONSIDERACOES_C_D = [
  'Oferecer O₂ em todo choque (cateter, máscara, CPAP, VNI ou ventilação mecânica), conforme tolerância e gravidade (p. 39).',
  'Edema subcutâneo e derrames cavitários pela perda capilar não significam, em princípio, hiper-hidratação; acompanhar a reposição por Ht, diurese e sinais vitais (p. 39).',
  'Evitar toracocentese, paracentese e pericardiocentese desnecessárias; no choque compensado, cateter periférico calibroso é aceitável (p. 40).',
  'Na fase de extravasamento há necessidade de reposição; na fase de reabsorção, restrição hídrica (p. 40).',
  'Síndrome hemofagocítica: imunomodulação (corticoide, imunoglobulina, imunoquimioterapia) e plasmaférese (p. 42).',
]

// ---------------------------------------------------------------- eletrólitos (p. 41)

/**
 * Hiponatremia (p. 41): corrigir após tratar a desidratação/choque, com Na < 120
 * ou sintomas neurológicos. mEq = (130 − Na) × peso × 0,6; NaCl 3% tem 0,51 mEq/mL;
 * velocidade 1 a 2 mL/kg/h (0,5 a 2 mEq/kg/dia). NaCl 3% prático: 85 mL de água
 * destilada + 15 mL de NaCl 20% para 100 mL.
 */
export function hiponatremiaDengue(naAtual: number, pesoKg: number): { mEq: number; mlNaCl3: number; mlH: [number, number]; indicada: boolean } | null {
  if (!ok(pesoKg) || !Number.isFinite(naAtual) || naAtual <= 0 || naAtual >= 130) return null
  const mEq = (130 - naAtual) * pesoKg * 0.6
  return { mEq, mlNaCl3: mEq / 0.51, mlH: [1 * pesoKg, 2 * pesoKg], indicada: naAtual < 120 }
}

/** Hipocalemia (p. 41): EV nos graves e com K < 2,5; 0,2 a 0,4 mEq/kg/h, no máximo 4 mEq por 100 mL. */
export function hipocalemiaDengue(kAtual: number, pesoKg: number): { mEqH: [number, number]; indicada: boolean; concentracaoMax: string } | null {
  if (!ok(pesoKg) || !Number.isFinite(kAtual) || kAtual <= 0) return null
  return { mEqH: [0.2 * pesoKg, 0.4 * pesoKg], indicada: kAtual < 2.5, concentracaoMax: '4 mEq/100 mL' }
}

/**
 * Acidose metabólica (p. 41): corrigir primeiro a desidratação/choque; bicarbonato só
 * com HCO3 < 10 e/ou pH < 7,20. mEq = (HCO3 desejado 15 a 22 − encontrado) × 0,4 × peso.
 */
export function bicarbonatoDengue(hco3: number, ph: number, pesoKg: number): { mEq: [number, number]; indicado: boolean } | null {
  if (!ok(pesoKg) || !ok(hco3)) return null
  const indicado = hco3 < 10 || (Number.isFinite(ph) && ph > 0 && ph < 7.2)
  return { mEq: [Math.max(0, (15 - hco3) * 0.4 * pesoKg), Math.max(0, (22 - hco3) * 0.4 * pesoKg)], indicado }
}

export const BICARBONATO_SEM_GASOMETRIA = 'Adulto em choque sem resposta a duas expansões, em unidade sem gasometria: 40 mL de NaHCO3 8,4% durante a terceira expansão (p. 41).'

// ---------------------------------------------------------------- internação e alta (p. 43)

export const INTERNACAO = [
  'Sinais de alarme ou de choque, sangramento grave ou comprometimento grave de órgão (grupos C e D)',
  'Recusa à ingestão de alimentos e líquidos',
  'Comprometimento respiratório: dor torácica, dificuldade respiratória, murmúrio vesicular diminuído ou outros sinais de gravidade',
  'Impossibilidade de seguimento ou retorno por condições clínicas ou sociais',
  'Comorbidade descompensada ou de difícil controle (diabetes, hipertensão, insuficiência cardíaca, uso de dicumarínico, crise asmática, anemia falciforme)',
  'Outras situações a critério clínico',
]

export const ALTA = [
  'Estabilização hemodinâmica durante 48 horas',
  'Ausência de febre por 24 horas',
  'Melhora visível do quadro clínico',
  'Hematócrito normal e estável por 24 horas',
  'Plaquetas em elevação',
]

// ---------------------------------------------------------------- hipertensos e cardiopatas

export const HIPERTENSOS = [
  'Hipertensos podem estar em choque com PA ainda "normal": valorizar perfusão periférica e oligúria; queda de 40% em relação à PA habitual pode significar hipotensão (p. 45).',
  'Dengue grave com extravasamento importante: suspender os anti-hipertensivos (p. 45).',
  'Sem sinais de alarme e PA normal: manter as medicações, com atenção a betabloqueador e clonidina (risco de rebote) (p. 45).',
  'Desidratação/hipovolemia com necessidade de reposição venosa: suspender em princípio diuréticos e vasodilatadores durante a observação; ponderar a suspensão de betabloqueador e clonidina (p. 45).',
]

export type ClasseNyha = 1 | 2 | 3 | 4

/**
 * Cardiopata adulto (p. 49–51): NYHA I — hidratar como os demais; II — SF ou Ringer
 * 15 mL/kg em 30 min, até 3 vezes; III — 10 mL/kg em 30 min, até 3 vezes; IV — UTI
 * como paciente crítico. Manutenção 15 a 25 mL/kg a cada 12 h após melhora da
 * diurese e da PA, atento à congestão.
 */
export function cardiopataDengue(classe: ClasseNyha, pesoKg: number): { etapa: string; volumeMl: number | null; mlH: number | null; manutencao12hMl: [number, number] | null } {
  const temPeso = ok(pesoKg)
  const manut: [number, number] | null = temPeso ? [15 * pesoKg, 25 * pesoKg] : null
  if (classe === 2) return { etapa: 'SF 0,9% ou Ringer simples 15 mL/kg em 30 min, até 3 vezes, sob rigorosa observação', volumeMl: temPeso ? 15 * pesoKg : null, mlH: temPeso ? 30 * pesoKg : null, manutencao12hMl: manut }
  if (classe === 3) return { etapa: 'SF 0,9% ou Ringer simples 10 mL/kg em 30 min, até 3 vezes, sob rigorosa observação', volumeMl: temPeso ? 10 * pesoKg : null, mlH: temPeso ? 20 * pesoKg : null, manutencao12hMl: manut }
  if (classe === 4) return { etapa: 'Internar em UTI e manejar como paciente crítico', volumeMl: null, mlH: null, manutencao12hMl: null }
  return { etapa: 'Hidratar conforme o grupo, como os demais pacientes', volumeMl: null, mlH: null, manutencao12hMl: manut }
}

export const CARDIOPATA_PARAMETROS = [
  'Hipotensão, para fins práticos no cardiopata: PAS < 100 mmHg; PA a cada 1–4 h (p. 48).',
  'Oligúria: débito ≤ 0,5 mL/kg/h (peso ideal), medido a cada 4–6 h; críticos com sonda vesical e diurese horária (p. 47–48).',
  'Expansão é a principal indicação no oligúrico sem congestão e na hipoperfusão periférica; hipotenso e congesto, ou oligúrico hipotenso e congesto: amina vasoativa (Quadro 4, p. 48; p. 50).',
]

/** Quadro 6 (p. 50): aminas vasoativas no cardiopata; alvo diurese normal e PAS > 100 mmHg. */
export const AMINAS_CARDIOPATA: { droga: string; ugKgMin: [number, number]; efeito: string }[] = [
  { droga: 'Dopamina', ugKgMin: [10, 20], efeito: 'vasoconstrição generalizada' },
  { droga: 'Dobutamina', ugKgMin: [2.5, 20], efeito: 'inotrópico e cronotrópico positivo, vasodilatador' },
  { droga: 'Adrenalina', ugKgMin: [0.01, 0.3], efeito: 'inotrópico e cronotrópico positivo' },
  { droga: 'Noradrenalina', ugKgMin: [0.01, 0.5], efeito: 'potente vasoconstritor, leve inotrópico' },
]

// ---------------------------------------------------------------- gestante (p. 19, 52–54)

export const GESTANTE = [
  'Tratar pelo estadiamento, com vigilância independentemente da gravidade; volume igual ao dos demais pacientes, com cuidado para não hiper-hidratar (p. 19, 53).',
  'Taquicardia, hipotensão postural e hemoconcentração aparecem mais tarde e podem se confundir com a fisiologia da gravidez (hemodiluição, FC e DC maiores) (p. 53).',
  'Gestante com sangramento, em qualquer idade gestacional: perguntar por febre nos últimos 7 dias (p. 19).',
  'Decúbito lateral esquerdo a partir de 20 semanas; RX e USG não são contraindicados (p. 53).',
  'Diferencial com pré-eclâmpsia, HELLP e sepse, que podem coexistir (p. 54).',
  'PCR com > 20 semanas: deslocar o útero para a esquerda; considerar cesárea após 4–5 min de RCP sem reversão (p. 54).',
]

// ---------------------------------------------------------------- antiagregantes e anticoagulantes (p. 58–63)

export type Antitrombotico = 'dapt-stent-recente' | 'aas' | 'varfarina' | 'doac'

export const ANTITROMBOTICOS: { value: Antitrombotico; label: string }[] = [
  { value: 'dapt-stent-recente', label: 'Dupla antiagregação (AAS + clopidogrel) com stent farmacológico < 6 meses ou convencional < 1 mês' },
  { value: 'aas', label: 'Só AAS (stent mais antigo ou profilaxia secundária coronária/cerebrovascular)' },
  { value: 'varfarina', label: 'Varfarina' },
  { value: 'doac', label: 'Dabigatrana, rivaroxabana, apixabana ou edoxabana' },
]

/** Conduta pela contagem de plaquetas (Figuras 4–6 e Tabela 4, p. 58–63). */
export function antitromboticoDengue(droga: Antitrombotico, plaquetas: number): string | null {
  if (!Number.isFinite(plaquetas) || plaquetas <= 0) return null
  const acima50 = plaquetas > 50_000
  const abaixo30 = plaquetas < 30_000
  if (droga === 'dapt-stent-recente') {
    if (acima50) return 'Manter AAS e clopidogrel; plaquetas diárias como no grupo B, sem internação (p. 58).'
    if (!abaixo30) return 'Manter AAS e clopidogrel; leito de observação com plaquetas diárias (p. 58).'
    return 'Suspender AAS e clopidogrel; leito de observação até plaquetas > 50.000/mm³, quando voltam a ser prescritos; com sangramento, transfundir plaquetas (p. 59).'
  }
  if (droga === 'aas') {
    if (acima50) return 'Manter o AAS; plaquetas diárias como no grupo B (p. 59).'
    if (!abaixo30) return 'Manter o AAS; leito de observação com plaquetas diárias (p. 59).'
    return 'Suspender o AAS; observação até plaquetas > 50.000/mm³ (p. 59).'
  }
  if (droga === 'varfarina') {
    if (acima50) return 'TAP e plaquetas em controle ambulatorial (p. 61).'
    if (!abaixo30) return 'Internar; trocar varfarina por heparina não fracionada EV quando o TAP ficar subterapêutico (em geral INR < 2,0) (p. 61).'
    return 'Suspender a varfarina; internar com TAP e plaquetas diários; não reverter a anticoagulação salvo sangramento (p. 61).'
  }
  if (plaquetas >= 50_000) return 'Manter a terapia prescrita, se a suspensão não for opção (p. 62).'
  return 'Internar e trocar por heparina não fracionada EV 24 h após a última dose (≈ 2 meias-vidas: dabigatrana 12–17 h, rivaroxabana 5–9 h, apixabana 8–15 h, edoxabana 10–14 h) (Tabela 4, p. 63). Prótese mecânica ou SAF não devem usar essas drogas.'
}

export const SANGRAMENTO_ANTITROMBOTICO = 'Sangramento moderado ou grave: suspender antiagregantes e anticoagulantes; na dupla antiagregação, plaquetas 1 U para cada 10 kg; na varfarina com sangramento grave, plasma 15 mL/kg (até INR < 1,5) e vitamina K 10 mg VO ou EV; para inibidores de trombina/fator Xa não há antídoto incorporado ao SUS (p. 63).'

// ---------------------------------------------------------------- medicamentos e prova do laço

/** Apêndice H (p. 77), adulto. Não usar salicilatos, AINE nem corticoide (p. 28). */
export const ANALGESICOS_ADULTO = [
  { droga: 'Dipirona', dose: '500 mg (20 gotas ou 1 comprimido) até de 6/6 h' },
  { droga: 'Paracetamol', dose: '500 mg (40 gotas ou 1 comprimido) de 4/4 h, ou 60 gotas ou 2 comprimidos (1 g) até de 6/6 h; não exceder 4 g em 24 h' },
]

export const ERRATA_PARACETAMOL = 'Apêndice H (p. 77): com gotas de 200 mg/mL (1 mL = 20 gotas), 40 gotas são 400 mg e 60 gotas são 600 mg — não coincidem com 1 e 2 comprimidos de 500 mg citados na mesma linha. A ferramenta mostra o texto e não converte gotas; o teto de 4 g/dia vale.'

/** Apêndice G (p. 76): prova do laço. Valor médio (PAS + PAD) / 2; adulto 5 min, ≥ 20 petéquias; criança 3 min, ≥ 10 petéquias. */
export function provaDoLaco(pas: number, pad: number): number | null {
  return ok(pas) && ok(pad) && pas >= pad ? (pas + pad) / 2 : null
}

export const PROVA_LACO = { adulto: { minutos: 5, petequias: 20 }, crianca: { minutos: 3, petequias: 10 }, nota: 'Revisão da OPAS/OMS (2022, 217 estudos) mostrou baixo valor preditivo da prova do laço para formas graves e hospitalização; frequentemente negativa na obesidade e no choque (p. 24, 76).' }

// ---------------------------------------------------------------- diagnóstico

export const DIAGNOSTICO_LAB = [
  'Até o 5º dia de sintomas: NS1, RT-PCR ou isolamento viral (amostra a −70 °C); a partir do 6º dia: sorologia IgM (soro a −20 °C) (p. 34–35, 57).',
  'Amostra de sangue total sem anticoagulante: 10 mL no adulto e 5 mL na criança (p. 34).',
  'Exames de confirmação são obrigatórios, mas não essenciais para a conduta; reação cruzada com Zika (flavivírus) pode dar resultado inconclusivo (p. 34, 57).',
  'Notificação compulsória de todo caso suspeito (p. 55).',
]

export const DIFERENCIAL = 'Diferencial por síndrome: febris (enteroviroses, influenza, covid-19, hepatites, malária, febre tifoide, chikungunya, Zika, oropouche); exantemáticas; hemorrágicas (hantavirose, febre amarela, leptospirose, febre maculosa); abdome agudo; choque (meningococcemia, sepse, choque tóxico, miocardite); meníngeas (p. 20).'

export const DIFERENCAS_2024 = [
  'Grupo B: além do sangramento de pele espontâneo ou induzido, entram as condições especiais, risco social e comorbidades (Figura 2, p. 27) — a versão anterior da ferramenta só usava o sangramento.',
  'Grupo C: a expansão é de 10 mL/kg na 1ª hora e 10 mL/kg/h na 2ª hora até o Ht, no máximo 20 mL/kg por fase em 2 h, até 3 fases (p. 33).',
  'Critério de alta: a Figura 2 fala em "seis critérios" e lista cinco; o item 6.10 (p. 43) diz "cinco critérios" — a ferramenta usa os cinco.',
  'Prova do laço perdeu peso: baixo valor preditivo para gravidade (OPAS/OMS 2022, p. 76).',
]
