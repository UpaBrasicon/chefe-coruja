import { useQuery } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { diaMesHora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { MinhaNotificacao } from '@/types/database'

function fmtHora(iso: string) {
  try {
    return diaMesHora(iso)
  } catch {
    return ''
  }
}

export function SinoAvisos({ unidadeId, habilitado }: { unidadeId?: string; habilitado: boolean }) {
  const { data: notificacoes, isLoading } = useQuery({
    queryKey: ['minhas-notificacoes', unidadeId],
    enabled: !!unidadeId && habilitado,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_notificacoes', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as MinhaNotificacao[]
    },
    refetchInterval: 30_000,
  })

  const lista = (notificacoes ?? []).slice(0, 5)
  const pendentes = (notificacoes ?? []).filter((n) => !n.lida).length

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        render={
          <Button variant="ghost" size="sm" className="relative" aria-label="Avisos">
            <Bell />
            {pendentes > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-capsula bg-critico px-1.5 text-rotulo font-semibold text-sobre-acao">
                {pendentes}
              </span>
            )}
          </Button>
        }
      />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side="bottom" align="end" sideOffset={6} className="z-50">
          <PopoverPrimitive.Popup className="w-80 rounded-container border bg-superficie p-3 text-tinta shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-apoio font-semibold">Últimos avisos</span>
              <span className="text-rotulo text-tinta-sussurro">{lista.length} de {(notificacoes ?? []).length}</span>
            </div>
            <div className="max-h-72 overflow-y-auto pr-1">
              {isLoading ? (
                <div className="flex h-16 items-center justify-center">
                  <Spinner />
                </div>
              ) : lista.length === 0 ? (
                <p className="py-6 text-center text-apoio text-tinta-sussurro">Nenhum aviso no momento.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {lista.map((n) => (
                    <div key={n.id} className={`rounded-controle border p-2 text-apoio ${n.lida ? 'bg-campo' : 'bg-alerta-atencao'}`}>
                      <div className="text-rotulo font-semibold text-tinta-sussurro">{fmtHora(n.created_at)}</div>
                      <div className="mt-0.5 leading-snug">{n.mensagem}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
