import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, BedDouble, CalendarDays, LineChart, RefreshCw } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { TituloPagina } from '@/components/monitor/Pagina'
import { Parametro, type Nivel } from '@/components/monitor/Parametros'

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
  if (taxa >= 90) return 'text-critico'
  if (taxa >= 85) return 'text-atencao'
  return 'text-conforme'
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
      // A data é a do servidor (America/Sao_Paulo), nunca a do aparelho.
      const { data: hoje, error: e1 } = await supabase.rpc('data_atual')
      if (e1) throw e1
      const { data, error } = await supabase.rpc('gerar_censo_diario', { p_unidade: unidadeId!, p_data: hoje as string })
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

  const aoVivo = {
    internados: (ocupacao ?? []).reduce((a, o) => a + o.internados, 0),
    leitos: (ocupacao ?? []).reduce((a, o) => a + o.limite, 0),
  }
  const taxaAoVivo = aoVivo.leitos > 0 ? aoVivo.internados / aoVivo.leitos : null
  const nivelOcupacao: Nivel = taxaAoVivo === null ? 'ok' : taxaAoVivo >= 0.95 ? 'critico' : taxaAoVivo >= 0.85 ? 'atencao' : 'ok'

  return (
    <div className="flex w-full flex-col gap-6">
      <TituloPagina
        icone={LineChart}
        titulo="Indicadores"
        descricao="Ocupação, permanência média e giro de leito, alimentados pelos eventos de internação. O censo é gravado por dia e pode ser regenerado."
        acoes={
          <Button variant="outline" size="sm" onClick={() => gerarCenso.mutate()} disabled={gerarCenso.isPending}>
            <RefreshCw className={gerarCenso.isPending ? 'animate-spin' : undefined} /> Gerar censo de hoje
          </Button>
        }
      />

      {/* O painel "Agora": a mesma gramática da faixa de parâmetros. */}
      <section aria-label="Agora" className="grid overflow-hidden rounded-container border border-fio bg-superficie sm:grid-cols-3 [&>*+*]:border-t [&>*+*]:border-trilha sm:[&>*+*]:border-t-0 sm:[&>*+*]:border-l">
        <Parametro
          grandeza="leitos"
          icone={BedDouble}
          rotulo="Internados agora"
          valor={aoVivo.internados}
          unidade={aoVivo.leitos ? `de ${aoVivo.leitos} leitos` : undefined}
          estado={nivelOcupacao === 'critico' ? 'Acima do limite' : nivelOcupacao === 'atencao' ? 'Perto do limite' : 'Dentro da capacidade'}
          nivel={nivelOcupacao}
          pct={taxaAoVivo ?? undefined}
          limite={taxaAoVivo === null ? undefined : 0.85}
          limiteTexto={taxaAoVivo === null ? undefined : 'limite 85%'}
        />
        <Parametro
          grandeza="leitos"
          icone={BarChart3}
          rotulo="Taxa de ocupação agora"
          valor={taxaAoVivo === null ? '—' : Math.round(taxaAoVivo * 100)}
          unidade={taxaAoVivo === null ? undefined : '%'}
          estado={taxaAoVivo === null ? 'Nenhum leito ativo' : 'contagem atual por setor'}
          nivel={nivelOcupacao}
        />
        <Parametro
          grandeza="turno"
          icone={CalendarDays}
          rotulo="Último censo gravado"
          valor={ultimaData ? fmtDia(ultimaData) : '—'}
          estado={ultimaData ? `${totalUnidade.internados} internados de ${totalUnidade.leitos} leitos` : 'Nenhum censo gerado ainda'}
          nivel="ok"
        />
      </section>
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
                    <span className={`text-sm font-semibold ${corTaxa(ultimo.taxa_ocupacao)}`}>
                      {ultimo.taxa_ocupacao != null ? `${ultimo.taxa_ocupacao}%` : '—'} ocupação
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {series.map((c) => (
                      <div key={c.data} className="rounded-lg bg-muted/50 p-2 text-center">
                        <div className="text-[10px] font-medium text-muted-foreground">{fmtDia(c.data)}</div>
                        <div className="text-sm font-semibold">{c.internados}</div>
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
                  <span className={`font-semibold ${lotado ? 'text-critico' : alerta ? 'text-atencao' : 'text-foreground'}`}>
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
