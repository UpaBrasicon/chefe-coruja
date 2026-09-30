// ─────────────────────────────────────────────────────────────────────────────
// Cuidados de enfermagem — dados (separado dos componentes para o fast refresh
// do Vite). As regras de escrita estão na migration
// 20261005000005_cuidados_enfermagem.sql; a soma do balanço em
// src/clinico/enfermagem/balancoHidrico.ts; as etapas da SAE em
// src/clinico/enfermagem/sae.ts. Aqui só se lê e se pede.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import type { ItemSae } from '@/clinico/enfermagem/sae'
import { abrirProntuario } from '@/lib/prontuario'
import { supabase } from '@/lib/supabase'

// Lista do protótipo (DISPOSITIVOS_ENF), sem "Curativo", que tem aba própria.
// A mesma lista está na CHECK de dispositivos_enfermagem.
export const TIPOS_DISPOSITIVO = [
  'Acesso venoso periférico',
  'Cateter venoso central',
  'Sonda vesical de demora',
  'Sonda nasogástrica ou nasoenteral',
  'Dreno',
  'Traqueostomia',
] as const
export type TipoDispositivo = (typeof TIPOS_DISPOSITIVO)[number]

export type SaeVigente = {
  id: string; versao: number; avaliacao: string; diagnosticos: ItemSae[]; planejamento: ItemSae[]; implementacao: ItemSae[]
  evolucao: string; registrado_em: string; autor: string | null
}
export type Dispositivo = {
  id: string; tipo: TipoDispositivo; local: string; calibre: string; inserido_em: string; troca_prevista: string | null
  observacao: string; registrado_em: string; autor: string | null; dia: number
  retirado_em: string | null; retirado_por: string | null; motivo_retirada: string | null
}
export type LancamentoBh = {
  id: string; tipo: 'entrada' | 'saida'; descricao: string; volume_ml: number; aferido_em: string; autor: string | null
  cancelado_em: string | null; cancelado_por: string | null; motivo_cancelamento: string | null
}
export type Curativo = {
  id: string; local: string; tipo: string; aspecto: string; proxima_troca: string | null; observacao: string
  registrado_em: string; autor: string | null
}
export type AfericaoSv = { aferido_em: string; autor: string | null; valores: Record<string, number> }
export type Cuidados = {
  episodio_id: string | null
  internacao_id: string | null
  atendimento_aberto: boolean
  pode_registrar: boolean
  pode_sae: boolean
  sae: SaeVigente | null
  dispositivos: Dispositivo[]
  balanco: LancamentoBh[]
  curativos: Curativo[]
  sinais_vitais: AfericaoSv[]
}

export type Contexto = { pacienteId: string; episodioId?: string | null; internacaoId?: string | null }

export const chaveCuidados = (c: Contexto) => ['cuidados-enfermagem', c.pacienteId, c.episodioId ?? null, c.internacaoId ?? null] as const

export function useCuidados(c: Contexto) {
  return useQuery({
    queryKey: chaveCuidados(c),
    staleTime: 10_000,
    queryFn: async (): Promise<Cuidados> => {
      // a leitura do prontuário fica registrada, como nas outras abas
      await abrirProntuario(c.pacienteId, c.internacaoId)
      const { data, error } = await supabase.rpc('cuidados_enfermagem', {
        p_paciente: c.pacienteId, p_episodio: c.episodioId ?? undefined, p_internacao: c.internacaoId ?? undefined,
      })
      if (error) throw error
      return data as unknown as Cuidados
    },
  })
}

export function useRecarregarCuidados(c: Contexto) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['cuidados-enfermagem', c.pacienteId] })
    void qc.invalidateQueries({ queryKey: ['avaliacoes', c.pacienteId] })
  }
}

// ── executar uma RPC com erro e aviso na tela ───────────────────────────────
export const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

export type Executar = (fn: () => PromiseLike<{ error: unknown }>, ok: string) => Promise<boolean>
export function useExecutar(recarregar: () => void) {
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)
  const executar: Executar = async (fn, ok) => {
    setOcupado(true)
    try {
      const { error } = await fn()
      if (error) { setErro(msg(error)); setAviso(null); return false }
      setErro(null); setAviso(ok); recarregar(); return true
    } catch (e) {
      setErro(msg(e)); setAviso(null); return false
    } finally { setOcupado(false) }
  }
  return { erro, aviso, ocupado, executar }
}

// ── datas (fuso da unidade) ─────────────────────────────────────────────────
const FUSO = 'America/Sao_Paulo'
export const quando = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: FUSO }) : ''
export const hora = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })
/** 'AAAA-MM-DD' → 'DD/MM/AAAA' */
export const dataBr = (s: string | null | undefined) => (s ? s.split('-').reverse().join('/') : '')
export const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: FUSO })
/** Valor de <input type="datetime-local"> para agora, no fuso da unidade. */
export const agoraLocal = () => new Date().toLocaleString('sv-SE', { timeZone: FUSO }).slice(0, 16).replace(' ', 'T')
