import { Navigate } from 'react-router-dom'

import { useUnidade } from '@/contexts/UnidadeContext'
import { foraDoTipo, inicioDoPapel } from '@/components/casca/navegacao'
import { ROTA_INICIAL } from '@/lib/constants'
import { Spinner } from '@/components/ui/spinner'

export function RedirectHome() {
  const { status, unidades, papelAtivo, unidadeAtiva } = useUnidade()

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
  // Numa UBS, a tela inicial de porta ou leito dá lugar ao primeiro item do menu.
  const tipo = unidadeAtiva?.unidade.tipo ?? null
  const inicial = papelAtivo ? ROTA_INICIAL[papelAtivo] : undefined
  const alvo = inicial && foraDoTipo(inicial, tipo) ? inicioDoPapel(papelAtivo, tipo) : inicial
  return <Navigate to={alvo ?? '/aguardando'} replace />
}
