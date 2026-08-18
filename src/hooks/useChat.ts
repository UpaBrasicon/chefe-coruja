import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// Hook do chat — conversas, mensagens, realtime e envio com optimistic update.
// Reutiliza a infraestrutura existente (supabase realtime + RPCs com auditoria).
// ─────────────────────────────────────────────────────────────────────────────

export type ConversaListada = {
  conversa_id: string
  tipo: 'direta' | 'suporte' | 'gestao'
  unidade_id: string | null
  unidade_nome: string | null
  interlocutor_id: string | null
  interlocutor_nome: string | null
  interlocutor_foto: string | null
  interlocutor_papel: string | null
  ultima_mensagem: string | null
  ultima_data: string | null
  nao_lidas: number
}

export type ContatoChat = {
  perfil_id: string
  nome: string
  foto: string | null
  papel: string
  setor_nome: string | null
  em_plantao: boolean
}

export type MensagemChat = {
  id: string
  conversa_id: string
  autor_id: string
  corpo: string
  criado_em: string
  editado_em: string | null
  excluida: boolean
  autor: { nome_completo: string; foto_url: string | null } | null
}

const PAGE_SIZE = 50

/** Total de não lidas (soma das conversas). Usado no badge do AppShell. */
export function useTotalNaoLidas() {
  const { data: conversas } = useConversas()
  const total = (conversas ?? []).reduce((acc, c) => acc + (c.nao_lidas ?? 0), 0)
  return total
}

/** Lista conversas do usuário (RPC listar_conversas) + refresh periódico leve. */
export function useConversas() {
  return useQuery({
    queryKey: ['chat-conversas'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_conversas')
      if (error) throw error
      return (data ?? []) as ConversaListada[]
    },
    refetchInterval: 20_000,
  })
}

/** Contatos disponíveis para nova conversa (de plantão + gestores). */
export function useContatosChat() {
  return useQuery({
    queryKey: ['chat-contatos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contatos_chat')
      if (error) throw error
      return (data ?? []) as ContatoChat[]
    },
    refetchInterval: 60_000,
  })
}

/** Mensagens de uma conversa — infinite query (50/página, mais antigas ao subir). */
export function useMensagens(conversaId: string | null) {
  const queryClient = useQueryClient()

  const query = useInfiniteQuery({
    queryKey: ['chat-mensagens', conversaId],
    enabled: !!conversaId,
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from('chat_mensagens')
        .select('id, conversa_id, autor_id, corpo, criado_em, editado_em, excluida, autor:perfis(nome_completo, foto_url)')
        .eq('conversa_id', conversaId!)
        .order('criado_em', { ascending: false })
        .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)
      if (error) throw error
      return (data ?? []) as unknown as MensagemChat[]
    },
    getNextPageParam: (lastPage, pages) => (lastPage.length === PAGE_SIZE ? pages.length : undefined),
    initialPageParam: 0,
  })

  // Realtime: canal da conversa aberta → insere nova mensagem no cache (sem refetch)
  useEffect(() => {
    if (!conversaId) return
    const channel = supabase
      .channel(`chat:${conversaId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_mensagens', filter: `conversa_id=eq.${conversaId}` },
        async (payload) => {
          const nova = payload.new as MensagemChat & { autor_id: string }
          // busca dados do autor para montar a mensagem completa
          const { data: autor } = await supabase
            .from('perfis')
            .select('nome_completo, foto_url')
            .eq('id', nova.autor_id)
            .maybeSingle()
          const completa: MensagemChat = { ...nova, autor: autor as MensagemChat['autor'] }
          queryClient.setQueryData<{ pages: MensagemChat[][]; pageParams: number[] }>(
            ['chat-mensagens', conversaId],
            (old) => {
              if (!old) return old
              // Insere APENAS na primeira página (a mais recente) e remove a
              // mensagem temporária do optimistic update com o mesmo corpo/remetente.
              const pages = old.pages.map((p, i) => {
                if (i !== 0) return p
                const semTemp = p.filter(
                  (m) => !(m.id.startsWith('temp-') && m.autor_id === completa.autor_id && m.corpo === completa.corpo)
                )
                return [completa, ...semTemp]
              })
              return { ...old, pages }
            }
          )
          // atualiza contador não lidas (se a thread não estiver focada, marcar vem do caller)
          void queryClient.invalidateQueries({ queryKey: ['chat-conversas'] })
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [conversaId, queryClient])

  return query
}

/** Canal global leve: nova mensagem em QUALQUER conversa atualiza contadores. */
export function useChatRealtimeGlobal() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const channel = supabase
      .channel('chat-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_mensagens' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['chat-conversas'] })
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])
}

/** Envia mensagem com optimistic update + rollback. */
export function useEnviarMensagem(conversaId: string | null) {
  const queryClient = useQueryClient()
  const { perfil } = useAuth()

  return useMutation({
    mutationFn: async (corpo: string) => {
      const { data, error } = await supabase.rpc('enviar_mensagem', {
        p_conversa_id: conversaId!,
        p_corpo: corpo,
      })
      if (error) throw error
      return data as string
    },
    onMutate: async (corpo) => {
      if (!conversaId) return
      await queryClient.cancelQueries({ queryKey: ['chat-mensagens', conversaId] })
      const previo = queryClient.getQueryData(['chat-mensagens', conversaId])
      const temp: MensagemChat = {
        id: `temp-${Date.now()}`,
        conversa_id: conversaId,
        autor_id: perfil?.id ?? '',
        corpo,
        criado_em: new Date().toISOString(),
        editado_em: null,
        excluida: false,
        autor: { nome_completo: 'Você', foto_url: null },
      }
      queryClient.setQueryData<{ pages: MensagemChat[][]; pageParams: number[] }>(
        ['chat-mensagens', conversaId],
        (old) => {
          if (!old) return old
          const pages = old.pages.map((p) => [temp, ...p])
          return { ...old, pages }
        }
      )
      return { previo }
    },
    onError: (_e, _v, ctx) => {
      if (conversaId && ctx?.previo) {
        queryClient.setQueryData(['chat-mensagens', conversaId], ctx.previo)
      }
    },
    onSuccess: () => {
      if (conversaId) void queryClient.invalidateQueries({ queryKey: ['chat-mensagens', conversaId] })
      void queryClient.invalidateQueries({ queryKey: ['chat-conversas'] })
    },
  })
}

/** Marca a conversa como lida. */
export function useMarcarLida() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (conversaId: string) => {
      const { error } = await supabase.rpc('marcar_lida', { p_conversa_id: conversaId })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chat-conversas'] }),
  })
}

/** Abre (cria/retorna) uma conversa 1:1 e a usa. */
export function useAbrirConversa() {
  const queryClient = useQueryClient()
  const abrir = useMutation({
    mutationFn: async (destinatarioId: string) => {
      const { data, error } = await supabase.rpc('abrir_conversa_direta', { p_destinatario_id: destinatarioId })
      if (error) throw error
      return data as string
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chat-conversas'] }),
  })
  return abrir
}

/** Abre a conversa de suporte. */
export function useAbrirSuporte() {
  const queryClient = useQueryClient()
  const abrir = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('abrir_conversa_suporte')
      if (error) throw error
      return data as string
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chat-conversas'] }),
  })
  return abrir
}
