import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, BedDouble, Hourglass, LineChart, RefreshCw, Repeat } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { TituloPagina } from '@/components/monitor/Pagina'
import { Parametro, type Nivel } from '@/components/monitor/Parametros'
import { PanoramaConfig } from '@/pages/gestor/PanoramaConfig'
import { useLimitesUnidade } from '@/pages/gestor/limites'

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

// taxa em %; atenção a partir do limite da unidade, crítico 5 pontos acima
function corTaxa(taxa: number | null, limitePct: number) {
  if (taxa == null) return 'text-tinta-sussurro'
  if (taxa >= Math.min(100, limitePct + 5)) return 'text-critico'
  if (taxa >= limitePct) return 'text-atencao'
  return 'text-conforme'
}

export default function Indicadores() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const queryClient = useQueryClient()
  const { limites } = useLimitesUnidade(unidadeId)

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

  // permanência média e giro do último censo gravado (média dos setores com dado)
  const ultimoCenso = React.useMemo(() => {
    const doDia = (censo ?? []).filter((c) => c.data === ultimaData)
    const perm = doDia.filter((c) => c.permanencia_media_h != null)
    const giro = doDia.filter((c) => c.giro_leito != null)
    return {
      permanenciaD: perm.length ? perm.reduce((a, c) => a + Number(c.permanencia_media_h), 0) / perm.length / 24 : null,
      giro: giro.length ? giro.reduce((a, c) => a + Number(c.giro_leito), 0) / giro.length : null,
    }
  }, [censo, ultimaData])

  const aoVivo = {
    internados: (ocupacao ?? []).reduce((a, o) => a + o.internados, 0),
    leitos: (ocupacao ?? []).reduce((a, o) => a + o.limite, 0),
  }
  const taxaAoVivo = aoVivo.leitos > 0 ? aoVivo.internados / aoVivo.leitos : null
  // limite de atenção da unidade (Unidade › Configurações; padrão 85%)
  const lim = limites.ocupacao_pct / 100
  const nivelOcupacao: Nivel = taxaAoVivo === null ? 'ok' : taxaAoVivo >= Math.max(0.95, lim) ? 'critico' : taxaAoVivo >= lim ? 'atencao' : 'ok'

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
      <section aria-label="Agora" className="grid overflow-hidden rounded-container border border-fio bg-superficie grid-cols-2 lg:grid-cols-4 [&>*]:border-trilha [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0 [&>*:nth-child(even)]:border-l lg:[&>*+*]:border-l">
        <Parametro
          grandeza="leitos"
          icone={BedDouble}
          rotulo="Internados agora"
          valor={aoVivo.internados}
          unidade={aoVivo.leitos ? `de ${aoVivo.leitos} leitos` : undefined}
          estado={nivelOcupacao === 'critico' ? 'Acima do limite' : nivelOcupacao === 'atencao' ? 'Perto do limite' : 'Dentro da capacidade'}
          nivel={nivelOcupacao}
          pct={taxaAoVivo ?? undefined}
          limite={taxaAoVivo === null ? undefined : lim}
          limiteTexto={taxaAoVivo === null ? undefined : `limite ${limites.ocupacao_pct}%`}
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
          icone={Hourglass}
          rotulo="Média de permanência"
          valor={ultimoCenso.permanenciaD == null ? '—' : ultimoCenso.permanenciaD.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          unidade={ultimoCenso.permanenciaD == null ? undefined : 'dias'}
          estado={ultimaData ? `censo de ${fmtDia(ultimaData)} · ${totalUnidade.internados} de ${totalUnidade.leitos} leitos` : 'Nenhum censo gerado ainda'}
          nivel="ok"
        />
        <Parametro
          grandeza="turno"
          icone={Repeat}
          rotulo="Giro de leito"
          valor={ultimoCenso.giro == null ? '—' : ultimoCenso.giro.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
          estado={ultimaData ? 'saídas por leito, último censo' : 'Nenhum censo gerado ainda'}
          nivel="ok"
        />
      </section>
      {/* Censo por setor (série de 7 dias) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-tinta-sussurro" />
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
            <p className="text-sm text-tinta-sussurro">
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
                    <span className={`text-sm font-semibold ${corTaxa(ultimo.taxa_ocupacao, limites.ocupacao_pct)}`}>
                      {ultimo.taxa_ocupacao != null ? `${ultimo.taxa_ocupacao}%` : '—'} ocupação
                    </span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {series.map((c) => (
                      <div key={c.data} className="rounded-lg bg-trilha/50 p-2 text-center">
                        <div className="text-[10px] font-medium text-tinta-sussurro">{fmtDia(c.data)}</div>
                        <div className="text-sm font-semibold">{c.internados}</div>
                        <div className="text-[10px] text-tinta-sussurro">
                          {c.permanencia_media_h != null ? `${c.permanencia_media_h}h` : '—'}
                        </div>
                        <div className="text-[10px] text-tinta-sussurro">giro {c.giro_leito ?? '—'}</div>
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
            <p className="text-sm text-tinta-sussurro">Nenhum setor com ocupação.</p>
          ) : (
            (ocupacao ?? []).map((o) => {
              const lotado = o.limite > 0 && o.internados >= o.limite
              const alerta = o.limite > 0 && o.internados >= Math.ceil(o.limite * 0.85)
              const p = o.limite > 0 ? Math.min(1, o.internados / o.limite) : 0
              return (
                <div key={o.setor_id} className="flex items-center gap-3 py-1.5 text-apoio">
                  <span className="w-[40%] min-w-0 truncate font-medium text-tinta sm:w-[180px]">{o.setor_nome}</span>
                  <div className="relative h-1.5 flex-1 rounded-capsula bg-trilha" aria-hidden>
                    <div className={`absolute inset-y-0 left-0 rounded-capsula ${alerta ? 'bg-atencao' : 'bg-conforme'}`} style={{ width: `${p * 100}%` }} />
                  </div>
                  <span className={`w-[92px] text-right font-semibold tabular ${lotado ? 'text-critico' : alerta ? 'text-atencao' : 'text-tinta'}`}>
                    {o.limite > 0 ? `${Math.round((o.internados / o.limite) * 100)}%` : '—'}
                    <span className="font-normal text-tinta-sussurro"> · {o.internados}/{o.limite || '∞'}</span>
                  </span>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {papelAtivo === 'gestor' && unidadeId && <PanoramaConfig unidadeId={unidadeId} />}
    </div>
  )
}
