import { useQuery } from '@tanstack/react-query'
import { Download, FileHeart } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { baixarCsv, gerarCsv, nomeArquivoCsv } from '@/lib/csv'
import { dataHora, dataIso, diaMesHora } from '@/lib/formato'
import {
  CABECALHO_CSV_OBITOS, ENCAMINHAMENTOS, FAIXAS, FONTE_OBITOS, ORIGENS, TEMPOS, TIPOS, fracaoObitos, linhasCsvObitos,
  percentualObitos, rotuloEncaminhamento, rotuloFaixa, rotuloOrigem, rotuloTempo, rotuloTipo, type IndicadorObitos,
} from '@/lib/obitosPainel'
import { supabase } from '@/lib/supabase'

import type { ContextoFiltros } from './useFiltrosBI'

// Óbitos em Indicadores do gestor (lacuna 10; decisão do RT em 10/11/2026, A
// em P1 a P8; migration 20270328000001). Período da barra pela hora do óbito,
// no dia do plantão (7h às 7h); o setor é o do óbito, escolhido aqui (a barra
// lista os setores de entrada). Cor, turno, grupo e médico da barra não se
// aplicam. A lista com nome fica fechada; o banco registra o acesso.

const fmtDia = (iso: string) => iso.split('-').reverse().join('/')
const fmtHora = (iso: string | null) => (iso ? diaMesHora(iso).replace(',', ' ·') : '—')

function Barras({ titulo, itens, total }: { titulo: string; itens: { rotulo: string; n: number }[]; total: number }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-controle border border-fio px-3 py-2.5">
      <span className="text-rotulo font-medium text-tinta-apoio">{titulo}</span>
      {itens.map((i) => (
        <div key={i.rotulo} className="flex items-center gap-2 text-apoio">
          <span className="w-[150px] shrink-0 truncate text-tinta-apoio">{i.rotulo}</span>
          <div className="relative h-2 flex-1 rounded-capsula bg-trilha" aria-hidden>
            <div className="absolute inset-y-0 left-0 rounded-capsula bg-tinta-sussurro" style={{ width: `${total ? (i.n / total) * 100 : 0}%` }} />
          </div>
          <span className="w-8 text-right tabular font-semibold text-tinta">{i.n}</span>
        </div>
      ))}
    </div>
  )
}

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string | number; nota: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-controle border border-fio px-3 py-2.5">
      <span className="text-rotulo text-tinta-apoio">{rotulo}</span>
      <span className="text-titulo leading-none font-semibold tabular text-tinta">{valor}</span>
      <span className="text-rotulo text-tinta-sussurro">{nota}</span>
    </div>
  )
}

