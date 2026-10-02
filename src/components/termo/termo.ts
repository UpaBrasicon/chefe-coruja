// ─────────────────────────────────────────────────────────────────────────────
// Termo de consentimento — dados e vocabulário (separado dos componentes para
// o fast refresh do Vite). Toda regra mora no banco
// (20261004000004_termo_consentimento.sql); aqui só se lê e se pede.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { abrirProntuario } from '@/lib/prontuario'
import { supabase } from '@/lib/supabase'
import type { Json, Tables } from '@/types/database'

export type Assinante = 'paciente' | 'responsavel' | 'ninguem_presente'
/** Quem assina o termo (decisão do RT 02/10/2026, Código Civil arts. 3º, 4º e 1.690):
 *  representado < 16 (assina o responsável), assistido 16–17 (paciente com o responsável), capaz ≥ 18. */
export type FaixaAssinatura = 'representado' | 'assistido' | 'capaz'

export type ModeloTermo = {
  id: string
  titulo: string
  procedimento: string
  texto: string
  declaracao: string | null
  versao: number
}

/** O que fica gravado no documento (conteudo.termo). */
export type ConteudoTermo = {
  modelo: { id: string; titulo: string; versao: number } | null
  procedimento: string
  texto: string
  informacoes: string | null
  declaracao: string
  paciente: { nome: string; idade_anos: number | null; menor_14: boolean; faixa?: FaixaAssinatura; assistido?: boolean }
  assinante: Assinante
  sem_condicoes_motivo: string | null
  responsavel: { nome: string; documento: string; vinculo: string } | null
  ausencia_motivo: string | null
  testemunha: { nome: string; documento: string | null } | null
  medico: { nome: string; crm: string | null; uf_crm: string | null }
}

export type VersaoTermo = {
  id: string
  versao: number
  numero: string | null
  estado: string
  emitido_em: string
  motivo_retificacao: string | null
  autor: string | null
}

export type TermoRegistrado = {
  id: string
  raiz_id: string
  versao: number
  numero: string | null
  estado: 'ativo' | 'cancelado'
  emitido_em: string
  primeira_emissao_em: string
  autor_id: string
  autor_original_id: string
  autor: string | null
  crm: string | null
  uf_crm: string | null
  motivo_retificacao: string | null
  conteudo: ConteudoTermo | null
  cancelamento: { motivo: string; em: string; por: string | null } | null
  versoes: VersaoTermo[]
}

export type PainelTermos = {
  paciente: {
    nome: string
    idade_anos: number | null
    menor_14: boolean
    faixa: FaixaAssinatura | null
    responsavel: { nome: string; vinculo: string | null; documento: string | null } | null
  }
  unidade: string | null
  medico: { id: string; nome: string; crm: string | null; uf_crm: string | null } | null
  pode_emitir: boolean
  sou_gestor: boolean
  declaracao_padrao: string
  modelos: ModeloTermo[]
  termos: TermoRegistrado[]
}

/**
 * Campos que o texto do modelo aceita. O servidor preenche o que sobrar no
 * texto final (private.preencher_campos_termo) — a lista é a mesma.
 */
export const CAMPOS_TERMO: { chave: string; descricao: string }[] = [
  { chave: 'paciente', descricao: 'nome do paciente (o social, se houver)' },
  { chave: 'idade', descricao: 'idade em anos' },
  { chave: 'procedimento', descricao: 'procedimento escrito no termo' },
  { chave: 'medico', descricao: 'médico do login' },
  { chave: 'crm', descricao: 'CRM do médico' },
  { chave: 'unidade', descricao: 'nome da unidade' },
  { chave: 'data', descricao: 'data de hoje' },
  { chave: 'responsavel', descricao: 'nome do responsável' },
  { chave: 'vinculo', descricao: 'vínculo do responsável' },
]

/** Pré-visualização: mesma troca que o servidor faz ao gerar. */
export function preencherCampos(texto: string, valores: Record<string, string>) {
  return texto.replace(/\{([a-z_]+)\}/g, (inteiro, chave: string) => (chave in valores ? valores[chave] : inteiro))
}

export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export const quando = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    : ''

export const mensagemErro = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

