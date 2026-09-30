import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

// Dados das telas do administrador (Rede, Plataformas, Pendências técnicas,
// Servidores; migration 20261008000001). Tudo vem do banco: nada de unidade,
// chamado ou serviço fixo no código, como era no protótipo.

export type UnidadeRede = {
  unidade_id: string
  nome: string
  tipo: string
  municipio: string | null
  uf: string | null
  /** Contagens de paciente: 1 a 4 chegam nulas (supressão, ADR 0002). */
  leitos: number | null
  leitos_ocupados: number | null
  taxa_ocupacao: number | null
  em_plantao: number
  sessoes_ativas: number
  ultimo_uso: string | null
  chamados_abertos: number
  chamados_alta: number
  rnds_pendentes: number
  rnds_erro: number
  rnds_mais_antigo: string | null
}

export type ChamadoTecnico = {
  id: string
  unidade_id: string | null
  unidade_nome: string | null
  titulo: string
  descricao: string | null
  categoria: Categoria
  severidade: Severidade
  responsavel: string | null
  situacao: Situacao
  aberto_por: string | null
  aberto_em: string
  atualizado_em: string
  resolvido_em: string | null
}

export type Categoria = 'servidor' | 'aplicativo' | 'integracao' | 'seguranca'
export type Severidade = 'alta' | 'media' | 'baixa'
export type Situacao = 'aberto' | 'em_atendimento' | 'aguardando_unidade' | 'planejado' | 'resolvido'

export const CATEGORIA: Record<Categoria, string> = { servidor: 'Servidor', aplicativo: 'Aplicativo', integracao: 'Integração', seguranca: 'Segurança' }
export const SEVERIDADE: Record<Severidade, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }
export const SITUACAO: Record<Situacao, string> = {
  aberto: 'Aberto',
  em_atendimento: 'Em atendimento',
  aguardando_unidade: 'Aguardando unidade',
  planejado: 'Planejado',
  resolvido: 'Resolvido',
}

/** Estado de uma unidade: 0 estável, 1 atenção, 2 crítico. */
export type Estado = 0 | 1 | 2

const DIA_MS = 24 * 60 * 60 * 1000

/**
 * O que faz uma unidade pedir atenção, só com o que o banco sabe: chamado
 * técnico aberto (alta = crítico) e a fila da RNDS (erro = crítico; envio
 * pendente há mais de 24 horas = atenção).
 */
export function avaliarUnidade(u: UnidadeRede, agora = Date.now()): { estado: Estado; motivos: string[] } {
  const motivos: string[] = []
  let estado: Estado = 0
  const subir = (e: Estado) => { if (e > estado) estado = e }
  if (u.chamados_alta > 0) {
    subir(2)
    motivos.push(u.chamados_alta === 1 ? '1 chamado de severidade alta' : `${u.chamados_alta} chamados de severidade alta`)
  }
  const outros = u.chamados_abertos - u.chamados_alta
  if (outros > 0) {
    subir(1)
    motivos.push(outros === 1 ? '1 chamado aberto' : `${outros} chamados abertos`)
  }
  if (u.rnds_erro > 0) {
    subir(2)
    motivos.push(u.rnds_erro === 1 ? '1 envio à RNDS com erro' : `${u.rnds_erro} envios à RNDS com erro`)
  } else if (u.rnds_mais_antigo && agora - new Date(u.rnds_mais_antigo).getTime() > DIA_MS) {
    subir(1)
    motivos.push('envio à RNDS pendente há mais de 24 horas')
  }
  return { estado, motivos }
}

export function useUnidadesRede() {
  return useQuery({
    queryKey: ['admin-unidades'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_unidades')
      if (error) throw error
      return (data ?? []) as UnidadeRede[]
    },
  })
}

export function useChamadosTecnicos(incluirResolvidos = false) {
  return useQuery({
    queryKey: ['chamados-tecnicos', incluirResolvidos],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('chamados_tecnicos_lista', { p_incluir_resolvidos: incluirResolvidos })
      if (error) throw error
      return (data ?? []) as ChamadoTecnico[]
    },
  })
}

export type Servidores = {
  servidor: string
  banco: { tamanho_bytes: number; conexoes: number; conexoes_max: number }
  sessoes: number
  rnds: { pendentes: number; erro: number; enviados_24h: number; mais_antigo: string | null }
  armazenamento: { bucket: string; arquivos: number; bytes: number }[]
  push: number
  auditoria: { ultima_em: string | null; registros_24h: number }
}

export function useServidores() {
  return useQuery({
    queryKey: ['admin-servidores'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_servidores')
      if (error) throw error
      return data as unknown as Servidores
    },
  })
}

/**
 * Latência medida DESTE navegador até o banco: três leituras mínimas em
 * sequência, a do meio. Não é a latência de cada unidade (essa não tem fonte).
 */
export function useLatencia() {
  return useQuery({
    queryKey: ['admin-latencia'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const tempos: number[] = []
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now()
        const { error } = await supabase.from('unidades').select('id').limit(1)
        if (error) throw error
        tempos.push(performance.now() - t0)
      }
      tempos.sort((a, b) => a - b)
      return Math.round(tempos[1])
    },
  })
}

/** Alvo de latência do protótipo (p95 de 250 ms no banco). */
export const LATENCIA_ALVO_MS = 250

// ── formatação ───────────────────────────────────────────────────────────────

export const lugar = (u: Pick<UnidadeRede, 'municipio' | 'uf'>) => [u.municipio, u.uf].filter(Boolean).join(', ')

/** "há 4 min", "há 2h05", "há 3 dias". */
export function haQuanto(iso: string | null, agora = Date.now()): string {
  if (!iso) return '—'
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  if (min < 48 * 60) return `há ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
  return `há ${Math.floor(min / 1440)} dias`
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`
  const u = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${u[i]}`
}

/** Selo de situação (mesma gramática dos selos do protótipo: verde, âmbar, vermelho). */
export const SELO_ESTADO: Record<Estado, string> = {
  0: 'text-conforme bg-conforme/10',
  1: 'text-atencao bg-atencao/10',
  2: 'text-critico bg-critico/10',
}
export const selo = 'inline-flex items-center rounded-capsula px-2 py-[3px] text-rotulo font-semibold tracking-[0.03em] uppercase whitespace-nowrap'
