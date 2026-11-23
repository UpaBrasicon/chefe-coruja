import { useEffect, useRef } from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'

// Fase 1, item 14 (PH1 a PH3 = A do RT, 23/11/2026; docs/frontend/POSTHOG-DIAGNOSTICO.md):
// uso do app contado no próprio banco, por dia, unidade, papel e evento, sem
// pessoa e sem paciente (migration 20270415000038). A entrada no app vem dos
// registros de acesso do LG9, não daqui.

export type EventoUso = 'central_aba' | 'ferramenta' | 'censo'

/** Detalhe aceito pelo banco: vazio, `slug` ou `secao/slug` (nada de texto livre). */
export const DETALHE_USO = /^([a-z0-9-]{1,80}(\/[a-z0-9-]{1,120})?)?$/

/**
 * Conta +1 no dia quando a tela abre (ou o detalhe muda). `null` = ainda não
 * sabe o detalhe, não conta. Falha em silêncio: um evento perdido não pode
 * atrapalhar o trabalho.
 */
export function useRegistrarUsoApp(evento: EventoUso, detalhe: string | null = '') {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidade = unidadeAtiva?.unidade_id ?? null
  const ultimo = useRef<string | null>(null)
  useEffect(() => {
    if (detalhe === null || !unidade || !papelAtivo || !DETALHE_USO.test(detalhe)) return
    const k = `${unidade}|${papelAtivo}|${evento}|${detalhe}`
    if (ultimo.current === k) return
    ultimo.current = k
    supabase
      .rpc('registrar_uso_app', { p_unidade: unidade, p_papel: papelAtivo, p_evento: evento, p_detalhe: detalhe })
      .then(
        () => undefined,
        () => undefined,
      )
  }, [unidade, papelAtivo, evento, detalhe])
}
