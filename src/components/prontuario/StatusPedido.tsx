import { Badge } from '@/components/ui/badge'

export type SituacaoPedido = 'pendente' | 'aprovado' | 'recusado' | 'cancelado'

/** Selo da situação do pedido de acesso ao prontuário (tela do pedido e auditoria do gestor). */
export function StatusPedido({ status, vigente }: { status: SituacaoPedido; vigente?: boolean }) {
  if (status === 'aprovado') return <Badge variant={vigente === false ? 'secondary' : 'success'}>{vigente === false ? 'Aprovado · vencido' : 'Aprovado'}</Badge>
  if (status === 'pendente') return <Badge variant="warning">Aguardando o gestor</Badge>
  if (status === 'recusado') return <Badge variant="destructive">Recusado</Badge>
  return <Badge variant="secondary">Cancelado</Badge>
}
