import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Escala from './pages/Escala'
import AguardandoAprovacao from './pages/AguardandoAprovacao'
import PainelAdmin from './pages/PainelAdmin'
import MinhasTrocas from './pages/MinhasTrocas'
import DesistenciasAbertas from './pages/DesistenciasAbertas'
import RedefinirSenha from './pages/RedefinirSenha'

function RootRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    if (sessionStorage.getItem('supabase_recovery')) {
      sessionStorage.removeItem('supabase_recovery')
      sessionStorage.setItem('recovery_landing', '1')
      navigate('/redefinir-senha', { replace: true })
    } else {
      navigate('/escala', { replace: true })
    }
  }, [])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/aguardando" element={<AguardandoAprovacao />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />

          <Route
            path="/escala"
            element={
              <ProtectedRoute>
                <Escala />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <PainelAdmin />
              </ProtectedRoute>
            }
          />

          <Route
            path="/trocas"
            element={
              <ProtectedRoute>
                <MinhasTrocas />
              </ProtectedRoute>
            }
          />

          <Route path="/desistencias" element={<ProtectedRoute><DesistenciasAbertas /></ProtectedRoute>} />

          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
