import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@/contexts/AuthContext'
import { UnidadeProvider } from '@/contexts/UnidadeContext'
import { RequireAuth } from '@/routes/RequireAuth'
import { RequireRole } from '@/routes/RequireRole'
import { RedirectHome } from '@/routes/RedirectHome'
import { AppShell } from '@/components/AppShell'
import { Login } from '@/pages/Login'
import { Cadastro } from '@/pages/Cadastro'
import { LinkReceita } from '@/pages/public/LinkReceita'
import { AguardandoLiberacao } from '@/pages/AguardandoLiberacao'
import { SeletorUnidade } from '@/pages/SeletorUnidade'
import { PainelAdmin } from '@/pages/PainelAdmin'
import { Pessoas } from '@/pages/Pessoas'
import { Setores } from '@/pages/Setores'
import Escala from '@/pages/Escala'
import InternacaoPainel from '@/pages/InternacaoPainel'
import ObservacaoPainel from '@/pages/ObservacaoPainel'
import Notificacoes from '@/pages/Notificacoes'
import Perfil from '@/pages/Perfil'
import MeuPlantao from '@/pages/MeuPlantao'
import Extrato from '@/pages/Extrato'
import Vagas from '@/pages/Vagas'
import HistoricoEscala from '@/pages/HistoricoEscala'
import Configuracao from '@/pages/Configuracao'
import Mensagens from '@/pages/Mensagens'
import MinhaAgenda from '@/pages/MinhaAgenda'
import PrescricaoTeste from '@/pages/PrescricaoTeste'
import ReferenciaDiluicao from '@/pages/ReferenciaDiluicao'
import Indicadores from '@/pages/Indicadores'
import { Banners } from '@/pages/gestor/Banners'
import PlantonistaHome from '@/pages/plantonista/PlantonistaHome'
import SectionHome from '@/pages/plantonista/SectionHome'
import { ToolRouter } from '@/pages/plantonista/ToolRouter'
import PlantaoHome from '@/pages/plantao/PlantaoHome'
import AtendimentoPorta from '@/pages/plantao/AtendimentoPorta'
import AtendimentoTool from '@/pages/plantao/AtendimentoTool'
import Internacao from '@/pages/plantao/Internacao'
import EvolucaoClinica from '@/pages/plantao/EvolucaoClinica'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

function UnidadeLayout() {
  return (
    <UnidadeProvider>
      <Outlet />
    </UnidadeProvider>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/r/:tipo/:token" element={<LinkReceita />} />

            <Route element={<RequireAuth />}>
              <Route path="/aguardando" element={<AguardandoLiberacao />} />

              <Route element={<UnidadeLayout />}>
                <Route path="/seletor" element={<SeletorUnidade />} />

                <Route element={<AppShell />}>
                  <Route element={<RequireRole papeis={['admin']} />}>
                    <Route path="/painel" element={<PainelAdmin />} />
                    <Route path="/pessoas" element={<Pessoas />} />
                  </Route>
                  <Route element={<RequireRole papeis={['gestor']} />}>
                    <Route path="/setores" element={<Setores />} />
                  </Route>
                  <Route element={<RequireRole papeis={['gestor', 'admin']} />}>
                    <Route path="/banners" element={<Banners />} />
                    <Route path="/configuracao" element={<Configuracao />} />
                    <Route path="/historico-escala" element={<HistoricoEscala />} />
                    <Route path="/indicadores" element={<Indicadores />} />
                  </Route>
                  <Route element={<RequireRole papeis={['plantonista', 'gestor', 'admin']} />}>
                    <Route path="/plantonista" element={<PlantonistaHome />} />
                    <Route path="/plantonista/:section" element={<SectionHome />} />
                    <Route path="/plantonista/:section/:tool" element={<ToolRouter />} />
                    <Route path="/escala" element={<Escala />} />
                    <Route path="/internacao" element={<InternacaoPainel />} />
                    <Route path="/observacao" element={<ObservacaoPainel />} />
                    <Route path="/notificacoes" element={<Notificacoes />} />
                    <Route path="/perfil" element={<Perfil />} />
                    <Route path="/meu-plantao" element={<MeuPlantao />} />
                    <Route path="/extrato" element={<Extrato />} />
                    <Route path="/vagas" element={<Vagas />} />
                    <Route path="/mensagens" element={<Mensagens />} />
                    <Route path="/minha-agenda" element={<MinhaAgenda />} />
                    <Route path="/prescricao-teste" element={<PrescricaoTeste />} />
                    <Route path="/referencia-diluicao" element={<ReferenciaDiluicao />} />
                  </Route>
                  <Route element={<RequireRole papeis={['plantonista']} />}>
                    <Route path="/plantao" element={<PlantaoHome />} />
                    <Route path="/plantao/atendimento-porta" element={<AtendimentoPorta />} />
                    <Route path="/plantao/atendimento-porta/:tool" element={<AtendimentoTool />} />
                    <Route path="/plantao/internacao" element={<Internacao />} />
                    <Route path="/plantao/evolucao" element={<EvolucaoClinica />} />
                  </Route>
                </Route>

                <Route path="/" element={<RedirectHome />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
