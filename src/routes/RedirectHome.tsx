import { Navigate } from 'react-router-dom'

import { useUnidade } from '@/contexts/UnidadeContext'
import { ROTA_INICIAL } from '@/lib/constants'
import { Spinner } from '@/components/ui/spinner'

export function RedirectHome() {
  const { status, unidades, papeisDaUnidade } = useUnidade()

  if (status === 'carregando') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (status === 'pendente') {
    return <Navigate to="/aguardando" replace />
  }

  if (unidades.length > 1) {
    return <Navigate to="/seletor" replace />
  }

  // papeisDaUnidade já vem ordenado por precedência (admin > gestor > plantonista).
  const alvo = papeisDaUnidade.map((p) => ROTA_INICIAL[p])[0]
  return <Navigate to={alvo ?? '/aguardando'} replace />
}
