import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    setCarregando(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

    if (error) {
      setErro(traduzirErro(error.message))
    } else {
      navigate('/escala')
    }
    setCarregando(false)
  }

  async function handleEsqueciSenha() {
    if (!email) {
      setErro('Digite seu e-mail acima para redefinir a senha.')
      return
    }
    setCarregando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setCarregando(false)
    if (error) {
      setErro(traduzirErro(error.message))
    } else {
      setErro('')
      alert('E-mail de redefinição enviado! Verifique sua caixa de entrada.')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--cor-fundo)' }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Chefe Coruja" className="h-24 w-24 rounded-full object-cover mx-auto mb-2" />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cor-texto)' }}>
            Chefe Coruja
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cor-texto-suave)' }}>
            Gestão de escala médica — UPA Aparecida de Goiânia
          </p>
        </div>

        <Card style={{ border: '1px solid var(--cor-borda)' }}>
          <CardHeader>
            <CardTitle style={{ color: 'var(--cor-texto)' }}>Entrar</CardTitle>
            <CardDescription style={{ color: 'var(--cor-texto-suave)' }}>
              Acesse com seu e-mail e senha cadastrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email" style={{ color: 'var(--cor-texto)' }}>E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="senha" style={{ color: 'var(--cor-texto)' }}>Senha</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="••••••••"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              {erro && (
                <p className="text-sm rounded-md p-3" style={{ color: 'var(--cor-vago)', background: '#FEF2F2' }}>
                  {erro}
                </p>
              )}

              <Button
                type="submit"
                className="w-full font-semibold"
                disabled={carregando}
                style={{ background: 'var(--cor-primaria)', color: '#fff' }}
              >
                {carregando ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <div className="mt-4 flex flex-col gap-2 text-center text-sm">
              <button
                type="button"
                onClick={handleEsqueciSenha}
                className="underline"
                style={{ color: 'var(--cor-texto-suave)' }}
              >
                Esqueci minha senha
              </button>
              <span style={{ color: 'var(--cor-texto-suave)' }}>
                Não tem conta?{' '}
                <Link to="/signup" className="font-medium underline" style={{ color: 'var(--cor-primaria)' }}>
                  Criar conta
                </Link>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function traduzirErro(msg) {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (msg.includes('Email not confirmed')) return 'E-mail não confirmado. Verifique sua caixa de entrada.'
  if (msg.includes('Too many requests')) return 'Muitas tentativas. Aguarde alguns minutos.'
  return msg
}
