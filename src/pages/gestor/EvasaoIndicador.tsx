import { useQuery } from '@tanstack/react-query'
import { Download, LogOut } from 'lucide-react'
import * as React from 'react'

import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { CorRisco } from '@/domain/risco'
import { baixarCsv, gerarCsv, nomeArquivoCsv } from '@/lib/csv'
import { MOMENTOS_EVASAO, MOTIVOS_EVASAO, rotuloMomento, rotuloMotivo, taxa, type IndicadorEvasao } from '@/lib/evasao'
import { descreverFiltros } from '@/lib/filtrosBi'
import { supabase } from '@/lib/supabase'

import type { ContextoFiltros } from './useFiltrosBI'

// Evasão e abandono (Fase 1, tarefa 6 do BACKLOG): taxa de evasão sobre as
// chegadas, pelo momento em que o paciente saiu, pelo motivo (lista curta
// pedida ao registrar), pela cor e pelo turno; alta a pedido em taxa separada.
// A lista dos casos traz o nome — o banco registra o acesso na auditoria
// (migration 20261029000006).

const TURNOS = [['manha', 'Manhã (07–13)'], ['tarde', 'Tarde (13–19)'], ['noite', 'Noite (19–07)']] as const
const fmtDia = (iso: string) => iso.split('-').reverse().join('/')
const fmtHora = (iso: string | null) => iso
  ? new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' ·')
  : '—'

function Barras({ titulo, itens, total }: { titulo: string; itens: { rotulo: string; n: number }[]; total: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-fio px-3 py-2.5">
      <span className="text-rotulo font-medium text-tinta-apoio">{titulo}</span>
      {itens.map((i) => (
        <div key={i.rotulo} className="flex items-center gap-2 text-apoio">
          <span className="w-[150px] shrink-0 truncate text-tinta-apoio">{i.rotulo}</span>
          <div className="relative h-2 flex-1 rounded-capsula bg-trilha" aria-hidden>
            <div className="absolute inset-y-0 left-0 rounded-capsula bg-atencao" style={{ width: `${total ? (i.n / total) * 100 : 0}%` }} />
          </div>
          <span className="w-8 text-right tabular font-semibold text-tinta">{i.n}</span>
        </div>
      ))}
    </div>
  )
}

