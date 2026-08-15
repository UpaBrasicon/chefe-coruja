import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import * as React from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'

const schema = z
  .object({
    nomeCompleto: z.string().min(3, 'Informe seu nome completo.'),
    email: z.string().email('Informe um e-mail válido.'),
    senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
    confirmarSenha: z.string(),
  })
  .refine((d) => d.senha === d.confirmarSenha, {
    path: ['confirmarSenha'],
    message: 'As senhas não coincidem.',
  })

type FormData = z.infer<typeof schema>

export function Cadastro() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = React.useState<string | null>(null)
  const [confirmacaoEnviada, setConfirmacaoEnviada] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setErro(null)
    const result = await signUp(data.email, data.senha, data.nomeCompleto)
    if (result.error) {
      setErro(result.error)
      return
    }
    // Confirmação de e-mail obrigatória: sem sessão ainda.
    setConfirmacaoEnviada(true)
    setTimeout(() => navigate('/login', { replace: true }), 4000)
  }

  if (confirmacaoEnviada) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Verifique seu e-mail</CardTitle>
            <CardDescription>
              Enviamos um link de confirmação. Depois de confirmar, um administrador precisa liberar
              seu acesso. Redirecionando para o login…
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Criar conta</CardTitle>
          <CardDescription>
            Seu acesso será liberado por um administrador após a confirmação do e-mail.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nomeCompleto">Nome completo</Label>
              <Input
                id="nomeCompleto"
                placeholder="Dr. Maria Silva"
                autoComplete="name"
                {...register('nomeCompleto')}
              />
              {errors.nomeCompleto && (
                <p className="text-xs text-destructive">{errors.nomeCompleto.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@exemplo.com"
                autoComplete="email"
                {...register('email')}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="new-password"
                {...register('senha')}
              />
              {errors.senha && <p className="text-xs text-destructive">{errors.senha.message}</p>}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmarSenha">Confirmar senha</Label>
              <Input
                id="confirmarSenha"
                type="password"
                autoComplete="new-password"
                {...register('confirmarSenha')}
              />
              {errors.confirmarSenha && (
                <p className="text-xs text-destructive">{errors.confirmarSenha.message}</p>
              )}
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : 'Criar conta'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link to="/login" className="text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
