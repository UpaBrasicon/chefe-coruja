import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
          <CardTitle className="text-corpo">Movimento por unidade</CardTitle>
          <CardDescription>Só agregado. Contagens de 1 a 4 aparecem como “&lt; 5” para não identificar ninguém, e a taxa some junto.</CardDescription>
        </div>
        <div className="flex gap-1 text-apoio">
          {[7, 30, 90].map((d) => (
            <Button key={d} type="button" variant="outline" size="sm" aria-pressed={d === dias} onClick={() => setDias(d)}
              className={d === dias ? 'border-acao text-acao' : undefined}>
              {d} dias
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading && <Spinner />}
        {error && <p className="text-apoio text-critico">{(error as Error).message}</p>}
        {data && data.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhuma unidade.</p>}
        {data && data.length > 0 && (
          <Table variante="referencia" className="w-full min-w-[760px] text-apoio">
            <TableHeader className="text-left text-rotulo text-tinta-sussurro">
              <TableRow>
                <TableHead className="py-1.5 font-medium">Unidade</TableHead>
                <TableHead className="font-medium">Leitos ocupados</TableHead>
                <TableHead className="font-medium">Ocupação</TableHead>
                <TableHead className="font-medium">Ocupação média (censo)</TableHead>
                <TableHead className="font-medium">Na porta agora</TableHead>
                <TableHead className="font-medium">Internados</TableHead>
                <TableHead className="font-medium">Chegadas</TableHead>
                <TableHead className="font-medium">Encerrados</TableHead>
                <TableHead className="font-medium">Óbitos</TableHead>
                <TableHead className="font-medium">Evasões</TableHead>
                <TableHead className="font-medium">Em expediente</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.unidade_id} className="border-t tabular">
                  <TableCell className="py-2 font-sans">{u.unidade_nome}</TableCell>
                  <TableCell>{n(u.leitos_ocupados)} de {n(u.leitos)}</TableCell>
                  <TableCell>{pct(u.taxa_ocupacao)}</TableCell>
                  <TableCell>{pct(u.taxa_ocupacao_media_censo)}</TableCell>
                  <TableCell>{n(u.porta_agora)}</TableCell>
                  <TableCell>{n(u.internados_agora)}</TableCell>
                  <TableCell>{n(u.chegadas_periodo)}</TableCell>
                  <TableCell>{n(u.encerrados_periodo)}</TableCell>
                  <TableCell>{n(u.obitos_periodo)}</TableCell>
                  <TableCell>{n(u.evasoes_periodo)}</TableCell>
                  <TableCell>{u.profissionais_em_expediente ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
