import { lazy } from 'react'
import { CalendarClock } from 'lucide-react'

import { TabsPagina, type AbaDef } from '@/components/TabsPagina'
import { PresencasDoDia } from '@/pages/gestor/PresencasDoDia'

const Escala = lazy(() => import('@/pages/Escala'))
const EscalaMes = lazy(() => import('@/pages/gestor/EscalaMes').then((m) => ({ default: m.EscalaMes })))
const HistoricoEscala = lazy(() => import('@/pages/HistoricoEscala'))

const ABAS: AbaDef[] = [
  // calendário do mês (barras por setor, vagas, publicar) em cima; a grade da
  // semana, onde se escala, continua embaixo
  { valor: 'mensal', rotulo: 'Mensal', conteudo: () => <><EscalaMes /><Escala embutido abaGestorFixa="mensal" /></> },
  { valor: 'fixa', rotulo: 'Fixa', conteudo: () => <Escala embutido abaGestorFixa="fixa" /> },
  { valor: 'presencas', rotulo: 'Presenças', conteudo: () => <PresencasDoDia /> },
  { valor: 'historico', rotulo: 'Histórico', conteudo: () => <HistoricoEscala embutido /> },
]

/**
 * Escala do gestor/admin — grade + presenças do dia (check-ins) + auditoria.
 *
 * A aba Presenças mostra quem fez check-in hoje, a que horas, se dentro do
 * raio da unidade, e quem está em escala mas ainda não fez check-in.
 */
export default function EscalaGrupo() {
  return (
    <TabsPagina
      titulo="Escala"
      descricao="Montagem da escala, presenças do dia (check-ins) e histórico de alterações."
      icone={CalendarClock}
      abas={ABAS}
    />
  )
}
