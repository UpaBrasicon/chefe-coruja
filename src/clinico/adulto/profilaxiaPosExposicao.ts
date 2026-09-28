import { fichaAdulto } from './fonte.ts'

// Tétano e profilaxias pós-exposição — Manual de Medicina de Emergência do
// HCFMUSP (3ª ed., 2022): cap. 93 Tétano acidental (p. 1249–1256), Anexo 4
// Profilaxia da raiva humana (p. 1497, fluxograma em figura), Anexo 6 Profilaxia
// de hepatite B (p. 1504–1510) e Anexo 7 Profilaxia do tétano (p. 1511).
// A ferramenta devolve a célula da tabela/fluxograma que corresponde ao que
// quem atende informou; a conduta é do profissional (ADR 0007).

export type Faixa = [number, number]
const valido = (x: number) => Number.isFinite(x) && x > 0

// ── Tétano ───────────────────────────────────────────────────────────────────

export const fichaTetanoAdulto = fichaAdulto(
  'adulto-tetano-profilaxia',
  'Tétano — profilaxia e tratamento (adulto)',
  'cap. 93 Tétano acidental, p. 1249–1256 (Tabelas 2 e 5); Anexo 7 Profilaxia do tétano, p. 1511',
)

export type HistoricoVacinalTetano = 'incerta' | 'menos5' | 'entre5e10' | 'mais10'
export type FerimentoTetano = 'limpo' | 'outros'

export const HISTORICO_TETANO: { value: HistoricoVacinalTetano; label: string }[] = [
  { value: 'incerta', label: 'Incerta ou menos de 3 doses' },
  { value: 'menos5', label: '3 doses ou mais; última há menos de 5 anos' },
  { value: 'entre5e10', label: '3 doses ou mais; última entre 5 e 10 anos' },
  { value: 'mais10', label: '3 doses ou mais; última há mais de 10 anos' },
]

export const FERIMENTO_TETANO: { value: FerimentoTetano; label: string }[] = [
  { value: 'limpo', label: 'Limpo ou superficial' },
  { value: 'outros', label: 'Outros tipos de ferimento' },
]

/** Anexo 7 (p. 1511): [vacina, SAT ou IGHAT] por histórico × ferimento. */
const ANEXO7: Record<HistoricoVacinalTetano, Record<FerimentoTetano, [boolean, boolean]>> = {
  incerta: { limpo: [true, false], outros: [true, true] },
  menos5: { limpo: [false, false], outros: [false, false] },
  entre5e10: { limpo: [false, false], outros: [true, false] },
  mais10: { limpo: [true, false], outros: [true, false] },
}

export const IMUNOGLOBULINA_PROFILAXIA = {
  sat: 'SAT 5.000 unidades IM após teste de sensibilidade',
  ighat: 'aos alérgicos ao SAT, imunoglobulina humana (IGHAT) dose única de 250 unidades',
  pagina: 'Anexo 7, p. 1511 (Funasa, jun. 2001)',
}

export function profilaxiaTetano(historico: HistoricoVacinalTetano, ferimento: FerimentoTetano) {
  const [vacina, imunoglobulina] = ANEXO7[historico][ferimento]
  return { vacina, imunoglobulina, pagina: 'Anexo 7, p. 1511' }
}

/** Tabela 5 do cap. 93 (p. 1255), outra tabela do mesmo livro, mostrada inteira para comparação. */
export const TABELA5_TETANO = {
  colunas: ['Imunizado', 'Imunização entre 5 e 10 anos', 'Sem imunização adequada ou status desconhecido'],
  linhas: [
    { ferimento: 'Superficiais e limpos', celulas: ['sem condutas específicas além de cuidados locais', 'sem condutas específicas além de cuidados locais', 'vacina dT 0,5 mL IM; encaminhar para outras doses'] },
    { ferimento: 'Profundos ou contaminados', celulas: ['sem condutas específicas além de cuidados locais', 'vacina dT 0,5 mL IM; encaminhar para outras doses', 'IHAT 250 U IM + vacina dT 0,5 mL IM; encaminhar para outras doses'] },
  ],
  pagina: 'cap. 93, Tabela 5, p. 1255',
  errata: 'As duas tabelas do livro não coincidem: a Tabela 5 (p. 1255) não define "imunizado" nem tem a linha "última dose há mais de 10 anos", em que o Anexo 7 (p. 1511) indica vacina mesmo no ferimento limpo; a imunoglobulina da Tabela 5 é IHAT 250 U, e a do Anexo 7 é SAT 5.000 U (IGHAT 250 U só para alérgicos). A ferramenta segue o Anexo 7 e mostra a Tabela 5 ao lado.',
}

