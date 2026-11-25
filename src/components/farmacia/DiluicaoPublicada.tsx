// Diluição publicada de um medicamento (API diluicao_publicada: só registros
// revisados por farmacêutico). Mesma ficha na Referência de diluição e na
// Consulta de medicamentos do médico (revisão da Farmácia do médico, 24/11/2026).
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { dataPura } from '@/lib/formato'
import { SeloAltaVigilancia } from '@/components/farmacia/SeloAltaVigilancia'

export type Diluicao = {
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

function useDiluicaoPublicada(medicamentoId: string | null | undefined) {
  return useQuery({
    queryKey: ['diluicao-publicada', medicamentoId],
    enabled: !!medicamentoId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('diluicao_publicada', { p_medicamento: medicamentoId! })
      if (error) throw error
      return (data ?? []) as Diluicao[]
    },
  })
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-trilha py-1.5 last:border-0">
      <dt className="w-40 shrink-0 text-tinta-sussurro">{rotulo}</dt>
      <dd className="min-w-0 text-tinta">{children}</dd>
    </div>
  )
}

/** As diluições publicadas do medicamento, ou o vazio que explica. */
export function DiluicoesPublicadas({ medicamentoId }: { medicamentoId: string }) {
  const { data: diluicoes, isFetching, isError } = useDiluicaoPublicada(medicamentoId)
  if (isFetching && !diluicoes) {
    return (
      <div role="status" className="flex h-20 items-center justify-center gap-2 text-apoio text-tinta-sussurro">
        <Loader2 className="size-4 animate-spin" aria-hidden /> Carregando a diluição…
      </div>
    )
  }
  if (isError) return <p className="text-apoio text-tinta">Não foi possível carregar a diluição agora.</p>
  if (!diluicoes?.length) {
    return (
      <p className="rounded-controle border border-dashed border-fio p-3 text-apoio text-tinta-sussurro">
        Nenhuma diluição publicada para este medicamento. Registros em rascunho aguardam revisão do farmacêutico.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {diluicoes.map((d) => (
        <section key={d.id} aria-label={`Via ${VIA_LABEL[d.via] ?? d.via}`}>
          <p className="flex flex-wrap items-center gap-2 text-apoio font-semibold text-tinta">
            Via {VIA_LABEL[d.via] ?? d.via}
            {d.alta_vigilancia && <SeloAltaVigilancia />}
          </p>
          <dl className="mt-1 text-apoio">
            {d.reconstituicao_diluente && <Linha rotulo="Reconstituição">{d.reconstituicao_diluente}{d.reconstituicao_volume_ml ? ` · ${d.reconstituicao_volume_ml} mL` : ''}</Linha>}
            {d.diluicao_solucao && d.diluicao_solucao.length > 0 && <Linha rotulo="Solução de diluição">{d.diluicao_solucao.join(', ')}{d.diluicao_volume_min_ml ? ` · ${d.diluicao_volume_min_ml} mL` : ''}</Linha>}
            {d.concentracao_maxima && <Linha rotulo="Concentração máx.">{d.concentracao_maxima}</Linha>}
            {d.tempo_infusao_min && <Linha rotulo="Tempo de infusão">{d.tempo_infusao_min} min</Linha>}
            {d.velocidade_max && <Linha rotulo="Velocidade máx.">{d.velocidade_max}</Linha>}
            {d.ajuste_renal === true && <Linha rotulo="Ajuste renal">Sim</Linha>}
            {d.acesso && <Linha rotulo="Acesso">{d.acesso}</Linha>}
            {d.estabilidade_ta_h != null && <Linha rotulo="Estab. T.A.">{d.estabilidade_ta_h} h</Linha>}
            {d.estabilidade_refrig_h != null && <Linha rotulo="Estab. geladeira">{d.estabilidade_refrig_h} h</Linha>}
            {d.fotossensivel === true && <Linha rotulo="Fotossensível">Sim</Linha>}
            {d.observacoes && <Linha rotulo="Observações">{d.observacoes}</Linha>}
          </dl>
          <p className="mt-1.5 text-rotulo text-tinta-sussurro">
            Fonte: {d.fonte}{d.revisor_crf ? ` · revisado por ${d.revisor_crf}` : ''}
            {d.data_revisao ? ` em ${dataPura(d.data_revisao)}` : ''}
          </p>
        </section>
      ))}
    </div>
  )
}
