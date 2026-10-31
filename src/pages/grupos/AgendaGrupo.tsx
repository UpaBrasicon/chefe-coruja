import { lazy } from 'react'
import { CalendarClock } from 'lucide-react'

import { TabsPagina, type AbaDef } from '@/components/TabsPagina'

const Escala = lazy(() => import('@/pages/Escala'))
const MinhaAgenda = lazy(() => import('@/pages/MinhaAgenda'))
const Vagas = lazy(() => import('@/pages/Vagas'))
const Extrato = lazy(() => import('@/pages/Extrato'))

const ABAS: AbaDef[] = [
  { valor: 'escala', rotulo: 'Minha escala', conteudo: () => <Escala embutido aba="minha" /> },
  { valor: 'geral', rotulo: 'Escala da unidade', conteudo: () => <Escala embutido aba="geral" /> },
  { valor: 'todas-unidades', rotulo: 'Todas as unidades', conteudo: () => <MinhaAgenda embutido /> },
  { valor: 'vagas', rotulo: 'Vagas', conteudo: () => <Vagas embutido /> },
  { valor: 'extrato', rotulo: 'Extrato', conteudo: () => <Extrato embutido /> },
]

/**
 * Minha Agenda — "quando eu trabalho e quanto recebo".
 *
 * Reúne Minha Escala, Escala Geral, Minha Agenda, Vagas e Extrato: escala e
 * agenda mostram os mesmos plantões com recortes diferentes, e vagas/extrato são
 * o antes e o depois do mesmo plantão. As sub-abas internas de `Escala.tsx`
 * viraram abas de primeiro nível aqui — nada de abas dentro de abas.
 */
export default function AgendaGrupo() {
  return (
    <TabsPagina
      titulo="Minha Agenda"
      descricao="Escala da unidade, agenda de todas as unidades, vagas abertas e extrato financeiro."
      icone={CalendarClock}
      abas={ABAS}
    />
  )
}
