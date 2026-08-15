import { Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function AguardandoLiberacao() {
  const { signOut, perfil } = useAuth()
  const navigate = useNavigate()

  async function handleSair() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="size-5 text-primary" />
            Aguardando liberação
          </CardTitle>
          <CardDescription>
            Olá, {perfil?.nome_completo ?? 'colega'}. Sua conta ainda não está vinculada a nenhuma
            unidade.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Um administrador da sua organização precisa atribuir seu papel (administrador, gestor ou
            plantonista) por unidade. Assim que o vínculo for criado, o acesso é liberado
            automaticamente.
          </p>
          <Button variant="outline" onClick={handleSair}>
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
