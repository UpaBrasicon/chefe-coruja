import { lazy } from 'react'
import { Building2 } from 'lucide-react'

import { TabsPagina, type AbaDef } from '@/components/TabsPagina'

const RedeCompleta = lazy(() => import('@/pages/admin/RedeCompleta').then((m) => ({ default: m.RedeCompleta })))
const Pessoas = lazy(() => import('@/pages/Pessoas').then((m) => ({ default: m.Pessoas })))

// "censo" continua como valor da aba para os links antigos (?aba=censo)
const ABAS: AbaDef[] = [
  { valor: 'censo', rotulo: 'Unidades', conteudo: () => <RedeCompleta /> },
  { valor: 'pessoas', rotulo: 'Pessoas', conteudo: () => <Pessoas embutido /> },
]

/**
 * Rede (admin): todas as unidades da organização, em agregado, e os vínculos
 * que a alimentam (P/index.html 9979).
 */
export default function OrganizacaoGrupo() {
  return (
    <TabsPagina
      titulo="Rede"
      descricao="Todas as unidades da organização. Sem identidade de paciente."
      icone={Building2}
      abas={ABAS}
    />
  )
}
