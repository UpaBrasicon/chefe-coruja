import type { Ficha } from '../ficha.ts'
import { completo, escolha, somar, type Escore, type Item } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Neutropenia febril — cap. 81 do Manual de Medicina de Emergência do HCFMUSP
// (3ª ed., 2022), p. 1062–1072. MASCC (Tabela 2, p. 1068), critérios de alto
// risco (p. 1067) e doses do tratamento empírico (p. 1069–1072). O CISNE é
// citado (p. 1067–1068) sem tabela de pontos e não é implementado.

const CAP = 'cap. 81 Neutropenia febril'

const KLASTERSKY: Ficha['fontes'][number] = {
  citacao: 'Klastersky J, Paesmans M, Rubenstein EB, et al. The Multinational Association for Supportive Care in Cancer risk index: a multinational scoring system for identifying low-risk febrile neutropenic cancer patients. J Clin Oncol. 2000;18(16):3038–3051.',
  url: 'https://doi.org/10.1200/JCO.2000.18.16.3038',
}

const baseMascc = fichaAdulto('adulto-mascc', 'MASCC — risco na neutropenia febril (adulto)', `${CAP}, p. 1067–1068 (Tabela 2)`)

export const ERRATA_MASCC =
  'p. 1068 (conferido na imagem da página) — a Tabela 2 junta "sintomas moderados ou graves = 3". No escore original (Klastersky et al., 2000) sintomas moderados valem 3 e sintomas graves valem 0. A ferramenta usa 0 para sintomas graves e mostra também o total pela leitura literal do livro.'

const simNao = (id: string, rotulo: string, pontos: number): Item => ({ tipo: 'escolha', id, rotulo, opcoes: [{ rotulo: 'Não — 0', valor: 0 }, { rotulo: `Sim — ${pontos}`, valor: pontos }] })

