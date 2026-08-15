import { CalendarClock, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function ForaDoExpediente() {
  const { signOut } = useAuth()
  const { unidadeAtiva } = useUnidade()
  const navigate = useNavigate()

  async function handleSair() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="size-5 text-primary" />
            Fora do expediente
          </CardTitle>
          <CardDescription>
            Você não está na escala deste turno na unidade {unidadeAtiva?.unidade.nome}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            O acesso é liberado automaticamente pelo relógio do servidor quando o seu plantão
            começar. Nenhuma configuração manual é necessária.
          </p>
          <p className="text-sm text-muted-foreground">
            Se você tem acesso pago a atendimento (prescrição, admissão, atestado e documento de
            internação), ele será liberado nesta mesma tela.
          </p>
          <Button variant="outline" onClick={handleSair}>
            <LogOut />
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
