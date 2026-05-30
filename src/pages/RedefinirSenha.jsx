import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

export default function RedefinirSenha() {
  const navigate = useNavigate()
  const [pronto, setPronto] = useState(false)       // sessão de recovery detectada
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)

  // Detecta o token de recovery no hash da URL (#access_token=...&type=recovery)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPronto(true)
      }
    })

    // Supabase processa o hash automaticamente ao iniciar — força a checagem
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setPronto(true)
    })

    return () => subscription.unsubscribe()
  }, [])

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

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return }

    setCarregando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setCarregando(false)

    if (error) {
      setErro('Erro ao redefinir senha. O link pode ter expirado — solicite um novo.')
    } else {
      setSucesso(true)
      setTimeout(() => navigate('/login'), 3000)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8" style={bgStyle}>
      <div className="text-center mb-6">
        <img src="/logo.png" alt="Chefe Coruja" className="h-20 w-20 rounded-full object-cover mx-auto mb-2 shadow-xl" />
        <h1 className="text-2xl font-bold text-white tracking-tight">Chefe Coruja</h1>
      </div>

      <div className="w-full max-w-md rounded-2xl p-6" style={glassStyle}>
        {sucesso ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-3">✅</div>
            <h2 className="text-lg font-semibold text-white mb-2">Senha redefinida!</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)' }}>
              Redirecionando para o login em instantes...
            </p>
          </div>
        ) : !pronto ? (
          <div className="text-center py-6">
            <p className="text-white font-medium mb-2">Verificando link...</p>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Se nada acontecer, o link pode ter expirado.{' '}
              <button onClick={() => navigate('/login')} className="underline text-white">
                Voltar ao login
              </button>
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-white mb-1 text-center">Nova senha</h2>
            <p className="text-sm mb-5 text-center" style={{ color: 'rgba(255,255,255,0.7)' }}>
              Digite e confirme sua nova senha
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="senha" className="text-white text-sm font-medium">Nova senha</Label>
                <Input
                  id="senha"
                  type="password"
                  placeholder="Mín. 6 caracteres"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  required
                  style={inputStyle}
                  className="placeholder:text-white/50"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirmar" className="text-white text-sm font-medium">Confirmar senha</Label>
                <Input
                  id="confirmar"
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmar}
                  onChange={e => setConfirmar(e.target.value)}
                  required
                  style={inputStyle}
                  className="placeholder:text-white/50"
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
                {carregando ? 'Salvando...' : 'Salvar nova senha'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
