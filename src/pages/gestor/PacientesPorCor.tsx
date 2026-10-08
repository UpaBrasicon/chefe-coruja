import { useQuery } from '@tanstack/react-query'
import { Download, Palette } from 'lucide-react'

import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { baixarCsv, gerarCsv, nomeArquivoCsv } from '@/lib/csv'
import { percentual, type CorAlvo, type PacientesPorCor as Dados } from '@/lib/esperaTriagem'
import { descreverFiltros } from '@/lib/filtrosBi'
import { supabase } from '@/lib/supabase'

import type { ContextoFiltros } from './useFiltrosBI'

// Pacientes por classificação de risco (Fase 1, tarefa 5 do BACKLOG): cada
// paciente na cor final (última classificação), com os reclassificados à
// parte; filtros de período, setor de entrada, adulto/pediátrico e turno pela
// hora de chegada. Só números agregados (migration 20261029000005).

const CORES: CorAlvo[] = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul']
const BARRA: Record<CorAlvo | 'sem_classificacao', string> = {
  vermelho: 'bg-mts-vermelho', laranja: 'bg-mts-laranja', amarelo: 'bg-mts-amarelo', verde: 'bg-mts-verde', azul: 'bg-mts-azul',
  sem_classificacao: 'bg-[repeating-linear-gradient(45deg,#CBD5E1_0_3px,transparent_3px_6px)]',
}
const fmtDia = (iso: string) => iso.split('-').reverse().join('/')

export function PacientesPorCor({ unidadeId, nomeUnidade, ctx }: { unidadeId: string; nomeUnidade: string; ctx: ContextoFiltros }) {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const faixa = ctx.faixa

  const { data, isLoading, error } = useQuery({
    queryKey: ['pacientes-por-cor', unidadeId, ctx.args],
    enabled: !!faixa.de && !!faixa.ate && faixa.de <= faixa.ate,
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pacientes_por_cor', { p_unidade: unidadeId, ...ctx.args })
      if (error) throw error
      return data as unknown as Dados
    },
  })

  function exportar() {
    if (!data) return
    baixarCsv(nomeArquivoCsv(`pacientes por cor ${nomeUnidade}`, hoje), gerarCsv(
      ['Data', 'Total', 'Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul', 'Sem classificação'],
      data.por_dia.map((d) => [fmtDia(d.dia), d.total, d.vermelho, d.laranja, d.amarelo, d.verde, d.azul, d.sem_classificacao]),
      { contexto: [
        ['Unidade', nomeUnidade], ['Relatório', 'Pacientes por classificação de risco (cor final)'],
        ['Período', `${fmtDia(data.de)} a ${fmtDia(data.ate)}`], ['Filtros', descreverFiltros(ctx.filtros, ctx.nomes)],
        ['Reclassificados', `${data.reclassificados.total} (${data.reclassificados.subiram} subiram, ${data.reclassificados.baixaram} baixaram)`],
        ['Gerado em', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
      ] },
    ))
  }

  const linhas: (CorAlvo | 'sem_classificacao')[] = [...CORES, 'sem_classificacao']

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="size-4 text-tinta-sussurro" />
            Pacientes por classificação de risco
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!data || data.total === 0}>
            <Download /> Exportar CSV
          </Button>
        </div>
        <CardDescription>Cada paciente na cor final (última classificação). Reclassificados à parte.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">

        {isLoading && <div className="flex h-20 items-center justify-center"><Spinner /></div>}
        {error && <p role="alert" className="text-apoio text-critico">{(error as Error).message}</p>}

        {data && (
          data.total === 0 ? (
            <p className="text-sm text-tinta-sussurro">Nenhuma chegada com esses filtros.</p>
          ) : (
            <>
              <div className="flex flex-col gap-2" role="list" aria-label="Pacientes por cor">
                {linhas.map((c) => {
                  const n = data.por_cor[c]
                  return (
                    <div key={c} role="listitem" className="flex items-center gap-3 text-apoio">
                      <span className="w-[130px] shrink-0">
                        {c === 'sem_classificacao' ? <PilulaRisco cor={null} /> : <PilulaRisco cor={c} />}
                      </span>
                      <div className="relative h-3 flex-1 rounded-capsula bg-trilha" aria-hidden>
                        <div className={`absolute inset-y-0 left-0 rounded-capsula ${BARRA[c]}`} style={{ width: `${data.total ? (n / data.total) * 100 : 0}%` }} />
                      </div>
                      <span className="w-[92px] text-right tabular font-semibold text-tinta">
                        {n} <span className="font-normal text-tinta-sussurro">· {percentual(n, data.total)}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-rotulo text-tinta-sussurro">
                {data.total} chegadas · {data.reclassificados.total} reclassificados
                ({data.reclassificados.subiram} subiram de gravidade, {data.reclassificados.baixaram} baixaram)
              </p>
              {data.por_dia.length > 1 && (
                <div className="overflow-x-auto rounded-lg border border-fio">
                  <table className="w-full min-w-[600px] text-apoio">
                    <thead className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
                      <tr>
                        <th className="px-3 py-2 font-medium">Dia</th>
                        <th className="px-3 py-2 text-right font-medium">Total</th>
                        {CORES.map((c) => <th key={c} className="px-3 py-2 text-right font-medium capitalize">{c}</th>)}
                        <th className="px-3 py-2 text-right font-medium">Sem class.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.por_dia.map((d) => (
                        <tr key={d.dia} className="border-b border-trilha last:border-0 tabular">
                          <td className="px-3 py-1.5">{fmtDia(d.dia)}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{d.total}</td>
                          {CORES.map((c) => <td key={c} className="px-3 py-1.5 text-right">{d[c]}</td>)}
                          <td className="px-3 py-1.5 text-right">{d.sem_classificacao}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )
        )}
      </CardContent>
    </Card>
  )
}
