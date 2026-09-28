import { completo, escolha, somar, type Escore } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Reversão de anticoagulação e hemorragia intraparenquimatosa (HIP) do adulto —
// Manual de Medicina de Emergência do HCFMUSP (3ª ed., 2022): cap. 39 (p.
// 543–549) e cap. 79 Distúrbios da hemostasia (p. 1042–1045, Tabelas 4–6).
// Varfarina por INR × sangramento, CCP, plasma, vitamina K, crioprecipitado,
// protamina por tempo desde a heparina, DOAC e o escore ICH. O livro não traz
// dose de idarucizumabe nem cita andexanete. A decisão é do médico (ADR 0007).

export type Faixa = [number, number]

const valido = (x: number) => Number.isFinite(x) && x > 0

export const fichaReversaoAnticoagulacaoAdulto = fichaAdulto(
  'adulto-reversao-anticoagulacao',
  'Reversão de anticoagulação e sangramento — adulto',
  'cap. 39 Hemorragias intraparenquimatosas, p. 545–549; cap. 79 Distúrbios da hemostasia, p. 1042–1045 (Tabelas 4–6)',
)

// ── Varfarina: Tabela 4 (p. 1043) ────────────────────────────────────────────

export type Sangramento = 'nao' | 'leve' | 'grave'

export type LinhaVarfarina = { inr: string; sangramento: string; texto: string }

export const TABELA_VARFARINA: (LinhaVarfarina & { de?: number; ate?: number; acimaDe?: number; sang: Sangramento })[] = [
  { inr: '2–5', de: 2, ate: 5, sang: 'nao', sangramento: 'Não', texto: 'Diminuir dose de varfarina ou omitir 1 dose (se aumento mínimo, não é necessário mudar)' },
  { inr: '2–5', de: 2, ate: 5, sang: 'leve', sangramento: 'Sim, leve', texto: 'Omitir varfarina e iniciar vitamina K1 1,5 a 5 mg VO; reiniciar varfarina com dose menor' },
  { inr: '5–9', de: 5, ate: 9, sang: 'nao', sangramento: 'Não', texto: 'Omitir 1–2 doses e reiniciar em dose menor, ou omitir 1 dose e dar vitamina K1 1,5 a 2,5 mg VO' },
  { inr: '5–9', de: 5, ate: 9, sang: 'leve', sangramento: 'Sim, leve', texto: 'Omitir 2 doses de varfarina e fazer vitamina K1 5 a 10 mg VO ou EV; se persistir sangramento, considerar plasma fresco congelado; reiniciar varfarina em dose menor quando INR terapêutico' },
  { inr: '> 9', acimaDe: 9, sang: 'nao', sangramento: 'Não', texto: 'Suspender varfarina e dar vitamina K1 2,5 a 5 mg VO; reiniciar varfarina quando INR terapêutico' },
  { inr: 'Qualquer valor', sang: 'grave', sangramento: 'Sangramento grave', texto: 'Vitamina K1 10 mg EV em 20 minutos, suspender a varfarina; se urgência, considerar plasma fresco congelado ou, idealmente, complexo protrombínico*' },
]

export type ReversaoVarfarina = { linhas: LinhaVarfarina[]; nota?: string }

/**
 * Linha(s) da Tabela 4 para o INR e o sangramento. As faixas do livro se
 * tocam em 5 (2–5 e 5–9): com INR 5 exato devolve as duas. Não há linha para
 * INR < 2 nem para INR > 9 com sangramento leve.
 */
export function reversaoVarfarina(inr: number, sang: Sangramento): ReversaoVarfarina | null {
  if (!valido(inr)) return null
  const tira = ({ inr: i, sangramento, texto }: LinhaVarfarina) => ({ inr: i, sangramento, texto })
  if (sang === 'grave') return { linhas: TABELA_VARFARINA.filter((l) => l.sang === 'grave').map(tira) }
  const linhas = TABELA_VARFARINA.filter((l) => l.sang === sang && (
    (l.de !== undefined && inr >= l.de && inr <= l.ate!) || (l.acimaDe !== undefined && inr > l.acimaDe)
  ))
  if (linhas.length === 0) {
    const nota = inr < 2 ? 'A Tabela 4 começa em INR 2: não há linha para INR menor.' : 'A Tabela 4 não tem linha para INR > 9 com sangramento leve.'
    return { linhas: [], nota }
  }
  return { linhas: linhas.map(tira), nota: linhas.length > 1 ? 'INR 5 exato: o livro dá faixas 2–5 e 5–9, que se tocam; as duas linhas são mostradas.' : undefined }
}

