import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

export default function ModalConfiguracoes({ aberto, onFechar }) {
  const { profissional, carregarPerfil, user } = useAuth()
  const [form, setForm] = useState({ nome: '', telefone: '', especialidades: '', unidade: '' })
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    if (aberto && profissional) {
      setForm({
        nome: profissional.nome ?? '',
        telefone: profissional.telefone ?? '',
        especialidades: profissional.especialidades ?? '',
        unidade: profissional.unidade ?? '',
      })
      setErro('')
      setSucesso(false)
    }
  }, [aberto, profissional])

  function atualizar(campo) {
    return e => setForm(prev => ({ ...prev, [campo]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.nome.trim()) { setErro('O nome não pode estar vazio.'); return }
    setErro('')
    setCarregando(true)
    const { error } = await supabase
      .from('profissionais')
      .update({
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        especialidades: form.especialidades.trim(),
        unidade: form.unidade.trim(),
      })
      .eq('id', profissional.id)
    setCarregando(false)
    if (error) {
      setErro('Erro ao salvar. Tente novamente.')
    } else {
      await carregarPerfil(user)
      setSucesso(true)
      setTimeout(() => { setSucesso(false); onFechar() }, 1500)
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
    <Dialog open={aberto} onOpenChange={v => { if (!v) onFechar() }}>
      <DialogContent style={{ borderColor: 'var(--cor-borda)' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--cor-texto)' }}>Configurações do perfil</DialogTitle>
        </DialogHeader>

        {sucesso ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-3">✅</div>
            <p className="font-semibold" style={{ color: '#16a34a' }}>Dados atualizados!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Campos somente leitura */}
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--cor-fundo)', border: '1px solid var(--cor-borda)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--cor-texto-suave)' }}>Dados fixos</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span style={{ color: 'var(--cor-texto-suave)' }}>E-mail</span>
                  <p className="font-medium truncate" style={{ color: 'var(--cor-texto)' }}>{profissional?.email}</p>
                </div>
                <div>
                  <span style={{ color: 'var(--cor-texto-suave)' }}>CRM</span>
                  <p className="font-medium" style={{ color: 'var(--cor-texto)' }}>{profissional?.crm}</p>
                </div>
              </div>
            </div>

            {/* Campos editáveis */}
            <div className="space-y-1">
              <Label style={labelStyle}>Nome completo</Label>
              <Input value={form.nome} onChange={atualizar('nome')} placeholder="Dr. João Silva" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label style={labelStyle}>Telefone</Label>
                <Input value={form.telefone} onChange={atualizar('telefone')} placeholder="(62) 99999-9999" />
              </div>
              <div className="space-y-1">
                <Label style={labelStyle}>Especialidade</Label>
                <Input value={form.especialidades} onChange={atualizar('especialidades')} placeholder="Clínica Geral" />
              </div>
            </div>

            <div className="space-y-1">
              <Label style={labelStyle}>
                Unidade
                <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-normal"
                  style={{ background: '#e0f2fe', color: '#0369a1' }}>
                  futuro
                </span>
              </Label>
              <Input value={form.unidade} onChange={atualizar('unidade')} placeholder="UPA Aparecida de Goiânia" />
              <p className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>
                Identificador da unidade de saúde — será usado quando o sistema estiver em múltiplas unidades.
              </p>
            </div>

            {erro && <p style={erroStyle}>{erro}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onFechar} className="flex-1"
                style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={carregando} className="flex-1"
                style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
                {carregando ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
