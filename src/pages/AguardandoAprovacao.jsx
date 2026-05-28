import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'

export default function AguardandoAprovacao() {
  const { profissional, signOut } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--cor-fundo)' }}>
      <div className="w-full max-w-md text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--cor-texto)' }}>
          Aguardando aprovação
        </h2>
        {profissional?.nome && (
          <p className="mb-2 font-medium" style={{ color: 'var(--cor-primaria)' }}>
            Olá, {profissional.nome}!
          </p>
        )}
        <p style={{ color: 'var(--cor-texto-suave)' }}>
          Seu cadastro está sendo analisado pelo coordenador. Você receberá acesso assim que for aprovado.
        </p>
        <p className="text-sm mt-3" style={{ color: 'var(--cor-texto-suave)' }}>
          Em caso de dúvidas, entre em contato com a coordenação.
        </p>
        <Button
          onClick={signOut}
          variant="outline"
          className="mt-6"
          style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}
        >
          Sair
        </Button>
      </div>
    </div>
  )
}
