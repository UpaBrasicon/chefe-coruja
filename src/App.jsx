import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './routes/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Escala from './pages/Escala'
import AguardandoAprovacao from './pages/AguardandoAprovacao'
import PainelAdmin from './pages/PainelAdmin'
import MinhasTrocas from './pages/MinhasTrocas'
import DesistenciasAbertas from './pages/DesistenciasAbertas'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/aguardando" element={<AguardandoAprovacao />} />

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

          <Route path="/" element={<Navigate to="/escala" replace />} />
          <Route path="*" element={<Navigate to="/escala" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