export function quemAssina(c: ConteudoTermo | null) {
  if (!c) return ''
  if (c.assinante === 'paciente' && c.responsavel) return `assina o paciente, assistido por ${c.responsavel.nome} (${c.responsavel.vinculo})`
  if (c.assinante === 'paciente') return 'assina o paciente'
  if (c.assinante === 'responsavel' && c.responsavel) return `assina ${c.responsavel.nome} (${c.responsavel.vinculo})`
  return 'sem responsável presente para assinar'
}

// ── painel da aba (paciente, modelos ativos e termos do episódio) ───────────
const chavePainel = (pacienteId: string, episodioId?: string | null, internacaoId?: string | null) =>
  ['termos-consentimento', pacienteId, episodioId ?? null, internacaoId ?? null] as const

export function usePainelTermos(pacienteId: string, episodioId?: string | null, internacaoId?: string | null) {
  return useQuery({
    queryKey: chavePainel(pacienteId, episodioId, internacaoId),
    enabled: !!pacienteId,
    queryFn: async (): Promise<PainelTermos> => {
      await abrirProntuario(pacienteId, internacaoId)
      const { data, error } = await supabase.rpc('termos_consentimento_do_paciente', {
        p_paciente: pacienteId,
        p_episodio: episodioId ?? undefined,
        p_internacao: internacaoId ?? undefined,
      })
      if (error) throw error
      const p = data as unknown as PainelTermos
      return { ...p, modelos: p.modelos ?? [], termos: p.termos ?? [] }
    },
  })
}

export type DadosTermo = {
  modelo_id: string | null
  procedimento: string
  texto: string
  informacoes: string
  assinante: Assinante
  sem_condicoes_motivo: string
  responsavel: { nome: string; documento: string; vinculo: string } | null
  ausencia_motivo: string
  testemunha: { nome: string; documento: string } | null
}

export function useEmitirTermo(pacienteId: string, episodioId?: string | null, internacaoId?: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ dados, retifica, motivo }: { dados: DadosTermo; retifica?: string | null; motivo?: string }) => {
      const { data, error } = await supabase.rpc('emitir_termo_consentimento', {
        p_paciente: pacienteId,
        p_dados: dados as unknown as Json,
        p_episodio: episodioId ?? undefined,
        p_internacao: internacaoId ?? undefined,
        p_retifica: retifica ?? undefined,
        p_motivo: motivo?.trim() || undefined,
      })
      if (error) throw error
      return data as { id: string; numero: string; versao: number }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['termos-consentimento', pacienteId] })
      void qc.invalidateQueries({ queryKey: ['documentos-clinicos', pacienteId] })
    },
  })
}

export function useCancelarTermo(pacienteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ documentoId, motivo }: { documentoId: string; motivo: string }) => {
      const { error } = await supabase.rpc('cancelar_termo_consentimento', { p_documento: documentoId, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['termos-consentimento', pacienteId] })
      void qc.invalidateQueries({ queryKey: ['documentos-clinicos', pacienteId] })
    },
  })
}

// ── gestor: modelos da unidade ──────────────────────────────────────────────
export type ModeloTermoLinha = Tables<'termos_modelos'>

/** Todas as versões dos modelos da unidade (o RLS dá o histórico só ao gestor). */
export function useModelosTermoUnidade(unidadeId: string | undefined) {
  return useQuery({
    queryKey: ['termos-modelos', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('termos_modelos')
        .select('*')
        .eq('unidade_id', unidadeId!)
        .order('titulo')
        .order('versao', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export type ModeloEntrada = { titulo: string; procedimento: string; texto: string; declaracao: string; modeloId?: string | null }

export function useSalvarModeloTermo(unidadeId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (m: ModeloEntrada) => {
      const { data, error } = await supabase.rpc('salvar_modelo_termo', {
        p_unidade: unidadeId!,
        p_titulo: m.titulo.trim(),
        p_procedimento: m.procedimento.trim(),
        p_texto: m.texto.trim(),
        p_declaracao: m.declaracao.trim() || undefined,
        p_modelo: m.modeloId ?? undefined,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['termos-modelos', unidadeId] }),
  })
}

export function useAtivarModeloTermo(unidadeId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ modeloId, ativo }: { modeloId: string; ativo: boolean }) => {
      const { error } = await supabase.rpc('ativar_modelo_termo', { p_modelo: modeloId, p_ativo: ativo })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['termos-modelos', unidadeId] }),
  })
}
