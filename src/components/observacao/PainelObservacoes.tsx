// ─────────────────────────────────────────────────────────────────────────────
// PainelObservacoes — flowsheet de UTI
// Conceitos nas linhas, tempo nas colunas, célula colorida por flag
// (L/N/H/CRIT), com delta entre aferições. Sinal vital chega sempre cru (flag
// N, sem faixa — Fase 3): quem colore é o laboratório, com a faixa dele.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'

import { getPainelInternacao, corDoFlag, type PainelInternacao } from '@/lib/observacao'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { VazioLinha } from '@/components/monitor/Pagina'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { hora } from '@/lib/formato'

type Props = {
  internacaoId: string
  className?: string
}

const formatarHora = (iso: string) => hora(iso)

function formatarValor(p: PainelInternacao['itens'][number]['ultimo']): string {
  if (!p) return '—'
  if (p.valor_num != null) return String(p.valor_num)
  if (p.valor_texto != null) return p.valor_texto
  return '—'
}

export function PainelObservacoes({ internacaoId, className }: Props) {
  const { data: painel, isFetching, isError } = useQuery({
    queryKey: ['painel-observacoes', internacaoId],
    enabled: !!internacaoId,
    queryFn: () => getPainelInternacao(internacaoId),
  })

  if (isError) return <MensagemErro formato="linha" texto="Não foi possível carregar as observações. Tente de novo." />
  if (isFetching && !painel) return <Skeleton className="h-40 w-full" />

  const itens = painel?.itens ?? []
  if (itens.length === 0) {
    return <VazioLinha>Nenhuma observação registrada nesta internação.</VazioLinha>
  }

  return (
    <div className={cn('overflow-x-auto rounded-controle border', className)}>
      <Table className="min-w-[560px] text-apoio">
        <TableHeader>
          <TableRow className="text-left text-rotulo uppercase tracking-wide text-tinta-sussurro">
            <TableHead className="h-auto px-3 py-2 font-medium">Conceito</TableHead>
            <TableHead className="h-auto px-3 py-2 text-right font-medium">Último</TableHead>
            <TableHead className="h-auto px-3 py-2 text-right font-medium">Hora</TableHead>
            <TableHead className="h-auto px-3 py-2 text-right font-medium">Δ</TableHead>
            <TableHead className="h-auto px-3 py-2 text-right font-medium">Referência</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((item) => (
            <TableRow key={item.conceito_id}>
              <TableCell className="px-3 py-1.5">
                <span className="font-medium capitalize">{item.nome.replace(/-/g, ' ')}</span>
                {item.unidade && <span className="ml-1 text-rotulo text-tinta-sussurro">{item.unidade}</span>}
              </TableCell>
              <TableCell className="px-3 py-1.5 text-right">
                {item.ultimo ? (
                  <span
                    className={cn(
                      'inline-block min-w-14 rounded-controle px-2 py-0.5 text-right font-mono text-rotulo font-semibold',
                      corDoFlag(item.ultimo.flag)
                    )}
                  >
                    {formatarValor(item.ultimo)}
                  </span>
                ) : (
                  <span className="text-tinta-sussurro">—</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-1.5 text-right font-mono text-rotulo text-tinta-sussurro">
                {item.ultimo ? formatarHora(item.ultimo.aferido_em) : '—'}
              </TableCell>
              <TableCell className="px-3 py-1.5 text-right font-mono text-rotulo">
                {item.delta != null ? (
                  // Subir ou descer não é, por si, alteração: o Δ sai neutro.
                  <span className="text-tinta-apoio">
                    {item.delta > 0 ? '+' : ''}
                    {item.delta}
                  </span>
                ) : (
                  <span className="text-tinta-sussurro">—</span>
                )}
              </TableCell>
              <TableCell className="px-3 py-1.5 text-right font-mono text-rotulo text-tinta-sussurro">
                {item.ref_min != null || item.ref_max != null
                  ? `${item.ref_min ?? '…'} – ${item.ref_max ?? '…'}`
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
