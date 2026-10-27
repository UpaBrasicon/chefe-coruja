import { lazy } from 'react'
import { CalendarClock } from 'lucide-react'

import { TabsPagina, type AbaDef } from '@/components/TabsPagina'
import { useUnidade } from '@/contexts/UnidadeContext'
import { PresencasDoDia } from '@/pages/gestor/PresencasDoDia'

const Escala = lazy(() => import('@/pages/Escala'))
const EscalaMes = lazy(() => import('@/pages/gestor/EscalaMes').then((m) => ({ default: m.EscalaMes })))
const HistoricoEscala = lazy(() => import('@/pages/HistoricoEscala'))

// Revisão visual 3.9 (27/10/2026, opção A do RT): o gestor monta o mês no
// calendário com o dia ao lado (EscalaMes); os pedidos e a carga horária ganham
// abas próprias, em vez de se repetir em cima das grades. O admin, que não tem
// o calendário do gestor, segue escalando na grade da semana.
const abas = (gestor: boolean): AbaDef[] => [
  { valor: 'mensal', rotulo: 'Mensal', conteudo: () => (gestor ? <EscalaMes /> : <Escala embutido abaGestorFixa="mensal" />) },
  { valor: 'pedidos', rotulo: 'Pedidos', conteudo: () => <Escala embutido abaGestorFixa="pedidos" /> },
  { valor: 'carga', rotulo: 'Carga horária', conteudo: () => <Escala embutido abaGestorFixa="carga" /> },
  { valor: 'fixa', rotulo: 'Fixa', conteudo: () => <Escala embutido abaGestorFixa="fixa" /> },
  { valor: 'presencas', rotulo: 'Presenças', conteudo: () => <PresencasDoDia /> },
  { valor: 'historico', rotulo: 'Histórico', conteudo: () => <HistoricoEscala embutido /> },
]

/**
 * Escala do gestor/admin — o mês, os pedidos, a carga horária, a escala fixa,
 * as presenças do dia (check-ins) e o histórico de alterações.
 */
export default function EscalaGrupo() {
  const { papelAtivo } = useUnidade()
  return (
    <TabsPagina
      titulo="Escala"
      descricao="Montagem da escala, pedidos, presenças do dia (check-ins) e histórico de alterações."
      icone={CalendarClock}
      abas={abas(papelAtivo === 'gestor')}
    />
  )
}
