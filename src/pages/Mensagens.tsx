import { MessageSquare } from 'lucide-react'

/**
 * Rota antiga /mensagens — o chat agora vive no drawer do AppShell.
 * Esta rota é redirecionada automaticamente e abre o drawer (ver AppShell).
 */
export default function Mensagens() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 py-16 text-center">
      <MessageSquare className="size-10 text-muted-foreground" />
      <h1 className="text-xl font-semibold tracking-tight">Mensagens</h1>
      <p className="text-sm text-muted-foreground">
        O chat agora fica no painel lateral. Clique no ícone de mensagens no canto superior para abrir.
      </p>
    </div>
  )
}
