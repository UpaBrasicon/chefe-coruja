// Tema da tela (guia do padrão do frontend, 1.4): claro, escuro ou automático,
// que segue o sistema do aparelho. A escolha é da pessoa e fica no perfil
// (perfis.tema); o aparelho guarda uma cópia para abrir já no tema certo.
//
// Decisão do RT "3a" (19/10/2026): o escuro fica pronto no código, mas a chave
// só aparece no fim da parte 4, quando as telas estiverem corrigidas. Até lá
// TEMA_ESCURO_LIBERADO é false e a tela fica sempre clara.

export type Tema = 'claro' | 'escuro' | 'automatico'

export const TEMA_ESCURO_LIBERADO = false

export const TEMAS: { valor: Tema; rotulo: string }[] = [
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
  { valor: 'automatico', rotulo: 'Automático' },
]

const CHAVE = 'cc-tema'
const CONSULTA_ESCURO = '(prefers-color-scheme: dark)'

export function ehTema(v: unknown): v is Tema {
  return v === 'claro' || v === 'escuro' || v === 'automatico'
}

/** O tema que a tela mostra para uma escolha (o automático pergunta ao sistema). */
export function temaEfetivo(escolha: Tema, sistemaEscuro: boolean, liberado = TEMA_ESCURO_LIBERADO): 'claro' | 'escuro' {
  if (!liberado) return 'claro'
  if (escolha === 'automatico') return sistemaEscuro ? 'escuro' : 'claro'
  return escolha
}

function sistemaEscuro() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(CONSULTA_ESCURO).matches
}

let escolhaAtual: Tema = 'automatico'

function pintar() {
  document.documentElement.dataset.tema = temaEfetivo(escolhaAtual, sistemaEscuro())
}

/** Aplica a escolha na tela e guarda a cópia no aparelho. */
export function aplicarTema(escolha: Tema) {
  escolhaAtual = escolha
  try {
    localStorage.setItem(CHAVE, escolha)
  } catch {
    /* sem localStorage: vale só nesta aba */
  }
  pintar()
}

/** A escolha guardada no aparelho (antes do perfil chegar). */
export function temaGuardado(): Tema {
  try {
    const v = localStorage.getItem(CHAVE)
    return ehTema(v) ? v : 'automatico'
  } catch {
    return 'automatico'
  }
}

/** Roda antes do React: pinta com a cópia do aparelho e acompanha o sistema. */
export function iniciarTema() {
  escolhaAtual = temaGuardado()
  pintar()
  if (typeof window.matchMedia === 'function') {
    window.matchMedia(CONSULTA_ESCURO).addEventListener('change', pintar)
  }
}
