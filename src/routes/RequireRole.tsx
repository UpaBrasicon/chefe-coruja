import { Navigate, Outlet } from 'react-router-dom'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Spinner } from '@/components/ui/spinner'
import { ROTA_INICIAL } from '@/lib/constants'
import type { Papel } from '@/types/database'

export function RequireRole({ papeis }: { papeis: Papel[] }) {
  const { status, papeisDaUnidade } = useUnidade()

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

  // Avalia o papel **na unidade ativa**, igual ao portão de plantão e ao chat.
  const temPapel = papeisDaUnidade.some((p) => papeis.includes(p))
  if (!temPapel) {
    const alvo = papeisDaUnidade.map((p) => ROTA_INICIAL[p])[0] ?? '/aguardando'
    return <Navigate to={alvo} replace />
  }

  return <Outlet />
}
