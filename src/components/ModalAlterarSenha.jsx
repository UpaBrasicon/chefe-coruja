import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export default function ModalAlterarSenha({ aberto, onFechar }) {
  const { user } = useAuth()
  const [etapa, setEtapa] = useState(1)
  const [codigoEnviado, setCodigoEnviado] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)

  function resetar() {
    setEtapa(1)
    setCodigoEnviado(false)
    setCodigo('')
    setSenha('')
    setConfirmar('')
    setErro('')
    setSucesso(false)
    setCarregando(false)
  }

  async function enviarCodigo() {
    setCarregando(true)
    setErro('')
    const { error } = await supabase.auth.reauthenticate()
    setCarregando(false)
    if (error) {
      setErro('Erro ao enviar código. Tente novamente.')
    } else {
      setCodigoEnviado(true)
    }
  }

  async function verificarCodigo(e) {
    e.preventDefault()
    if (codigo.length < 6) { setErro('Digite o código de 6 dígitos.'); return }
    setCarregando(true)
    setErro('')
    const { error } = await supabase.auth.verifyOtp({
      email: user.email,
      token: codigo,
      type: 'reauthentication',
    })
    setCarregando(false)
    if (error) {
      setErro('Código inválido ou expirado. Solicite um novo.')
    } else {
      setEtapa(2)
    }
  }

  async function alterarSenha(e) {
    e.preventDefault()
    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres.'); return }
    if (senha !== confirmar) { setErro('As senhas não coincidem.'); return }
    setCarregando(true)
    setErro('')
    const { error } = await supabase.auth.updateUser({ password: senha })
    setCarregando(false)
    if (error) {
      setErro('Erro ao alterar senha. Tente novamente.')
    } else {
      setSucesso(true)
      setTimeout(() => { resetar(); onFechar() }, 2000)
    }
  }

  const labelStyle = { color: 'var(--cor-texto)' }
  const erroStyle = {
    color: '#dc2626',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
  }

  return (
    <Dialog open={aberto} onOpenChange={v => { if (!v) { resetar(); onFechar() } }}>
      <DialogContent style={{ borderColor: 'var(--cor-borda)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--cor-texto)' }}>Alterar senha</DialogTitle>
        </DialogHeader>

        {sucesso ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold" style={{ color: '#16a34a' }}>Senha alterada com sucesso!</p>
          </div>
        ) : etapa === 1 ? (
          <div className="space-y-4">
            {!codigoEnviado ? (
              <>
                <p className="text-sm" style={{ color: 'var(--cor-texto-suave)', lineHeight: 1.6 }}>
                  Para sua segurança, enviaremos um código de verificação para{' '}
                  <strong style={{ color: 'var(--cor-texto)' }}>{user?.email}</strong>.
                </p>
                {erro && <p style={erroStyle}>{erro}</p>}
                <Button onClick={enviarCodigo} disabled={carregando} className="w-full"
                  style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
                  {carregando ? 'Enviando...' : 'Enviar código de verificação'}
                </Button>
              </>
            ) : (
              <form onSubmit={verificarCodigo} className="space-y-4">
                <p className="text-sm" style={{ color: 'var(--cor-texto-suave)', lineHeight: 1.6 }}>
                  Código enviado para <strong style={{ color: 'var(--cor-texto)' }}>{user?.email}</strong>.
                  Verifique sua caixa de entrada.
                </p>
                <div className="space-y-1">
                  <Label style={labelStyle}>Código de verificação</Label>
                  <Input
                    placeholder="000000"
                    value={codigo}
                    onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    className="text-center text-xl tracking-widest"
                    style={{ letterSpacing: '0.3em' }}
                    autoFocus
                  />
                </div>
                {erro && <p style={erroStyle}>{erro}</p>}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={enviarCodigo} disabled={carregando}
                    className="flex-1" style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}>
                    Reenviar
                  </Button>
                  <Button type="submit" disabled={carregando || codigo.length < 6} className="flex-1"
                    style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
                    {carregando ? 'Verificando...' : 'Verificar código'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <form onSubmit={alterarSenha} className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
              Identidade confirmada. Digite sua nova senha:
            </p>
            <div className="space-y-1">
              <Label style={labelStyle}>Nova senha</Label>
              <Input type="password" placeholder="Mín. 6 caracteres"
                value={senha} onChange={e => setSenha(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1">
              <Label style={labelStyle}>Confirmar nova senha</Label>
              <Input type="password" placeholder="Repita a nova senha"
                value={confirmar} onChange={e => setConfirmar(e.target.value)} required />
            </div>
            {erro && <p style={erroStyle}>{erro}</p>}
            <Button type="submit" disabled={carregando} className="w-full"
              style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
              {carregando ? 'Salvando...' : 'Salvar nova senha'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