export const TRATAMENTO_TETANO = {
  imunoglobulina: { texto: 'IGHAT IM profunda 500 a 5.000 UI (infiltrar perto da ferida não é mais recomendado); alternativa SAT 20.000 a 30.000 UI IM em dois grupos musculares, com anti-histamínico profilático. Desbridamento só 1–6 h após a IGHAT. Vacinar simultaneamente', pagina: 'p. 1253' },
  antibioticos: { texto: 'metronidazol 500 mg EV 6/6 ou 8/8 h (preferido); penicilina G 2 a 4 milhões U EV 4/4 ou 6/6 h; infecção mista: cefazolina 1–2 g EV 8/8 h, cefuroxima 2 g EV 6/6 h ou ceftriaxona 1–2 g EV 24/24 h; 7 a 10 dias', pagina: 'p. 1253–1254' },
  espasmos: { texto: 'diazepam ≈ 30 mg EV em 24 h (5 mg a cada 4 h), até 120 mg/dia; baclofeno intratecal bolus de 1.000 µg ou infusão; propofol; bloqueio neuromuscular se refratário', pagina: 'p. 1254',
    errata: 'Midazolam impresso "5–15 mg/kg por hora" — unidade implausível (por kg seria dose letal). Não é calculado.' },
  bnm: { rocuronioMgKg: 1, vecuronioPrimingMgKg: 0.01, vecuronioMgKg: 0.15, texto: 'rocurônio 1 mg/kg (1ª escolha) ou vecurônio 0,01 mg/kg em bolus e, após 3 min, 0,15 mg/kg', pagina: 'p. 1254' },
  magnesio: { ataqueMgKg: 40, ataqueMin: 30, corteKg: 45, acimaGH: 2, ateGH: 1.5, texto: 'disautonomia: sulfato de magnésio 40 mg/kg em 30 min + 2 g/h (> 45 kg) ou 1,5 g/h (≤ 45 kg)', pagina: 'p. 1254' },
  disautonomia: { texto: 'labetalol 0,25–1,0 mg/min; clonidina 0,3 mg 8/8 h VO/sonda; evitar propranolol isolado. Morfina impressa "0,5 a 1,0 mg/kg por hora" (não calculada, ver errata)', pagina: 'p. 1254',
    errata: 'Morfina 0,5–1,0 mg/kg/h em infusão contínua daria 35–70 mg/h em 70 kg; o inventário do projeto marcou o valor para conferir na fonte original. Não é calculado.' },
  fatoresRisco: { texto: 'incubação < 7 dias (principalmente < 48 h); progressão < 48 h; idade > 60 anos; comorbidades graves; complicações infecciosas, respiratórias, hemodinâmicas ou renais na admissão', pagina: 'Tabela 2, p. 1250–1251' },
}

export function tratamentoTetanoPorPeso(pesoKg: number) {
  if (!valido(pesoKg)) return null
  const m = TRATAMENTO_TETANO.magnesio
  const b = TRATAMENTO_TETANO.bnm
  return {
    magnesioAtaqueG: (m.ataqueMgKg * pesoKg) / 1000,
    magnesioManutencaoGH: pesoKg > m.corteKg ? m.acimaGH : m.ateGH,
    rocuronioMg: b.rocuronioMgKg * pesoKg,
    vecuronioPrimingMg: b.vecuronioPrimingMgKg * pesoKg,
    vecuronioMg: b.vecuronioMgKg * pesoKg,
  }
}

// ── Raiva (Anexo 4, p. 1497) ────────────────────────────────────────────────

export const fichaRaivaAdulto = fichaAdulto(
  'adulto-raiva-pos-exposicao',
  'Raiva — profilaxia pós-exposição (adulto)',
  'Anexo 4 Profilaxia da raiva humana, p. 1497 (fluxograma)',
)

export type ContatoRaiva = 'indireto-morcego' | 'direto'
export type AcidenteRaiva = 'leve' | 'grave'
export type AnimalRaiva = 'sem-suspeita' | 'com-suspeita' | 'raivoso-silvestre-economico'

export const ACIDENTE_RAIVA = {
  leve: 'superficial, pouco extenso; tronco e membros (mordedura, arranhadura, unha, dente ou lambedura)',
  grave: 'profundo, múltiplo, extenso; cabeça, face, pescoço, mãos, polpas digitais; lambedura de mucosa ou de local com lesão grave',
}

