import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profissional, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--cor-fundo)' }}>
        <div className="text-center">
          <img src="/logo.png" alt="" className="h-12 w-12 rounded-full object-cover mx-auto mb-3" />
          <p style={{ color: 'var(--cor-texto-suave)' }}>Carregando...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (profissional?.status_aprovacao === 'pendente') {
    return <Navigate to="/aguardando" replace />
  }

  if (adminOnly && profissional?.role !== 'admin') {
    return <Navigate to="/escala" replace />
  }

  return children
}
