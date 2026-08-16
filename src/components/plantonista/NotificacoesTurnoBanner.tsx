import { Bell, X } from 'lucide-react'

import { useNotificacoesTurno } from '@/hooks/useNotificacoesTurno'
import { Button } from '@/components/ui/button'

export function NotificacoesTurnoBanner({
  unidadeId,
  habilitado,
}: {
  unidadeId?: string
  habilitado: boolean
}) {
  const { notificacoes, marcarLida } = useNotificacoesTurno(unidadeId, habilitado)

  if (!habilitado || notificacoes.length === 0) return null

  return (
    <div className="sticky top-0 z-40 flex flex-col gap-2 border-b border-amber-200 bg-amber-50/95 px-4 py-3 backdrop-blur">
      {notificacoes.map((n) => (
        <div key={n.id} className="mx-auto flex w-full max-w-6xl items-start gap-3">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-white">
            <Bell className="size-4" />
          </span>
          <p className="flex-1 text-sm font-medium text-amber-900">{n.mensagem}</p>
          <Button size="xs" variant="ghost" onClick={() => marcarLida.mutate(n.id)}>
            <X /> Fechar
          </Button>
        </div>
      ))}
    </div>
  )
}
