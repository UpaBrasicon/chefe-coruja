import type { Ficha, Fonte } from '../ficha.ts'
import { WELLS_PESO_2017 } from './bolus.ts'

// Fita de Broselow no Guia rápido da criança (pedido do RT de 17/11/2026: peso e cor
// da fita no topo da criança). Decisões do RT: peso e altura da fita 2017
// pelo PubMed (Oommen 2021, Tabela 5); idade aproximada pelo e-book Fita PED
// (Grupo MOVER, 2021), que o RT enviou; ao escolher a cor, o peso vai para o
// campo pelo MEIO da faixa, escrito para o médico entender ("6–7 kg → 6,5 kg"),
// com selo e editável. Pesar é melhor: a fita erra mais nas crianças maiores.

export const OOMMEN_BROSELOW_2021: Fonte = {
  citacao:
    'Oommen JZ, Hodgins M, Hinojosa R, et al. Accuracy of Weight Estimation Using the Broselow Tape in a Peruvian Pediatric Population. Cureus. 2021;13(6):e15807 (PMID 34306874, PMC8294604). Tabela 5: altura e peso por cor da fita Broselow, edição 2017-A; erro dentro de 10% em 62,8%, maior nas cores de criança maior.',
  url: 'https://doi.org/10.7759/cureus.15807',
  pediatrica: true,
}

export const FITA_PED_MOVER_2021: Fonte = {
  citacao:
    'Fita PED — Emergências Pediátricas. Grupo MOVER, Editora Ponto, 1ª edição, janeiro de 2021 (e-book enviado pelo RT): idade aproximada de cada cor.',
  pediatrica: true,
}

export const fichaFitaBroselow: Ficha = {
  id: 'ped-fita-broselow',
  titulo: 'Fita de Broselow — cor, altura, peso e idade (Guia rápido)',
  versao: '2026-11-17.1',
  publico: 'pediatrico',
  fontes: [OOMMEN_BROSELOW_2021, FITA_PED_MOVER_2021, WELLS_PESO_2017],
  revisadoEm: '17/11/2026 (tabela da fita 2017 pelo PubMed e idade pelo e-book, decisões do RT de 17/11/2026; aguarda aprovação do RT)',
}

export type CorBroselow = {
  id: 'cinza' | 'rosa' | 'vermelho' | 'roxo' | 'amarelo' | 'branco' | 'azul' | 'laranja' | 'verde'
  nome: string
  /** altura deitada, cm (Oommen 2021, Tabela 5) */
  alturaCm: [number, number]
  /** peso da faixa, kg (Oommen 2021, Tabela 5) */
  pesoKg: [number, number]
  /** idade aproximada (e-book Fita PED, 2021) */
  idade: string
  /** cor da faixa na tela (amostra visual da fita) */
  amostra: string
}

export const CORES_BROSELOW: CorBroselow[] = [
  { id: 'cinza', nome: 'Cinza', alturaCm: [46.6, 59], pesoKg: [3, 5], idade: 'RN a 4 meses', amostra: '#9CA3AF' }, // padrao-ok: cor da fita física de Broselow
  { id: 'rosa', nome: 'Rosa', alturaCm: [59, 66.7], pesoKg: [6, 7], idade: '4 a 6 meses', amostra: '#EC4899' }, // padrao-ok: cor da fita física de Broselow
  { id: 'vermelho', nome: 'Vermelho', alturaCm: [66.7, 74], pesoKg: [8, 9], idade: '6 a 12 meses', amostra: '#DC2626' }, // padrao-ok: cor da fita física de Broselow
  { id: 'roxo', nome: 'Roxo', alturaCm: [74, 83.6], pesoKg: [10, 11], idade: '1 ano', amostra: '#7C3AED' }, // padrao-ok: cor da fita física de Broselow
  { id: 'amarelo', nome: 'Amarelo', alturaCm: [83.6, 95.2], pesoKg: [12, 14], idade: '2 anos', amostra: '#FACC15' }, // padrao-ok: cor da fita física de Broselow
  { id: 'branco', nome: 'Branco', alturaCm: [95.2, 108], pesoKg: [15, 18], idade: '3 a 4 anos', amostra: '#FFFFFF' }, // padrao-ok: cor da fita física de Broselow
  { id: 'azul', nome: 'Azul', alturaCm: [108, 121.2], pesoKg: [19, 22], idade: '5 a 6 anos', amostra: '#2563EB' }, // padrao-ok: cor da fita física de Broselow
  { id: 'laranja', nome: 'Laranja', alturaCm: [121.2, 130.4], pesoKg: [24, 28], idade: '7 a 9 anos', amostra: '#F97316' }, // padrao-ok: cor da fita física de Broselow
  { id: 'verde', nome: 'Verde', alturaCm: [130.4, 143.3], pesoKg: [30, 36], idade: '10 a 11 anos', amostra: '#16A34A' }, // padrao-ok: cor da fita física de Broselow
]

const br = (n: number) => String(n).replace('.', ',')

/** Peso que vai para o campo: o meio da faixa (decisão do RT). */
export const pesoDaCor = (c: CorBroselow) => (c.pesoKg[0] + c.pesoKg[1]) / 2

/** "6–7 kg → 6,5 kg" */
export const rotuloPesoDaCor = (c: CorBroselow) => `${c.pesoKg[0]}–${c.pesoKg[1]} kg → ${br(pesoDaCor(c))} kg`

/** "59–66,7 cm · 4 a 6 meses" */
export const rotuloAlturaIdade = (c: CorBroselow) => `${br(c.alturaCm[0])}–${br(c.alturaCm[1])} cm · ${c.idade}`

export const AVISO_FITA =
  'Pese sempre que der. A fita estima o peso pela altura e erra mais nas crianças maiores: dentro de 10% do peso real em 62,8% (Oommen 2021) e 55,6% (Wells 2017).'