// ── CCP, plasma, vitamina K e crioprecipitado ────────────────────────────────

export const CCP = {
  uKg: 50,
  inrAcimaDe: 6,
  texto: 'confirmar que existe alargamento de INR; o ideal é o complexo protrombínico de 4 fatores; dose típica 50 unidades/kg para INR > 6',
  volumeMl: [20, 40] as Faixa,
  errata: 'Na p. 549 o livro diz que os CCP contêm os fatores II, IX e X, omitindo o VII (a p. 546 cita o CCP de 4 fatores). O livro não traz dose de CCP para INR ≤ 6 nem teto de unidades.',
  pagina: 'cap. 79, p. 1043 (nota da Tabela 4); cap. 39, p. 548–549',
}

/** CCP 50 U/kg só quando INR > 6 (única dose do livro). */
export function ccpUnidades(pesoKg: number, inr: number): { unidades: number | null; nota: string } | null {
  if (!valido(pesoKg) || !valido(inr)) return null
  if (inr > CCP.inrAcimaDe) return { unidades: CCP.uKg * pesoKg, nota: '50 U/kg (INR > 6)' }
  return { unidades: null, nota: `INR ${inr}: o livro só traz a dose de CCP para INR > 6.` }
}

export const PLASMA = {
  hipMlKg: [15, 20] as Faixa,
  hepatopatiaMlKg: 15,
  texto: 'HIP com INR alterado: plasma fresco congelado 15–20 mL/kg junto com vitamina K1 5–10 mg lentamente EV (nunca vitamina K isolada). Hepatopatia grave com sangramento: 15 mL/kg, repetir conforme necessidade.',
  pagina: 'cap. 39, p. 548; cap. 79, p. 1042',
}

export function plasmaMl(pesoKg: number): { hip: Faixa; hepatopatia: number } | null {
  if (!valido(pesoKg)) return null
  return { hip: [PLASMA.hipMlKg[0] * pesoKg, PLASMA.hipMlKg[1] * pesoKg], hepatopatia: PLASMA.hepatopatiaMlKg * pesoKg }
}

export const VITAMINA_K = [
  { contexto: 'HIP com antagonista de vitamina K', texto: '10 mg EV', pagina: 'cap. 39, p. 545' },
  { contexto: 'HIP com INR alterado (com plasma)', texto: '5–10 mg lentamente EV', pagina: 'cap. 39, p. 548' },
  { contexto: 'Sangramento grave com varfarina', texto: '10 mg EV em 20 minutos', pagina: 'cap. 79, p. 1043' },
  { contexto: 'Colestase isolada', texto: '10 mg EV', pagina: 'cap. 79, p. 1042' },
]
export const ERRATA_VITAMINA_K = 'Na HIP o livro dá 10 mg (p. 545) e 5–10 mg (p. 548); inconsistência interna, as duas são mostradas.'

export const CRIOPRECIPITADO = {
  unidadesPor10Kg: 1,
  ganhoMgDl: 50,
  gatilhoMgDl: 100,
  texto: 'indicado com manifestação hemorrágica e fibrinogênio < 100 mg/dL; 1 unidade para cada 10 kg aumenta o fibrinogênio em aproximadamente 50 mg/dL',
  pagina: 'cap. 79, p. 1042',
}

export function crioUnidades(pesoKg: number): number | null {
  return valido(pesoKg) ? (pesoKg / 10) * CRIOPRECIPITADO.unidadesPor10Kg : null
}

// ── Protamina: Tabela 5 (p. 1044) ────────────────────────────────────────────

export type TempoHeparina = 'imediato' | '30-60min' | 'mais-2h'

export const TABELA_PROTAMINA: Record<TempoHeparina, { rotulo: string; mgPor100U: Faixa }> = {
  imediato: { rotulo: 'Imediato', mgPor100U: [1, 1.5] },
  '30-60min': { rotulo: '30–60 min', mgPor100U: [0.5, 0.75] },
  'mais-2h': { rotulo: '> 2 h', mgPor100U: [0.25, 0.375] },
}

