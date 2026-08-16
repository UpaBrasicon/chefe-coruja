import { useQuery } from '@tanstack/react-query'
import { Bell, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { MinhaNotificacao } from '@/types/database'

export default function Notificacoes() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id

  const { data: notificacoes, isLoading } = useQuery({
    queryKey: ['minhas-notificacoes', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_notificacoes', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as MinhaNotificacao[]
    },
    refetchInterval: 60_000,
  })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link className="transition-colors hover:text-foreground" to="/">
            Início
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">Avisos</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Avisos</h1>
        <p className="text-sm text-muted-foreground">
          Central de notificações — turno, observação vencendo, decisões do gestor e candidaturas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4 text-muted-foreground" />
            Notificações
          </CardTitle>
          <CardDescription>Últimas 100 notificações do seu perfil.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner />
            </div>
          ) : (notificacoes ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma notificação ainda.</p>
          ) : (
            (notificacoes ?? []).map((n) => (
              <div key={n.id} className={`rounded-lg border p-2 text-sm ${n.lida ? 'bg-muted/30' : 'bg-amber-50'}`}>
                <div className="flex items-center gap-2">
                  <span className="flex-1">{n.mensagem}</span>
                  <Badge variant={n.lida ? 'secondary' : 'warning'}>{n.lida ? 'Lida' : 'Nova'}</Badge>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString('pt-BR')}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
