import { useQuery } from '@tanstack/react-query'
import { AlarmClock, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CABECALHO_CSV_ATRASO, linhasCsvAtraso, rotuloMes, taxa, type IndicadorAtraso } from '@/lib/atraso'
import { baixarCsv, gerarCsv, nomeArquivoCsv } from '@/lib/csv'
import { dataHora, dataIso } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

import type { ContextoFiltros } from './useFiltrosBI'

// Doses atrasadas e omissão de dose em Indicadores do gestor (lacuna 9;
// decisão do RT em 10/11/2026, A em A6; migration 20270331000001). Portaria MS
// 2.095/2013, Anexo 03, item 7.3.1. Período da barra pelo horário previsto da
// dose (dia do calendário, Brasília); cor, turno, grupo, médico e setor da
// barra não se aplicam: o setor é o do paciente na hora da checagem, e a
// tabela já vem por setor. Só número, sem dado de pessoa.

const FONTE = 'Portaria MS 2.095/2013, Anexo 03, item 7.3.1 (taxa de erro de omissão). Regra da unidade: tolerância de 2 h; omissão depois de 12 h sem checagem.'
const fmtDia = (iso: string) => iso.split('-').reverse().join('/')

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string | number; nota: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-controle border border-fio px-3 py-2.5">
      <span className="text-rotulo text-tinta-apoio">{rotulo}</span>
      <span className="text-titulo leading-none font-semibold tabular text-tinta">{valor}</span>
      <span className="text-rotulo text-tinta-sussurro">{nota}</span>
    </div>
  )
}

export function AtrasoChecagemIndicador({ unidadeId, nomeUnidade, ctx }: { unidadeId: string; nomeUnidade: string; ctx: ContextoFiltros }) {
  const faixa = ctx.faixa
  const { data, isLoading, error } = useQuery({
    queryKey: ['indicador-atraso-checagem', unidadeId, faixa.de, faixa.ate],
    enabled: !!faixa.de && !!faixa.ate && faixa.de <= faixa.ate,
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('indicador_atraso_checagem', { p_unidade: unidadeId, p_de: faixa.de, p_ate: faixa.ate })
      if (error) throw error
      return data as unknown as IndicadorAtraso
    },
  })

  function exportar() {
    if (!data) return
    baixarCsv(nomeArquivoCsv(`doses atrasadas ${nomeUnidade}`, dataIso()), gerarCsv(CABECALHO_CSV_ATRASO, linhasCsvAtraso(data), {
      contexto: [
        ['Unidade', nomeUnidade], ['Relatório', 'Doses atrasadas e omissão de dose'],
        ['Período', `${fmtDia(data.de)} a ${fmtDia(data.ate)}, pelo horário previsto da dose`],
        ['Referência', FONTE], ['Gerado em', dataHora(new Date())],
      ],
    }))
  }

  const t = data?.total
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-corpo">
            <AlarmClock className="size-4 text-tinta-sussurro" />
            Doses atrasadas e omissão
          </CardTitle>
          <Button variant="outline" size="sm" onClick={exportar} disabled={!data}>
            <Download /> Exportar CSV
          </Button>
        </div>
        <CardDescription>
          Medicamento aprazado, pelo horário previsto da dose. Daqui vale só o período; o setor é o do paciente na hora da checagem.
          "Agora", "Se necessário", infusão e contenção ficam fora.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading && <div className="flex h-20 items-center justify-center"><Spinner /></div>}
        {error && <p role="alert" className="text-apoio text-critico">{(error as Error).message}</p>}

        {data && t && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Numero rotulo="Taxa de doses atrasadas" valor={taxa(t.atrasadas, t.feitas)}
                nota={`${t.atrasadas} ${t.atrasadas === 1 ? 'feita' : 'feitas'} com atraso de ${t.feitas} ${t.feitas === 1 ? 'feita' : 'feitas'}`} />
              <Numero rotulo="Taxa de omissão" valor={taxa(t.omissoes, t.previstas)}
                nota={`${t.omissoes} ${t.omissoes === 1 ? 'omissão' : 'omissões'} de ${t.previstas} ${t.previstas === 1 ? 'dose prevista' : 'doses previstas'}`} />
              <Numero rotulo="Doses previstas" valor={t.previstas} nota="com checagem ou omissão registrada" />
            </div>
            <p className="text-rotulo text-tinta-sussurro">
              Dose prevista: horário aprazado com alguma checagem (feito, não feito ou recusado) ou que passou de 12 h sem checagem. Conta
              a partir da publicação desta regra. {FONTE}
            </p>
            {data.linhas.length === 0 ? (
              <p className="text-apoio text-tinta-sussurro">Nenhuma dose prevista no período.</p>
            ) : (
              <div className="overflow-x-auto rounded-controle border border-fio">
                <Table variante="referencia" className="w-full min-w-[720px] text-apoio">
                  <TableHeader className="border-b border-fio text-left text-rotulo text-tinta-sussurro">
                    <TableRow>
                      <TableHead className="px-3 py-2 font-medium">Mês</TableHead>
                      <TableHead className="px-3 py-2 font-medium">Setor</TableHead>
                      <TableHead className="px-3 py-2 text-right font-medium">Previstas</TableHead>
                      <TableHead className="px-3 py-2 text-right font-medium">Feitas</TableHead>
                      <TableHead className="px-3 py-2 text-right font-medium">Com atraso</TableHead>
                      <TableHead className="px-3 py-2 text-right font-medium">Taxa de atraso</TableHead>
                      <TableHead className="px-3 py-2 text-right font-medium">Omissões</TableHead>
                      <TableHead className="px-3 py-2 text-right font-medium">Taxa de omissão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.linhas.map((l) => (
                      <TableRow key={`${l.mes}-${l.setor_id ?? ''}`} className="border-b border-trilha last:border-0">
                        <TableCell className="px-3 py-1.5 tabular text-tinta-apoio">{rotuloMes(l.mes)}</TableCell>
                        <TableCell className="px-3 py-1.5 text-tinta">{l.setor ?? 'Sem setor'}</TableCell>
                        <TableCell className="px-3 py-1.5 text-right tabular">{l.previstas}</TableCell>
                        <TableCell className="px-3 py-1.5 text-right tabular">{l.feitas}</TableCell>
                        <TableCell className="px-3 py-1.5 text-right tabular">{l.atrasadas}</TableCell>
                        <TableCell className="px-3 py-1.5 text-right tabular font-semibold text-tinta">{taxa(l.atrasadas, l.feitas)}</TableCell>
                        <TableCell className="px-3 py-1.5 text-right tabular">{l.omissoes}</TableCell>
                        <TableCell className="px-3 py-1.5 text-right tabular font-semibold text-tinta">{taxa(l.omissoes, l.previstas)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
