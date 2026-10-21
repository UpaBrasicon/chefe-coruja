import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LinhaEntrada, PaginaEntrada } from '@/components/entrada/LadoMarca'

export function AguardandoLiberacao() {
  const { signOut, perfil } = useAuth()
  const navigate = useNavigate()

  async function handleSair() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <PaginaEntrada
      titulo="Aguardando liberação."
      abertura={`Olá, ${perfil?.nome_completo ?? 'colega'}. A sua conta existe, mas ainda não está ligada a nenhuma unidade.`}
      acao={<Button variant="outline" onClick={handleSair}>Sair</Button>}
    >
      <ul className="cc-linhas">
        <LinhaEntrada titulo="Quem libera">
          O gestor da sua unidade (ou a administração da rede) define o seu papel em cada unidade.
        </LinhaEntrada>
        <LinhaEntrada titulo="Quando abre">
          Assim que o vínculo é criado, o acesso abre sozinho na próxima entrada. Não é preciso pedir de novo.
        </LinhaEntrada>
      </ul>
    </PaginaEntrada>
  )
}
