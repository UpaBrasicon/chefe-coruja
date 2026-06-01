import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/button'

function BadgeStatus({ status, ativo }) {
  if (!ativo) return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#F1F5F9', color: '#64748B' }}>Inativo</span>
  const map = {
    pendente:  { bg: '#FEF9C3', cor: '#854D0E', label: 'Pendente' },
    aprovado:  { bg: '#DCFCE7', cor: '#166534', label: 'Aprovado' },
    recusado:  { bg: '#FEE2E2', cor: '#991B1B', label: 'Recusado' },
  }
  const s = map[status] ?? { bg: '#FEF9C3', cor: '#854D0E', label: 'Pendente' }
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.cor }}>{s.label}</span>
}

function BadgeRole({ role }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: role === 'admin' ? '#EDE9FE' : '#F1F5F9', color: role === 'admin' ? '#5B21B6' : '#64748B' }}>
      {role === 'admin' ? '👑 Admin' : 'Médico'}
    </span>
  )
}

export default function TabMedicos() {
  const [medicos, setMedicos] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [acao, setAcao] = useState(null) // id do médico sendo processado
  const [erro, setErro] = useState('')
  const [filtro, setFiltro] = useState('todos')

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase
      .from('profissionais')
      .select('id, nome, crm, email, telefone, role, status_aprovacao, ativo, especialidades')
      .order('nome')
    setMedicos(data ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function aprovar(id) {
    setErro(''); setAcao(id)
    const { error } = await supabase.rpc('aprovar_profissional', { profissional_id: id })
    if (error) setErro('Erro ao aprovar: ' + error.message)
    setAcao(null); await carregar()
  }

  async function recusar(id) {
    setErro(''); setAcao(id)
    const { error } = await supabase.rpc('recusar_profissional', { profissional_id: id, motivo: '' })
    if (error) setErro('Erro ao recusar: ' + error.message)
    setAcao(null); await carregar()
  }

  async function toggleAtivo(medico) {
    setErro(''); setAcao(medico.id)
    const novoAtivo = !medico.ativo
    const { error } = await supabase.from('profissionais').update({ ativo: novoAtivo }).eq('id', medico.id)
    if (error) { setErro('Erro: ' + error.message); setAcao(null); return }

    // Se desativando, remove de plantões futuros
    if (!novoAtivo) {
      const hoje = new Date().toISOString().split('T')[0]
      await supabase.from('plantoes')
        .update({ profissional_id: null, status: 'vago' })
        .eq('profissional_id', medico.id)
        .gte('data', hoje)
    }
    setAcao(null); await carregar()
  }

  async function toggleRole(medico) {
    setErro(''); setAcao(medico.id)
    const novoRole = medico.role === 'admin' ? 'medico' : 'admin'
    const { error } = await supabase.from('profissionais').update({ role: novoRole }).eq('id', medico.id)
    if (error) setErro('Erro: ' + error.message)
    setAcao(null); await carregar()
  }

  const pendentes = medicos.filter(m => !m.status_aprovacao || m.status_aprovacao === 'pendente')
  const filtrados = filtro === 'todos' ? medicos
    : filtro === 'ativos' ? medicos.filter(m => m.ativo && m.status_aprovacao === 'aprovado')
    : filtro === 'inativos' ? medicos.filter(m => !m.ativo)
    : medicos.filter(m => m.role === filtro)

  return (
    <div className="space-y-6">
      {erro && <p className="text-sm rounded-lg p-3" style={{ color: 'var(--cor-vago)', background: '#FEF2F2' }}>{erro}</p>}

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <section>
          <h2 className="font-semibold text-sm uppercase tracking-wider mb-3" style={{ color: 'var(--cor-vago)' }}>
            ⏳ Aguardando aprovação ({pendentes.length})
          </h2>
          <div className="space-y-3">
            {pendentes.map(m => (
              <div key={m.id} className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ background: '#FEF9C3', border: '1px solid #CA8A04' }}>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--cor-texto)' }}>{m.nome}</p>
                  <p className="text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
                    CRM {m.crm} · {m.email ?? '—'} · {m.telefone ?? '—'}
                  </p>
                  {m.especialidades?.length > 0 && (
                    <p className="text-xs mt-1" style={{ color: '#92400E' }}>{m.especialidades.join(', ')}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" onClick={() => aprovar(m.id)} disabled={acao === m.id}
                    style={{ background: 'var(--cor-sucesso)', color: '#fff' }}>
                    {acao === m.id ? '...' : 'Aprovar'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => recusar(m.id)} disabled={acao === m.id}
                    style={{ borderColor: 'var(--cor-vago)', color: 'var(--cor-vago)' }}>
                    Recusar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'todos', label: `Todos (${medicos.length})` },
          { key: 'ativos', label: `Ativos (${medicos.filter(m => m.ativo && m.status_aprovacao === 'aprovado').length})` },
          { key: 'inativos', label: `Inativos (${medicos.filter(m => !m.ativo).length})` },
          { key: 'admin', label: `Admins (${medicos.filter(m => m.role === 'admin').length})` },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setFiltro(key)}
            className="text-xs px-3 py-1 rounded-full font-medium transition-colors"
            style={{
              background: filtro === key ? 'var(--cor-primaria)' : 'var(--cor-superficie)',
              color: filtro === key ? '#fff' : 'var(--cor-texto-suave)',
              border: `1px solid ${filtro === key ? 'var(--cor-primaria)' : 'var(--cor-borda)'}`,
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Lista completa */}
      {carregando ? (
        <p className="text-center py-8" style={{ color: 'var(--cor-texto-suave)' }}>Carregando...</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map(m => (
            <div key={m.id} className="rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)', opacity: m.ativo ? 1 : 0.6 }}>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="font-medium truncate" style={{ color: 'var(--cor-texto)' }}>{m.nome}</p>
                  <BadgeStatus status={m.status_aprovacao} ativo={m.ativo} />
                  <BadgeRole role={m.role} />
                </div>
                <p className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>
                  CRM {m.crm}{m.email ? ` · ${m.email}` : ''}
                </p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap">
                {(!m.status_aprovacao || m.status_aprovacao === 'pendente' || m.status_aprovacao === 'recusado') && (
                  <Button size="sm" onClick={() => aprovar(m.id)} disabled={acao === m.id}
                    style={{ background: 'var(--cor-sucesso)', color: '#fff' }}>
                    {acao === m.id ? '...' : 'Aprovar'}
                  </Button>
                )}
                <button onClick={() => toggleRole(m)} disabled={acao === m.id}
                  className="text-xs px-3 py-1 rounded-lg border transition-colors"
                  style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}
                  title={m.role === 'admin' ? 'Rebaixar para médico' : 'Promover a admin'}>
                  {m.role === 'admin' ? '↓ Médico' : '↑ Admin'}
                </button>
                <button onClick={() => toggleAtivo(m)} disabled={acao === m.id}
                  className="text-xs px-3 py-1 rounded-lg border transition-colors"
                  style={{
                    borderColor: m.ativo ? 'var(--cor-vago)' : 'var(--cor-sucesso)',
                    color: m.ativo ? 'var(--cor-vago)' : 'var(--cor-sucesso)',
                  }}>
                  {acao === m.id ? '...' : m.ativo ? 'Desativar' : 'Reativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
