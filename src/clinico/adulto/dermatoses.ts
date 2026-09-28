import { completo, escolha, somar, type Escore, type Item } from '../escore.ts'
import { fichaAdulto } from './fonte.ts'

// Dermatoses graves — cap. 96 do Manual de Medicina de Emergência do HCFMUSP
// (3ª ed., 2022), p. 1277–1294. RegiSCAR (Tabela 4), os itens do SCORTEN que
// o livro usa como critério de vaga de UTI (p. 1285) e as doses por peso. O
// ALDEN (Tabela 6) não é implementado: o livro não traz a tabela que
// interpreta o escore final. O livro não traz a pontuação nem a mortalidade do
// SCORTEN, só a regra "dois dos seguintes".

const CAP = 'cap. 96 Dermatoses graves'

export type Faixa = [number, number]
const valido = (x: number) => Number.isFinite(x) && x > 0

// RegiSCAR (Tabela 4, p. 1282–1283)

const it = (id: string, rotulo: string, ausente: number, presente: number): Item => ({
  tipo: 'escolha', id, rotulo, opcoes: [{ rotulo: `Ausente — ${ausente}`, valor: ausente }, { rotulo: `Presente — ${presente}`, valor: presente }],
})

export function faixaRegiscar(total: number): string {
  if (total < 2) return 'exclui o diagnóstico'
  if (total <= 3) return 'diagnóstico possível'
  if (total <= 5) return 'diagnóstico provável'
  return 'diagnóstico definitivo'
}

