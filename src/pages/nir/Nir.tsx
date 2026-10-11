// ─────────────────────────────────────────────────────────────────────────────
// NIR — Núcleo Interno de Regulação (Fase 4, tarefa 11; decisões do RT de
// 11/10/2026).
//
// Painel de pendências da unidade: AIH (internação sem AIH, sem decisão,
// rejeitada sem nova), APAC (sem decisão, rejeitada sem nova) e regulações
// (pendência e evolução vencidas, destino sem resposta, chegada sem registro).
// Cada uma mostra o responsável e o tempo parado; "Cobrar" manda aviso ao
// responsável e fica registrado quem cobrou e quando. Veem o NIR (no plantão)
// e o gestor. Migrations 20261117000001/2.
// ─────────────────────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ClipboardList } from 'lucide-react'
import * as React from 'react'

import { TituloPagina, Vazio } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtDataHora } from '@/lib/datas'
import { GRUPOS_NIR, filtrarPendencias, type GrupoNir, type PendenciaNir } from '@/lib/nir'
import { formatarEspera } from '@/lib/regulacao'
import { supabase } from '@/lib/supabase'

type Resposta = { itens: PendenciaNir[]; resumo: Record<GrupoNir, number>; agora: string }

export default function Nir() {
  const qc = useQueryClient()
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id ?? ''
  const [grupo, setGrupo] = React.useState<GrupoNir | 'todos'>('todos')
  const painel = useQuery({
    queryKey: ['nir-pendencias', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('nir_pendencias', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as Resposta
    },
  })
  const cobrar = useMutation({
    mutationFn: async (p: PendenciaNir) => {
      const { data, error } = await supabase.rpc('nir_cobrar', { p_unidade: unidadeId, p_tipo: p.tipo, p_ref: p.ref_id })
      if (error) throw error
      return data as number
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['nir-pendencias', unidadeId] }),
  })
  const r = painel.data
  const itens = filtrarPendencias(r?.itens ?? [], grupo)
  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina icone={ClipboardList} titulo="NIR — pendências da unidade"
        descricao="AIH, APAC e regulações paradas, com o responsável e o tempo parado. Cobrar avisa o responsável e fica registrado." />
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Pendências
            {r && (Object.keys(GRUPOS_NIR) as GrupoNir[]).map((g) => r.resumo[g] > 0 && <Badge key={g} variant="warning">{GRUPOS_NIR[g]}: {r.resumo[g]}</Badge>)}
          </CardTitle>
          <CardDescription>Mais antigas primeiro. Atualiza a cada minuto.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-apoio">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Assunto">
            {(['todos', ...Object.keys(GRUPOS_NIR)] as (GrupoNir | 'todos')[]).map((g) => (
              <Button key={g} size="xs" variant={grupo === g ? 'default' : 'outline'} onClick={() => setGrupo(g)}>
                {g === 'todos' ? 'Todas' : GRUPOS_NIR[g]}
              </Button>
            ))}
          </div>
          {painel.isLoading ? <Spinner /> : painel.error ? <p role="alert" className="text-critico">{(painel.error as Error).message}</p>
            : itens.length === 0 ? <Vazio icone={ClipboardList} titulo="Nada parado" texto="Nenhuma pendência neste assunto." /> : (
              <ul className="flex flex-col divide-y divide-fio">
                {itens.map((p) => (
                  <li key={`${p.tipo}-${p.ref_id}`} className="flex flex-wrap items-center gap-2 py-2">
                    <Badge variant="secondary">{GRUPOS_NIR[p.grupo]}</Badge>
                    <span className="font-medium text-tinta">{p.titulo}</span>
                    {p.paciente && <span className="text-tinta-apoio">{p.paciente}</span>}
                    <span className="font-semibold tabular-nums text-atencao">parado há {formatarEspera(p.parado_seg)}</span>
                    <span className="w-full text-rotulo text-tinta-sussurro">
                      Responsável: {p.responsavel ?? '—'}
                      {p.ultima_cobranca && <> · cobrado {p.ultima_cobranca.vezes}× — última por {p.ultima_cobranca.por ?? '—'} em {fmtDataHora(p.ultima_cobranca.em)}</>}
                    </span>
                    {p.pode_cobrar && (
                      <Button size="xs" variant="outline" className="ml-auto" onClick={() => cobrar.mutate(p)} disabled={cobrar.isPending}>Cobrar</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          {cobrar.error && <p role="alert" className="text-rotulo text-critico">{(cobrar.error as Error).message}</p>}
          {cobrar.isSuccess && <p className="text-rotulo text-conforme">Cobrança enviada a {cobrar.data} pessoa(s).</p>}
        </CardContent>
      </Card>
    </div>
  )
}
