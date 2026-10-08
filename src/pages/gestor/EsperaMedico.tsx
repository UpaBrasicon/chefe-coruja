import { useQuery } from '@tanstack/react-query'
import { Download, Stethoscope } from 'lucide-react'
import * as React from 'react'

import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { baixarCsv, gerarCsv, nomeArquivoCsv } from '@/lib/csv'
import { minutos, rotuloAlvo, type CorAlvo, type EsperaMedico as Dados } from '@/lib/esperaTriagem'
import { descreverFiltros } from '@/lib/filtrosBi'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

import type { ContextoFiltros } from './useFiltrosBI'

// Indicador triagem → médico (Fase 1, tarefa 4 do BACKLOG). Da 1ª
// classificação até o médico abrir o atendimento; a cor e o alvo são os da
// classificação mais recente antes do médico. Alvos por cor da unidade
// (Unidade › Configurações; sem ajuste, o protocolo). A lista dos atrasados
// traz o nome — o banco registra o acesso na auditoria (migration 20261029000003).

const CORES: CorAlvo[] = ['vermelho', 'laranja', 'amarelo', 'verde', 'azul']
const fmtDia = (iso: string) => iso.split('-').reverse().join('/')
const fmtHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')

export function EsperaMedico({ unidadeId, nomeUnidade, ctx }: { unidadeId: string; nomeUnidade: string; ctx: ContextoFiltros }) {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const [verAtrasados, setVerAtrasados] = React.useState(false)
  const faixa = ctx.faixa

  const { data, isLoading, error } = useQuery({
    queryKey: ['espera-medico', unidadeId, ctx.args],
    enabled: !!faixa.de && !!faixa.ate && faixa.de <= faixa.ate,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('indicador_espera_medico', { p_unidade: unidadeId, ...ctx.args })
      if (error) throw error
      return data as unknown as Dados
    },
  })

  function exportar() {
    if (!data) return
    const contexto: [string, string | number][] = [
      ['Unidade', nomeUnidade], ['Relatório', 'Espera da triagem ao médico'],
      ['Período', `${fmtDia(data.de)} a ${fmtDia(data.ate)}`], ['Filtros', descreverFiltros(ctx.filtros, ctx.nomes)],
      ['Alvos (min)', CORES.map((c) => `${c} ${data.alvos[c]}`).join(', ')],
      ['Base', 'da 1ª classificação ao início do atendimento; cor da última classificação antes do médico'],
      ['Gerado em', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
    ]
    baixarCsv(nomeArquivoCsv(`espera triagem medico ${nomeUnidade}`, hoje), gerarCsv(
      ['Cor', 'Alvo (min)', 'Atendidos', 'Mediana (min)', 'Média (min)', 'Fora do alvo', 'Sem médico'],
      CORES.map((c) => { const v = data.por_cor[c]; return [c, v.alvo_min, v.atendidos, v.mediana_min, v.media_min, v.fora_alvo, v.sem_medico] }),
      { contexto },
    ))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Stethoscope className="size-4 text-tinta-sussurro" />
            Espera da triagem ao médico
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!data || data.classificados === 0}>
            <Download /> Exportar CSV
          </Button>
        </div>
        <CardDescription>
          Da 1ª classificação ao médico abrir o atendimento, pela cor mais recente antes do médico. Alvos por cor em Unidade › Configurações.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">

        {isLoading && <div className="flex h-20 items-center justify-center"><Spinner /></div>}
        {error && <p role="alert" className="text-apoio text-critico">{(error as Error).message}</p>}

        {data && (
          data.classificados === 0 ? (
            <p className="text-sm text-tinta-sussurro">Nenhum paciente classificado no período.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {CORES.map((c) => {
                  const v = data.por_cor[c]
                  return (
                    <div key={c} className="flex flex-col gap-1.5 rounded-lg border border-fio px-3 py-2.5">
                      <PilulaRisco cor={c} className="self-start" />
                      <span className={cn('text-[22px] leading-none font-semibold tabular', v.mediana_min != null && Math.floor(v.mediana_min) > v.alvo_min ? 'text-critico' : 'text-tinta')}>
                        {minutos(v.mediana_min)}
                      </span>
                      <span className="text-rotulo text-tinta-sussurro">mediana · alvo {rotuloAlvo(v.alvo_min)}</span>
                      <span className={cn('text-rotulo', v.fora_alvo > 0 ? 'font-medium text-critico' : 'text-tinta-sussurro')}>
                        {v.atendidos} atendidos · {v.fora_alvo} fora do alvo
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="text-rotulo text-tinta-sussurro">
                {data.classificados} classificados · {data.atendidos} atendidos pelo médico · mediana geral {minutos(data.mediana_min)} ·
                {' '}{data.sem_medico} sem médico (evasão, cancelamento ou ainda aguardando)
              </p>

              {data.atrasados.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-apoio font-medium text-critico">{data.fora_alvo} pacientes passaram do tempo-alvo</span>
                    <Button variant="outline" size="sm" onClick={() => setVerAtrasados((v) => !v)}>
                      {verAtrasados ? 'Esconder lista' : 'Ver quem atrasou'}
                    </Button>
                  </div>
                  {verAtrasados && (
                    <>
                      <span className="text-rotulo text-tinta-sussurro">Acesso registrado na auditoria{data.atrasados.length >= 200 ? ' · mostrando os 200 maiores atrasos' : ''}.</span>
                      <div className="overflow-x-auto rounded-lg border border-fio">
                        <table className="w-full min-w-[640px] text-apoio">
                          <thead className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
                            <tr>
                              <th className="px-3 py-2 font-medium">Paciente</th>
                              <th className="px-3 py-2 font-medium">Cor</th>
                              <th className="px-3 py-2 font-medium">Classificado</th>
                              <th className="px-3 py-2 text-right font-medium">Espera</th>
                              <th className="px-3 py-2 text-right font-medium">Alvo</th>
                              <th className="px-3 py-2 font-medium">Médico</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.atrasados.map((a, i) => (
                              <tr key={i} className="border-b border-trilha last:border-0">
                                <td className="px-3 py-1.5 font-medium text-tinta">{a.nome}</td>
                                <td className="px-3 py-1.5"><PilulaRisco cor={a.cor} /></td>
                                <td className="px-3 py-1.5 tabular text-tinta-apoio">{fmtHora(a.classificado_em)}</td>
                                <td className="px-3 py-1.5 text-right font-semibold tabular text-critico">{minutos(a.espera_min)}</td>
                                <td className="px-3 py-1.5 text-right tabular text-tinta-apoio">{a.alvo_min == null ? '—' : rotuloAlvo(a.alvo_min)}</td>
                                <td className="px-3 py-1.5 text-tinta-apoio">
                                  {a.sem_medico ? (a.desfecho ? `não atendido (${a.desfecho.replace(/_/g, ' ')})` : 'ainda aguardando') : fmtHora(a.atendido_em!)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )
        )}
      </CardContent>
    </Card>
  )
}
