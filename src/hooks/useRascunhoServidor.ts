import { useCallback, useEffect, useRef, useState } from 'react'

import { supabase } from '@/lib/supabase'
import type { TipoDocumentoPorta } from '@/lib/prontuario'

const ESPERA_MS = 3000

/**
 * Espelha no banco o rascunho de um documento (Fase 4.1). O aparelho continua
 * guardando o rascunho local; o do banco existe para a alta enxergar
 * "documento do PEP aberto" e para a emissão numerar exatamente o que foi
 * escrito. Só grava depois que o texto muda em relação ao que havia ao abrir
 * o paciente (abrir e fechar não deixa rascunho para trás). Sem conexão, não
 * faz nada: o rascunho local segue valendo.
 */
export function useRascunhoServidor(pacienteId: string | null | undefined, tipo: TipoDocumentoPorta, conteudo: string) {
  const [salvoEm, setSalvoEm] = useState<Date | null>(null)
  const base = useRef<string | null>(null)        // paciente cujo conteúdo inicial já foi visto
  const ultimoEnviado = useRef<string | null>(null)
  const idRef = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!pacienteId) {
      base.current = null
      return
    }
    if (base.current !== pacienteId) {
      base.current = pacienteId
      ultimoEnviado.current = conteudo
      idRef.current = null
      return
    }
    if (conteudo === ultimoEnviado.current) return
    timer.current = setTimeout(async () => {
      const enviar = (rascunho: string | null) =>
        supabase.rpc('salvar_rascunho', { p_paciente: pacienteId, p_tipo: tipo, p_conteudo: conteudo, p_rascunho: rascunho ?? undefined })
      let r = await enviar(idRef.current)
      if (r.error && /Rascunho não encontrado/.test(r.error.message)) r = await enviar(null)
      if (r.error) return // sem conexão ou sem acesso: o rascunho local continua
      ultimoEnviado.current = conteudo
      idRef.current = r.data as string
      setSalvoEm(new Date())
    }, ESPERA_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [pacienteId, tipo, conteudo])

  /** O rascunho do banco agora (para emitir exatamente ele). */
  const rascunhoId = useCallback(() => idRef.current, [])

  /**
   * Depois de emitir: o conteúdo atual já virou documento; não recriar
   * rascunho com ele NEM com o formulário limpo que vem logo depois (o
   * próximo conteúdo vira a nova referência, como ao abrir o paciente).
   */
  const emitido = useCallback((atual: string) => {
    if (timer.current) clearTimeout(timer.current)
    ultimoEnviado.current = atual
    idRef.current = null
    base.current = null
  }, [])

  /** "Limpar": o rascunho do banco é descartado (deixa de impedir a alta). */
  const descartar = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    const atual = idRef.current
    idRef.current = null
    base.current = null
    if (atual) await supabase.rpc('descartar_rascunho', { p_rascunho: atual })
  }, [])

  return { rascunhoId, salvoEm, emitido, descartar }
}
