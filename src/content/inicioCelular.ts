// Início do celular do médico (item 6 do BACKLOG; CM1 a CM8 = A, RT em
// 23/11/2026). O RT escolheu a mescla das opções A e B do protótipo: cartões
// grandes por tipo de conteúdo que, ao toque, abrem na própria tela uma grade
// de duas colunas com as ferramentas daquele grupo. Visual próprio, inspirado
// nas referências, sem copiar o app dos prints.
//
// Só entra o que já existe (CM5 = A). A categoria "Urgências" reaproveita os
// cartões do Guia rápido (com os guias de bolso e o cronômetro da parada); as
// outras listam as ferramentas mais usadas de cada tipo e terminam em "Ver
// todas", que abre a Central completa com a busca. Nenhuma dose muda: cada
// item abre a tela de sempre, com a ficha dela. O teste confere as rotas.

import { GUIA_ADULTO, GUIA_CRIANCA, ROTA_TODAS_FERRAMENTAS, cartaoDoGuia, type CartaoGuia } from './guiaRapido.ts'

export type LadoInicio = 'adulto' | 'crianca'

export type IconeCategoria = 'urgencias' | 'doses' | 'calculadoras' | 'escores' | 'intoxicacao' | 'todas'

/** Item da grade: abre uma tela da Central (rota) ou um guia do Guia rápido (?guia=). */
export type ItemInicio = { nome: string; sigla: string; rota: string }

export type CategoriaInicio = {
  id: string
  nome: string
  exemplos: string
  icone: IconeCategoria
  /** Sem itens: o cartão leva direto à rota (ex.: todas as ferramentas). */
  itens: ItemInicio[]
  rota?: string
}

const p = (slug: string) => `/plantonista/${slug}`

/** Sigla curta do cartão do Guia rápido, para o quadrado do item. */
const SIGLA_GUIA: Record<string, string> = {
  'Parada e reanimação': 'PCR',
  'Infusões e vasoativas': 'mL/h',
  'Via aérea e intubação': 'IOT',
  'Ventilação mecânica': 'VM',
  'Choque e volume': 'CH',
  Sepse: 'SP',
  'Dor torácica e SCA': 'SCA',
  'AVC e trombólise': 'AVC',
  'Crise epiléptica': 'CR',
  TEP: 'TEP',
  Sedação: 'SD',
  'Intoxicações e antídotos': 'TX',
  Anafilaxia: 'AN',
  'Cetoacidose e EHH': 'CAD',
  Dengue: 'DG',
  'Cuidados paliativos': 'CP',
  'Doses por classe': 'DS',
  'Via aérea': 'VA',
  Choque: 'CH',
  'Desidratação e diarreia': 'DH',
  Asma: 'AS',
  Bronquiolite: 'BQ',
  Intoxicações: 'TX',
}

/** Os cartões do Guia rápido como itens (o grupo abre no ?guia= de sempre). */
export const itemDoGuia = (c: CartaoGuia): ItemInicio => ({
  nome: c.nome,
  sigla: SIGLA_GUIA[c.nome] ?? c.nome.slice(0, 2).toUpperCase(),
  rota: 'rota' in c ? c.rota : `/plantonista?guia=${c.id}`,
})

const TODAS: CategoriaInicio = {
  id: 'todas', nome: 'Todas as ferramentas', exemplos: 'Busca, grupos e favoritos', icone: 'todas', itens: [], rota: ROTA_TODAS_FERRAMENTAS,
}

