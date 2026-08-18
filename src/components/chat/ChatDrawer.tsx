'use client'

import { ArrowLeft, MessageCircle, X } from 'lucide-react'
import * as React from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useAbrirConversa, useAbrirSuporte, useContatosChat, useConversas } from '@/hooks/useChat'
import { ListaConversas } from '@/components/chat/ListaConversas'
import { Thread } from '@/components/chat/Thread'
import { cn } from '@/lib/utils'

/**
 * Painel lateral de chat (drawer à direita).
 * Telas grandes: painel de 380px com overlay. Mobile: tela cheia.
 */
export function ChatDrawer({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id

  const [conversaAtiva, setConversaAtiva] = React.useState<string | null>(null)
  const [tituloThread, setTituloThread] = React.useState<string>('')
  const [tipoThread, setTipoThread] = React.useState<string>('direta')

  const { data: conversas } = useConversas()
  const { data: contatos } = useContatosChat()
  const abrirConversa = useAbrirConversa()
  const abrirSuporte = useAbrirSuporte()

  function fechar() {
    setConversaAtiva(null)
    setTituloThread('')
    onFechar()
  }

  function voltarLista() {
    setConversaAtiva(null)
    setTituloThread('')
  }

  function abrirConversaExistente(id: string, nome: string, tipo: string) {
    setConversaAtiva(id)
    setTituloThread(nome)
    setTipoThread(tipo)
  }

  async function iniciarComContato(perfilId: string, nome: string) {
    const res = await abrirConversa.mutateAsync(perfilId)
    setConversaAtiva(res)
    setTituloThread(nome)
    setTipoThread('direta')
  }

  async function iniciarSuporte() {
    const res = await abrirSuporte.mutateAsync()
    setConversaAtiva(res)
    setTituloThread('Suporte')
    setTipoThread('suporte')
  }

  return (
    <div
      aria-hidden={!aberto}
      className={cn(
        'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-background shadow-2xl transition-transform duration-300 sm:w-[400px]',
        aberto ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        {conversaAtiva ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Voltar à lista"
              onClick={voltarLista}
              className="rounded-md p-1 hover:bg-muted"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div>
              <div className="text-sm font-semibold">{tituloThread}</div>
              <div className="text-[11px] text-muted-foreground">
                {tipoThread === 'suporte' ? 'Suporte Chefe Coruja' : unidadeAtiva?.unidade.nome}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Mensagens</span>
          </div>
        )}
        <button
          type="button"
          aria-label="Fechar chat"
          onClick={fechar}
          className="rounded-md p-1 hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Corpo */}
      {conversaAtiva ? (
        <Thread
          key={conversaAtiva}
          conversaId={conversaAtiva}
          perfilId={perfil?.id}
          onMensagemLida={() => undefined}
        />
      ) : (
        <ListaConversas
          conversas={conversas ?? []}
          contatos={contatos ?? []}
          unidadeId={unidadeId}
          onAbrirConversa={abrirConversaExistente}
          onIniciarContato={iniciarComContato}
          onIniciarSuporte={() => void iniciarSuporte()}
        />
      )}
    </div>
  )
}
