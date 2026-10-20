import { useQuery } from '@tanstack/react-query'
import { Download, Wallet } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { dataHora, dataPura, moeda } from '@/lib/formato'
import { TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

type ExtratoLinha = {
  plantao_id: string
  data: string
  turno: string
  setor_id: string
  setor_nome: string
  perfil_id: string
  nome_completo: string
  valor: number
}

const TURNO_LABEL: Record<string, string> = { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }

const brl = moeda

export default function Extrato({ embutido = false }: { embutido?: boolean } = {}) {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id

  const hoje = new Date()
  const [inicio, setInicio] = React.useState(
    new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10)
  )
  const [fim, setFim] = React.useState(
    new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10)
  )

  const { data: linhas, isLoading } = useQuery({
    queryKey: ['extrato', unidadeId, inicio, fim],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('gerar_extrato_plantonista', {
        p_unidade: unidadeId!,
        p_inicio: inicio,
        p_fim: fim,
      })
      if (error) throw error
      return (data ?? []) as ExtratoLinha[]
    },
  })

  const total = React.useMemo(() => (linhas ?? []).reduce((acc, l) => acc + (l.valor || 0), 0), [linhas])

  // recibo PDF
  async function baixarRecibo() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const y0 = 18
    doc.setFontSize(16)
    doc.text('Chefe Coruja', 14, y0)
    doc.setFontSize(11)
    doc.text('Extrato de Plantões', 14, y0 + 8)
    doc.setFontSize(9)
    doc.text(`Unidade: ${unidadeAtiva?.unidade.nome ?? ''}`, 14, y0 + 16)
    doc.text(`Período: ${dataPura(inicio)} a ${dataPura(fim)}`, 14, y0 + 22)
    doc.text(`Gerado em: ${dataHora(new Date())}`, 14, y0 + 28)
    doc.line(14, y0 + 32, 196, y0 + 32)

    let y = y0 + 40
    doc.setFontSize(9)
    ;(linhas ?? []).forEach((l) => {
      if (y > 280) {
        doc.addPage()
        y = 18
      }
      doc.text(
        `${dataPura(l.data)} |${TURNO_LABEL[l.turno] ?? l.turno} | ${l.setor_nome} | ${l.nome_completo}`,
        14,
        y
      )
      doc.text(brl(l.valor), 180, y, { align: 'right' })
      y += 6
    })

    y += 4
    doc.setFontSize(11)
    doc.text(`Total: ${brl(total)}`, 14, y)
    doc.save('extrato-plantoes.pdf')
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {!embutido && (
        <div className="flex flex-col">
          <Trilha niveis={[{ rotulo: 'Início', to: '/' }, { rotulo: 'Extrato financeiro' }]} />
          <TituloPagina icone={Wallet} titulo="Extrato financeiro" className="mb-0"
            descricao="Valores por plantão calculados a partir da escala e das remunerações configuradas pela unidade." />
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-rotulo font-medium text-tinta-sussurro">De</label>
          <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-rotulo font-medium text-tinta-sussurro">Até</label>
          <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className="w-40" />
        </div>
        <Button variant="outline" onClick={baixarRecibo} disabled={(linhas ?? []).length === 0}>
          <Download /> Baixar recibo (PDF)
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-corpo">
            <Wallet className="size-4 text-tinta-sussurro" />
            Plantões no período
          </CardTitle>
          <CardDescription>{perfil?.nome_completo}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {isLoading ? (
            <div className="flex h-24 items-center justify-center">
              <Spinner />
            </div>
          ) : (linhas ?? []).length === 0 ? (
            <p className="text-apoio text-tinta-sussurro">
              Nenhum plantão no período ou valores ainda não configurados.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {(linhas ?? []).map((l) => (
                <div key={l.plantao_id} className="flex items-center justify-between rounded-controle border p-2.5 text-apoio">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {dataPura(l.data)} ·{TURNO_LABEL[l.turno] ?? l.turno}
                    </span>
                    <span className="text-tinta-sussurro">{l.setor_nome}</span>
                  </div>
                  <span className="font-semibold">{brl(l.valor || 0)}</span>
                </div>
              ))}
              <div className="mt-2 flex items-center justify-between border-t pt-3 text-apoio font-semibold">
                <span>Total</span>
                <span className="text-secao">{brl(total)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
