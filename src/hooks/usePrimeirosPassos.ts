// Progresso dos primeiros passos no aparelho (OB4 = A do RT, 23/11/2026),
// separado por pessoa e papel. O menu do usuário reabre o cartão pelo evento
// `cc-primeiros-passos`. Sem armazenamento, o cartão aparece e o progresso
// vale só na memória desta aba.
import * as React from 'react'

import { chaveProgresso, lerProgresso, type Progresso } from '@/domain/primeirosPassos'

const EVENTO = 'cc-primeiros-passos'
const memoria = new Map<string, string>()

function lerTexto(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave)
  } catch {
    return memoria.get(chave) ?? null
  }
}

function gravar(chave: string, p: Progresso) {
  const texto = JSON.stringify(p)
  memoria.set(chave, texto)
  try {
    window.localStorage.setItem(chave, texto)
  } catch {
    // sem armazenamento: fica na memória desta aba
  }
  window.dispatchEvent(new Event(EVENTO))
}

function assinar(aviso: () => void) {
  window.addEventListener(EVENTO, aviso)
  window.addEventListener('storage', aviso)
  return () => {
    window.removeEventListener(EVENTO, aviso)
    window.removeEventListener('storage', aviso)
  }
}

/** Reabre o cartão do papel (menu do usuário, "Primeiros passos"). */
export function reabrirPrimeirosPassos(perfilId: string, papel: string) {
  gravar(chaveProgresso(perfilId, papel), { feitos: [], escondido: false })
}

export function usePrimeirosPassos(perfilId: string | undefined, papel: string | null | undefined) {
  const chave = perfilId && papel ? chaveProgresso(perfilId, papel) : null
  const texto = React.useSyncExternalStore(assinar, () => (chave ? lerTexto(chave) : null), () => null)
  const progresso = lerProgresso(texto)
  const marcar = (id: string) => {
    if (chave && !progresso.feitos.includes(id)) gravar(chave, { ...progresso, feitos: [...progresso.feitos, id] })
  }
  const esconder = () => { if (chave) gravar(chave, { ...progresso, escondido: true }) }
  // EN3: a primeira visita marca o cartão como visto; nas próximas ele abre recolhido
  const marcarVisto = () => { if (chave && !progresso.visto) gravar(chave, { ...progresso, visto: true }) }
  return { progresso, marcar, esconder, marcarVisto }
}
