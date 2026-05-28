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

  if (sucesso) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--cor-fundo)' }}>
        <div className="w-full max-w-md text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--cor-texto)' }}>Cadastro recebido!</h2>
          <p style={{ color: 'var(--cor-texto-suave)' }}>
            Se você já é da equipe, seu acesso é imediato. Caso contrário, aguarde a aprovação do coordenador.
          </p>
          <Link to="/login">
            <Button className="mt-6 w-full" style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
              Ir para o Login
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background: 'var(--cor-fundo)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🦉</div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--cor-texto)' }}>Chefe Coruja</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--cor-texto-suave)' }}>Criar nova conta</p>
        </div>

        <Card style={{ border: '1px solid var(--cor-borda)' }}>
          <CardHeader>
            <CardTitle style={{ color: 'var(--cor-texto)' }}>Cadastro</CardTitle>
            <CardDescription style={{ color: 'var(--cor-texto-suave)' }}>
              Preencha seus dados para solicitar acesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="nome" style={{ color: 'var(--cor-texto)' }}>Nome completo</Label>
                <Input id="nome" placeholder="Dr. João Silva" value={form.nome} onChange={atualizar('nome')} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="crm" style={{ color: 'var(--cor-texto)' }}>CRM</Label>
                  <Input
                    id="crm"
                    placeholder="12345"
                    value={form.crm}
                    onChange={atualizar('crm')}
                    maxLength={6}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="telefone" style={{ color: 'var(--cor-texto)' }}>Telefone</Label>
                  <Input id="telefone" placeholder="(62) 99999-9999" value={form.telefone} onChange={atualizar('telefone')} />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="email" style={{ color: 'var(--cor-texto)' }}>E-mail</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={form.email} onChange={atualizar('email')} required />
              </div>

              <div className="space-y-1">
                <Label htmlFor="senha" style={{ color: 'var(--cor-texto)' }}>Senha</Label>
                <Input id="senha" type="password" placeholder="Mín. 6 caracteres" value={form.senha} onChange={atualizar('senha')} required />
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirmarSenha" style={{ color: 'var(--cor-texto)' }}>Confirmar senha</Label>
                <Input id="confirmarSenha" type="password" placeholder="Repita a senha" value={form.confirmarSenha} onChange={atualizar('confirmarSenha')} required />
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
                {carregando ? 'Cadastrando...' : 'Criar conta'}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
              Já tem conta?{' '}
              <Link to="/login" className="font-medium underline" style={{ color: 'var(--cor-primaria)' }}>
                Entrar
              </Link>
            </p>
          </CardContent>
        </Card>
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
