import { useNavigate } from 'react-router-dom'
import * as React from 'react'

import { useAuth } from '@/contexts/AuthContext'
import AuthSectionTwo from '@/components/ui/auth-section-2'

export function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = React.useState<string | null>(null)
  const [carregando, setCarregando] = React.useState(false)

  async function onSubmit(email: string, senha: string) {
    if (!email || !senha) {
      setErro('Informe e-mail e senha.')
      return
    }
    setErro(null)
    setCarregando(true)
    const result = await signIn(email, senha)
    setCarregando(false)
    if (result.error) {
      setErro(result.error)
      return
    }
    navigate('/', { replace: true })
  }

  return <AuthSectionTwo onSubmit={onSubmit} erro={erro} carregando={carregando} />
}