export const mascc: Escore = {
  ficha: { ...baseMascc, fontes: [...baseMascc.fontes, KLASTERSKY] },
  descricao: 'Multinational Association for Supportive Care in Cancer: soma de 0 a 26; abaixo de 21 é critério de alto risco no livro.',
  itens: [
    { tipo: 'escolha', id: 'sintomas', rotulo: 'Intensidade dos sintomas', opcoes: [
      { rotulo: 'Assintomático — 5', valor: 5 },
      { rotulo: 'Sintomas leves — 5', valor: 5 },
      { rotulo: 'Sintomas moderados — 3', valor: 3 },
      { rotulo: 'Sintomas graves — 0 (o livro dá 3; ver errata)', valor: 0 },
    ] },
    simNao('hipotensao', 'Ausência de hipotensão', 5),
    simNao('dpoc', 'Ausência de doença pulmonar obstrutiva crônica', 4),
    simNao('tumor', 'Tumor sólido ou neoplasia hematológica sem infecção fúngica prévia', 4),
    simNao('desidratacao', 'Ausência de desidratação', 3),
    simNao('ambulatorial', 'Não hospitalizado ao aparecimento da febre', 3),
    simNao('idade', 'Idade menor que 60 anos', 2),
  ],
  calcular(r) {
    if (!completo(mascc, r)) return null
    const total = somar(mascc, r)
    const graves = escolha(mascc, r, 'sintomas')?.rotulo.startsWith('Sintomas graves') ?? false
    const literal = graves ? total + 3 : total
    const alto = total < 21
    const derivados: [string, string][] = [['Corte do livro (p. 1067)', 'MASCC < 21 é um dos critérios de alto risco']]
    if (graves) derivados.push(['Total pela leitura literal do livro (graves = 3)', `${literal}${literal < 21 ? ' — alto risco' : ' — ≥ 21'}`])
    return {
      rotulo: 'MASCC',
      valor: String(total),
      unidade: 'de 26',
      nota: alto ? '< 21: critério de alto risco' : '≥ 21: não preenche o critério de alto risco pelo MASCC',
      estado: alto ? 2 : 0,
      derivados,
      alerta: graves ? ERRATA_MASCC : undefined,
      cuidados: [
        'MASCC ≥ 21 não basta para baixo risco: o livro também classifica como alto risco neutropenia < 500 esperada por > 7 dias; comorbidades (instabilidade, mucosite, alteração mental, infecção de cateter, infiltrado novo ou hipóxia, doença pulmonar crônica); transaminases > 5 × LSN ou ClCr < 30 mL/min; neutropenia ≤ 100 por > 7 dias; profilaxia ambulatorial com quinolona; e exige doença oncológica estável (p. 1067).',
        'Baixo risco: nenhum desses critérios e bom performance status (p. 1067).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// ---------------------------------------------------------------------------
// Definições e doses (p. 1062, 1069–1072)

export const fichaNeutropeniaFebrilAdulto = fichaAdulto('adulto-neutropenia-febril', 'Neutropenia febril — definições e doses empíricas (adulto)', `${CAP}, p. 1062–1072`)

export const DEFINICOES_NF = [
  { texto: 'Febre: temperatura axilar ≥ 37,8 °C sustentada por uma hora; não medir temperatura retal', pagina: 'p. 1062' },
  { texto: 'Neutropenia: < 500 células ou entre 500 e 1.000 com perspectiva de queda nas 48 h seguintes', pagina: 'p. 1062' },
  { texto: 'Triagem: considerar até 6 semanas após quimioterapia; maior risco entre o 10º e o 20º dia', pagina: 'p. 1062' },
  { texto: 'Antimicrobiano idealmente nos primeiros 30 min após a triagem, depois das hemoculturas', pagina: 'p. 1068' },
  { texto: 'Plaquetas < 50.000 antes de punção lombar: considerar transfusão (o livro escreve "/L")', pagina: 'p. 1067' },
]

export const ATB_ALTO_RISCO = [
  { nome: 'Piperacilina-tazobactam', dose: '4,5 g IV 6/6 horas' },
  { nome: 'Cefepime', dose: '2 g IV 8/8 horas' },
  { nome: 'Meropenem', dose: '1 g IV 8/8 horas' },
  { nome: 'Imipenem', dose: '500 mg IV 6/6 horas' },
  { nome: 'Ceftazidima', dose: '2 g IV 8/8 horas (ressalva: resistência crescente e espectro limitado contra Gram-positivos)' },
]

export type Faixa = [number, number]

export const ANTIFUNGICOS_NF = {
  caspofungina: { ataqueMg: 70, manutencaoMg: 50, texto: '70 mg IV no 1º dia, depois 50 mg 1 x/d (sem profilaxia antifúngica prévia e sem foco)' },
  anfoLipossomal: { mgKg: [3, 5] as Faixa, texto: '3-5 mg/kg IV 1 x/d (infiltrados/nódulos pulmonares)' },
  voriconazol: { ataqueMgKg: 6, manutencaoMgKg: 4, intervaloH: 12, texto: '6 mg/kg IV 12/12 h no 1º dia, depois 4 mg/kg 12/12 h' },
  pagina: 'p. 1072',
}

export const ERRATA_ANFO_DEOXICOLATO =
  'p. 1072 — o livro traz "deoxicolato 5 mg/kg 1 x/d" para a anfotericina B convencional. A dose usual da formulação deoxicolato é muito menor (fração de mg/kg), e 5 mg/kg é dose da formulação lipídica: provável erro de digitação. A ferramenta não calcula essa linha.'

export type ContaAntifungico = { anfoLipossomalMg: Faixa; voriconazolAtaqueMg: number; voriconazolManutencaoMg: number }

export function antifungicosPorPeso(pesoKg: number): ContaAntifungico | null {
  if (!Number.isFinite(pesoKg) || pesoKg <= 0) return null
  const a = ANTIFUNGICOS_NF
  return {
    anfoLipossomalMg: [a.anfoLipossomal.mgKg[0] * pesoKg, a.anfoLipossomal.mgKg[1] * pesoKg],
    voriconazolAtaqueMg: a.voriconazol.ataqueMgKg * pesoKg,
    voriconazolManutencaoMg: a.voriconazol.manutencaoMgKg * pesoKg,
  }
}

export const INDICACOES_VANCO_NF = [
  'Instabilidade hemodinâmica',
  'Mucosite',
  'Suspeita de infecção relacionada a cateter, pele ou partes moles',
  'Profilaxia com quinolona',
  'Colonização prévia com germe sensível somente a vancomicina',
  'Cultura preliminarmente positiva para Gram-positivo',
]

export const DURACAO_NF = [
  { texto: 'Foco definido: tempo conforme o sítio + neutrófilos > 500 céls./µL', pagina: 'p. 1072' },
  { texto: 'Sem foco e culturas negativas: afebril por pelo menos 48 h + neutrófilos > 500 céls./µL em ascensão', pagina: 'p. 1072' },
  { texto: 'Antifúngico empírico: febre persistente após 4-7 dias com neutropenia esperada > 7 dias', pagina: 'p. 1071–1072' },
]
