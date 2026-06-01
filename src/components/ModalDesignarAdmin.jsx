import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'

export default function ModalDesignarAdmin({ plantao, aberto, onFechar, onDesignado }) {
  const [profissionais, setProfissionais] = useState([])
  const [busca, setBusca]                 = useState('')
  const [selecionado, setSelecionado]     = useState(null)
  const [salvando, setSalvando]           = useState(false)
  const [erro, setErro]                   = useState('')

  useEffect(() => {
    if (!aberto) return
    setBusca(''); setSelecionado(null); setErro('')
    supabase.from('profissionais')
      .select('id, nome, crm')
      .eq('status_aprovacao', 'aprovado')
      .eq('ativo', true)
      .order('nome')
      .then(({ data }) => setProfissionais(data ?? []))
  }, [aberto])

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase()
    if (!b) return profissionais.slice(0, 8)
    return profissionais
      .filter(p => p.nome.toLowerCase().includes(b) || (p.crm ?? '').toLowerCase().includes(b))
      .slice(0, 8)
  }, [busca, profissionais])

  async function handleSalvar() {
    if (!selecionado) return
    setSalvando(true); setErro('')
    const { error } = await supabase.from('plantoes')
      .update({ profissional_id: selecionado.id, status: 'confirmado' })
      .eq('id', plantao.id)
    if (error) { setErro(error.message); setSalvando(false); return }
    setSalvando(false)
    onDesignado?.()
    onFechar()
  }

  async function handleLimpar() {
    setSalvando(true); setErro('')
    const { error } = await supabase.from('plantoes')
      .update({ profissional_id: null, status: 'vago' })
      .eq('id', plantao.id)
    if (error) { setErro(error.message); setSalvando(false); return }
    setSalvando(false)
    onDesignado?.()
    onFechar()
  }

  if (!aberto) return null

  const setor = plantao.setores
  const turno = plantao.tipos_turno
  const atual = plantao.profissionais

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="rounded-2xl w-full max-w-sm" style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <p className="font-bold text-sm" style={{ color: '#0f172a' }}>Designar profissional</p>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              {setor?.nome} · {turno?.hora_inicio?.slice(0,5)}–{turno?.hora_fim?.slice(0,5)}
            </p>
          </div>
          <button onClick={onFechar} style={{ color: '#94a3b8', fontSize: 20 }}>×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Atual */}
          <div className="rounded-lg px-3 py-2 text-sm" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <span style={{ color: '#64748b', fontSize: 12 }}>Atualmente: </span>
            <span style={{ color: atual ? '#0f172a' : '#dc2626', fontWeight: 600 }}>
              {atual?.nome ?? 'VAGO'}
            </span>
          </div>

          {/* Busca */}
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#475569' }}>Novo profissional</p>
            <input
              value={busca}
              onChange={e => { setBusca(e.target.value); setSelecionado(null) }}
              placeholder="Buscar por nome ou CRM…"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{ border: '1px solid #cbd5e1', color: '#0f172a' }}
            />
          </div>

          {/* Lista */}
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #e2e8f0', maxHeight: 220, overflowY: 'auto' }}>
            {filtrados.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: '#94a3b8' }}>Nenhum profissional encontrado</p>
            ) : filtrados.map(p => (
              <button key={p.id}
                onClick={() => setSelecionado(p)}
                className="w-full text-left px-3 py-2.5 transition-colors"
                style={{
                  background: selecionado?.id === p.id ? '#f0fdfa' : '#fff',
                  borderBottom: '1px solid #f1f5f9',
                  borderLeft: selecionado?.id === p.id ? '3px solid #0d9488' : '3px solid transparent',
                }}>
                <p className="text-sm font-medium" style={{ color: '#0f172a' }}>{p.nome}</p>
                {p.crm && <p className="text-xs" style={{ color: '#94a3b8' }}>CRM {p.crm}</p>}
              </button>
            ))}
          </div>

          {erro && <p className="text-xs rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fef2f2' }}>{erro}</p>}

          {/* Ações */}
          <div className="flex gap-2">
            <Button
              onClick={handleSalvar}
              disabled={!selecionado || salvando}
              className="flex-1"
              style={{ background: '#0d9488', color: '#fff' }}>
              {salvando ? 'Salvando…' : 'Confirmar'}
            </Button>
            {atual && (
              <Button variant="outline" onClick={handleLimpar} disabled={salvando}
                style={{ borderColor: '#fca5a5', color: '#dc2626' }}>
                Deixar vago
              </Button>
            )}
            <Button variant="outline" onClick={onFechar}
              style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
