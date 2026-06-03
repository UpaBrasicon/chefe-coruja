import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  Crown, Building2, Grid3x3, Users, BarChart3,
  Plus, Edit2, Trash2, Check, X, ToggleLeft, ToggleRight,
  Database, HardDrive, Activity, TrendingUp,
} from 'lucide-react'

const CEO_HEADER_BG = 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)'
const CORES_PADRAO = ['#0d9488', '#7c3aed', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#db2777', '#ea580c']

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, valor, sub, icon: Icon, cor }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-2"
      style={{ background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94a3b8' }}>{label}</p>
          <p className="text-3xl font-bold mt-1" style={{ color: cor || '#1e293b' }}>{valor ?? '—'}</p>
        </div>
        {Icon && (
          <div className="rounded-xl p-2.5" style={{ background: cor ? `${cor}18` : '#f8fafc' }}>
            <Icon size={22} style={{ color: cor || '#94a3b8' }} />
          </div>
        )}
      </div>
      {sub && <p className="text-xs" style={{ color: '#64748b' }}>{sub}</p>}
    </div>
  )
}

// ── Tab: Visão Geral ──────────────────────────────────────────────────────────
function TabVisaoGeral() {
  const [stats, setStats] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.rpc('fn_stats_ceo').then(({ data, error }) => {
      if (error) setErro('Execute o SQL de setup no Supabase para ativar esta função.')
      else setStats(data)
      setCarregando(false)
    })
  }, [])

  if (carregando) return <p className="text-center py-12" style={{ color: '#94a3b8' }}>Carregando estatísticas...</p>

  if (erro) return (
    <div className="rounded-xl p-5" style={{ background: '#fef2f2', border: '1px solid #fca5a5' }}>
      <p className="font-semibold" style={{ color: '#991b1b' }}>Setup necessário</p>
      <p className="text-sm mt-1" style={{ color: '#b91c1c' }}>{erro}</p>
      <p className="text-xs mt-3" style={{ color: '#64748b' }}>
        Execute o script SQL fornecido no Supabase → SQL Editor para criar a função fn_stats_ceo().
      </p>
    </div>
  )

  return (
    <div className="space-y-7">
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Profissionais</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total" valor={stats.total_medicos} icon={Users} cor="#0d9488" />
          <StatCard label="Ativos" valor={stats.medicos_ativos} icon={Activity} cor="#16a34a" sub="Aprovados" />
          <StatCard label="Inativos" valor={stats.medicos_inativos} icon={ToggleLeft} cor="#64748b" />
          <StatCard label="Pendentes" valor={stats.medicos_pendentes} icon={TrendingUp} cor="#d97706" sub="Aguardando aprovação" />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Estrutura</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Unidades" valor={stats.total_unidades} icon={Building2} cor="#7c3aed" sub={`${stats.unidades_ativas} ativa(s)`} />
          <StatCard label="Setores" valor={stats.total_setores} icon={Grid3x3} cor="#0891b2" />
          <StatCard label="Admins" valor={stats.total_admins} icon={Crown} cor="#b45309" />
          <StatCard label="Plantões (mês)" valor={stats.plantoes_mes} icon={BarChart3} cor="#0d9488" />
        </div>
      </section>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#94a3b8' }}>Sistema</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Banco de Dados" valor={stats.db_size} icon={Database} cor="#1e293b" sub="Tamanho total do banco" />
          <StatCard label="Arquivos (Storage)" valor={stats.storage_count} icon={HardDrive} cor="#7c3aed" sub={stats.storage_size} />
          <StatCard label="Movimentações" valor={Number(stats.total_trocas) + Number(stats.total_desistencias)} icon={TrendingUp} cor="#0891b2"
            sub={`${stats.total_trocas} trocas · ${stats.total_desistencias} desistências`} />
        </div>
      </section>
    </div>
  )
}