export const PROTAMINA_REVERSAO = {
  maxMg: 50,
  mgPorAmpola: 50,
  hipTexto: 'HIP com heparina EV: protamina 1 mg/100 U de heparina (máximo 50 mg)',
  scTexto: 'heparina SC: 1–1,5 mg/100 U',
  errata: 'O livro escreve "cada ampola de protamina contém 50 mg ou 5.000 UI de protamina": protamina não é dosada em UI (50 mg neutralizam cerca de 5.000 U de heparina). A tabela também não cobre o intervalo entre 60 min e 2 h, e não diz como estimar as unidades de heparina a neutralizar.',
  pagina: 'cap. 79, p. 1044 (Tabela 5); cap. 39, p. 548',
}

export type ProtaminaCalc = { mg: Faixa; limitadoAoTeto: boolean; ampolas: Faixa }

/** Protamina para as unidades de heparina informadas, na linha escolhida da Tabela 5, com teto de 50 mg. */
export function protamina(unidadesHeparina: number, tempo: TempoHeparina): ProtaminaCalc | null {
  if (!valido(unidadesHeparina)) return null
  const [a, b] = TABELA_PROTAMINA[tempo].mgPor100U
  const bruto: Faixa = [(unidadesHeparina / 100) * a, (unidadesHeparina / 100) * b]
  const mg: Faixa = [Math.min(bruto[0], PROTAMINA_REVERSAO.maxMg), Math.min(bruto[1], PROTAMINA_REVERSAO.maxMg)]
  return { mg, limitadoAoTeto: bruto[1] > PROTAMINA_REVERSAO.maxMg, ampolas: [mg[0] / PROTAMINA_REVERSAO.mgPorAmpola, mg[1] / PROTAMINA_REVERSAO.mgPorAmpola] }
}

// ── DOAC: Tabela 3 (p. 546) e Tabela 6 (p. 1044–1045) ────────────────────────

export const REVERSAO_DOAC = [
  { droga: 'Dabigatrana', maior: ['Idarucizumabe (sem dose no livro)', 'Complexo protrombínico ativado', 'Antifibrinolítico (ácido tranexâmico ou ε-aminocaproico)', 'Descontinuar anticoagulação', 'Carvão ativado se < 2 h da ingestão', 'Plaquetas se plaquetopenia', 'Intervenções endoscópicas e outras, se necessário'],
    menor: ['Medidas hemostáticas locais', 'Considerar descontinuar anticoagulação', 'Considerar antifibrinolítico'] },
  { droga: 'Rivaroxabana, apixabana, edoxabana e betrixabana', maior: ['CCP de 4 fatores (o livro registra que ainda não estava disponível no DE do HCFMUSP)', 'Antifibrinolítico (ácido tranexâmico ou ε-aminocaproico)', 'Considerar descontinuar anticoagulação', 'Carvão ativado se < 2 h da ingestão', 'Plaquetas se plaquetopenia', 'Intervenções endoscópicas e outras, se necessário'],
    menor: ['Medidas hemostáticas locais', 'Considerar descontinuar anticoagulação', 'Meia-vida: rivaroxabana 5–9 h, apixabana 8–15 h, edoxabana 6–11 h', 'Considerar antifibrinolítico'] },
]
export const DOAC_PAGINA = 'cap. 39, p. 546 (Tabela 3); cap. 79, p. 1044–1045 (Tabela 6)'
export const SANGRAMENTO_MAIOR = 'Sangramento maior: intracraniano, retroperitoneal, síndrome compartimental, gastrointestinal maciço. Menor: epistaxe, tecidos moles, gastrointestinal lento (p. 1044–1045).'
export const ERRATA_DOAC = 'Grafias do livro: "Idaricuzumab" (idarucizumabe), "transnexâmico" (tranexâmico), "endoxaban" (edoxabana). Nenhuma dose de idarucizumabe nem de CCP para DOAC é dada; andexanete não é citado.'

// ── HIP: PA, glicemia e cirurgia (p. 543–549) ────────────────────────────────