export const ANIMAL_RAIVA: { value: AnimalRaiva; label: string }[] = [
  { value: 'sem-suspeita', label: 'Cão ou gato sem suspeita de raiva' },
  { value: 'com-suspeita', label: 'Cão ou gato com suspeita de raiva' },
  { value: 'raivoso-silvestre-economico', label: 'Cão ou gato raivoso, animal silvestre ou de interesse econômico' },
]

export type CondutaRaiva = {
  esquema: 'sorovacinacao-4' | 'vacina-4' | 'vacina-2' | 'nenhum'
  texto: string
  observar10Dias: boolean
}

export const RAIVA = {
  vacina4: 'D0, D3, D7 e D14 (nota informativa n. 26-SEI/2017-CGPNI/DEVIT/SVS/MS: de 5 para 4 doses)',
  vacina2: 'D0 e D3',
  observacao: 'observar o cão/gato por 10 dias: se morrer ou se tornar raivoso, vacina (4 doses); se a suspeita for descartada, encerrar sem completar a vacinação',
  interesseEconomico: 'bovinos, bubalinos, equídeos, caprinos, ovinos, suínos e outros',
  contatoIndireto: 'através de fômites ou secreção de animais suspeitos',
  pagina: 'Anexo 4, p. 1497',
  nota: 'O fluxograma põe o morcego só no ramo "contato indireto" e não traz dose de soro nem de imunoglobulina; o livro não informa a dose do soro.',
}

/**
 * Célula do fluxograma do Anexo 4 (p. 1497). `areaControlada` só é usado no
 * acidente grave com cão/gato sem suspeita: "área de raiva controlada ou animal
 * exclusivamente doméstico ou só sai à rua acompanhado, sem contato com outros
 * animais" (sim) × não ou dúvida.
 */
export function profilaxiaRaiva(contato: ContatoRaiva, acidente: AcidenteRaiva, animal: AnimalRaiva, areaControlada: boolean | null): CondutaRaiva | null {
  if (contato === 'indireto-morcego') return { esquema: 'sorovacinacao-4', texto: 'Sorovacinação (4 doses)', observar10Dias: false }
  if (animal === 'raivoso-silvestre-economico') {
    return acidente === 'leve'
      ? { esquema: 'vacina-4', texto: 'Vacina (4 doses)', observar10Dias: false }
      : { esquema: 'sorovacinacao-4', texto: 'Sorovacinação (4 doses)', observar10Dias: false }
  }
  if (animal === 'com-suspeita') {
    return acidente === 'leve'
      ? { esquema: 'vacina-2', texto: 'Vacina (2 doses, D0 e D3) e observar o animal 10 dias', observar10Dias: true }
      : { esquema: 'sorovacinacao-4', texto: 'Sorovacinação (4 doses) e observar o animal 10 dias', observar10Dias: true }
  }
  if (acidente === 'leve') return { esquema: 'nenhum', texto: 'Observar o animal 10 dias', observar10Dias: true }
  if (areaControlada === null) return null
  return areaControlada
    ? { esquema: 'nenhum', texto: 'Observar o animal 10 dias', observar10Dias: true }
    : { esquema: 'vacina-2', texto: 'Vacina (2 doses, D0 e D3) e observar o animal 10 dias', observar10Dias: true }
}

// ── Hepatite B pós-exposição ocupacional (Anexo 6, p. 1504–1510) ────────────

export const fichaHepatiteBAdulto = fichaAdulto(
  'adulto-hepatite-b-pos-exposicao',
  'Hepatite B — profilaxia pós-exposição ocupacional (adulto)',
  'Anexo 6 Recomendações para profilaxia de hepatite B (SES-SP/CVE, adaptado do Manual dos CRIE/MS 2006), p. 1504–1510',
)

export type FonteHbv = 'positivo-ou-risco' | 'desconhecido-sem-risco' | 'negativo'
export type SituacaoProfissional = 'nao-vacinado' | 'incompleto' | 'resposta-adequada' | 'sem-resposta-1' | 'sem-resposta-2' | 'resposta-desconhecida' | 'infeccao-previa'

export const FONTE_HBV: { value: FonteHbv; label: string }[] = [
  { value: 'positivo-ou-risco', label: 'HBsAg positivo, ou desconhecido com risco' },
  { value: 'desconhecido-sem-risco', label: 'HBsAg desconhecido sem risco' },
  { value: 'negativo', label: 'HBsAg negativo' },
]

export const RISCO_FONTE_HBV = 'politransfundidos, cirróticos, em hemodiálise, HIV-positivo, usuários de drogas, contatos domiciliares e sexuais de portadores do VHB, história de DST, procedentes de áreas de alta endemicidade, de instituições para deficiência mental e do sistema prisional'

