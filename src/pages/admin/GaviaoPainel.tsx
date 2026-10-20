import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, Activity, AlertTriangle, CheckCircle2, CalendarDays } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { TituloPagina } from '@/components/monitor/Pagina'
import { dataHora, dataPura } from '@/lib/formato'

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

type Relatorio = {
  id: string
  periodo_inicio: string
  periodo_fim: string
  resumo: {
    total_incidentes: number
    total_alertas: number
    incidentes_por_severidade: { critico: number; atencao: number; informativo: number }
    incidentes_por_patrulha: { dados: number; conteudo: number; hermes: number }
    alertas_por_status: { novo: number; visto: number; em_acompanhamento: number; justificado: number }
    periodo: { inicio: string; fim: string }
  }
  gerado_em: string
}

type Painel = {
  incidentes: Incidente[]
  alertas: Alerta[]
  relatorio: Relatorio | null
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
  critico: 'bg-critico/10 text-critico',
  atencao: 'bg-atencao/10 text-atencao',
  informativo: 'bg-suprimento/10 text-suprimento',
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
      <div className="rounded-controle border border-critico/30 bg-alerta-critico p-4 text-apoio text-critico">
        Falha ao carregar o painel do Gavião: {(error as Error).message}
      </div>
    )
  }

  const incidentes = data?.incidentes ?? []
  const alertas = data?.alertas ?? []

  return (
    <div className="space-y-6">
      <TituloPagina
        icone={ShieldCheck}
        titulo="Gavião — Sentinela"
        descricao="Fiscal de segurança e integridade da plataforma. Dados que o Gavião considera pertinentes."
        className="mb-0"
      />

      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-apoio">
              <AlertTriangle className="size-4 text-critico" /> Incidentes abertos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-numeral-ok leading-none font-semibold tracking-[-0.03em] tabular">{data?.resumo.incidentes_abertos ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-apoio">
              <Activity className="size-4 text-atencao" /> Alertas de escala ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-numeral-ok leading-none font-semibold tracking-[-0.03em] tabular">{data?.resumo.alertas_ativos ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-apoio">
              <CheckCircle2 className="size-4 text-conforme" /> Última verificação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-apoio font-medium">
              {data?.resumo.gerado_em ? dataHora(data.resumo.gerado_em) : '—'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Relatório semanal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-corpo">
            <CalendarDays className="size-4" /> Relatório semanal do Gavião
          </CardTitle>
          <CardDescription>
            {data?.relatorio
              ? `Semana de ${dataPura(data.relatorio.periodo_inicio)} a ${dataPura(data.relatorio.periodo_fim)}`
              : 'Ainda não há relatório gerado (o job roda às segundas 08h15).'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.relatorio ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-controle border p-3">
                <div className="text-rotulo text-tinta-sussurro">Incidentes</div>
                <div className="text-numeral-ok leading-none font-semibold tracking-[-0.03em] tabular">{data.relatorio.resumo.total_incidentes}</div>
                <div className="mt-1 flex gap-1 text-rotulo">
                  <Badge className={SEVERIDADE_COR.critico}>C {data.relatorio.resumo.incidentes_por_severidade.critico}</Badge>
                  <Badge className={SEVERIDADE_COR.atencao}>A {data.relatorio.resumo.incidentes_por_severidade.atencao}</Badge>
                  <Badge className={SEVERIDADE_COR.informativo}>I {data.relatorio.resumo.incidentes_por_severidade.informativo}</Badge>
                </div>
              </div>
              <div className="rounded-controle border p-3">
                <div className="text-rotulo text-tinta-sussurro">Por patrulha</div>
                <div className="text-apoio font-medium">
                  dados {data.relatorio.resumo.incidentes_por_patrulha.dados} · conteúdo {data.relatorio.resumo.incidentes_por_patrulha.conteudo} · hermes {data.relatorio.resumo.incidentes_por_patrulha.hermes}
                </div>
              </div>
              <div className="rounded-controle border p-3">
                <div className="text-rotulo text-tinta-sussurro">Alertas de escala</div>
                <div className="text-numeral-ok leading-none font-semibold tracking-[-0.03em] tabular">{data.relatorio.resumo.total_alertas}</div>
                <div className="text-rotulo text-tinta-sussurro">
                  {data.relatorio.resumo.alertas_por_status.novo} novos · {data.relatorio.resumo.alertas_por_status.visto} vistos
                </div>
              </div>
              <div className="rounded-controle border p-3">
                <div className="text-rotulo text-tinta-sussurro">Gerado em</div>
                <div className="text-apoio font-medium">
                  {dataHora(data.relatorio.gerado_em)}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-apoio text-tinta-sussurro">Nenhum relatório semanal disponível ainda.</p>
          )}
        </CardContent>
      </Card>

      {/* Incidentes (super_admin) */}
      {incidentes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-corpo">Incidentes de segurança (Cérbero)</CardTitle>
            <CardDescription>Visível apenas ao super_admin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {incidentes.map((i) => (
              <div key={i.id} className="flex items-start justify-between gap-3 rounded-controle border p-3">
                <div>
                  <div className="text-apoio font-medium">{i.titulo}</div>
                  <div className="text-rotulo text-tinta-sussurro">
                    {i.patrulha} · {dataHora(i.detectado_em)}
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
          <CardTitle className="text-corpo">Alertas de escala (Sentinela)</CardTitle>
          <CardDescription>Médicos fora do padrão estatístico da unidade (IQR, mínimo 8 plantões).</CardDescription>
        </CardHeader>
        <CardContent>
          {alertas.length === 0 ? (
            <p className="text-apoio text-tinta-sussurro">Nenhum alerta ativo no momento.</p>
          ) : (
            <div className="space-y-2">
              {alertas.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 rounded-controle border p-3">
                  <div>
                    <div className="text-apoio font-medium">{METRICA_LABEL[a.metrica] ?? a.metrica}</div>
                    <div className="text-rotulo text-tinta-sussurro">
                      {a.valor} (mediana da unidade: {a.mediana_unidade}) · {dataHora(a.criado_em)}
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
