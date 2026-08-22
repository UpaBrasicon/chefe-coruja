import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

type Incidente = {
  id: string
  patrulha: string
  severidade: string
  titulo: string
  status: string
  detectado_em: string
}

type Alerta = {
  id: string
  unidade_id: string
  metrica: string
  valor: number
  mediana_unidade: number
  status: string
  criado_em: string
}

type Painel = {
  incidentes: Incidente[]
  alertas: Alerta[]
  resumo: { incidentes_abertos: number; alertas_ativos: number; gerado_em: string }
}

const METRICA_LABEL: Record<string, string> = {
  taxa_repasse: 'Repasses',
  faltas: 'Faltas',
  cancelamento_tardio: 'Cancelamentos tardios',
  trocas_iniciadas: 'Trocas iniciadas',
  concentracao_destino: 'Concentração de destino',
}

const SEVERIDADE_COR: Record<string, string> = {
  critico: 'bg-red-100 text-red-700',
  atencao: 'bg-amber-100 text-amber-700',
  informativo: 'bg-sky-100 text-sky-700',
}

export function GaviaoPainel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['gaviao-painel'],
    queryFn: async (): Promise<Painel> => {
      const { data, error } = await supabase.rpc('gaviao_painel_admin')
      if (error) throw new Error(error.message)
      return data as unknown as Painel
    },
    staleTime: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Falha ao carregar o painel do Gavião: {(error as Error).message}
      </div>
    )
  }

  const incidentes = data?.incidentes ?? []
  const alertas = data?.alertas ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <ShieldCheck className="size-5" /> Gavião — Sentinela
        </h1>
        <p className="text-sm text-muted-foreground">
          Fiscal de segurança e integridade da plataforma. Dados que o Gavião considera pertinentes.
        </p>
      </div>

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="size-4 text-red-600" /> Incidentes abertos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.resumo.incidentes_abertos ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="size-4 text-amber-600" /> Alertas de escala ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.resumo.alertas_ativos ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-600" /> Última verificação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {data?.resumo.gerado_em ? new Date(data.resumo.gerado_em).toLocaleString('pt-BR') : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incidentes (super_admin) */}
      {incidentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Incidentes de segurança (Cérbero)</CardTitle>
            <CardDescription>Visível apenas ao super_admin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {incidentes.map((i) => (
              <div key={i.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">{i.titulo}</div>
                  <div className="text-xs text-muted-foreground">
                    {i.patrulha} · {new Date(i.detectado_em).toLocaleString('pt-BR')}
                  </div>
                </div>
                <Badge className={SEVERIDADE_COR[i.severidade] ?? ''}>{i.severidade}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Alertas do Sentinela */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alertas de escala (Sentinela)</CardTitle>
          <CardDescription>Médicos fora do padrão estatístico da unidade (IQR, mínimo 8 plantões).</CardDescription>
        </CardHeader>
        <CardContent>
          {alertas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum alerta ativo no momento.</p>
          ) : (
            <div className="space-y-2">
              {alertas.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-medium">{METRICA_LABEL[a.metrica] ?? a.metrica}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.valor} (mediana da unidade: {a.mediana_unidade}) · {new Date(a.criado_em).toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <Badge variant="outline">{a.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
