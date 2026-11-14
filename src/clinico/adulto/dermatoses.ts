import type { Ficha, Fonte } from '../ficha.ts'
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

// Revisão PubMed, itens médios (decisão do RT de 06/11/2026): o consenso
// Delphi internacional de DRESS (2024) entra como nota nos cuidados do
// RegiSCAR. O escore e a dose do livro não mudam.
export const DRESS_DELPHI_2024: Fonte = {
  citacao: 'Brüggen MC, Walsh S, Ameri MM, et al. Management of Adult Patients With Drug Reaction With Eosinophilia and Systemic Symptoms: A Delphi-Based International Consensus. JAMA Dermatol. 2024;160(1):37–44 (PMID 37966824).',
  url: 'https://doi.org/10.1001/jamadermatol.2023.4450',
}

export const NOTA_DRESS_DELPHI =
  'Consenso internacional Delphi (JAMA Dermatol 2024, posterior ao livro; 54 especialistas, consenso em 93 de 100 enunciados): propõe graduar a gravidade do DRESS em leve, moderada e grave pela extensão do acometimento hepático, renal e hematológico e pelo dano a outros órgãos, e orienta o manejo por grau, o seguimento após a fase aguda e a investigação alergológica. O livro usa TGO ou TGP 5 vezes acima ou outros órgãos como sinal de gravidade; a ferramenta segue o livro.'

const fichaRegiscarLivro = fichaAdulto('adulto-regiscar', 'RegiSCAR — escore para DRESS (adulto)', `${CAP}, p. 1281–1283 (Tabelas 3 e 4)`)

export const regiscar: Escore = {
  ficha: {
    ...fichaRegiscarLivro,
    versao: '2026-11-06.1',
    fontes: [...fichaRegiscarLivro.fontes, DRESS_DELPHI_2024],
    revisadoEm: '06/11/2026 (nota do consenso Delphi de DRESS 2024; revisão PubMed, itens médios)',
  },
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
        NOTA_DRESS_DELPHI,
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

const fichaDermatosesLivro = fichaAdulto('adulto-dermatoses-graves', 'Dermatoses graves — doses por peso (adulto)', `${CAP}, p. 1279–1292`)

// Lote 6 da revisão do HCFMUSP (Q2 = A, decisão do RT de 14/11/2026): diretriz
// latino-americana de SSJ/NET de 2025, lida no texto integral (PMC), ao lado do
// manual. Os graus são como a diretriz escreve (nível de evidência B, grau C ou D;
// a recomendação do tratamento sistêmico vem com força e certeza).
export const LATAM_SSJ_NET_2025: Fonte = {
  citacao: 'Murillo-Casas AD, Zwiener R, Giavina-Bianchi P, et al. Latin American guidelines for the diagnosis and treatment of Stevens-Johnson syndrome and toxic epidermal necrolysis. World Allergy Organ J. 2025;18(4):101046 (PMID 40226820; PMC11986972). Texto integral e tabela do tratamento sistêmico lidos no PMC.',
  url: 'https://doi.org/10.1016/j.waojou.2025.101046',
}

const SEM_ITEM_DERM = 'o cap. 96 não trata do ponto'

/** Diretriz latino-americana de SSJ/NET (2025) ao lado do cap. 96 do manual (Tabela 5, p. 1284–1285). */
export const DIRETRIZ_SSJ_NET_2025: { tema: string; diretriz: string; grau: string; fonte: string; livro: string }[] = [
  { tema: 'Droga suspeita', diretriz: 'Suspender já a droga responsável, o que melhora o prognóstico. Não suspender, na fase aguda, os medicamentos de uso crônico que não estão sob suspeita. ALDEN para identificar a droga', grau: 'nível de evidência B; ALDEN sem grau', fonte: 'Latino-americana 2025', livro: 'suspender a droga suspeita pelo ALDEN (Tabela 6); com anticonvulsivante, pedir à neurologia a troca (Tabela 5, p. 1284–1285)' },
  { tema: 'Gravidade e local de tratamento', diretriz: 'SCORTEN na admissão e de novo nos dias 1 e 3 (pode superestimar a mortalidade). Encaminhar a tempo a centro especializado, em UTI com experiência em queimados', grau: 'sem grau', fonte: 'Latino-americana 2025', livro: 'vaga de UTI com dois dos sete itens do SCORTEN (Tabela 5, p. 1284–1285)' },
  { tema: 'Tratamento sistêmico', diretriz: 'Corticoide sistêmico junto com imunoglobulina EV é sugerido. A diretriz diz que não há tratamento imunomodulador padronizado; biológico (etanercepte) sem base para uso de rotina. Não traz recomendação sobre ciclosporina', grau: 'condicional a favor; certeza muito baixa (consenso de especialistas)', fonte: 'Latino-americana 2025', livro: 'prednisona 1–2 mg/kg/dia por 3–5 dias, nas primeiras 48–72 horas; ciclosporina 3–5 mg/kg/dia (Tabela 5, p. 1285)' },
  { tema: 'Líquidos', diretriz: 'Titular para diurese de 0,5–1 mL/kg/h; considerar sonda vesical. O protocolo francês citado usa a fórmula de Brooke modificada nas primeiras 24 h: 1,5 mL × % da superfície acometida × peso em kg. Choque: tratar antes de calcular a manutenção', grau: 'grau D', fonte: 'Latino-americana 2025', livro: SEM_ITEM_DERM },
  { tema: 'Via aérea', diretriz: 'VNI contraindicada. Suspeitar de acometimento traqueobrônquico com tosse mucopurulenta, hemoptise, dispneia, hipoxemia ou alteração radiológica; a intubação pode ser difícil pelo acometimento da laringe', grau: 'grau D', fonte: 'Latino-americana 2025', livro: 'radiografia ou TC de tórax se houver sintoma respiratório (Tabela 5, p. 1284–1285)' },
  { tema: 'Pele', diretriz: 'Não remover a epiderme descolada, que serve de cobertura biológica. Desbridamento cirúrgico só se o tratamento conservador falhar, nunca de início. Sulfadiazina de prata e antibiótico tópico de rotina não são recomendados; antisséptico diário (por exemplo, clorexidina no banho)', grau: 'grau D', fonte: 'Latino-americana 2025', livro: 'curativos vaselinados e limpeza local (Tabela 5, p. 1284–1285)' },
  { tema: 'Olhos', diretriz: 'Avaliação oftalmológica nas primeiras 24 horas da fase aguda', grau: 'grau D', fonte: 'Latino-americana 2025', livro: 'avaliação multidisciplinar: oftalmologia, otorrino, gineco ou uro (Tabela 5, p. 1284–1285)' },
  { tema: 'Antibiótico', diretriz: 'Antibiótico profilático não é recomendado; antimicrobiano só com sinais de infecção', grau: 'grau D', fonte: 'Latino-americana 2025', livro: SEM_ITEM_DERM },
  { tema: 'Tromboprofilaxia', diretriz: 'Sugerida, salvo contraindicação', grau: 'grau D', fonte: 'Latino-americana 2025', livro: SEM_ITEM_DERM },
]

export const fichaDermatosesAdulto: Ficha = {
  ...fichaDermatosesLivro,
  versao: '2026-11-14.1',
  fontes: [...fichaDermatosesLivro.fontes, LATAM_SSJ_NET_2025],
  revisadoEm: '14/11/2026 (diretriz latino-americana de SSJ/NET 2025 ao lado do manual, no texto integral; lote 6 da revisão do HCFMUSP; aguarda aprovação do RT); 27/09/2026 (conferido no livro, com errata anotada)',
}

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
