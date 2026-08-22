import { lazy } from 'react'
import { CalendarClock } from 'lucide-react'

import { TabsPagina, type AbaDef } from '@/components/TabsPagina'

const Escala = lazy(() => import('@/pages/Escala'))
const HistoricoEscala = lazy(() => import('@/pages/HistoricoEscala'))

const ABAS: AbaDef[] = [
  { valor: 'mensal', rotulo: 'Mensal', conteudo: () => <Escala embutido abaGestorFixa="mensal" /> },
  { valor: 'fixa', rotulo: 'Fixa', conteudo: () => <Escala embutido abaGestorFixa="fixa" /> },
  { valor: 'historico', rotulo: 'Histórico', conteudo: () => <HistoricoEscala embutido /> },
]

/**
 * Escala do gestor/admin — grade + auditoria no mesmo lugar.
 *
 * O histórico é a auditoria da mesma entidade que a grade: juntá-los permite ver
 * o erro de passagem sem sair da escala.
 */
export default function EscalaGrupo() {
  return (
    <TabsPagina
      titulo="Escala"
      descricao="Montagem da escala mensal e fixa, com o histórico de alterações e erros de passagem."
      icone={CalendarClock}
      abas={ABAS}
    />
  )
}