export const SITUACAO_HBV: { value: SituacaoProfissional; label: string }[] = [
  { value: 'nao-vacinado', label: 'Não vacinado' },
  { value: 'incompleto', label: 'Esquema vacinal incompleto' },
  { value: 'resposta-adequada', label: 'Vacinado, anti-HBs ≥ 10 UI/mL' },
  { value: 'sem-resposta-1', label: 'Vacinado, anti-HBs < 10 após 1º esquema (3 doses)' },
  { value: 'sem-resposta-2', label: 'Vacinado, anti-HBs < 10 após 2º esquema (6 doses)' },
  { value: 'resposta-desconhecida', label: 'Vacinado, resposta desconhecida' },
  { value: 'infeccao-previa', label: 'Infecção prévia pelo VHB' },
]

export const HBV = {
  esquema: '3 doses (0, 1 e 6 meses); considerar doses anteriores válidas independentemente do tempo',
  antiHbs: 'anti-HBs quantitativo 30 a 60 dias após o término do esquema',
  hbig: { mlKg: 0.06, via: 'IM', prazo: 'o mais precocemente possível, até 7 dias após o acidente; solicitar no CRIE' },
  alergia: 'Previamente vacinado sem resposta adequada e com alergia grave à vacina: 2 doses de HBIG.',
  pagina: 'Anexo 6, p. 1504–1510',
  errata: 'p. 1510: "alegria grave a vacina" — erro de digitação de "alergia"; não muda a conduta.',
}

export type CondutaHbv = { itens: string[]; dosesHbig: 0 | 1 | 2; hbigSeAntiHbsBaixo: boolean }

const iniciar = `Iniciar esquema vacinal: ${HBV.esquema}. Realizar ${HBV.antiHbs}.`
const completar = `Completar esquema vacinal: ${HBV.esquema}. Realizar ${HBV.antiHbs}.`
const repetir = `Repetir esquema vacinal (2º esquema: mais 3 doses em 0, 1 e 6 meses). Realizar ${HBV.antiHbs}.`
const umaHbig = `1 dose de HBIG ${HBV.hbig.mlKg.toLocaleString('pt-BR')} mL/kg ${HBV.hbig.via}, ${HBV.hbig.prazo}.`
const nada = 'Nenhuma medida específica.'

export function profilaxiaHepatiteB(fonte: FonteHbv, situacao: SituacaoProfissional): CondutaHbv {
  const risco = fonte === 'positivo-ou-risco'
  switch (situacao) {
    case 'nao-vacinado':
      return risco ? { itens: [iniciar, umaHbig], dosesHbig: 1, hbigSeAntiHbsBaixo: false } : { itens: [iniciar], dosesHbig: 0, hbigSeAntiHbsBaixo: false }
    case 'incompleto':
      return risco ? { itens: [completar, umaHbig], dosesHbig: 1, hbigSeAntiHbsBaixo: false } : { itens: [completar], dosesHbig: 0, hbigSeAntiHbsBaixo: false }
    case 'resposta-adequada':
    case 'infeccao-previa':
      return { itens: [nada], dosesHbig: 0, hbigSeAntiHbsBaixo: false }
    case 'sem-resposta-1':
      return risco ? { itens: [umaHbig, repetir], dosesHbig: 1, hbigSeAntiHbsBaixo: false } : { itens: [repetir], dosesHbig: 0, hbigSeAntiHbsBaixo: false }
    case 'sem-resposta-2':
      return fonte === 'negativo'
        ? { itens: [nada], dosesHbig: 0, hbigSeAntiHbsBaixo: false }
        : { itens: ['2 doses de HBIG, com intervalo de 1 mês entre as doses.'], dosesHbig: 2, hbigSeAntiHbsBaixo: false }
    case 'resposta-desconhecida':
      return risco
        ? { itens: ['Anti-HBs quantitativo com resultado garantido até o 7º dia após o acidente: ≥ 10 UI/mL, nenhuma medida; < 10 UI/mL, 1 dose de HBIG e repetir o esquema (2º esquema).'], dosesHbig: 0, hbigSeAntiHbsBaixo: true }
        : { itens: [`Anti-HBs quantitativo: ≥ 10 UI/mL, nenhuma medida; < 10 UI/mL, repetir o esquema (2º esquema). Realizar ${HBV.antiHbs}.`], dosesHbig: 0, hbigSeAntiHbsBaixo: false }
  }
}

/** Volume de HBIG: 0,06 mL/kg IM (p. 1506–1507). */
export const hbigMl = (pesoKg: number) => (valido(pesoKg) ? HBV.hbig.mlKg * pesoKg : null)