export const regiscar: Escore = {
  ficha: fichaAdulto('adulto-regiscar', 'RegiSCAR — escore para DRESS (adulto)', `${CAP}, p. 1281–1283 (Tabelas 3 e 4)`),
  descricao: 'Escore RegiSCAR da Tabela 4 do manual do HC: < 2 exclui, 2-3 possível, 4-5 provável, > 5 definitivo.',
  itens: [
    it('febre', 'Febre (> 38,5 ºC)', -1, 0),
    it('linfonodos', 'Linfonodomegalias (≥ 2 locais, > 1 cm)', 0, 1),
    it('linfocitos', 'Linfócitos atípicos', 0, 1),
    { tipo: 'escolha', id: 'eosinofilia', rotulo: 'Eosinofilia', opcoes: [
      { rotulo: 'Ausente — 0', valor: 0 },
      { rotulo: '700-1.499 ou 10-19,9% — 1', valor: 1 },
      { rotulo: '≥ 1.500 ou ≥ 20% — 2', valor: 2 },
    ] },
    it('extensao', 'Rash: extensão > 50%', 0, 1),
    it('morfologia', 'Rash: pelo menos 2 de edema, púrpura, infiltração ou descamação', -1, 1),
    it('biopsia', 'Rash: biópsia sugestiva de DRESS', -1, 0),
    { tipo: 'escolha', id: 'orgaos', rotulo: 'Envolvimento de órgãos internos', opcoes: [
      { rotulo: 'Nenhum — 0', valor: 0 }, { rotulo: 'Um — 1', valor: 1 }, { rotulo: 'Dois ou mais — 2', valor: 2 },
    ] },
    it('resolucao', 'Resolução > 15 dias', -1, 0),
    it('exames', '3 exames que excluem outros diagnósticos', 0, 1),
  ],
  calcular(r) {
    if (!completo(regiscar, r)) return null
    const total = somar(regiscar, r)
    return {
      rotulo: 'RegiSCAR',
      valor: String(total),
      unidade: 'de −4 a 9',
      nota: faixaRegiscar(total),
      estado: total > 5 ? 2 : total >= 2 ? 1 : 0,
      derivados: [['Faixas da Tabela 4 (p. 1283)', '< 2 exclui; 2-3 possível; 4-5 provável; > 5 definitivo']],
      cuidados: [
        'DRESS: latência média de 2 a 8 semanas; mortalidade de 10-20% (p. 1281).',
        'Sinais de gravidade (TGO ou TGP 5 × acima ou outros órgãos): prednisona 1 mg/kg/d até normalizar os exames e por 6-8 semanas depois (p. 1282).',
        'A tabela do livro não tem a opção "desconhecido" do escore original; a ferramenta segue o livro.',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// Itens do SCORTEN usados como critério de UTI (p. 1285)

const ITENS_UTI = [
  ['idade', 'Idade > 40 anos'],
  ['malignidade', 'Presença de malignidade'],
  ['fc', 'Frequência cardíaca > 120 bpm'],
  ['descolamento', 'Descolamento > 10% na admissão'],
  ['bun', 'BUN > 28 mg/dL'],
  ['glicose', 'Glicose sérica > 252 mg/dL'],
  ['bicarbonato', 'Bicarbonato < 20 mmol/L (o livro escreve "mm/L")'],
] as const

export const scortenUti: Escore = {
  ficha: fichaAdulto('adulto-scorten-uti', 'SSJ/NET — itens do SCORTEN para vaga de UTI (adulto)', `${CAP}, p. 1283–1285 (Tabela 5)`),
  descricao: 'Sete itens do SCORTEN que o manual do HC usa na síndrome de Stevens-Johnson / necrólise epidérmica tóxica: dois ou mais, solicitar vaga de UTI.',
  itens: ITENS_UTI.map(([id, rotulo]) => ({ tipo: 'escolha' as const, id, rotulo, opcoes: [{ rotulo: 'Não', valor: 0 }, { rotulo: 'Sim', valor: 1 }] })),
  calcular(r) {
    if (!completo(scortenUti, r)) return null
    const presentes = ITENS_UTI.filter(([id]) => escolha(scortenUti, r, id)?.valor === 1).map(([, rotulo]) => rotulo)
    const n = presentes.length
    return {
      rotulo: 'Itens do SCORTEN',
      valor: String(n),
      unidade: 'de 7',
      nota: n >= 2 ? '≥ 2 itens: critério do livro para solicitar vaga de UTI' : 'Menos de 2 itens',
      estado: n >= 2 ? 2 : n === 1 ? 1 : 0,
      derivados: n ? [['Itens presentes', presentes.join('; ')]] : [],
      cuidados: [
        'O livro usa os itens do SCORTEN só como regra de UTI ("dois dos seguintes"); não traz a pontuação nem a mortalidade do SCORTEN, e a ferramenta não as mostra.',
        'Extensão: SSJ < 10%; sobreposição 10-30%; NET > 30% da área corpórea (p. 1284).',
        'Sem referência pediátrica declarada.',
      ],
    }
  },
}

// Doses do capítulo (p. 1279–1292)

export const fichaDermatosesAdulto = fichaAdulto('adulto-dermatoses-graves', 'Dermatoses graves — doses por peso (adulto)', `${CAP}, p. 1279–1292`)

export const DOSES_DERMATOSES = {
  ssjNetPrednisona: { mgKgDia: [1, 2] as Faixa, texto: 'Prednisona 1-2 mg/kg/d por 3-5 dias, iniciada nas primeiras 48-72 h', pagina: 'p. 1285' },
  ssjNetCiclosporina: { mgKgDia: [3, 5] as Faixa, texto: 'Ciclosporina 3-5 mg/kg/d, monitorizando função renal, PA e ciclosporinemia', pagina: 'p. 1285' },
  dressPrednisona: { mgKgDia: [1, 1] as Faixa, texto: 'Prednisona 1 mg/kg/d com sinais de gravidade', pagina: 'p. 1282' },
}

export type ContaDermatoses = { ssjNetPrednisonaMg: Faixa; ssjNetCiclosporinaMg: Faixa; dressPrednisonaMg: number }

export function dosesDermatoses(pesoKg: number): ContaDermatoses | null {
  if (!valido(pesoKg)) return null
  const d = DOSES_DERMATOSES
  return {
    ssjNetPrednisonaMg: [d.ssjNetPrednisona.mgKgDia[0] * pesoKg, d.ssjNetPrednisona.mgKgDia[1] * pesoKg],
    ssjNetCiclosporinaMg: [d.ssjNetCiclosporina.mgKgDia[0] * pesoKg, d.ssjNetCiclosporina.mgKgDia[1] * pesoKg],
    dressPrednisonaMg: d.dressPrednisona.mgKgDia[0] * pesoKg,
  }
}

export const DOSES_FIXAS_DERMATOSES = [
  { nome: 'Exantema máculo-papular', texto: 'Loratadina 10 mg/d; corticoides tópicos', pagina: 'p. 1279' },
  { nome: 'Urticária/angioedema', texto: 'Loratadina 10 mg/d + hidroxizine 25-50 mg/d à noite; anti-H2 se muito sintomático; angioedema: prednisona 20-60 mg/d por 7 dias; manter anti-histamínico por ≥ 2 semanas', pagina: 'p. 1280' },
  { nome: 'Herpes-zóster', texto: 'Aciclovir 800 mg 5 x/d por 7 dias ou valaciclovir 1 g 8/8 h por 7 dias (nas primeiras 72 horas)', pagina: 'p. 1291' },
  { nome: 'Erisipela', texto: 'Ambulatorial: cefalexina 1 g 6/6 h ou amoxicilina 1 g 8/8 h por 7 dias; internado: cefazolina 1 g EV 8/8 h ou ceftriaxona 1 g EV 12/12 h por 7-14 dias', pagina: 'p. 1292' },
  { nome: 'Celulite', texto: 'Ambulatorial: cefalexina 1 g 6/6 h por 7 dias; internado: oxacilina 2 g EV 4/4 h por 7 dias', pagina: 'p. 1292' },
]

export const ERRATA_DERMATOSES = [
  'p. 1291 — aciclovir EV "10 mg/kg/d de 8/8 horas": o texto não deixa claro se 10 mg/kg é por dose ou por dia. A ferramenta não calcula essa linha.',
  'p. 1285 — bicarbonato "< 20 mm/L": a unidade é mmol/L (ou mEq/L).',
  'p. 1282 — "TGO ou TGP ↑ 5 x" sem dizer em relação a quê (presumivelmente o limite superior).',
  'p. 1288 — ALDEN sem a tabela de interpretação do escore final (faixas de causalidade): não implementado.',
]
