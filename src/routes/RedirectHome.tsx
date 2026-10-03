import { Navigate } from 'react-router-dom'

import { useUnidade } from '@/contexts/UnidadeContext'
import { ROTA_INICIAL } from '@/lib/constants'
import { Spinner } from '@/components/ui/spinner'

export function RedirectHome() {
  const { status, unidades, papelAtivo } = useUnidade()

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

  // papelAtivo é o último perfil escolhido em "Trocar perfil" (guardado por
  // unidade); sem escolha, o contexto cai no primeiro por precedência.
  const alvo = papelAtivo ? ROTA_INICIAL[papelAtivo] : undefined
  return <Navigate to={alvo ?? '/aguardando'} replace />
}
