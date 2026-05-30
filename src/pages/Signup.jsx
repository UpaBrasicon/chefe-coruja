import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export default function Signup() {
  const [form, setForm] = useState({
    nome: '', crm: '', email: '', telefone: '', senha: '', confirmarSenha: '',
  })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)

  function atualizar(campo) {
    return e => setForm(prev => ({ ...prev, [campo]: e.target.value }))
  }

  function validar() {
    if (!form.nome.trim()) return 'Informe seu nome completo.'
    if (!/^\d{4,6}$/.test(form.crm)) return 'CRM inválido. Use apenas números (4 a 6 dígitos).'
    if (!form.email.includes('@')) return 'E-mail inválido.'
    if (form.senha.length < 6) return 'A senha deve ter pelo menos 6 caracteres.'
    if (form.senha !== form.confirmarSenha) return 'As senhas não coincidem.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    const erroValidacao = validar()
    if (erroValidacao) { setErro(erroValidacao); return }

    setCarregando(true)
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.senha,
      options: {
        data: {
          nome: form.nome.trim(),
          crm: form.crm.trim(),
          telefone: form.telefone.trim(),
        },
      },
    })
    setCarregando(false)

    if (error) {
      setErro(traduzirErro(error.message))
    } else {
      setSucesso(true)
    }
  }

  const bgStyle = {
    background: 'linear-gradient(145deg, #0d9488 0%, #0f766e 40%, #134e4a 100%)',
  }
  const glassStyle = {
    background: 'rgba(255,255,255,0.12)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.25)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  }
  const inputStyle = {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
  }

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={bgStyle}>
        <div className="w-full max-w-md rounded-2xl p-8 text-center" style={glassStyle}>
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-3 text-white">Cadastro recebido!</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)' }}>
            Se você já é da equipe, seu acesso é imediato. Caso contrário, aguarde a aprovação do coordenador.
          </p>
          <Link to="/login">
            <Button className="mt-6 w-full font-semibold" style={{ background: 'rgba(255,255,255,0.95)', color: '#0f766e' }}>
              Ir para o Login
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8" style={bgStyle}>
      <div className="text-center mb-5">
        <img src="/logo.png" alt="Chefe Coruja" className="h-20 w-20 rounded-full object-cover mx-auto mb-2 shadow-xl" />
        <h1 className="text-2xl font-bold text-white tracking-tight">Chefe Coruja</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>Criar nova conta</p>
      </div>

      <div className="w-full max-w-md rounded-2xl p-6" style={glassStyle}>
        <h2 className="text-lg font-semibold text-white mb-1">Cadastro</h2>
        <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Preencha seus dados para solicitar acesso
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="nome" className="text-white text-sm font-medium">Nome completo</Label>
            <Input id="nome" placeholder="Dr. João Silva" value={form.nome} onChange={atualizar('nome')} required
              style={inputStyle} className="placeholder:text-white/50" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="crm" className="text-white text-sm font-medium">CRM</Label>
              <Input id="crm" placeholder="12345" value={form.crm} onChange={atualizar('crm')} maxLength={6} required
                style={inputStyle} className="placeholder:text-white/50" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="telefone" className="text-white text-sm font-medium">Telefone</Label>
              <Input id="telefone" placeholder="(62) 99999-9999" value={form.telefone} onChange={atualizar('telefone')}
                style={inputStyle} className="placeholder:text-white/50" />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="email" className="text-white text-sm font-medium">E-mail</Label>
            <Input id="email" type="email" placeholder="seu@email.com" value={form.email} onChange={atualizar('email')} required
              style={inputStyle} className="placeholder:text-white/50" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="senha" className="text-white text-sm font-medium">Senha</Label>
            <Input id="senha" type="password" placeholder="Mín. 6 caracteres" value={form.senha} onChange={atualizar('senha')} required
              style={inputStyle} className="placeholder:text-white/50" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="confirmarSenha" className="text-white text-sm font-medium">Confirmar senha</Label>
            <Input id="confirmarSenha" type="password" placeholder="Repita a senha" value={form.confirmarSenha} onChange={atualizar('confirmarSenha')} required
              style={inputStyle} className="placeholder:text-white/50" />
          </div>

          {erro && (
            <p className="text-sm rounded-lg p-3" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
              {erro}
            </p>
          )}

          <Button type="submit" className="w-full font-semibold mt-2" disabled={carregando}
            style={{ background: 'rgba(255,255,255,0.95)', color: '#0f766e' }}>
            {carregando ? 'Cadastrando...' : 'Criar conta'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold underline text-white">Entrar</Link>
        </p>
      </div>
    </div>
  )
}

function traduzirErro(msg) {
  if (msg.includes('already registered')) return 'Este e-mail já está cadastrado.'
  if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.'
  if (msg.includes('Unable to validate')) return 'E-mail inválido.'
  return msg
}
