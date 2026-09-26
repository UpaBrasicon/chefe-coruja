import { lazy, Suspense } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Spinner } from '@/components/ui/spinner'

// A landing só existe para quem chega em "/" sem sessão; com sessão, "/" segue
// para a tela inicial do papel (RedirectHome).
const Landing = lazy(() => import('@/pages/landing/Landing'))

function Carregando() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner />
    </div>
  )
}

export function RequireAuth() {
  const { perfil, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Carregando />

  if (!perfil) {
    if (location.pathname === '/') {
      return (
        <Suspense fallback={<Carregando />}>
          <Landing />
        </Suspense>
      )
    }
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
