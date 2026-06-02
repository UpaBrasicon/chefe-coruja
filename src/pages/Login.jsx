import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

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
      redirectTo: 'https://chefecoruja.com.br/redefinir-senha',
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
    <div className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-4 py-10">
      <div style={{
        position: 'absolute',
        inset: '-20px',
        backgroundImage: 'url(/fundo-login.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(1.5px)',
        zIndex: 0,
      }} />
      <style>{`
        .login-input {
          background: rgba(255,255,255,0.15) !important;
          border: 1.5px solid rgba(255,255,255,0.35) !important;
          color: #fff !important;
          border-radius: 10px !important;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .login-input::placeholder { color: rgba(255,255,255,0.5) !important; }
        .login-input:focus {
          border-color: rgba(255,255,255,0.7) !important;
          box-shadow: 0 0 0 3px rgba(255,255,255,0.12) !important;
          outline: none !important;
        }
        .login-btn {
          background: rgba(255,255,255,0.95);
          color: #0f766e;
          font-weight: 700;
          font-size: 1rem;
          border: none;
          border-radius: 10px;
          padding: 0.7rem 1rem;
          width: 100%;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          letter-spacing: 0.01em;
        }
        .login-btn:hover:not(:disabled) {
          transform: scale(1.025);
          box-shadow: 0 4px 20px rgba(0,0,0,0.18);
        }
        .login-btn:disabled { opacity: 0.65; cursor: not-allowed; }
      `}</style>

      <div className="relative z-10 flex flex-col items-center w-full">
      {/* Logo */}
      <div className="flex flex-col items-center mb-4 select-none">
        <img
          src="/logo-login.png"
          alt="Chefe Coruja"
          className="drop-shadow-2xl"
          style={{ width: 'clamp(260px, 72vw, 460px)', height: 'auto' }}
        />
      </div>

      {/* Card glass */}
      <div
        className="w-full rounded-2xl p-7"
        style={{
          maxWidth: '420px',
          background: 'rgba(10,60,60,0.52)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          border: '1px solid rgba(255,255,255,0.18)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.35)',
        }}
      >
        <h2
          className="font-bold text-center mb-1"
          style={{ color: '#fff', fontSize: '1.35rem' }}
        >
          Entrar
        </h2>
        <p className="text-center text-sm mb-6" style={{ color: 'rgba(255,255,255,0.65)' }}>
          Acesse com seu e-mail e senha cadastrados
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
              E-mail
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="login-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="senha" style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
              Senha
            </Label>
            <Input
              id="senha"
              type="password"
              placeholder="••••••••"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              autoComplete="current-password"
              className="login-input"
            />
          </div>

          {erro && (
            <p
              className="text-sm rounded-lg p-3"
              style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.18)', border: '1px solid rgba(239,68,68,0.35)' }}
            >
              {erro}
            </p>
          )}

          <button type="submit" className="login-btn mt-1" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-5 flex flex-col gap-2.5 text-center text-sm">
          <button
            type="button"
            onClick={handleEsqueciSenha}
            className="underline underline-offset-2 transition-opacity hover:opacity-100"
            style={{ color: 'rgba(255,255,255,0.65)' }}
          >
            Esqueci minha senha
          </button>
          <span style={{ color: 'rgba(255,255,255,0.65)' }}>
            Não tem conta?{' '}
            <Link to="/signup" className="font-semibold underline underline-offset-2 text-white">
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