// ── Tab: Unidades ─────────────────────────────────────────────────────────────
function TabUnidades() {
  const [unidades, setUnidades] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [editNome, setEditNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  async function carregar() {
    setCarregando(true)
    const { data } = await supabase.from('unidades').select('*').order('nome')
    setUnidades(data ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function criar() {
    if (!novoNome.trim()) return
    setSalvando(true); setErro('')
    const { error } = await supabase.from('unidades').insert({ nome: novoNome.trim(), ativo: true })
    if (error) setErro('Erro: ' + error.message)
    else { setNovoNome(''); setCriando(false) }
    setSalvando(false)
    await carregar()
  }

  async function salvarEdicao(id) {
    if (!editNome.trim()) return
    setSalvando(true); setErro('')
    const { error } = await supabase.from('unidades').update({ nome: editNome.trim() }).eq('id', id)
    if (error) setErro('Erro: ' + error.message)
    else setEditandoId(null)
    setSalvando(false)
    await carregar()
  }

  async function toggleAtivo(u) {
    await supabase.from('unidades').update({ ativo: !u.ativo }).eq('id', u.id)
    await carregar()
  }

  async function deletar(id) {
    if (!window.confirm('Deletar esta unidade? Setores vinculados também serão afetados.')) return
    const { error } = await supabase.from('unidades').delete().eq('id', id)
    if (error) setErro('Erro ao deletar: ' + error.message)
    await carregar()
  }

  return (
    <div className="space-y-4">
      {erro && <p className="text-sm rounded-lg p-3" style={{ color: '#991b1b', background: '#fef2f2' }}>{erro}</p>}

      <div className="flex justify-between items-center">
        <p className="text-sm" style={{ color: '#94a3b8' }}>{unidades.length} unidade(s) cadastrada(s)</p>
        <Button size="sm" onClick={() => { setCriando(true); setEditandoId(null) }}
          style={{ background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Nova unidade
        </Button>
      </div>

      {criando && (
        <div className="rounded-xl p-4 flex gap-2" style={{ background: '#f5f3ff', border: '1px solid #7c3aed' }}>
          <Input
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            placeholder="Nome da unidade (ex: UPA Leste)"
            onKeyDown={e => e.key === 'Enter' && criar()}
            autoFocus
            style={{ flex: 1 }}
          />
          <Button size="sm" onClick={criar} disabled={salvando}
            style={{ background: '#16a34a', color: '#fff', padding: '0 10px' }}>
            <Check size={14} />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setCriando(false); setNovoNome('') }}
            style={{ padding: '0 10px' }}>
            <X size={14} />
          </Button>
        </div>
      )}

      {carregando ? (
        <p className="text-center py-8" style={{ color: '#94a3b8' }}>Carregando...</p>
      ) : (
        <div className="space-y-2">
          {unidades.map(u => (
            <div key={u.id} className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background: '#fff', border: '1px solid #e2e8f0', opacity: u.ativo ? 1 : 0.6 }}>
              <div className="flex-1 min-w-0">
                {editandoId === u.id ? (
                  <div className="flex gap-2">
                    <Input value={editNome} onChange={e => setEditNome(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && salvarEdicao(u.id)}
                      autoFocus style={{ flex: 1, fontSize: 14 }} />
                    <Button size="sm" onClick={() => salvarEdicao(u.id)} disabled={salvando}
                      style={{ background: '#16a34a', color: '#fff', padding: '0 10px' }}>
                      <Check size={13} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}
                      style={{ padding: '0 10px' }}>
                      <X size={13} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-medium" style={{ color: '#1e293b' }}>{u.nome}</p>
                    {!u.ativo && (
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#64748b' }}>inativa</span>
                    )}
                  </div>
                )}
              </div>
              {editandoId !== u.id && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleAtivo(u)} title={u.ativo ? 'Desativar' : 'Ativar'}
                    style={{ color: u.ativo ? '#16a34a' : '#94a3b8' }}>
                    {u.ativo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                  <button onClick={() => { setEditandoId(u.id); setEditNome(u.nome); setCriando(false) }}
                    style={{ color: '#0d9488' }}>
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => deletar(u.id)} style={{ color: '#ef4444' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {unidades.length === 0 && (
            <p className="text-center py-10" style={{ color: '#94a3b8' }}>Nenhuma unidade cadastrada.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Setores ──────────────────────────────────────────────────────────────
function TabSetores() {
  const [unidades, setUnidades] = useState([])
  const [setores, setSetores] = useState([])
  const [unidadeSel, setUnidadeSel] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [criando, setCriando] = useState(false)
  const [novoNome, setNovoNome] = useState('')
  const [novaCor, setNovaCor] = useState('#0d9488')
  const [editandoId, setEditandoId] = useState(null)
  const [editNome, setEditNome] = useState('')
  const [editCor, setEditCor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome')
      .then(({ data }) => {
        setUnidades(data ?? [])
        if (data?.length > 0) setUnidadeSel(String(data[0].id))
      })
  }, [])

  const carregarSetores = useCallback(async (uid) => {
    if (!uid) return
    setCarregando(true)
    const { data } = await supabase.from('setores').select('*').eq('unidade_id', Number(uid)).order('nome')
    setSetores(data ?? [])
    setCarregando(false)
  }, [])

  useEffect(() => { if (unidadeSel) carregarSetores(unidadeSel) }, [unidadeSel, carregarSetores])

  async function criar() {
    if (!novoNome.trim() || !unidadeSel) return
    setSalvando(true); setErro('')
    const { error } = await supabase.from('setores').insert({ nome: novoNome.trim(), cor: novaCor, unidade_id: Number(unidadeSel) })
    if (error) setErro('Erro: ' + error.message)
    else { setNovoNome(''); setCriando(false) }
    setSalvando(false)
    await carregarSetores(unidadeSel)
  }

  async function salvarEdicao(id) {
    setSalvando(true); setErro('')
    const { error } = await supabase.from('setores').update({ nome: editNome, cor: editCor }).eq('id', id)
    if (error) setErro('Erro: ' + error.message)
    else setEditandoId(null)
    setSalvando(false)
    await carregarSetores(unidadeSel)
  }

  async function deletar(id) {
    if (!window.confirm('Deletar este setor?')) return
    const { error } = await supabase.from('setores').delete().eq('id', id)
    if (error) setErro('Erro: ' + error.message)
    await carregarSetores(unidadeSel)
  }

  function PaletaCores({ selecionada, onSelect }) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {CORES_PADRAO.map(c => (
          <button key={c} onClick={() => onSelect(c)}
            className="rounded-full transition-transform hover:scale-110"
            style={{ width: 22, height: 22, background: c, outline: selecionada === c ? `3px solid ${c}` : 'none', outlineOffset: 2 }} />
        ))}
        <input type="color" value={selecionada} onChange={e => onSelect(e.target.value)}
          style={{ width: 26, height: 26, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {erro && <p className="text-sm rounded-lg p-3" style={{ color: '#991b1b', background: '#fef2f2' }}>{erro}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        <select value={unidadeSel} onChange={e => { setUnidadeSel(e.target.value); setCriando(false); setEditandoId(null) }}
          className="text-sm rounded-xl px-3 py-2 font-medium focus:outline-none"
          style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#1e293b', minWidth: 200 }}>
          {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
        </select>
        {unidadeSel && (
          <Button size="sm" onClick={() => { setCriando(true); setEditandoId(null) }}
            style={{ background: '#0891b2', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} /> Novo setor
          </Button>
        )}
        {unidades.length === 0 && (
          <p className="text-sm" style={{ color: '#94a3b8' }}>Cadastre unidades primeiro.</p>
        )}
      </div>

      {criando && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: '#f0f9ff', border: '1px solid #0891b2' }}>
          <Input value={novoNome} onChange={e => setNovoNome(e.target.value)}
            placeholder="Nome do setor (ex: PS Adulto)"
            onKeyDown={e => e.key === 'Enter' && criar()} autoFocus />
          <div className="space-y-1">
            <p className="text-xs font-medium" style={{ color: '#0891b2' }}>Cor do setor:</p>
            <PaletaCores selecionada={novaCor} onSelect={setNovaCor} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={criar} disabled={salvando} style={{ background: '#16a34a', color: '#fff' }}>
              Criar setor
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setCriando(false); setNovoNome('') }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {carregando ? (
        <p className="text-center py-8" style={{ color: '#94a3b8' }}>Carregando...</p>
      ) : (
        <div className="space-y-2">
          {setores.map(s => (
            <div key={s.id} className="rounded-xl px-4 py-3 flex items-start gap-3"
              style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
              <div className="rounded-full shrink-0 mt-1" style={{ width: 14, height: 14, background: s.cor }} />
              <div className="flex-1 min-w-0">
                {editandoId === s.id ? (
                  <div className="space-y-2">
                    <Input value={editNome} onChange={e => setEditNome(e.target.value)}
                      autoFocus style={{ fontSize: 14 }} />
                    <PaletaCores selecionada={editCor} onSelect={setEditCor} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => salvarEdicao(s.id)} disabled={salvando}
                        style={{ background: '#16a34a', color: '#fff' }}>
                        <Check size={13} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}>
                        <X size={13} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="font-medium" style={{ color: '#1e293b' }}>{s.nome}</p>
                )}
              </div>
              {editandoId !== s.id && (
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setEditandoId(s.id); setEditNome(s.nome); setEditCor(s.cor); setCriando(false) }}
                    style={{ color: '#0d9488' }}>
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => deletar(s.id)} style={{ color: '#ef4444' }}>
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {setores.length === 0 && unidadeSel && !carregando && (
            <p className="text-center py-10" style={{ color: '#94a3b8' }}>Nenhum setor nesta unidade.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tab: Usuários ─────────────────────────────────────────────────────────────
function TabUsuarios() {
  const [medicos, setMedicos] = useState([])
  const [unidades, setUnidades] = useState([])
  const [filtroUnidade, setFiltroUnidade] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvandoId, setSalvandoId] = useState(null)
  const [erro, setErro] = useState('')

  async function carregar() {
    setCarregando(true)
    const [{ data: m }, { data: u }] = await Promise.all([
      supabase.from('profissionais')
        .select('id, nome, crm, email, role, status_aprovacao, ativo, unidade_id')
        .order('nome'),
      supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome'),
    ])
    setMedicos(m ?? [])
    setUnidades(u ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function atribuirUnidade(medicoId, unidadeId) {
    setSalvandoId(medicoId); setErro('')
    const { error } = await supabase.from('profissionais')
      .update({ unidade_id: unidadeId ? Number(unidadeId) : null })
      .eq('id', medicoId)
    if (error) setErro('Erro: ' + error.message)
    setSalvandoId(null)
    await carregar()
  }

  const semUnidade = medicos.filter(m => !m.unidade_id).length
  const filtrados = filtroUnidade === '__sem__'
    ? medicos.filter(m => !m.unidade_id)
    : filtroUnidade
    ? medicos.filter(m => String(m.unidade_id) === filtroUnidade)
    : medicos

  return (
    <div className="space-y-4">
      {erro && <p className="text-sm rounded-lg p-3" style={{ color: '#991b1b', background: '#fef2f2' }}>{erro}</p>}

      <div className="flex items-center gap-2 flex-wrap">
        <select value={filtroUnidade} onChange={e => setFiltroUnidade(e.target.value)}
          className="text-sm rounded-xl px-3 py-2 focus:outline-none"
          style={{ background: '#fff', border: '1px solid #e2e8f0', color: filtroUnidade ? '#1e293b' : '#94a3b8', minWidth: 220 }}>
          <option value="">Todos os médicos ({medicos.length})</option>
          {unidades.map(u => (
            <option key={u.id} value={u.id}>
              {u.nome} ({medicos.filter(m => m.unidade_id === u.id).length})
            </option>
          ))}
          <option value="__sem__">Sem unidade ({semUnidade})</option>
        </select>
      </div>

      {carregando ? (
        <p className="text-center py-10" style={{ color: '#94a3b8' }}>Carregando...</p>
      ) : (
        <div className="space-y-2">
          {filtrados.map(m => (
            <div key={m.id} className="rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
              style={{ background: '#fff', border: '1px solid #e2e8f0', opacity: m.ativo ? 1 : 0.6 }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium" style={{ color: '#1e293b' }}>{m.nome}</p>
                  {m.role === 'ceo' && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>CEO</span>
                  )}
                  {m.role === 'admin' && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#ede9fe', color: '#5b21b6' }}>Admin</span>
                  )}
                  {!m.ativo && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: '#64748b' }}>Inativo</span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: '#94a3b8' }}>
                  CRM {m.crm}{m.email ? ` · ${m.email}` : ''}
                </p>
              </div>
              <div className="shrink-0">
                <select
                  value={m.unidade_id ?? ''}
                  onChange={e => atribuirUnidade(m.id, e.target.value)}
                  disabled={salvandoId === m.id}
                  className="text-sm rounded-xl px-3 py-1.5 focus:outline-none"
                  style={{
                    background: m.unidade_id ? '#f0fdf4' : '#fafafa',
                    border: `1px solid ${m.unidade_id ? '#16a34a' : '#e2e8f0'}`,
                    color: m.unidade_id ? '#15803d' : '#94a3b8',
                    minWidth: 180,
                  }}>
                  <option value="">Sem unidade</option>
                  {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>
            </div>
          ))}
          {filtrados.length === 0 && (
            <p className="text-center py-10" style={{ color: '#94a3b8' }}>Nenhum médico neste filtro.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PainelCEO() {
  const [searchParams] = useSearchParams()
  const abaInicial = searchParams.get('aba') || 'overview'

  return (
    <Layout>
      <div className="px-6 py-5 flex items-center gap-4" style={{ background: CEO_HEADER_BG }}>
        <div className="rounded-xl p-2.5" style={{ background: 'rgba(251,191,36,0.2)' }}>
          <Crown size={26} style={{ color: '#fbbf24' }} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">Painel CEO</h1>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Visão executiva e configuração do sistema
          </p>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue={abaInicial}>
          <TabsList
            className="w-full mb-5 grid grid-cols-4 text-xs sm:text-sm"
            style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid var(--cor-borda)', borderRadius: 12, padding: 4, gap: 2 }}>
            <TabsTrigger value="overview" className="rounded-lg transition-all duration-200 hover:bg-white/80">
              <span className="hidden sm:inline">Visão Geral</span>
              <span className="sm:hidden">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="unidades" className="rounded-lg transition-all duration-200 hover:bg-white/80">Unidades</TabsTrigger>
            <TabsTrigger value="setores" className="rounded-lg transition-all duration-200 hover:bg-white/80">Setores</TabsTrigger>
            <TabsTrigger value="usuarios" className="rounded-lg transition-all duration-200 hover:bg-white/80">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><TabVisaoGeral /></TabsContent>
          <TabsContent value="unidades"><TabUnidades /></TabsContent>
          <TabsContent value="setores"><TabSetores /></TabsContent>
          <TabsContent value="usuarios"><TabUsuarios /></TabsContent>
        </Tabs>
      </main>
    </Layout>
  )
}
