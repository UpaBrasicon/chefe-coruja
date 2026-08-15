import { Navigate } from 'react-router-dom'

import { useUnidade } from '@/contexts/UnidadeContext'
import { Spinner } from '@/components/ui/spinner'

export function RedirectHome() {
  const { status, unidades, ehAdmin, ehGestor, ehPlantonista } = useUnidade()

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

  if (ehAdmin) return <Navigate to="/painel" replace />
  if (ehGestor) return <Navigate to="/setores" replace />
  if (ehPlantonista) return <Navigate to="/plantonista" replace />

  return <Navigate to="/aguardando" replace />
}
