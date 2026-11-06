// Favoritos de prescrição na porta (achado guardado de 07/10/2026; decisão do
// RT em 06/11/2026: A em G1 a G5; docs/porta/FAVORITOS-PRESCRICAO-PORTA-DIAGNOSTICO.md).
//
// O favorito (preferencias_prescricao, escrito pelo próprio médico) só PREENCHE
// o "Novo item" da porta (G2): o médico confere e clica em Prescrever. Nada é
// sugerido pelo sistema; o que o favorito não diz com clareza fica em branco.

import { FREQUENCIAS_PORTA, OUTRA, frequenciaPortaReconhecida, intervaloDaPosologia } from './frequenciaPorta.ts'

export type FavoritoParaPorta = { medicamento_id: string; dose: string | null; via: string | null; posologia: string | null }
export type QuandoPorta = (typeof FREQUENCIAS_PORTA)[number] | typeof OUTRA
export type ViaPorta = string | { v: string; rotulo: string }

export type NovoItemDoFavorito = {
  medicamentoId: string
  dose: string
  /** Via da porta marcada, ou null (o médico escolhe). */
  via: string | null
  /** Via escrita no favorito que não é uma das da porta: só aparece como lembrete (G4). */
  viaLembrete: string | null
  /** Chip do "Quando", "Outra" (com outraTexto) ou null: em branco, o médico escolhe (G3). */
  quando: QuandoPorta | null
  outraTexto: string
}

/** Sem caixa, sem acento, espaços simples. */
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// Frequência "pura": o texto inteiro é só a frequência, numa das formas que o
// servidor lê (private.intervalo_posologia). Qualquer palavra a mais ("1 cp",
// "por 5 dias", "se dor") faz do texto uma instrução de receita, que a porta
// não aceita como está: o "Quando" fica em branco para o médico (G3).
const UNIDADE = '(h|hs|hora|horas)'
const INTERVALO_PURO = [
  new RegExp(`^(\\d{1,2}) ?/ ?(\\d{1,2}) ?${UNIDADE}$`),
  new RegExp(`^de (\\d{1,2}) em (\\d{1,2}) ?${UNIDADE}$`),
  new RegExp(`^a cada (\\d{1,2}) ?${UNIDADE}$`),
]
const VEZES_AO_DIA_PURO = [
  /^\d{1,2} ?(x|vez|vezes) ?(ao|por|\/|a)? ?dia$/,
  /^(uma|duas|tres|quatro) vezes (ao|por) dia$/,
]

/**
 * O "Quando" da porta a partir da posologia do favorito (G3).
 * - "Agora" e "Se necessário" marcam os chips.
 * - Intervalo puro ("8/8h", "de 6 em 6 h", "a cada 6 horas") de 4, 6, 8, 12
 *   ou 24 horas marca o chip "N/Nh".
 * - Outra frequência pura que o servidor entende ("3x ao dia", "a cada 2
 *   horas", "Contínuo") vai em "Outra" com o texto do favorito.
 * - Qualquer outra coisa (texto de receita como "1 cp de 8/8h por 5 dias, se
 *   dor", intervalo que o servidor não lê, vazio) deixa o "Quando" em branco.
 */
export function quandoDoFavorito(posologia: string | null | undefined): { quando: QuandoPorta | null; outraTexto: string } {
  const original = (posologia ?? '').trim().replace(/\.$/, '').trim()
  const t = plano(original)
  const branco = { quando: null, outraTexto: '' }
  if (!t) return branco
  if (t === 'agora') return { quando: 'Agora', outraTexto: '' }
  if (t === 'se necessario') return { quando: 'Se necessário', outraTexto: '' }
  if (t === 'continuo') return { quando: OUTRA, outraTexto: original }
  const puro = INTERVALO_PURO.some((r) => r.test(t)) || VEZES_AO_DIA_PURO.some((r) => r.test(t))
  if (!puro || !frequenciaPortaReconhecida(t, false)) return branco
  const n = intervaloDaPosologia(t)
  const chip = `${n}/${n}h`
  if (INTERVALO_PURO.some((r) => r.test(t)) && (FREQUENCIAS_PORTA as readonly string[]).includes(chip)) {
    return { quando: chip as QuandoPorta, outraTexto: '' }
  }
  return { quando: OUTRA, outraTexto: original }
}

/**
 * A via do favorito (G4): marcada só se for uma das vias da porta (sem caixa
 * nem acento, pelo valor ou pelo rótulo do chip). Fora delas, nada é traduzido
 * (IV não vira EV): a via escrita aparece como lembrete e o médico escolhe.
 */
export function viaDoFavorito(via: string | null | undefined, viasPorta: readonly ViaPorta[]): { via: string | null; viaLembrete: string | null } {
  const escrita = (via ?? '').trim()
  if (!escrita) return { via: null, viaLembrete: null }
  const t = plano(escrita)
  for (const v of viasPorta) {
    const valor = typeof v === 'string' ? v : v.v
    const rotulo = typeof v === 'string' ? v : v.rotulo
    if (plano(valor) === t || plano(rotulo) === t) return { via: valor, viaLembrete: null }
  }
  return { via: null, viaLembrete: escrita }
}

/** O "Novo item" da porta preenchido com o favorito (G2 a G4). */
export function deFavoritoParaPorta(fav: FavoritoParaPorta, viasPorta: readonly ViaPorta[]): NovoItemDoFavorito {
  return {
    medicamentoId: fav.medicamento_id,
    dose: (fav.dose ?? '').trim(),
    ...viaDoFavorito(fav.via, viasPorta),
    ...quandoDoFavorito(fav.posologia),
  }
}
