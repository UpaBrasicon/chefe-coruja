import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, BarChart3, ChevronRight, RefreshCw } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

type CensoLinha = {
  data: string
  setor_id: string
  setor_nome: string
  internados: number
  leitos_total: number
  taxa_ocupacao: number | null
  permanencia_media_h: number | null
  giro_leito: number | null
}

type OcupacaoSetor = {
  setor_id: string
  setor_nome: string
  internados: number
  limite: number
}

function fmtDia(iso: string) {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

function corTaxa(taxa: number | null) {
  if (taxa == null) return 'text-muted-foreground'
  if (taxa >= 90) return 'text-red-600'
  if (taxa >= 85) return 'text-amber-600'
  return 'text-emerald-600'
}

export default function Indicadores() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()

  const { data: censo, isLoading } = useQuery({
    queryKey: ['censo-recente', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('censo_recente', { p_unidade: unidadeId!, p_dias: 7 })
      if (error) throw error
      return (data ?? []) as CensoLinha[]
    },
  })

  // ocupação viva (para o dashboard quando o censo ainda não foi gerado)
  const { data: ocupacao } = useQuery({
    queryKey: ['ocupacao-ao-vivo', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ocupacao_setores', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as OcupacaoSetor[]
    },
    refetchInterval: 60_000,
  })

  const gerarCenso = useMutation({
    mutationFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10)
      const { data, error } = await supabase.rpc('gerar_censo_diario', { p_unidade: unidadeId!, p_data: hoje })
      if (error) throw error
      return data as number
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['censo-recente', unidadeId] })
    },
  })

  const agrupado = React.useMemo(() => {
    const mapa = new Map<string, CensoLinha[]>()
    for (const c of censo ?? []) {
      const arr = mapa.get(c.setor_id) ?? []
      arr.push(c)
      mapa.set(c.setor_id, arr)
    }
    return mapa
  }, [censo])

  // totais (última data disponível do censo)
  const ultimaData = (censo ?? []).reduce((acc, c) => (c.data > acc ? c.data : acc), '')
  const totalUnidade = React.useMemo(() => {
    const doDia = (censo ?? []).filter((c) => c.data === ultimaData)
    return {
      internados: doDia.reduce((a, c) => a + c.internados, 0),
      leitos: doDia.reduce((a, c) => a + c.leitos_total, 0),
    }
  }, [censo, ultimaData])

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="transition-colors hover:text-foreground">
            Início
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">Indicadores</span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Indicadores Hospitalares</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => gerarCenso.mutate()}
            disabled={gerarCenso.isPending}
          >
            {gerarCenso.isPending ? <RefreshCw className="animate-spin" /> : <RefreshCw />} Gerar censo de hoje
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Ocupação, taxa, permanência média e giro de leito — alimentados pelos eventos ADT (Fase 3).
          O censo é materializado por dia e pode ser regenerado a qualquer momento.
        </p>
      </div>

      {/* Totais da unidade */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-primary" />
              Internados hoje
            </CardTitle>
            <CardDescription>{ultimaData ? fmtDia(ultimaData) : 'sem censo ainda'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalUnidade.internados}</div>
            <div className="text-xs text-muted-foreground">pacientes presentes na unidade</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-primary" />
              Taxa de ocupação
            </CardTitle>
            <CardDescription>leitos totais: {totalUnidade.leitos}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${corTaxa(totalUnidade.leitos > 0 ? (totalUnidade.internados / totalUnidade.leitos) * 100 : null)}`}>
              {totalUnidade.leitos > 0 ? Math.round((totalUnidade.internados / totalUnidade.leitos) * 100) : '—'}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="size-4 text-primary" />
              Ocupação ao vivo
            </CardTitle>
            <CardDescription>contagem atual por setor (RLS por escala)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(ocupacao ?? []).reduce((a, o) => a + o.internados, 0)}
            </div>
            <div className="text-xs text-muted-foreground">pacientes (fonte: ocupacao_setores)</div>
          </CardContent>
        </Card>
      </div>

      {/* Censo por setor (série de 7 dias) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-muted-foreground" />
            Censo por setor (últimos 7 dias)
          </CardTitle>
          <CardDescription>
            Internados, taxa de ocupação, permanência média (h) e giro de leito.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner />
            </div>
          ) : agrupado.size === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum censo gerado ainda. Clique em &quot;Gerar censo de hoje&quot;.
            </p>
          ) : (
            Array.from(agrupado.entries()).map(([setorId, linhas]) => {
              const nome = linhas[0].setor_nome
              const series = [...linhas].sort((a, b) => a.data.localeCompare(b.data))
              const ultimo = linhas[0]
              return (
                <div key={setorId} className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold">{nome}</span>
                    <span className={`text-sm font-bold ${corTaxa(ultimo.taxa_ocupacao)}`}>
                      {ultimo.taxa_ocupacao != null ? `${ultimo.taxa_ocupacao}%` : '—'} ocupação
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {series.map((c) => (
                      <div key={c.data} className="rounded-lg bg-muted/50 p-2 text-center">
                        <div className="text-[10px] font-medium text-muted-foreground">{fmtDia(c.data)}</div>
                        <div className="text-sm font-bold">{c.internados}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {c.permanencia_media_h != null ? `${c.permanencia_media_h}h` : '—'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">giro {c.giro_leito ?? '—'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Ocupação ao vivo por setor */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ocupação ao vivo por setor</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(ocupacao ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum setor com ocupação.</p>
          ) : (
            (ocupacao ?? []).map((o) => {
              const lotado = o.limite > 0 && o.internados >= o.limite
              const alerta = o.limite > 0 && o.internados >= Math.ceil(o.limite * 0.85)
              return (
                <div key={o.setor_id} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <span className="font-medium">{o.setor_nome}</span>
                  <span className={`font-bold ${lotado ? 'text-red-600' : alerta ? 'text-amber-600' : 'text-foreground'}`}>
                    {o.internados}/{o.limite || '∞'}
                    {lotado && ' · LOTADO'}
                  </span>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
