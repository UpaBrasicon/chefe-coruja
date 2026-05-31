import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import { Button } from '../components/ui/button'
import { useNavyTheme } from '../hooks/useNavyTheme'

const DIAS = [
  { idx: 1, label: 'Seg' },
  { idx: 2, label: 'Ter' },
  { idx: 3, label: 'Qua' },
  { idx: 4, label: 'Qui' },
  { idx: 5, label: 'Sex' },
  { idx: 6, label: 'Sáb' },
  { idx: 0, label: 'Dom' },
]

// ── Célula editável ───────────────────────────────────────────────────────────
function Celula({ cellData, profissionais, onSave, onClear }) {
  const [editando, setEditando] = useState(false)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const inputRef = useRef()

  const nomeAtual = cellData?.profissional?.nome || cellData?.nome_livre || ''

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase()
    if (!b) return profissionais.slice(0, 8)
    return profissionais
      .filter(p => p.nome.toLowerCase().includes(b) || (p.crm || '').toLowerCase().includes(b))
      .slice(0, 8)
  }, [busca, profissionais])

  function abrir() {
    setBusca(nomeAtual)
    setEditando(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  async function salvarNomeLivre() {
    const texto = busca.trim()
    if (texto === nomeAtual) { setEditando(false); return }
    if (texto === '') {
      await onClear()
    } else {
      const match = profissionais.find(p => p.nome.toLowerCase() === texto.toLowerCase())
      if (match) { await salvarProf(match); return }
      setSalvando(true)
      await onSave({ profissional_id: null, nome_livre: texto })
      setSalvando(false)
    }
    setEditando(false)
  }

  async function salvarProf(prof) {
    setSalvando(true)
    await onSave({ profissional_id: prof.id, nome_livre: null, _prof: prof })
    setSalvando(false)
    setEditando(false)
    setBusca('')
  }

  if (editando) {
    return (
      <div style={{ position: 'relative', zIndex: 20, minWidth: 130 }}>
        <input
          ref={inputRef}
          value={busca}
          onChange={e => setBusca(e.target.value)}
          onBlur={() => setTimeout(() => { salvarNomeLivre() }, 160)}
          onKeyDown={e => {
            if (e.key === 'Enter') salvarNomeLivre()
            if (e.key === 'Escape') { setEditando(false); setBusca('') }
          }}
          placeholder="Nome ou CRM..."
          className="w-full text-xs px-2 py-1.5 rounded border focus:outline-none"
          style={{ borderColor: '#0d9488', background: '#fff', color: '#1e293b', minWidth: 130 }}
        />
        {filtrados.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 999,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 210, maxHeight: 220, overflowY: 'auto',
          }}>
            {busca.trim() && !profissionais.find(p => p.nome.toLowerCase() === busca.trim().toLowerCase()) && (
              <button
                onMouseDown={e => { e.preventDefault(); salvarNomeLivre() }}
                className="w-full text-left px-3 py-2 text-xs border-b border-gray-100 hover:bg-teal-50"
                style={{ color: '#0d9488' }}>
                Salvar "{busca.trim()}" (nome livre)
              </button>
            )}
            {filtrados.map(p => (
              <button key={p.id}
                onMouseDown={e => { e.preventDefault(); salvarProf(p) }}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50">
                <p className="text-xs font-medium" style={{ color: '#1e293b' }}>{p.nome}</p>
                {p.crm && <p style={{ fontSize: 10, color: '#94a3b8' }}>CRM {p.crm}</p>}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={abrir}
      className="rounded cursor-pointer flex items-center justify-between group px-1.5"
      style={{
        minWidth: 130, minHeight: 30,
        background: nomeAtual ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${nomeAtual ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'}`,
        transition: 'border-color .12s',
      }}
    >
      <span className="text-xs truncate flex-1 py-1" style={{ color: nomeAtual ? '#fff' : 'rgba(255,255,255,0.18)' }}>
        {nomeAtual || '—'}
      </span>
      {nomeAtual && (
        <button
          onClick={e => { e.stopPropagation(); onClear() }}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-white text-xs leading-none ml-1 flex-shrink-0">
          ×
        </button>
      )}
      {salvando && <span className="text-xs ml-1" style={{ color: '#0d9488' }}>…</span>}
    </div>
  )
}

// ── Modal Publicar ────────────────────────────────────────────────────────────
function ModalPublicar({ aberto, onFechar, onPublicar }) {
  const [dataInicio, setDataInicio] = useState('')
  const [duracao, setDuracao] = useState(3)
  const [semanaInicial, setSemanaInicial] = useState('A')
  const [publicando, setPublicando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)

  async function handlePublicar() {
    if (!dataInicio) { setErro('Escolha a data de início.'); return }
    setErro(''); setPublicando(true)
    try {
      await onPublicar({ dataInicio, duracaoMeses: Number(duracao), semanaInicial })
      setSucesso(true)
    } catch (e) { setErro(e.message) }
    setPublicando(false)
  }

  if (!aberto) return null

  if (sucesso) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="rounded-2xl p-8 text-center max-w-sm w-full mx-4"
        style={{ background: '#0c1445', border: '1px solid rgba(255,255,255,0.2)' }}>
        <p className="text-4xl mb-3">✅</p>
        <p className="text-lg font-bold text-white mb-2">Escala publicada!</p>
        <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.55)' }}>
          Plantões gerados por {duracao} {duracao === 1 ? 'mês' : 'meses'} a partir de{' '}
          {new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')}.
        </p>
        <Button onClick={() => { setSucesso(false); onFechar() }} style={{ background: '#0d9488', color: '#fff' }}>Fechar</Button>
      </div>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="rounded-2xl p-6 w-full max-w-md"
        style={{ background: '#0c1445', border: '1px solid rgba(255,255,255,0.2)' }}>
        <h2 className="text-lg font-bold text-white mb-1">Publicar Escala</h2>
        <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Gera plantões reais a partir do template Semana A/B.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'rgba(255,255,255,0.65)' }}>Data de início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', colorScheme: 'dark' }} />
          </div>

          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'rgba(255,255,255,0.65)' }}>Duração</label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 6, 9, 12].map(m => (
                <button key={m} onClick={() => setDuracao(m)}
                  className="py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: duracao === m ? '#0d9488' : 'rgba(255,255,255,0.07)',
                    color: duracao === m ? '#fff' : 'rgba(255,255,255,0.5)',
                    border: `1px solid ${duracao === m ? '#0d9488' : 'rgba(255,255,255,0.13)'}`,
                  }}>
                  {m} {m === 1 ? 'mês' : 'meses'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'rgba(255,255,255,0.65)' }}>A primeira semana é...</label>
            <div className="grid grid-cols-2 gap-2">
              {['A', 'B'].map(s => (
                <button key={s} onClick={() => setSemanaInicial(s)}
                  className="py-2 rounded-lg text-sm font-bold transition-all"
                  style={{
                    background: semanaInicial === s ? '#0d9488' : 'rgba(255,255,255,0.07)',
                    color: semanaInicial === s ? '#fff' : 'rgba(255,255,255,0.45)',
                    border: `1px solid ${semanaInicial === s ? '#0d9488' : 'rgba(255,255,255,0.13)'}`,
                  }}>
                  Semana {s}
                </button>
              ))}
            </div>
          </div>

          {dataInicio && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.3)' }}>
              <p className="text-xs font-medium text-white mb-1">Resumo</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Início: <strong className="text-white">{new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
                {' — '}{duracao} {duracao === 1 ? 'mês' : 'meses'} (~{duracao * 4} semanas alternadas A↔B)
              </p>
              <p className="text-xs mt-1" style={{ color: '#fca5a5' }}>
                ⚠️ Substituirá todos os plantões existentes no período.
              </p>
            </div>
          )}

          {erro && <p className="text-xs rounded-lg p-2" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.1)' }}>{erro}</p>}
        </div>

        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onFechar} className="flex-1"
            style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.55)' }}>
            Cancelar
          </Button>
          <Button onClick={handlePublicar} disabled={publicando || !dataInicio} className="flex-1"
            style={{ background: '#0d9488', color: '#fff' }}>
            {publicando ? 'Publicando…' : 'Publicar'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Adicionar Grupo ─────────────────────────────────────────────────────
function ModalAddGrupo({ aberto, onFechar, setores, tiposTurno, gruposExistentes, onAdd }) {
  const [setorId, setSetorId] = useState('')
  const [tipoId, setTipoId] = useState('')

  if (!aberto) return null

  function confirmar() {
    if (setorId && tipoId) {
      onAdd(parseInt(setorId), parseInt(tipoId))
      setSetorId(''); setTipoId(''); onFechar()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="rounded-2xl p-6 w-full max-w-sm"
        style={{ background: '#0c1445', border: '1px solid rgba(255,255,255,0.2)' }}>
        <h2 className="text-base font-bold text-white mb-4">Adicionar grupo de slots</h2>
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs block mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Setor</label>
            <select value={setorId} onChange={e => setSetorId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff' }}>
              <option value="" style={{ background: '#0c1445' }}>Selecione o setor…</option>
              {setores.map(s => <option key={s.id} value={s.id} style={{ background: '#0c1445' }}>{s.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Tipo de turno</label>
            <select value={tipoId} onChange={e => setTipoId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff' }}>
              <option value="" style={{ background: '#0c1445' }}>Selecione o turno…</option>
              {tiposTurno.map(t => (
                <option key={t.id} value={t.id} style={{ background: '#0c1445' }}>
                  {t.nome} ({t.hora_inicio?.slice(0, 5)}–{t.hora_fim?.slice(0, 5)})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onFechar} className="flex-1"
            style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.55)' }}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!setorId || !tipoId} className="flex-1"
            style={{ background: '#0d9488', color: '#fff' }}>Adicionar</Button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function EditorEscalaTemplate() {
  useNavyTheme()
  const [semana, setSemana] = useState('A')
  const [setores, setSetores] = useState([])
  const [tiposTurno, setTiposTurno] = useState([])
  const [profissionais, setProfissionais] = useState([])
  const [slots, setSlots] = useState([])
  const [grupConfig, setGrupConfig] = useState({}) // { 'setor_id:tipo_turno_id': maxSlot }
  const [loading, setLoading] = useState(true)
  const [modalPublicar, setModalPublicar] = useState(false)
  const [modalAddGrupo, setModalAddGrupo] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregarBase() {
      const [resS, resT, resP] = await Promise.all([
        supabase.from('setores').select('id, nome, cor, ordem_exibicao').order('ordem_exibicao'),
        supabase.from('tipos_turno').select('id, nome, hora_inicio, hora_fim').order('hora_inicio'),
        supabase.from('profissionais').select('id, nome, crm')
          .eq('status_aprovacao', 'aprovado').eq('ativo', true).order('nome'),
      ])
      setSetores(resS.data ?? [])
      setTiposTurno(resT.data ?? [])
      setProfissionais(resP.data ?? [])
    }
    carregarBase()
  }, [])

  useEffect(() => {
    async function carregarSlots() {
      setLoading(true)
      const { data } = await supabase
        .from('escala_template_slots')
        .select('*, profissional:profissionais(id, nome, crm)')
        .eq('semana', semana)
      const lista = data ?? []
      setSlots(lista)
      const cfg = {}
      for (const s of lista) {
        const k = `${s.setor_id}:${s.tipo_turno_id}`
        cfg[k] = Math.max(cfg[k] || 0, s.slot_index)
      }
      setGrupConfig(cfg)
      setLoading(false)
    }
    carregarSlots()
  }, [semana])

  const slotsMap = useMemo(() => {
    const m = {}
    for (const s of slots) m[`${s.setor_id}:${s.tipo_turno_id}:${s.slot_index}:${s.dia_semana}`] = s
    return m
  }, [slots])

  const grupos = useMemo(() => {
    return Object.entries(grupConfig).map(([key, maxSlot]) => {
      const [setor_id, tipo_turno_id] = key.split(':').map(Number)
      return { setor_id, tipo_turno_id, maxSlot, key }
    }).sort((a, b) => {
      const oa = setores.find(s => s.id === a.setor_id)?.ordem_exibicao ?? 99
      const ob = setores.find(s => s.id === b.setor_id)?.ordem_exibicao ?? 99
      if (oa !== ob) return oa - ob
      const ta = tiposTurno.find(t => t.id === a.tipo_turno_id)?.hora_inicio ?? ''
      const tb = tiposTurno.find(t => t.id === b.tipo_turno_id)?.hora_inicio ?? ''
      return ta.localeCompare(tb)
    })
  }, [grupConfig, setores, tiposTurno])

  async function handleSave(setor_id, tipo_turno_id, slot_index, dia_semana, { profissional_id, nome_livre, _prof }) {
    const record = { semana, dia_semana, setor_id, tipo_turno_id, slot_index, profissional_id: profissional_id || null, nome_livre: nome_livre || null }
    const { data, error } = await supabase
      .from('escala_template_slots')
      .upsert(record, { onConflict: 'semana,dia_semana,setor_id,tipo_turno_id,slot_index' })
      .select('*, profissional:profissionais(id, nome, crm)')
      .single()
    if (!error && data) {
      setSlots(prev => {
        const f = prev.filter(s => !(s.setor_id === setor_id && s.tipo_turno_id === tipo_turno_id && s.slot_index === slot_index && s.dia_semana === dia_semana && s.semana === semana))
        return [...f, data]
      })
    }
  }

  async function handleClear(setor_id, tipo_turno_id, slot_index, dia_semana) {
    await supabase.from('escala_template_slots').delete()
      .eq('semana', semana).eq('setor_id', setor_id).eq('tipo_turno_id', tipo_turno_id)
      .eq('slot_index', slot_index).eq('dia_semana', dia_semana)
    setSlots(prev => prev.filter(s => !(s.setor_id === setor_id && s.tipo_turno_id === tipo_turno_id && s.slot_index === slot_index && s.dia_semana === dia_semana && s.semana === semana)))
  }

  function addSlot(setor_id, tipo_turno_id) {
    const k = `${setor_id}:${tipo_turno_id}`
    setGrupConfig(prev => ({ ...prev, [k]: (prev[k] || 0) + 1 }))
  }

  async function removeSlotRow(setor_id, tipo_turno_id, slot_index) {
    await supabase.from('escala_template_slots').delete()
      .eq('semana', semana).eq('setor_id', setor_id).eq('tipo_turno_id', tipo_turno_id).eq('slot_index', slot_index)
    const novos = slots.filter(s => !(s.setor_id === setor_id && s.tipo_turno_id === tipo_turno_id && s.slot_index === slot_index && s.semana === semana))
    setSlots(novos)
    const k = `${setor_id}:${tipo_turno_id}`
    const newMax = novos.filter(s => s.setor_id === setor_id && s.tipo_turno_id === tipo_turno_id).reduce((m, s) => Math.max(m, s.slot_index), 0)
    setGrupConfig(prev => { const n = { ...prev }; if (newMax === 0) delete n[k]; else n[k] = newMax; return n })
  }

  function addGrupo(setor_id, tipo_turno_id) {
    const k = `${setor_id}:${tipo_turno_id}`
    setGrupConfig(prev => prev[k] ? prev : { ...prev, [k]: 1 })
  }

  async function handlePublicar({ dataInicio, duracaoMeses, semanaInicial }) {
    const [{ data: slotsA }, { data: slotsB }] = await Promise.all([
      supabase.from('escala_template_slots').select('*').eq('semana', 'A'),
      supabase.from('escala_template_slots').select('*').eq('semana', 'B'),
    ])

    const inicio = new Date(dataInicio + 'T12:00:00')
    const fim = new Date(dataInicio + 'T12:00:00')
    fim.setMonth(fim.getMonth() + duracaoMeses)

    function getMondayOfWeek(d) {
      const dt = new Date(d); const day = dt.getDay()
      dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day)); dt.setHours(0, 0, 0, 0); return dt
    }
    const mondayInicio = getMondayOfWeek(inicio)

    const plantoesParaCriar = []
    const current = new Date(inicio); current.setHours(0, 0, 0, 0)

    while (current < fim) {
      const diaSemana = current.getDay()
      const mondayCurrent = getMondayOfWeek(current)
      const weekNum = Math.round((mondayCurrent - mondayInicio) / (7 * 24 * 3600 * 1000))
      const ehA = weekNum % 2 === 0 ? semanaInicial === 'A' : semanaInicial === 'B'
      const dateStr = current.toISOString().split('T')[0]
      for (const slot of (ehA ? slotsA : slotsB || []).filter(s => s.dia_semana === diaSemana)) {
        plantoesParaCriar.push({
          data: dateStr,
          setor_id: slot.setor_id,
          tipo_turno_id: slot.tipo_turno_id,
          slot_num: slot.slot_index,
          profissional_id: slot.profissional_id || null,
          status: slot.profissional_id ? 'confirmado' : 'vago',
          observacoes: `[TEMPLATE:${ehA ? 'A' : 'B'}]`,
        })
      }
      current.setDate(current.getDate() + 1)
    }

    const inicioStr = inicio.toISOString().split('T')[0]
    const fimStr = fim.toISOString().split('T')[0]

    const { data: aExcluir } = await supabase.from('plantoes').select('id').gte('data', inicioStr).lt('data', fimStr)
    const ids = (aExcluir || []).map(p => p.id)
    for (let i = 0; i < ids.length; i += 200) {
      const batch = ids.slice(i, i + 200)
      await Promise.all([
        supabase.from('trocas').delete().in('plantao_id', batch),
        supabase.from('desistencias').delete().in('plantao_id', batch),
      ])
    }
    await supabase.from('plantoes').delete().gte('data', inicioStr).lt('data', fimStr)

    for (let i = 0; i < plantoesParaCriar.length; i += 100) {
      const { error } = await supabase.from('plantoes').insert(plantoesParaCriar.slice(i, i + 100))
      if (error) throw new Error(error.message)
    }
  }

  // ── Render ──
  const GLASS = {
    background: 'rgba(255,255,255,0.07)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(145deg, #0c1445 0%, #0e2d6e 45%, #0e4d8a 100%)' }}>
      <Header />
      <main className="px-3 pb-12 pt-4">

        {/* Cabeçalho */}
        <div className="max-w-[1440px] mx-auto mb-4 flex flex-wrap items-center gap-3">
          <Link to="/admin" className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>← Painel Admin</Link>
          <h1 className="text-xl font-bold text-white flex-1">Editor de Escala — Template</h1>
          <Button onClick={() => setModalPublicar(true)}
            style={{ background: '#0d9488', color: '#fff', fontWeight: 600, boxShadow: '0 4px 16px rgba(13,148,136,0.35)' }}>
            Publicar Escala
          </Button>
        </div>

        {/* Tabs A / B */}
        <div className="max-w-[1440px] mx-auto mb-4 flex gap-2">
          {['A', 'B'].map(s => (
            <button key={s} onClick={() => setSemana(s)}
              className="px-7 py-2.5 rounded-xl font-bold text-sm transition-all"
              style={{
                background: semana === s ? '#0d9488' : 'rgba(255,255,255,0.08)',
                color: semana === s ? '#fff' : 'rgba(255,255,255,0.45)',
                border: `2px solid ${semana === s ? '#0d9488' : 'rgba(255,255,255,0.14)'}`,
                boxShadow: semana === s ? '0 4px 16px rgba(13,148,136,0.3)' : 'none',
              }}>
              Semana {s}
            </button>
          ))}
          <span className="text-xs self-center ml-2" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {grupos.reduce((acc, g) => acc + g.maxSlot * 7, 0)} slots configurados
          </span>
        </div>

        {/* Grade */}
        <div className="max-w-[1440px] mx-auto">
          <div className="rounded-2xl overflow-x-auto" style={GLASS}>
            {loading ? (
              <div className="text-center py-16">
                <p style={{ color: 'rgba(255,255,255,0.5)' }}>Carregando template…</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1020 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ width: 190, padding: '10px 16px', textAlign: 'left' }}>
                      <span className="text-xs font-semibold tracking-widest" style={{ color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>
                        Setor · Turno · Slot
                      </span>
                    </th>
                    {DIAS.map(d => (
                      <th key={d.idx} style={{ padding: '10px 4px', textAlign: 'center', width: 136 }}>
                        <span className="text-xs font-bold tracking-wide"
                          style={{ color: d.idx === 0 ? '#fca5a5' : 'rgba(255,255,255,0.45)' }}>
                          {d.label}
                        </span>
                      </th>
                    ))}
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>

                <tbody>
                  {grupos.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ padding: '48px 16px', textAlign: 'center' }}>
                        <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Template vazio para Semana {semana}.</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Use "+ Adicionar grupo" abaixo para criar linhas de setor + turno.</p>
                      </td>
                    </tr>
                  )}

                  {grupos.map((grupo, gi) => {
                    const setor = setores.find(s => s.id === grupo.setor_id)
                    const turno = tiposTurno.find(t => t.id === grupo.tipo_turno_id)
                    const isFirstSetor = gi === 0 || grupos[gi - 1].setor_id !== grupo.setor_id
                    const corSetor = setor?.cor ?? '#0d9488'

                    return [
                      isFirstSetor && (
                        <tr key={`sh-${grupo.setor_id}-${gi}`}>
                          <td colSpan={DIAS.length + 2}
                            style={{ padding: '8px 16px', background: corSetor + '28', borderTop: gi > 0 ? '2px solid rgba(255,255,255,0.06)' : undefined }}>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-md text-white"
                              style={{ background: corSetor }}>
                              {setor?.nome ?? `Setor ${grupo.setor_id}`}
                            </span>
                          </td>
                        </tr>
                      ),

                      <tr key={`th-${grupo.key}`}>
                        <td colSpan={DIAS.length + 2}
                          style={{ padding: '3px 16px 3px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
                            {turno?.nome ?? 'Turno'} · {turno?.hora_inicio?.slice(0, 5)}–{turno?.hora_fim?.slice(0, 5)}
                          </span>
                        </td>
                      </tr>,

                      ...Array.from({ length: grupo.maxSlot }, (_, i) => i + 1).map(slotIdx => (
                        <tr key={`sr-${grupo.key}-${slotIdx}`}
                          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '3px 6px 3px 28px' }}>
                            <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>#{slotIdx}</span>
                          </td>
                          {DIAS.map(d => (
                            <td key={d.idx} style={{ padding: '2px 3px' }}>
                              <Celula
                                cellData={slotsMap[`${grupo.setor_id}:${grupo.tipo_turno_id}:${slotIdx}:${d.idx}`]}
                                profissionais={profissionais}
                                onSave={payload => handleSave(grupo.setor_id, grupo.tipo_turno_id, slotIdx, d.idx, payload)}
                                onClear={() => handleClear(grupo.setor_id, grupo.tipo_turno_id, slotIdx, d.idx)}
                              />
                            </td>
                          ))}
                          <td style={{ padding: '2px 2px 2px 0' }}>
                            <button onClick={() => removeSlotRow(grupo.setor_id, grupo.tipo_turno_id, slotIdx)}
                              title="Remover linha"
                              className="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors hover:bg-red-500/20"
                              style={{ color: 'rgba(255,255,255,0.2)' }}>
                              ×
                            </button>
                          </td>
                        </tr>
                      )),

                      <tr key={`as-${grupo.key}`}>
                        <td colSpan={DIAS.length + 2} style={{ padding: '3px 16px 8px 28px' }}>
                          <button onClick={() => addSlot(grupo.setor_id, grupo.tipo_turno_id)}
                            className="text-xs px-3 py-1 rounded-md transition-colors hover:bg-white/10"
                            style={{ color: 'rgba(255,255,255,0.3)', border: '1px dashed rgba(255,255,255,0.18)' }}>
                            + Adicionar slot
                          </button>
                        </td>
                      </tr>,
                    ].filter(Boolean)
                  })}

                  <tr>
                    <td colSpan={DIAS.length + 2}
                      style={{ padding: '12px 16px', borderTop: '2px solid rgba(255,255,255,0.06)' }}>
                      <button onClick={() => setModalAddGrupo(true)}
                        className="text-xs px-4 py-2 rounded-xl transition-all hover:bg-teal-500/20"
                        style={{ color: '#0d9488', border: '1px dashed rgba(13,148,136,0.45)', background: 'rgba(13,148,136,0.07)' }}>
                        + Adicionar grupo (setor + turno)
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>

          {/* Legenda */}
          <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.25)' }}>
            Clique em qualquer célula para editar · Autocomplete busca profissionais cadastrados · Nomes não encontrados são salvos como texto livre
          </p>
        </div>
      </main>

      <ModalPublicar aberto={modalPublicar} onFechar={() => setModalPublicar(false)} onPublicar={handlePublicar} />
      <ModalAddGrupo
        aberto={modalAddGrupo} onFechar={() => setModalAddGrupo(false)}
        setores={setores} tiposTurno={tiposTurno} gruposExistentes={grupos} onAdd={addGrupo}
      />
    </div>
  )
}
