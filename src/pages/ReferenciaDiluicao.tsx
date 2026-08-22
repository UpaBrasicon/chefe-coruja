import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Droplets, Loader2, Pill, ShieldAlert } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

type Medicamento = {
  id: string
  principio_ativo: string
  concentracao: string | null
  apresentacao: string | null
  rxcui: string | null
  alta_vigilancia: boolean
  anvisa_registro: string | null
}

type Diluicao = {
  id: string
  principio_ativo: string
  apresentacao: string
  via: string
  reconstituicao_diluente: string | null
  reconstituicao_volume_ml: number | null
  reconstituicao_concentracao: string | null
  diluicao_solucao: string[] | null
  diluicao_volume_min_ml: number | null
  concentracao_maxima: string | null
  tempo_infusao_min: number | null
  velocidade_max: string | null
  bolus_permitido: boolean | null
  estabilidade_ta_h: number | null
  estabilidade_refrig_h: number | null
  fotossensivel: boolean | null
  acesso: string | null
  ajuste_renal: boolean | null
  incompatibilidades: string[] | null
  alta_vigilancia: boolean
  observacoes: string | null
  fonte: string
  data_revisao: string | null
  revisor_crf: string | null
  status: string
}

const VIA_LABEL: Record<string, string> = {
  EV: 'EV',
  IM: 'IM',
  SC: 'SC',
  IN: 'Inalatório',
  VO: 'VO',
  SL: 'Sublingual',
}

export default function ReferenciaDiluicao({ embutido = false }: { embutido?: boolean } = {}) {
  const [busca, setBusca] = React.useState('')

  const { data: medicamentos, isLoading } = useQuery({
    queryKey: ['medicamento-catalogo', busca],
    enabled: true,
    queryFn: async () => {
      let query = supabase
        .from('medicamento')
        .select('id, principio_ativo, concentracao, apresentacao, rxcui, alta_vigilancia, anvisa_registro')
        .eq('ativo', true)
        .order('principio_ativo')
        .limit(200)
      if (busca.trim().length >= 2) {
        query = query.ilike('principio_ativo', `%${busca.trim()}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as Medicamento[]
    },
  })

  const [sel, setSel] = React.useState<Medicamento | null>(null)

  const { data: diluicoes, isFetching: buscandoDil } = useQuery({
    queryKey: ['diluicao-publicada', sel?.id],
    enabled: !!sel,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('diluicao_publicada', { p_medicamento: sel!.id })
      if (error) throw error
      return (data ?? []) as Diluicao[]
    },
  })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {!embutido && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">
              Início
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-foreground">Referência de Diluição</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Referência de Diluição</h1>
          <p className="text-sm text-muted-foreground">
            API interna <code className="rounded bg-muted px-1">diluicao_publicada</code> — retorna apenas
            registros <strong>publicados</strong> (revisados por farmacêutico). Registros em rascunho não são
            exibidos.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pill className="size-4 text-muted-foreground" />
              Medicamentos ({medicamentos?.length ?? '…'})
            </CardTitle>
            <CardDescription>Selecione para ver a diluição publicada.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar por princípio ativo…"
            />
            <div className="flex max-h-[480px] flex-col gap-1.5 overflow-y-auto">
              {isLoading ? (
                <div className="flex h-24 items-center justify-center">
                  <Spinner />
                </div>
              ) : (medicamentos ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum medicamento encontrado.</p>
              ) : (
                (medicamentos ?? []).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSel(m)}
                    className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted ${
                      sel?.id === m.id ? 'border-primary bg-primary/5' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {m.principio_ativo}
                      {m.alta_vigilancia && <ShieldAlert className="size-3.5 text-amber-600" />}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {m.concentracao ?? '—'}
                      {m.apresentacao ? ` · ${m.apresentacao}` : ''}
                      {m.rxcui ? ` · rxcui ${m.rxcui}` : ''}
                    </span>
                  </button>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Droplets className="size-4 text-muted-foreground" />
              {sel ? sel.principio_ativo : 'Diluição publicada'}
            </CardTitle>
            <CardDescription>
              {sel
                ? `Concentração: ${sel.concentracao ?? '—'}${sel.alta_vigilancia ? ' · Alta vigilância (ISMP)' : ''}`
                : 'Selecione um medicamento.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {!sel ? (
              <p className="text-sm text-muted-foreground">Nenhum medicamento selecionado.</p>
            ) : buscandoDil ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="animate-spin" />
              </div>
            ) : (diluicoes ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nenhuma diluição <strong>publicada</strong> para este medicamento. Registros em rascunho
                aguardam revisão do farmacêutico.
              </div>
            ) : (
              (diluicoes ?? []).map((d) => (
                <div key={d.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {VIA_LABEL[d.via] ?? d.via}
                    <Badge variant="success">Publicado</Badge>
                    {d.alta_vigilancia && <Badge variant="warning">Alta vigilância</Badge>}
                  </div>
                  <dl className="mt-2 grid gap-1.5 text-sm">
                    {d.reconstituicao_diluente && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">Reconstituição</dt><dd>{d.reconstituicao_diluente}{d.reconstituicao_volume_ml ? ` · ${d.reconstituicao_volume_ml} mL` : ''}</dd></div>
                    )}
                    {d.diluicao_solucao && d.diluicao_solucao.length > 0 && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">Solução de diluição</dt><dd>{d.diluicao_solucao.join(', ')}{d.diluicao_volume_min_ml ? ` · ${d.diluicao_volume_min_ml} mL` : ''}</dd></div>
                    )}
                    {d.concentracao_maxima && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">Concentração máx.</dt><dd>{d.concentracao_maxima}</dd></div>
                    )}
                    {d.tempo_infusao_min && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">Tempo de infusão</dt><dd>{d.tempo_infusao_min} min</dd></div>
                    )}
                    {d.velocidade_max && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">Velocidade máx.</dt><dd>{d.velocidade_max}</dd></div>
                    )}
                    {d.ajuste_renal === true && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">Ajuste renal</dt><dd>Sim</dd></div>
                    )}
                    {d.acesso && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">Acesso</dt><dd>{d.acesso}</dd></div>
                    )}
                    {d.estabilidade_ta_h != null && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">Estab. T.A.</dt><dd>{d.estabilidade_ta_h} h</dd></div>
                    )}
                    {d.estabilidade_refrig_h != null && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">Estab. geladeira</dt><dd>{d.estabilidade_refrig_h} h</dd></div>
                    )}
                    {d.fotossensivel === true && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">Fotossensível</dt><dd>Sim</dd></div>
                    )}
                    {d.observacoes && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-muted-foreground">Observações</dt><dd>{d.observacoes}</dd></div>
                    )}
                  </dl>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Fonte: {d.fonte}{d.revisor_crf ? ` · revisado por ${d.revisor_crf}` : ''}
                    {d.data_revisao ? ` em ${new Date(d.data_revisao + 'T12:00:00').toLocaleDateString('pt-BR')}` : ''}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