export const INICIO_ADULTO: CategoriaInicio[] = [
  { id: 'urgencias', nome: 'Urgências', exemplos: 'Parada, intubação, sepse, AVC', icone: 'urgencias', itens: GUIA_ADULTO.map(itemDoGuia) },
  {
    id: 'doses', nome: 'Diluições e doses', exemplos: 'Infusões, diluição, medicamentos', icone: 'doses',
    itens: [
      { nome: 'Infusões contínuas', sigla: 'mL/h', rota: p('calculadoras/infusoes-adulto') },
      { nome: 'Sequência rápida (IOT)', sigla: 'IOT', rota: p('calculadoras/iot') },
      { nome: 'Referência de diluição', sigla: 'DL', rota: p('farmacia/referencia-diluicao') },
      { nome: 'Consulta de medicamentos', sigla: 'MD', rota: p('farmacia/consulta-medicamentos') },
      { nome: 'Heparina EV e TTPa', sigla: 'HNF', rota: p('calculadoras/heparinizacao-venosa') },
    ],
  },
  {
    id: 'calculadoras', nome: 'Calculadoras', exemplos: 'Sepse, CAD, sódio, potássio', icone: 'calculadoras',
    itens: [
      { nome: 'Sepse', sigla: 'SP', rota: p('escores/sepse-adulto') },
      { nome: 'Cetoacidose e EHH', sigla: 'CAD', rota: p('emergencias/cad-ehh-tratamento') },
      { nome: 'Hiponatremia', sigla: 'Na', rota: p('calculadoras/hiponatremia') },
      { nome: 'Hipernatremia', sigla: 'Na', rota: p('calculadoras/hipernatremia') },
      { nome: 'Reposição de potássio', sigla: 'K', rota: p('emergencias/hipocalemia-reposicao-potassio') },
      { nome: 'Hiperpotassemia', sigla: 'K', rota: p('protocolos/hiperpotassemia') },
      { nome: 'Reposição de magnésio', sigla: 'Mg', rota: p('emergencias/hipomagnesemia-reposicao-magnesio') },
      { nome: 'Reposição de cálcio', sigla: 'Ca', rota: p('emergencias/hipocalcemia-reposicao-calcio') },
      { nome: 'Gasometria e ácido-base', sigla: 'pH', rota: p('emergencias/gasometria-acidobase') },
      { nome: 'QTc', sigla: 'QT', rota: p('calculadoras/qtc') },
      { nome: 'Função renal (CKD-EPI)', sigla: 'TFG', rota: p('escores/ckd-epi') },
      { nome: 'Cockcroft-Gault', sigla: 'ClCr', rota: p('escores/cockcroft-gault') },
    ],
  },
  {
    id: 'escores', nome: 'Escores', exemplos: 'HEART, NEWS2, Glasgow, Wells', icone: 'escores',
    itens: [
      { nome: 'HEART', sigla: 'HE', rota: p('escores/heart') },
      { nome: 'CHA₂DS₂-VA', sigla: 'CHA', rota: p('escores/cha2ds2-va') },
      { nome: 'NEWS2', sigla: 'NW', rota: p('escores/news2') },
      { nome: 'Glasgow', sigla: 'GCS', rota: p('escores/glasgow') },
      { nome: 'CURB-65', sigla: 'CU', rota: p('escores/curb-65') },
      { nome: 'Wells — TEP', sigla: 'WE', rota: p('escores/wells-tep') },
      { nome: 'SOFA-2', sigla: 'SO', rota: p('escores/sofa-2') },
      { nome: 'NIHSS', sigla: 'NIH', rota: p('escores/nih-avc') },
    ],
  },
  {
    id: 'intoxicacao', nome: 'Intoxicação', exemplos: 'Antídotos, peçonhentos, abstinência', icone: 'intoxicacao',
    itens: [
      { nome: 'Intoxicações e antídotos', sigla: 'TX', rota: p('emergencias/intoxicacoes-antidotos-adulto') },
      { nome: 'Animais peçonhentos', sigla: 'AP', rota: p('emergencias/animais-peconhentos-adulto') },
      { nome: 'Abstinência alcoólica', sigla: 'AB', rota: p('protocolos/abstinencia') },
    ],
  },
  TODAS,
]

