import { useQueryClient } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { useAvisosFlutuantes } from '@/contexts/AvisosFlutuantesContext'
import {
  conversaAbertaAgora,
  ouvirMensagensNovas,
  type ConversaListada,
  type MensagemNovaRealtime,
} from '@/hooks/useChat'
import { supabase } from '@/lib/supabase'

// Aviso flutuante de mensagem nova durante o turno. Não abre canal próprio:
// escuta o canal global que `useChatRealtimeGlobal` já assina — então a casca
// precisa ter esse hook montado também. Avisa só de mensagem de outra pessoa
// e que não esteja na conversa aberta na gaveta.

const TAMANHO_PREVIA = 120

function previa(corpo: string) {
  const limpo = corpo.replace(/\s+/g, ' ').trim()
  return limpo.length > TAMANHO_PREVIA ? `${limpo.slice(0, TAMANHO_PREVIA - 1)}…` : limpo
}

export function useAvisoDeMensagem() {
  const { avisar } = useAvisosFlutuantes()
  const { perfil } = useAuth()
  const queryClient = useQueryClient()
  const meuId = perfil?.id

  // nomes já descobertos, para não ir ao banco a cada mensagem
  const nomes = useRef(new Map<string, string>())
  // o realtime pode entregar o mesmo INSERT duas vezes numa reconexão
  const avisadas = useRef(new Set<string>())

  useEffect(() => {
    if (!meuId) return
    let ativo = true

    async function nomeDoAutor(m: MensagemNovaRealtime) {
      const conhecido = nomes.current.get(m.autor_id)
      if (conhecido) return conhecido
      const conversas = queryClient.getQueryData<ConversaListada[]>(['chat-conversas'])
      const conv = conversas?.find((c) => c.conversa_id === m.conversa_id)
      if (conv?.tipo === 'suporte') return 'O suporte'
      if (conv?.interlocutor_id === m.autor_id && conv.interlocutor_nome) {
        nomes.current.set(m.autor_id, conv.interlocutor_nome)
        return conv.interlocutor_nome
      }
      const { data } = await supabase.from('perfis').select('nome_completo').eq('id', m.autor_id).maybeSingle()
      const nome = data?.nome_completo ?? null
      if (nome) nomes.current.set(m.autor_id, nome)
      return nome ?? 'Um colega'
    }

    const parar = ouvirMensagensNovas((m) => {
      if (m.autor_id === meuId || m.excluida) return
      if (m.conversa_id === conversaAbertaAgora()) return
      if (avisadas.current.has(m.id)) return
      avisadas.current.add(m.id)
      if (avisadas.current.size > 200) avisadas.current = new Set([m.id])

      void nomeDoAutor(m).then((nome) => {
        if (!ativo) return
        // a pessoa pode ter aberto a conversa enquanto o nome chegava
        if (m.conversa_id === conversaAbertaAgora()) return
        avisar({
          tag: 'Mensagem',
          titulo: `${nome} enviou uma mensagem`,
          texto: previa(m.corpo),
          quando: 'agora',
          icone: MessageSquare,
        })
      })
    })

    return () => {
      ativo = false
      parar()
    }
  }, [meuId, avisar, queryClient])
}
