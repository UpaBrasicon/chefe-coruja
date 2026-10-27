import { useQuery } from '@tanstack/react-query'
import { Droplets, Loader2, Pill, ShieldAlert } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { normalizarMedicamento } from '@/lib/search'
import { filtroDaUnidade } from '@/lib/medicamentoCadastro'
import { useUnidade } from '@/contexts/UnidadeContext'
import { dataPura } from '@/lib/formato'
import { TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha } from '@/components/ui/botao-linha'
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

  const unidadeBusca = useUnidade().unidadeAtiva?.unidade_id
  const { data: medicamentos, isLoading } = useQuery({
    queryKey: ['medicamento-catalogo', busca, unidadeBusca],
    enabled: true,
    queryFn: async () => {
      let query = supabase
        .from('medicamento')
        .select('id, principio_ativo, concentracao, apresentacao, rxcui, alta_vigilancia, anvisa_registro')
        .eq('ativo', true).or(filtroDaUnidade(unidadeBusca))
        .order('principio_ativo')
        .limit(200)
      if (busca.trim().length >= 2) {
        query = query.ilike('principio_ativo_norm', `%${normalizarMedicamento(busca.trim())}%`)
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
        <div>
          <Trilha niveis={[{ rotulo: 'Início', to: '/' }, { rotulo: 'Referência de diluição' }]} />
          <TituloPagina
            icone={Droplets}
            titulo="Referência de diluição"
            className="mb-0"
            descricao={
              <>
                API interna <code className="rounded-controle bg-trilha px-1">diluicao_publicada</code> — retorna apenas
                registros <strong>publicados</strong> (revisados por farmacêutico). Registros em rascunho não são
                exibidos.
              </>
            }
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-corpo">
              <Pill className="size-4 text-tinta-sussurro" />
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
                <p className="text-apoio text-tinta-sussurro">Nenhum medicamento encontrado.</p>
              ) : (
                (medicamentos ?? []).map((m) => (
                  <BotaoLinha
                    key={m.id}
                    onClick={() => setSel(m)}
                    className={`items-stretch rounded-controle px-3 py-2 hover:border-fio hover:bg-trilha ${
                      sel?.id === m.id ? 'border-acao bg-acao/5 hover:border-acao' : ''
                    }`}
                  >
                    <span className="flex items-center gap-2 text-apoio font-medium">
                      {m.principio_ativo}
                      {m.alta_vigilancia && <ShieldAlert className="size-3.5 text-atencao" />}
                    </span>
                    <span className="text-rotulo text-tinta-sussurro">
                      {m.concentracao ?? '—'}
                      {m.apresentacao ? ` · ${m.apresentacao}` : ''}
                      {m.rxcui ? ` · rxcui ${m.rxcui}` : ''}
                    </span>
                  </BotaoLinha>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-corpo">
              <Droplets className="size-4 text-tinta-sussurro" />
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
              <p className="text-apoio text-tinta-sussurro">Nenhum medicamento selecionado.</p>
            ) : buscandoDil ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="animate-spin" />
              </div>
            ) : (diluicoes ?? []).length === 0 ? (
              <div className="rounded-controle border border-dashed p-4 text-apoio text-tinta-sussurro">
                Nenhuma diluição <strong>publicada</strong> para este medicamento. Registros em rascunho
                aguardam revisão do farmacêutico.
              </div>
            ) : (
              (diluicoes ?? []).map((d) => (
                <div key={d.id} className="rounded-controle border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-apoio font-semibold">
                    {VIA_LABEL[d.via] ?? d.via}
                    <Badge variant="success">Publicado</Badge>
                    {d.alta_vigilancia && <Badge variant="warning">Alta vigilância</Badge>}
                  </div>
                  <dl className="mt-2 grid gap-1.5 text-apoio">
                    {d.reconstituicao_diluente && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-tinta-sussurro">Reconstituição</dt><dd>{d.reconstituicao_diluente}{d.reconstituicao_volume_ml ? ` · ${d.reconstituicao_volume_ml} mL` : ''}</dd></div>
                    )}
                    {d.diluicao_solucao && d.diluicao_solucao.length > 0 && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-tinta-sussurro">Solução de diluição</dt><dd>{d.diluicao_solucao.join(', ')}{d.diluicao_volume_min_ml ? ` · ${d.diluicao_volume_min_ml} mL` : ''}</dd></div>
                    )}
                    {d.concentracao_maxima && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-tinta-sussurro">Concentração máx.</dt><dd>{d.concentracao_maxima}</dd></div>
                    )}
                    {d.tempo_infusao_min && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-tinta-sussurro">Tempo de infusão</dt><dd>{d.tempo_infusao_min} min</dd></div>
                    )}
                    {d.velocidade_max && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-tinta-sussurro">Velocidade máx.</dt><dd>{d.velocidade_max}</dd></div>
                    )}
                    {d.ajuste_renal === true && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-tinta-sussurro">Ajuste renal</dt><dd>Sim</dd></div>
                    )}
                    {d.acesso && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-tinta-sussurro">Acesso</dt><dd>{d.acesso}</dd></div>
                    )}
                    {d.estabilidade_ta_h != null && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-tinta-sussurro">Estab. T.A.</dt><dd>{d.estabilidade_ta_h} h</dd></div>
                    )}
                    {d.estabilidade_refrig_h != null && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-tinta-sussurro">Estab. geladeira</dt><dd>{d.estabilidade_refrig_h} h</dd></div>
                    )}
                    {d.fotossensivel === true && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-tinta-sussurro">Fotossensível</dt><dd>Sim</dd></div>
                    )}
                    {d.observacoes && (
                      <div className="flex gap-2"><dt className="w-40 shrink-0 text-tinta-sussurro">Observações</dt><dd>{d.observacoes}</dd></div>
                    )}
                  </dl>
                  <p className="mt-2 text-rotulo text-tinta-sussurro">
                    Fonte: {d.fonte}{d.revisor_crf ? ` · revisado por ${d.revisor_crf}` : ''}
                    {d.data_revisao ? ` em ${dataPura(d.data_revisao)}` : ''}
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
