import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { AvisosProvider } from './contexts/AvisosContext'
import ProtectedRoute from './routes/ProtectedRoute'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Home from './pages/Home'
import Perfil from './pages/Perfil'
import Escala from './pages/Escala'
import AguardandoAprovacao from './pages/AguardandoAprovacao'
import PainelAdmin from './pages/PainelAdmin'
import MinhasTrocas from './pages/MinhasTrocas'
import DesistenciasAbertas from './pages/DesistenciasAbertas'
import RedefinirSenha from './pages/RedefinirSenha'
import EmBreve from './pages/EmBreve'
import EditorEscalaTemplate from './pages/EditorEscalaTemplate'
import PainelCEO from './pages/PainelCEO'

function RootRedirect() {
  const navigate = useNavigate()
  useEffect(() => {
    if (sessionStorage.getItem('supabase_recovery')) {
      sessionStorage.removeItem('supabase_recovery')
      sessionStorage.setItem('recovery_landing', '1')
      navigate('/redefinir-senha', { replace: true })
    } else {
      navigate('/home', { replace: true })
    }
  }, [])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AvisosProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/aguardando" element={<AguardandoAprovacao />} />
          <Route path="/redefinir-senha" element={<RedefinirSenha />} />

          <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />

          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />

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

          <Route
            path="/admin/editor-escala"
            element={
              <ProtectedRoute adminOnly>
                <EditorEscalaTemplate />
              </ProtectedRoute>
            }
          />

          <Route
            path="/ceo"
            element={
              <ProtectedRoute ceoOnly>
                <PainelCEO />
              </ProtectedRoute>
            }
          />

          {/* Plantão — parte médica */}
          <Route path="/plantao/prescricao-ps" element={<ProtectedRoute><EmBreve icone="📋" titulo="Prescrição Pronto Socorro" descricao="Crie e gerencie prescrições do Pronto Socorro de forma digital, integrada ao prontuário do paciente." /></ProtectedRoute>} />
          <Route path="/plantao/atestado" element={<ProtectedRoute><EmBreve icone="📄" titulo="Atestado Médico" descricao="Emita atestados médicos digitais com assinatura eletrônica e registro automático." /></ProtectedRoute>} />
          <Route path="/plantao/prescricao-internacao" element={<ProtectedRoute><EmBreve icone="🏥" titulo="Prescrição de Internação" descricao="Gerenciamento completo de prescrições para pacientes internados, com controle de medicamentos e procedimentos." /></ProtectedRoute>} />
          <Route path="/plantao/evolucao-internacao" element={<ProtectedRoute><EmBreve icone="📝" titulo="Evolução de Internação" descricao="Registre e acompanhe a evolução clínica dos pacientes internados com histórico completo." /></ProtectedRoute>} />
          <Route path="/plantao/apac" element={<ProtectedRoute><EmBreve icone="🗂️" titulo="APAC" descricao="Autorização de Procedimentos de Alta Complexidade — emissão e acompanhamento digital integrado ao sistema." /></ProtectedRoute>} />
          <Route path="/plantao/encaminhamento" element={<ProtectedRoute><EmBreve icone="↗️" titulo="Encaminhamento" descricao="Gere encaminhamentos para especialistas e outros serviços de saúde de forma ágil e rastreável." /></ProtectedRoute>} />
          <Route path="/plantao/pedido-exame" element={<ProtectedRoute><EmBreve icone="🔬" titulo="Pedido de Exame" descricao="Solicite exames laboratoriais e de imagem com histórico completo por paciente." /></ProtectedRoute>} />

          {/* Financeiro */}
          <Route path="/financeiro/custos" element={<ProtectedRoute adminOnly><EmBreve icone="📊" titulo="Planilha de Custos" descricao="Controle financeiro completo da unidade: custos por plantão, por médico e por setor." /></ProtectedRoute>} />
          <Route path="/financeiro/contracheque" element={<ProtectedRoute><EmBreve icone="💰" titulo="Contracheque" descricao="Visualize seus comprovantes de pagamento, histórico de plantões remunerados e deduções." /></ProtectedRoute>} />

          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
        </AvisosProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
