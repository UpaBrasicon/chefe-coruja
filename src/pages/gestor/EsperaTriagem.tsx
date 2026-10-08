import { useQuery } from '@tanstack/react-query'
import { Download, Timer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { baixarCsv, gerarCsv, nomeArquivoCsv } from '@/lib/csv'
import { minutos, type EsperaTriagem as Dados } from '@/lib/esperaTriagem'
import { descreverFiltros } from '@/lib/filtrosBi'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import type { ContextoFiltros } from './useFiltrosBI'

// Indicador chegada → triagem (Fase 1, tarefa 3 do BACKLOG). Base: da ficha
// na recepção à primeira classificação (reclassificação não conta), com o
// alvo da unidade (padrão 10 min, Unidade › Configurações). A espera até ser
// chamado aparece ao lado, para o gestor ter noção da espera na cadeira.
// Só números agregados (migration 20261029000002).


const fmtDia = (iso: string) => iso.split('-').reverse().join('/')

export function EsperaTriagem({ unidadeId, nomeUnidade, ctx }: { unidadeId: string; nomeUnidade: string; ctx: ContextoFiltros }) {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const faixa = ctx.faixa

  const { data, isLoading, error } = useQuery({
    queryKey: ['espera-triagem', unidadeId, ctx.args],
    enabled: !!faixa.de && !!faixa.ate && faixa.de <= faixa.ate,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('indicador_espera_triagem', { p_unidade: unidadeId, ...ctx.args })
      if (error) throw error
      return data as unknown as Dados
    },
  })

  function exportar() {
    if (!data) return
    baixarCsv(nomeArquivoCsv(`espera chegada triagem ${nomeUnidade}`, hoje), gerarCsv(
      ['Data', 'Chegadas', 'Triados', 'Média até a triagem (min)', 'Mediana até a triagem (min)', `Fora do alvo de ${data.alvo_min} min`, 'Mediana até a chamada (min)'],
      data.por_dia.map((d) => [fmtDia(d.dia), d.chegadas, d.triados, d.media_min, d.mediana_min, d.fora_alvo, d.chamada_mediana_min]),
      { contexto: [
        ['Unidade', nomeUnidade], ['Relatório', 'Espera da chegada à triagem'],
        ['Período', `${fmtDia(data.de)} a ${fmtDia(data.ate)}`], ['Filtros', descreverFiltros(ctx.filtros, ctx.nomes)], ['Alvo (min)', data.alvo_min],
        ['Base', 'da ficha na recepção à primeira classificação; reclassificação não conta'],
        ['Gerado em', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
      ] },
    ))
  }

  const pctFora = data && data.triados > 0 ? Math.round((data.fora_alvo / data.triados) * 100) : null

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Timer className="size-4 text-tinta-sussurro" />
            Espera da chegada à triagem
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!data || data.por_dia.length === 0}>
            <Download /> Exportar CSV
          </Button>
        </div>
        <CardDescription>
          Da ficha na recepção à classificação de risco{data ? ` · alvo ${data.alvo_min} min (Unidade › Configurações)` : ''}. Ao lado, a espera até ser chamado.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">

        {isLoading && <div className="flex h-20 items-center justify-center"><Spinner /></div>}
        {error && <p role="alert" className="text-apoio text-critico">{(error as Error).message}</p>}

        {data && (
          data.chegadas === 0 ? (
            <p className="text-sm text-tinta-sussurro">Nenhuma chegada no período.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Numero rotulo="Mediana até a triagem" valor={minutos(data.mediana_min)} fora={data.mediana_min != null && data.mediana_min > data.alvo_min} />
                <Numero rotulo="Média até a triagem" valor={minutos(data.media_min)} fora={data.media_min != null && data.media_min > data.alvo_min} />
                <Numero rotulo={`Fora do alvo (${data.alvo_min} min)`} valor={`${data.fora_alvo}`} detalhe={pctFora != null ? `${pctFora}% dos triados` : undefined} fora={data.fora_alvo > 0} />
                <Numero rotulo="Mediana até ser chamado" valor={minutos(data.chamada.mediana_min)}
                  detalhe={data.chamada.chamados ? `${data.chamada.chamados} chamados pelo painel` : 'nenhum "Chamar" no período'} />
              </div>
              <p className="text-rotulo text-tinta-sussurro">
                {data.chegadas} chegadas · {data.triados} triados · {data.sem_triagem} sem classificação (aguardando, evadidos ou cancelados)
                {data.p90_min != null ? ` · 9 em cada 10 triados em até ${minutos(data.p90_min)}` : ''}
              </p>
              {data.por_dia.length > 1 && (
                <div className="overflow-x-auto rounded-lg border border-fio">
                  <table className="w-full min-w-[560px] text-apoio">
                    <thead className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
                      <tr>
                        <th className="px-3 py-2 font-medium">Dia</th>
                        <th className="px-3 py-2 text-right font-medium">Chegadas</th>
                        <th className="px-3 py-2 text-right font-medium">Mediana</th>
                        <th className="px-3 py-2 text-right font-medium">Média</th>
                        <th className="px-3 py-2 text-right font-medium">Fora do alvo</th>
                        <th className="px-3 py-2 text-right font-medium">Até a chamada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.por_dia.map((d) => (
                        <tr key={d.dia} className="border-b border-trilha last:border-0 tabular">
                          <td className="px-3 py-1.5">{fmtDia(d.dia)}</td>
                          <td className="px-3 py-1.5 text-right">{d.chegadas}</td>
                          <td className={cn('px-3 py-1.5 text-right', d.mediana_min != null && d.mediana_min > data.alvo_min && 'font-semibold text-critico')}>{minutos(d.mediana_min)}</td>
                          <td className="px-3 py-1.5 text-right">{minutos(d.media_min)}</td>
                          <td className={cn('px-3 py-1.5 text-right', d.fora_alvo > 0 && 'text-critico')}>{d.fora_alvo}</td>
                          <td className="px-3 py-1.5 text-right">{minutos(d.chamada_mediana_min)}</td>
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

function Numero({ rotulo, valor, detalhe, fora }: { rotulo: string; valor: string; detalhe?: string; fora?: boolean }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-fio px-3 py-2.5">
      <span className="text-rotulo text-tinta-apoio">{rotulo}</span>
      <span className={cn('text-[22px] leading-none font-semibold tabular', fora ? 'text-critico' : 'text-tinta')}>{valor}</span>
      {detalhe && <span className="text-rotulo text-tinta-sussurro">{detalhe}</span>}
    </div>
  )
}
