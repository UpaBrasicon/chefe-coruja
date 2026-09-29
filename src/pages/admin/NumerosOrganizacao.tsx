import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { supabase } from '@/lib/supabase'

// Fase 6: números da organização por unidade, em agregado (painel_organizacao).
// Contagem de 1 a 4 volta vazia do banco (supressão de célula pequena, ADR
// 0002) e aparece aqui como "< 5". Nenhuma identidade de paciente.

type Linha = {
  unidade_id: string
  unidade_nome: string
  leitos: number | null
  leitos_ocupados: number | null
  taxa_ocupacao: number | null
  porta_agora: number | null
  internados_agora: number | null
  chegadas_periodo: number | null
  encerrados_periodo: number | null
  obitos_periodo: number | null
  evasoes_periodo: number | null
  profissionais_em_expediente: number | null
  taxa_ocupacao_media_censo: number | null
}

const n = (v: number | null) => (v === null ? '< 5' : String(v))
const pct = (v: number | null) => (v === null ? '—' : `${String(v).replace('.', ',')}%`)

export function NumerosOrganizacao() {
  const [dias, setDias] = React.useState(30)
  const { data, isLoading, error } = useQuery({
    queryKey: ['painel-organizacao', dias],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_organizacao', { p_dias: dias })
      if (error) throw error
      return (data ?? []) as Linha[]
    },
  })

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Movimento por unidade</CardTitle>
          <CardDescription>Só agregado. Contagens de 1 a 4 aparecem como “&lt; 5” para não identificar ninguém, e a taxa some junto.</CardDescription>
        </div>
        <div className="flex gap-1 text-sm">
          {[7, 30, 90].map((d) => (
            <button key={d} type="button" onClick={() => setDias(d)}
              className={`rounded-md border px-2.5 py-1 ${d === dias ? 'border-acao text-acao' : 'border-fio text-tinta-apoio'}`}>
              {d} dias
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading && <Spinner />}
        {error && <p className="text-sm text-critico">{(error as Error).message}</p>}
        {data && data.length === 0 && <p className="text-sm text-tinta-sussurro">Nenhuma unidade.</p>}
        {data && data.length > 0 && (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-xs text-tinta-sussurro">
              <tr>
                <th className="py-1.5 font-medium">Unidade</th>
                <th className="font-medium">Leitos ocupados</th>
                <th className="font-medium">Ocupação</th>
                <th className="font-medium">Ocupação média (censo)</th>
                <th className="font-medium">Na porta agora</th>
                <th className="font-medium">Internados</th>
                <th className="font-medium">Chegadas</th>
                <th className="font-medium">Encerrados</th>
                <th className="font-medium">Óbitos</th>
                <th className="font-medium">Evasões</th>
                <th className="font-medium">Em expediente</th>
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.unidade_id} className="border-t tabular">
                  <td className="py-2 font-sans">{u.unidade_nome}</td>
                  <td>{n(u.leitos_ocupados)} de {n(u.leitos)}</td>
                  <td>{pct(u.taxa_ocupacao)}</td>
                  <td>{pct(u.taxa_ocupacao_media_censo)}</td>
                  <td>{n(u.porta_agora)}</td>
                  <td>{n(u.internados_agora)}</td>
                  <td>{n(u.chegadas_periodo)}</td>
                  <td>{n(u.encerrados_periodo)}</td>
                  <td>{n(u.obitos_periodo)}</td>
                  <td>{n(u.evasoes_periodo)}</td>
                  <td>{u.profissionais_em_expediente ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}
