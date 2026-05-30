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
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-4 py-8">
      {/* Fundo com blur — extendido para evitar bordas brancas */}
      <div style={{
        position: 'absolute',
        inset: '-20px',
        backgroundImage: 'url(/fundo-login.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(3px)',
        zIndex: 0,
      }} />
      {/* Conteúdo acima do fundo */}
      <div className="relative z-10 flex flex-col items-center w-full px-0 py-0">
      {/* Logo */}
      <div className="text-center mb-4">
        <img
          src="/logo-login.png"
          alt="Chefe Coruja"
          className="mx-auto object-contain drop-shadow-2xl"
          style={{ width: 'clamp(260px, 72vw, 460px)', height: 'auto' }}
        />
      </div>

      {/* Card glass */}
      <div
        className="w-full max-w-md rounded-2xl p-6"
        style={{
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.25)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}
      >
        <h2 className="text-lg font-semibold text-white mb-1 text-center">Entrar</h2>
        <p className="text-sm mb-5 text-center" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Acesse com seu e-mail e senha cadastrados
        </p>

        <style>{`
          .input-zoom {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .input-zoom:hover, .input-zoom:focus {
            transform: scale(1.04);
            box-shadow: 0 0 0 2px rgba(255,255,255,0.5);
            outline: none;
          }
        `}</style>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email" className="text-white text-sm font-medium">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
              }}
              className="placeholder:text-white/50 input-zoom"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="senha" className="text-white text-sm font-medium">Senha</Label>
            <Input
              id="senha"
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              autoComplete="current-password"
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
              }}
              className="placeholder:text-white/50 input-zoom"
            />
          </div>

          {erro && (
            <p className="text-sm rounded-lg p-3" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
              {erro}
            </p>
          )}

          <Button
            type="submit"
            className="w-full font-semibold mt-2"
            disabled={carregando}
            style={{ background: 'rgba(255,255,255,0.95)', color: '#0f766e' }}
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <div className="mt-4 flex flex-col gap-2 text-center text-sm">
          <button
            type="button"
            onClick={handleEsqueciSenha}
            className="underline"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            Esqueci minha senha
          </button>
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>
            Não tem conta?{' '}
            <Link to="/signup" className="font-semibold underline text-white">
              Criar conta
            </Link>
          </span>
        </div>
      </div>
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