export const INICIO_CRIANCA: CategoriaInicio[] = [
  { id: 'urgencias', nome: 'Urgências', exemplos: 'Parada, via aérea, crise, anafilaxia', icone: 'urgencias', itens: GUIA_CRIANCA.map(itemDoGuia) },
  {
    id: 'doses', nome: 'Diluições e doses', exemplos: 'Doses por peso, infusões, sedação', icone: 'doses',
    itens: [
      { nome: 'Doses por peso', sigla: 'DS', rota: p('pediatria/bolus') },
      { nome: 'Infusões contínuas', sigla: 'mL/h', rota: p('pediatria/infusoes') },
      { nome: 'Sedação para procedimento', sigla: 'SD', rota: p('pediatria/sedacao-procedimento-ped') },
    ],
  },
  {
    id: 'calculadoras', nome: 'Calculadoras', exemplos: 'Sepse, CAD, hidratação, sódio', icone: 'calculadoras',
    itens: [
      { nome: 'Sepse (Phoenix)', sigla: 'SP', rota: p('pediatria/phoenix') },
      { nome: 'Cetoacidose e EHH', sigla: 'CAD', rota: p('pediatria/cad-ehh-ped') },
      { nome: 'Hidratação de manutenção', sigla: 'HM', rota: p('pediatria/fluidoterapia-manutencao-ped') },
      { nome: 'Sódio', sigla: 'Na', rota: p('pediatria/sodio-ped') },
      { nome: 'Eletrólitos', sigla: 'K', rota: p('pediatria/eletrolitos-ped') },
      { nome: 'Ácido-base', sigla: 'pH', rota: p('pediatria/acidobase-ped') },
      { nome: 'TFG (Schwartz)', sigla: 'TFG', rota: p('pediatria/tfg-schwartz-ped') },
      { nome: 'Sinais vitais por idade', sigla: 'SV', rota: p('pediatria/sinais-vitais-pediatricos') },
    ],
  },
  {
    id: 'escores', nome: 'Escores', exemplos: 'Glasgow, PRAM, Phoenix, PECARN', icone: 'escores',
    itens: [
      { nome: 'Glasgow pediátrico', sigla: 'GCS', rota: p('pediatria/glasgow-pediatrico') },
      { nome: 'PRAM', sigla: 'PR', rota: p('pediatria/pram') },
      { nome: 'Phoenix', sigla: 'PH', rota: p('pediatria/phoenix') },
      { nome: 'PEWS', sigla: 'PW', rota: p('pediatria/pews') },
      { nome: 'POPS', sigla: 'PO', rota: p('pediatria/pops') },
      { nome: 'PECARN até 2 anos', sigla: 'PE', rota: p('pediatria/pecarn-menor-2-anos') },
      { nome: 'PECARN 2 anos ou mais', sigla: 'PE', rota: p('pediatria/pecarn-2-anos-ou-mais') },
      { nome: 'TWIST', sigla: 'TW', rota: p('pediatria/twist-ped') },
    ],
  },
  {
    id: 'intoxicacao', nome: 'Intoxicação', exemplos: 'Antídotos, escorpião e aranhas', icone: 'intoxicacao',
    itens: [
      { nome: 'Intoxicações', sigla: 'TX', rota: p('pediatria/intoxicacoes-ped') },
      { nome: 'Escorpião e aranhas', sigla: 'EA', rota: p('pediatria/escorpiao-aranhas-ped') },
    ],
  },
  TODAS,
]

/** "Iniciar PCR" (CM3 = A), em bloco inteiro acima dos cartões. Sepse e CAD saíram do
 *  topo e ficam nas categorias (RT, 23/11/2026, conferindo o lote 1 na homologação). */
export const ROTA_PCR: Record<LadoInicio, string> = {
  adulto: '/plantonista?guia=parada-adulto',
  crianca: '/plantonista?guia=parada-crianca',
}

export const categoriasDoInicio = (lado: LadoInicio) => (lado === 'crianca' ? INICIO_CRIANCA : INICIO_ADULTO)

/**
 * Chave de favorito (`secao/slug`, a mesma da Central completa) de um item do
 * início. O guia de bolso favorita a ferramenta completa dele (ex.: parada do
 * adulto = emergencias/pcr-adulto). Sem ferramenta, sem favorito.
 */
export function chaveDoItem(rota: string): string | null {
  const guia = /^\/plantonista\?guia=([\w-]+)$/.exec(rota)
  const alvo = guia ? cartaoDoGuia(guia[1])?.itens[0]?.rota : rota
  const m = alvo ? /^\/plantonista\/([\w-]+)\/([\w-]+)$/.exec(alvo) : null
  return m ? `${m[1]}/${m[2]}` : null
}

/** A busca do início abre a Central completa já com o texto digitado. */
export const rotaDaBusca = (texto: string) =>
  texto.trim() ? `${ROTA_TODAS_FERRAMENTAS}&q=${encodeURIComponent(texto.trim())}` : ROTA_TODAS_FERRAMENTAS