export const HIP_METAS = [
  { texto: 'PAS entre 150 e 220 mmHg sem contraindicação: reduzir para PAS de 140 mmHg é seguro e desejável', pagina: 'p. 547' },
  { texto: 'Glicemia entre 70 e 180 mg/dL', pagina: 'p. 547' },
  { texto: 'Coagulopatia ou trombocitopenia graves: fator de substituição apropriado ou transfusão de plaquetas (sem número no livro)', pagina: 'p. 545' },
  { texto: 'Mau prognóstico: Glasgow < 9, hematoma > 60 mL, sangue no ventrículo; Glasgow < 9 com hematoma > 60 mL, mortalidade > 90%', pagina: 'p. 543' },
  { texto: 'Cirurgia: hemorragia cerebelar > 3 cm (principalmente com compressão do tronco); considerar em lobares de 10 a 100 mL a 1 cm da superfície cortical; momento controverso, 4–96 h', pagina: 'p. 549' },
]
export const ERRATA_HIP_CIRURGIA = 'O livro escreve "hemorragias lobares de 10 a 100 mm³" (p. 549); a unidade deveria ser mL (cm³).'

export function conferirPasHip(pas: number): string | null {
  if (!valido(pas)) return null
  if (pas >= 150 && pas <= 220) return 'PAS entre 150 e 220 mmHg: o livro traz PAS-alvo de 140 mmHg (p. 547).'
  if (pas > 220) return 'PAS > 220 mmHg: o livro não traz alvo para esta faixa neste capítulo.'
  return 'PAS < 150 mmHg: fora da faixa em que o livro dá o alvo de 140 mmHg.'
}

// ── Escore ICH (p. 543–544) ──────────────────────────────────────────────────

export const fichaEscoreIch = fichaAdulto('adulto-escore-ich', 'Escore ICH — hemorragia intraparenquimatosa (adulto)', 'cap. 39 Hemorragias intraparenquimatosas, p. 543–544 (Tabela 2)')

export const MORTALIDADE_ICH: Record<number, string> = { 1: '13%', 2: '26%', 3: '72%', 4: '97%', 5: '100%' }

export const ERRATA_ICH = 'A Tabela 2 (p. 544) começa no escore 1 e vai até 5: não há linha para 0 nem para 6 (máximo possível). O livro usa "idade > 80 anos" (p. 543); o inventário do projeto registra que o escore original usa ≥ 80 — a ferramenta segue o livro.'

export const escoreIch: Escore = {
  ficha: fichaEscoreIch,
  descricao: 'Soma de Glasgow, volume do hematoma, extensão intraventricular, origem infratentorial e idade, com a mortalidade em 30 dias da Tabela 2 do manual do HC.',
  itens: [
    { tipo: 'escolha', id: 'glasgow', rotulo: 'Escala de Glasgow', opcoes: [
      { rotulo: '13 a 15 — 0 ponto', valor: 0 }, { rotulo: '5 a 12 — 1 ponto', valor: 1 }, { rotulo: '3 a 4 — 2 pontos', valor: 2 },
    ] },
    { tipo: 'escolha', id: 'volume', rotulo: 'Volume do hematoma', opcoes: [
      { rotulo: '< 30 cm³ — 0 ponto', valor: 0 }, { rotulo: '≥ 30 cm³ — 1 ponto', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'ventricular', rotulo: 'Extensão intraventricular', opcoes: [
      { rotulo: 'Ausente — 0 ponto', valor: 0 }, { rotulo: 'Presente — 1 ponto', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'infratentorial', rotulo: 'Origem infratentorial', opcoes: [
      { rotulo: 'Não — 0 ponto', valor: 0 }, { rotulo: 'Sim — 1 ponto', valor: 1 },
    ] },
    { tipo: 'escolha', id: 'idade', rotulo: 'Idade', opcoes: [
      { rotulo: '80 anos ou menos — 0 ponto', valor: 0 }, { rotulo: 'Mais de 80 anos — 1 ponto', valor: 1 },
    ] },
  ],
  calcular(r) {
    if (!completo(escoreIch, r)) return null
    const total = somar(escoreIch, r)
    const mort = MORTALIDADE_ICH[total]
    const glasgow = escolha(escoreIch, r, 'glasgow')!
    return {
      rotulo: 'Escore ICH',
      valor: String(total),
      unidade: 'de 6',
      nota: mort ? `Mortalidade em 30 dias: ${mort} (Tabela 2, p. 544)` : `Escore ${total}: sem linha na Tabela 2 do livro`,
      estado: total >= 3 ? 2 : total >= 1 ? 1 : 0,
      derivados: [['Glasgow', glasgow.rotulo]],
      alerta: mort ? undefined : ERRATA_ICH,
      cuidados: [
        'Mau prognóstico no texto: Glasgow < 9, hematoma > 60 mL, sangue no ventrículo (p. 543).',
        'Escore prognóstico: não define conduta.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}
