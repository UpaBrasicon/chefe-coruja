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
import { AguardandoLiberacao } from '@/pages/AguardandoLiberacao'
import { SeletorUnidade } from '@/pages/SeletorUnidade'
import { PainelAdmin } from '@/pages/PainelAdmin'
import { Pessoas } from '@/pages/Pessoas'
import { Setores } from '@/pages/Setores'
import { HomePlantonista } from '@/pages/HomePlantonista'

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
                  <Route element={<RequireRole papeis={['plantonista']} />}>
                    <Route path="/plantonista" element={<HomePlantonista />} />
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
