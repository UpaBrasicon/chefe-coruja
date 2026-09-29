import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { ChevronLeft, XIcon } from 'lucide-react'
import * as React from 'react'

import { Gaveta, GavetaCabeca } from '@/components/ui/gaveta'
import { ListaConversas } from '@/components/chat/ListaConversas'
import { Thread } from '@/components/chat/Thread'
import { useAuth } from '@/contexts/AuthContext'
import {
  definirConversaAberta,
  useAbrirConversa,
  useAbrirSuporte,
  useContatosChat,
  useConversas,
} from '@/hooks/useChat'

// Gaveta de Mensagens (P/index.html .cc-lateral + chat.*): entra pela direita
// sobre o véu. Na lista, "Mensagens" e as conversas; dentro de uma conversa,
// voltar, nome e de quem se trata, e o campo de escrever ao pé.

type ConversaNaTela = { id: string; nome: string; sub: string; tipo: string }

export function ChatDrawer({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { perfil } = useAuth()
  const [conversa, setConversa] = React.useState<ConversaNaTela | null>(null)
  const [erro, setErro] = React.useState<string | null>(null)

  const { data: conversas } = useConversas()
  const { data: contatos } = useContatosChat()
  const abrirConversa = useAbrirConversa()
  const abrirSuporte = useAbrirSuporte()
  const ocupado = abrirConversa.isPending || abrirSuporte.isPending

  // registra a conversa que está na tela (o aviso flutuante não avisa dela)
  React.useEffect(() => {
    definirConversaAberta(aberto && conversa ? conversa.id : null)
    return () => definirConversaAberta(null)
  }, [aberto, conversa])

  function fechar() {
    setConversa(null)
    setErro(null)
    onFechar()
  }

  function voltarLista() {
    setConversa(null)
    setErro(null)
  }

  async function iniciarComContato(perfilId: string, nome: string, sub: string) {
    setErro(null)
    try {
      const id = await abrirConversa.mutateAsync(perfilId)
      setConversa({ id, nome, sub, tipo: 'direta' })
    } catch {
      setErro('Não foi possível abrir a conversa. Tente de novo.')
    }
  }

  async function iniciarSuporte() {
    setErro(null)
    try {
      const id = await abrirSuporte.mutateAsync()
      setConversa({ id, nome: 'Suporte Chefe Coruja', sub: 'Equipe de suporte', tipo: 'suporte' })
    } catch {
      setErro('Não foi possível falar com o suporte agora. Tente de novo.')
    }
  }

  return (
    <Gaveta aberta={aberto} onAbertaChange={(v) => !v && fechar()} rotulo="Mensagens" className="overflow-y-hidden">
      {conversa ? (
        <>
          <div className="flex shrink-0 items-center gap-2.5 border-b border-trilha px-[22px] py-4">
            <button
              type="button"
              onClick={voltarLista}
              aria-label="Voltar"
              className="flex shrink-0 p-0.5 text-tinta-sussurro hover:text-acao"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-px">
              <DialogPrimitive.Title className="truncate text-corpo font-semibold text-tinta">{conversa.nome}</DialogPrimitive.Title>
              <span className="truncate text-apoio text-tinta-sussurro">{conversa.sub}</span>
            </div>
            <DialogPrimitive.Close aria-label="Fechar" className="flex shrink-0 p-1 text-tinta-sussurro hover:text-acao">
              <XIcon className="size-[17px]" aria-hidden />
            </DialogPrimitive.Close>
          </div>
          <Thread key={conversa.id} conversaId={conversa.id} perfilId={perfil?.id} />
        </>
      ) : (
        <>
          <GavetaCabeca titulo="Mensagens" />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {erro && (
              <p role="alert" className="border-b border-trilha bg-alerta-critico px-[22px] py-2.5 text-apoio text-critico">
                {erro}
              </p>
            )}
            <ListaConversas
              conversas={conversas ?? []}
              contatos={contatos ?? []}
              meuId={perfil?.id}
              ocupado={ocupado}
              onAbrirConversa={(id, nome, tipo, sub) => setConversa({ id, nome, sub, tipo })}
              onIniciarContato={(id, nome, sub) => void iniciarComContato(id, nome, sub)}
              onIniciarSuporte={() => void iniciarSuporte()}
            />
          </div>
        </>
      )}
    </Gaveta>
  )
}