export function ObitosIndicador({ unidadeId, nomeUnidade, ctx }: { unidadeId: string; nomeUnidade: string; ctx: ContextoFiltros }) {
  const hoje = dataIso()
  const [setor, setSetor] = React.useState('')
  const [verCasos, setVerCasos] = React.useState(false)
  const faixa = ctx.faixa

  const { data, isLoading, error } = useQuery({
    queryKey: ['indicador-obitos', unidadeId, faixa.de, faixa.ate, setor],
    enabled: !!faixa.de && !!faixa.ate && faixa.de <= faixa.ate,
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('indicador_obitos', {
        p_unidade: unidadeId, p_de: faixa.de, p_ate: faixa.ate, p_setor: setor || undefined,
      })
      if (error) throw error
      return data as unknown as IndicadorObitos
    },
  })
  const nomeSetor = data?.setores.find((s) => s.id === setor)?.nome

  function exportar() {
    if (!data) return
    baixarCsv(nomeArquivoCsv(`obitos ${nomeUnidade}`, hoje), gerarCsv(CABECALHO_CSV_OBITOS, linhasCsvObitos(data), {
      contexto: [
        ['Unidade', nomeUnidade], ['Relatório', 'Óbitos e óbitos sobre saídas'],
        ['Período', `${fmtDia(data.de)} a ${fmtDia(data.ate)}, dia do plantão (7h às 7h), pela hora do óbito`],
        ['Setor do óbito', nomeSetor ?? 'Todos'], ['Referência', FONTE_OBITOS], ['Gerado em', dataHora(new Date())],
      ],
    }))
  }

  const o = data?.obitos_sobre_saidas
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-corpo">
            <FileHeart className="size-4 text-tinta-sussurro" />
            Óbitos
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <CampoSelecao aria-label="Setor do óbito" value={setor} onChange={(e) => setSetor(e.target.value)} className="bg-superficie px-2.5">
              <option value="">Todos os setores</option>
              {(data?.setores ?? []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </CampoSelecao>
            <Button variant="outline" size="sm" onClick={exportar} disabled={!data}>
              <Download /> Exportar CSV
            </Button>
          </div>
        </div>
        <CardDescription>
          Pela hora do óbito, no dia do plantão (7h às 7h). Daqui valem o período e o setor do óbito; cor, turno, grupo e médico não se aplicam.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">

        {isLoading && <div className="flex h-20 items-center justify-center"><Spinner /></div>}
        {error && <p role="alert" className="text-apoio text-critico">{(error as Error).message}</p>}

        {data && o && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Numero rotulo="Óbitos no período" valor={data.total}
                nota={data.registro_anterior ? `${data.registro_anterior} de registro anterior, sem tipo de morte` : 'todos com o registro do óbito'} />
              <Numero rotulo="Óbitos sobre saídas" valor={percentualObitos(o.numerador, o.denominador)} nota={fracaoObitos(o.numerador, o.denominador)} />
              <Numero rotulo="Saídas no período" valor={data.saidas.total}
                nota={ORIGENS.map((x) => `${x.rotulo.toLowerCase()} ${data.saidas[x.valor]}`).join(' · ')} />
            </div>
            <p className="text-rotulo text-tinta-sussurro">
              Saídas: alta, alta a pedido, evasão, transferência para outro serviço e óbito, da porta, da observação e da internação. Quem foi da porta
              para a observação ou a internação sai uma vez só, por lá. {FONTE_OBITOS}
            </p>

            {data.total === 0 ? (
              <p className="text-apoio text-tinta-sussurro">Nenhum óbito no período.</p>
            ) : (
              <>
                <div className="grid gap-3 lg:grid-cols-3">
                  <Barras titulo="Onde estava" total={data.total} itens={ORIGENS.map((x) => ({ rotulo: x.rotulo, n: data.por_origem[x.valor] }))} />
                  <Barras titulo="Setor do óbito" total={data.total} itens={data.por_setor.map((s) => ({ rotulo: s.setor, n: s.obitos }))} />
                  <Barras titulo="Tempo desde a chegada" total={data.total}
                    itens={TEMPOS.filter((x) => x.valor !== 'sem_chegada' || data.por_tempo.sem_chegada > 0).map((x) => ({ rotulo: x.rotulo, n: data.por_tempo[x.valor] }))} />
                  <Barras titulo="Tipo de morte" total={data.total}
                    itens={TIPOS.filter((x) => x.valor !== 'registro_anterior' || data.registro_anterior > 0).map((x) => ({ rotulo: x.rotulo, n: data.por_tipo[x.valor] }))} />
                  <Barras titulo="Quem atesta" total={data.total}
                    itens={ENCAMINHAMENTOS.filter((x) => x.valor !== 'registro_anterior' || data.registro_anterior > 0).map((x) => ({ rotulo: x.rotulo, n: data.por_encaminhamento[x.valor] }))} />
                  <Barras titulo="Faixa etária" total={data.total}
                    itens={FAIXAS.filter((x) => x.valor !== 'sem_data_nascimento' || data.por_faixa.sem_data_nascimento > 0).map((x) => ({ rotulo: x.rotulo, n: data.por_faixa[x.valor] }))} />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-apoio font-medium text-tinta">{data.total} {data.total === 1 ? 'óbito' : 'óbitos'} no período</span>
                    <Button variant="outline" size="sm" onClick={() => setVerCasos((v) => !v)}>{verCasos ? 'Esconder os casos' : 'Ver os casos'}</Button>
                  </div>
                  {verCasos && (
                    <>
                      <span className="text-rotulo text-tinta-sussurro">Acesso registrado na auditoria{data.casos.length >= 300 ? ' · mostrando os 300 mais recentes' : ''}.</span>
                      <div className="overflow-x-auto rounded-controle border border-fio">
                        <Table variante="referencia" className="w-full min-w-[820px] text-apoio">
                          <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
                            <TableRow>
                              <TableHead className="px-3 py-2 font-medium">Paciente</TableHead>
                              <TableHead className="px-3 py-2 font-medium">Hora do óbito</TableHead>
                              <TableHead className="px-3 py-2 font-medium">Chegada</TableHead>
                              <TableHead className="px-3 py-2 font-medium">Onde</TableHead>
                              <TableHead className="px-3 py-2 font-medium">Tipo de morte</TableHead>
                              <TableHead className="px-3 py-2 font-medium">Quem atesta</TableHead>
                              <TableHead className="px-3 py-2 font-medium">Faixa</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.casos.map((c, i) => (
                              <TableRow key={i} className="border-b border-trilha align-top last:border-0">
                                <TableCell className="px-3 py-1.5 font-medium text-tinta">{c.nome}</TableCell>
                                <TableCell className="px-3 py-1.5 tabular text-tinta-apoio">{fmtHora(c.hora_obito)}</TableCell>
                                <TableCell className="px-3 py-1.5 tabular text-tinta-apoio">
                                  {fmtHora(c.chegada_em)}
                                  <span className="block text-rotulo text-tinta-sussurro">{rotuloTempo(c.tempo)}</span>
                                </TableCell>
                                <TableCell className="px-3 py-1.5 text-tinta-apoio">
                                  {rotuloOrigem(c.origem)}
                                  {c.setor && <span className="block text-rotulo text-tinta-sussurro">{c.setor}</span>}
                                </TableCell>
                                <TableCell className="px-3 py-1.5 text-tinta-apoio">{rotuloTipo(c.tipo_morte, c.registro_anterior)}</TableCell>
                                <TableCell className="px-3 py-1.5 text-tinta-apoio">{rotuloEncaminhamento(c.encaminhamento, c.registro_anterior)}</TableCell>
                                <TableCell className="px-3 py-1.5 text-tinta-apoio">{rotuloFaixa(c.faixa)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