export function EvasaoIndicador({ unidadeId, nomeUnidade, ctx }: { unidadeId: string; nomeUnidade: string; ctx: ContextoFiltros }) {
  const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const [verCasos, setVerCasos] = React.useState(false)
  const faixa = ctx.faixa

  const { data, isLoading, error } = useQuery({
    queryKey: ['indicador-evasao', unidadeId, ctx.args],
    enabled: !!faixa.de && !!faixa.ate && faixa.de <= faixa.ate,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('indicador_evasao', { p_unidade: unidadeId, ...ctx.args })
      if (error) throw error
      return data as unknown as IndicadorEvasao
    },
  })

  function exportar() {
    if (!data) return
    baixarCsv(nomeArquivoCsv(`evasao ${nomeUnidade}`, hoje), gerarCsv(
      ['Data', 'Chegadas', 'Evasões', 'Taxa de evasão (%)', 'Altas a pedido', 'Taxa de alta a pedido (%)'],
      data.por_dia.map((d) => [
        fmtDia(d.dia), d.chegadas, d.evasoes, d.chegadas ? Math.round((d.evasoes / d.chegadas) * 1000) / 10 : null,
        d.alta_a_pedido, d.chegadas ? Math.round((d.alta_a_pedido / d.chegadas) * 1000) / 10 : null,
      ]),
      { contexto: [
        ['Unidade', nomeUnidade], ['Relatório', 'Evasão e alta a pedido'], ['Período', `${fmtDia(data.de)} a ${fmtDia(data.ate)}`], ['Filtros', descreverFiltros(ctx.filtros, ctx.nomes)],
        ['Evasões por momento', MOMENTOS_EVASAO.map((m) => `${m.rotulo} ${data.por_momento[m.valor]}`).join('; ')],
        ['Evasões por motivo', MOTIVOS_EVASAO.map((m) => `${m.rotulo} ${data.por_motivo[m.valor]}`).join('; ')],
        ['Gerado em', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
      ] },
    ))
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <LogOut className="size-4 text-tinta-sussurro" />
            Evasão e alta a pedido
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!data || data.chegadas === 0}>
            <Download /> Exportar CSV
          </Button>
        </div>
        <CardDescription>Sobre as chegadas do período. Alta a pedido em taxa separada; não soma com a evasão.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">

        {isLoading && <div className="flex h-20 items-center justify-center"><Spinner /></div>}
        {error && <p role="alert" className="text-apoio text-critico">{(error as Error).message}</p>}

        {data && (
          data.chegadas === 0 ? (
            <p className="text-sm text-tinta-sussurro">Nenhuma chegada no período.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <div className="flex flex-col gap-1 rounded-lg border border-fio px-3 py-2.5">
                  <span className="text-rotulo text-tinta-apoio">Taxa de evasão</span>
                  <span className={`text-[22px] leading-none font-semibold tabular ${data.evasoes > 0 ? 'text-critico' : 'text-tinta'}`}>{taxa(data.evasoes, data.chegadas)}</span>
                  <span className="text-rotulo text-tinta-sussurro">{data.evasoes} de {data.chegadas} chegadas</span>
                </div>
                <div className="flex flex-col gap-1 rounded-lg border border-fio px-3 py-2.5">
                  <span className="text-rotulo text-tinta-apoio">Taxa de alta a pedido</span>
                  <span className="text-[22px] leading-none font-semibold tabular text-tinta">{taxa(data.alta_a_pedido, data.chegadas)}</span>
                  <span className="text-rotulo text-tinta-sussurro">{data.alta_a_pedido} de {data.chegadas} chegadas</span>
                </div>
              </div>
              {data.evasoes > 0 && (
                <div className="grid gap-3 lg:grid-cols-3">
                  <Barras titulo="Quando saiu" total={data.evasoes}
                    itens={MOMENTOS_EVASAO.map((m) => ({ rotulo: m.rotulo, n: data.por_momento[m.valor] }))} />
                  <Barras titulo="Motivo" total={data.evasoes}
                    itens={MOTIVOS_EVASAO.map((m) => ({ rotulo: m.rotulo, n: data.por_motivo[m.valor] }))} />
                  <Barras titulo="Turno da chegada" total={data.evasoes}
                    itens={TURNOS.map(([v, r]) => ({ rotulo: r, n: data.por_turno[v] }))} />
                </div>
              )}
              {data.evasoes > 0 && (
                <div className="flex flex-wrap gap-2 text-rotulo text-tinta-apoio">
                  <span>Por cor:</span>
                  {(['vermelho', 'laranja', 'amarelo', 'verde', 'azul'] as CorRisco[]).map((c) => (
                    <span key={c} className="flex items-center gap-1"><PilulaRisco cor={c} className="min-w-0" /> {data.por_cor[c]}</span>
                  ))}
                  <span className="flex items-center gap-1"><PilulaRisco cor={null} className="min-w-0" /> {data.por_cor.sem_classificacao}</span>
                </div>
              )}
              {data.casos.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-apoio font-medium text-tinta">{data.evasoes} evasões no período</span>
                    <Button variant="outline" size="sm" onClick={() => setVerCasos((v) => !v)}>{verCasos ? 'Esconder casos' : 'Ver os casos'}</Button>
                  </div>
                  {verCasos && (
                    <>
                      <span className="text-rotulo text-tinta-sussurro">Acesso registrado na auditoria{data.casos.length >= 300 ? ' · mostrando os 300 mais recentes' : ''}.</span>
                      <div className="overflow-x-auto rounded-lg border border-fio">
                        <table className="w-full min-w-[760px] text-apoio">
                          <thead className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
                            <tr>
                              <th className="px-3 py-2 font-medium">Paciente</th>
                              <th className="px-3 py-2 font-medium">Cor</th>
                              <th className="px-3 py-2 font-medium">Chegada</th>
                              <th className="px-3 py-2 font-medium">Saiu</th>
                              <th className="px-3 py-2 font-medium">Quando</th>
                              <th className="px-3 py-2 font-medium">Motivo</th>
                              <th className="px-3 py-2 font-medium">Justificativa</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.casos.map((c, i) => (
                              <tr key={i} className="border-b border-trilha align-top last:border-0">
                                <td className="px-3 py-1.5 font-medium text-tinta">{c.nome}</td>
                                <td className="px-3 py-1.5"><PilulaRisco cor={(c.cor as CorRisco | null) ?? null} /></td>
                                <td className="px-3 py-1.5 tabular text-tinta-apoio">{fmtHora(c.chegada_em)}</td>
                                <td className="px-3 py-1.5 tabular text-tinta-apoio">{fmtHora(c.saiu_em)}</td>
                                <td className="px-3 py-1.5 text-tinta-apoio">{rotuloMomento(c.momento)}</td>
                                <td className="px-3 py-1.5 text-tinta-apoio">{rotuloMotivo(c.motivo)}</td>
                                <td className="px-3 py-1.5 text-tinta-apoio">{c.justificativa ?? '—'}</td>
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
