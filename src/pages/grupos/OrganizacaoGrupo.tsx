import { lazy } from 'react'
import { LayoutDashboard } from 'lucide-react'

import { TabsPagina, type AbaDef } from '@/components/TabsPagina'

const PainelAdmin = lazy(() => import('@/pages/PainelAdmin').then((m) => ({ default: m.PainelAdmin })))
const Pessoas = lazy(() => import('@/pages/Pessoas').then((m) => ({ default: m.Pessoas })))

const ABAS: AbaDef[] = [
  { valor: 'censo', rotulo: 'Censo', conteudo: () => <PainelAdmin embutido /> },
  { valor: 'pessoas', rotulo: 'Pessoas', conteudo: () => <Pessoas embutido /> },
]

/**
 * Organização (admin) — censo agregado e os vínculos que o alimentam.
 */
export default function OrganizacaoGrupo() {
  return (
    <TabsPagina
      titulo="Rede"
      descricao="Censo agregado por unidade e gestão de vínculos. Nenhuma tela do administrador mostra identidade de paciente."
      icone={LayoutDashboard}
      abas={ABAS}
    />
  )
}
