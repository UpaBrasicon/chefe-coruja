import { useQuery } from '@tanstack/react-query'
import { Clock, LogIn, Users } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

type PresencaDia = {
  perfil_id: string
  nome: string
  papel: string
  em_escala: boolean
  checkin_em: string | null
  checkout_em: string | null
  checkin_dentro: boolean | null
  checkout_dentro: boolean | null
  observacao: string | null
}

/**
 * Presenças do dia — visão do GESTOR (RPC presencas_do_dia_gestor).
 * Mostra quem fez check-in, a que horas, se dentro do raio da unidade, e quem
 * está em escala mas ainda NÃO fez check-in (pendência). Refresca a cada 30s.
 *
 * LGPD: nomes de profissionais (não é dado de paciente); RPC restrito a
 * gestor/admin/super via SECURITY DEFINER + guarda interna.
 */
export function PresencasDoDia() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id

  const { data: presencas, isLoading, error } = useQuery({
    queryKey: ['presencas-do-dia', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('presencas_do_dia_gestor', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as unknown as PresencaDia[]
    },
    refetchInterval: 30_000,
  })

  const feitos = (presencas ?? []).filter((p) => p.checkin_em && !p.checkout_em)
  const pendentes = (presencas ?? []).filter((p) => !p.checkin_em)
  const concluidos = (presencas ?? []).filter((p) => p.checkout_em)

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Falha ao carregar presenças: {(error as Error).message}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-muted-foreground" />
            Presenças de hoje
          </CardTitle>
          <CardDescription>
            <span className="font-medium text-emerald-700">{feitos.length} em expediente</span>
            {' · '}
            <span className="font-medium text-amber-700">{pendentes.length} sem check-in</span>
            {' · '}
            <span className="font-medium text-muted-foreground">{concluidos.length} concluídos</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(presencas ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum plantonista vinculado nesta unidade.</p>
          ) : (
            (presencas ?? []).map((p) => (
              <div
                key={p.perfil_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium">{p.nome}</span>
                  {!p.em_escala && <Badge variant="outline">fora da escala hoje</Badge>}
                  {p.checkin_dentro === true && <Badge variant="success">dentro do raio</Badge>}
                  {p.checkin_dentro === false && <Badge variant="destructive">fora do raio</Badge>}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {p.checkin_em ? (
                    <span className="flex items-center gap-1">
                      <LogIn className="size-3.5" />
                      {new Date(p.checkin_em).toLocaleTimeString('pt-BR')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-medium text-amber-700">
                      <Clock className="size-3.5" /> aguardando
                    </span>
                  )}
                  {p.checkout_em && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      → {new Date(p.checkout_em).toLocaleTimeString('pt-BR')}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
