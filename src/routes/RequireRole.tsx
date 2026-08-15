import { Navigate, Outlet } from 'react-router-dom'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Spinner } from '@/components/ui/spinner'
import type { Papel } from '@/types/database'

export function RequireRole({ papeis }: { papeis: Papel[] }) {
  const { status, vinculos } = useUnidade()

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

  const temPapel = vinculos.some((v) => papeis.includes(v.papel))
  if (!temPapel) {
    // Usuário sem o papel exigido: manda para a rota mais permissiva que tem.
    const rotasPorPapel: Record<Papel, string> = {
      admin: '/painel',
      gestor: '/setores',
      plantonista: '/plantonista',
    }
    const alvo = vinculos.map((v) => rotasPorPapel[v.papel])[0] ?? '/aguardando'
    return <Navigate to={alvo} replace />
  }

  return <Outlet />
}
