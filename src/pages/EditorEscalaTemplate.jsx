import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import { Button } from '../components/ui/button'
import { useNavyTheme } from '../hooks/useNavyTheme'

// Seg → Dom (ordem da escala)
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
  const [busca, setBusca]       = useState('')
  const [pos, setPos]           = useState(null)
  const cellRef  = useRef()
  const inputRef = useRef()
  const dropRef  = useRef()
  const buscaRef = useRef('')  // ref para acesso no listener global

  const nomeAtual = cellData?.profissional?.nome || cellData?.nome_livre || ''

  useEffect(() => { buscaRef.current = busca }, [busca])

  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase()
    if (!b) return []
    return profissionais
      .filter(p => p.nome.toLowerCase().includes(b) || (p.crm || '').toLowerCase().includes(b))
      .slice(0, 8)
  }, [busca, profissionais])

  function getRect() {
    const r = cellRef.current?.getBoundingClientRect()
    if (r) setPos({ top: r.top, left: r.left, w: r.width, h: r.height, bottom: r.bottom })
  }

  function abrir() {
    if (editando) return
    getRect()
    setBusca('')
    buscaRef.current = ''
    setEditando(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  function fechar() {
    setEditando(false); setPos(null); setBusca(''); buscaRef.current = ''
  }

  async function salvarProf(prof) {
    fechar()                                               // fecha imediatamente (UX)
    await onSave({ profissional_id: prof.id, nome_livre: null })
  }

  async function salvarTexto() {
    const t = buscaRef.current.trim()
    fechar()
    if (!t) return
    const match = profissionais.find(p => p.nome.toLowerCase() === t.toLowerCase())
    if (match) await onSave({ profissional_id: match.id, nome_livre: null })
    else await onSave({ profissional_id: null, nome_livre: t })
  }

  // Atualiza posição do input ao rolar/redimensionar
  useEffect(() => {
    if (!editando) return
    window.addEventListener('scroll', getRect, true)
    window.addEventListener('resize', getRect)
    return () => { window.removeEventListener('scroll', getRect, true); window.removeEventListener('resize', getRect) }
  }, [editando])

  // Fecha ao clicar fora (sem overlay — não compete com os botões do dropdown)
  useEffect(() => {
    if (!editando) return
    function onDocDown(e) {
      if (inputRef.current?.contains(e.target)) return
      if (dropRef.current?.contains(e.target)) return
      if (cellRef.current?.contains(e.target)) return
      salvarTexto()
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [editando])   // salvarTexto usa buscaRef (ref), não precisa ser dependência

  // Largura: input = tamanho exato da célula; dropdown = pelo menos 220 px
  const inputW = pos?.w ?? 120
  const dropW  = Math.max(inputW, 220)

  return (
    <>
      {/* Célula visual */}
      <div
        ref={cellRef}
        onClick={abrir}
        className="rounded cursor-pointer flex items-center justify-between group px-1.5"
        style={{
          minWidth: 118, height: 28,
          background: editando ? 'rgba(13,148,136,0.2)' : nomeAtual ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${editando ? '#0d9488' : nomeAtual ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
        }}>
        <span className="text-xs truncate flex-1" style={{ color: nomeAtual ? '#e2e8f0' : 'rgba(255,255,255,0.2)', fontSize: 11 }}>
          {nomeAtual || 'NOME'}
        </span>
        {nomeAtual && !editando && (
          <button onClick={e => { e.stopPropagation(); onClear() }}
            className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-white text-xs ml-1 flex-shrink-0">
            ×
          </button>
        )}
      </div>

      {/* Portal: input + dropdown (sem overlay — sem competição de cliques) */}
      {editando && pos && createPortal(
        <>
          {/* Input flutuante exatamente sobre a célula */}
          <input
            ref={inputRef}
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') filtrados.length > 0 ? salvarProf(filtrados[0]) : salvarTexto()
              if (e.key === 'Escape') fechar()
            }}
            placeholder="Pesquise um nome…"
            style={{
              position: 'fixed',
              top: pos.top, left: pos.left,
              width: inputW,      // mesmo tamanho da célula — sem overflow
              height: pos.h,
              zIndex: 99990,
              border: '2px solid #0d9488',
              borderRadius: 4,
              padding: '0 8px',
              fontSize: 11,
              color: '#1e293b',
              background: '#fff',
              outline: 'none',
              boxShadow: '0 0 0 3px rgba(13,148,136,0.18)',
            }}
          />

          {/* Dropdown de resultados */}
          {(filtrados.length > 0 || busca.trim()) && (
            <div
              ref={dropRef}
              style={{
                position: 'fixed',
                top: pos.bottom + 3,
                left: pos.left,
                width: dropW,     // pode ser maior que a célula para leitura
                zIndex: 99995,
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                maxHeight: 240,
                overflowY: 'auto',
              }}>
              {filtrados.map(p => (
                <button
                  key={p.id}
                  onMouseDown={e => { e.preventDefault(); salvarProf(p) }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50"
                  style={{ borderBottom: '1px solid #f8fafc', display: 'block' }}>
                  <p className="text-xs font-semibold" style={{ color: '#0f172a' }}>{p.nome}</p>
                  {p.crm && <p style={{ fontSize: 10, color: '#94a3b8' }}>CRM {p.crm}</p>}
                </button>
              ))}
              {filtrados.length === 0 && busca.trim() && (
                <button
                  onMouseDown={e => { e.preventDefault(); salvarTexto() }}
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-teal-50"
                  style={{ color: '#0d9488' }}>
                  Salvar "{busca.trim()}" como nome livre
                </button>
              )}
            </div>
          )}
        </>,
        document.body
      )}
    </>
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
    try { await onPublicar({ dataInicio, duracaoMeses: Number(duracao), semanaInicial }); setSucesso(true) }
    catch (e) { setErro(e.message) }
    setPublicando(false)
  }

  if (!aberto) return null

  if (sucesso) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="rounded-2xl p-8 text-center max-w-sm w-full mx-4" style={{ background: '#0c1445', border: '1px solid rgba(255,255,255,0.2)' }}>
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
      <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: '#0c1445', border: '1px solid rgba(255,255,255,0.2)' }}>
        <h2 className="text-lg font-bold text-white mb-1">Publicar Escala</h2>
        <p className="text-sm mb-5" style={{ color: 'rgba(255,255,255,0.4)' }}>Gera plantões reais alternando Semana A↔B.</p>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>Data de início</label>
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', colorScheme: 'dark' }} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Duração</label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 6, 9, 12].map(m => (
                <button key={m} onClick={() => setDuracao(m)}
                  className="py-2 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: duracao === m ? '#0d9488' : 'rgba(255,255,255,0.07)', color: duracao === m ? '#fff' : 'rgba(255,255,255,0.45)', border: `1px solid ${duracao === m ? '#0d9488' : 'rgba(255,255,255,0.12)'}` }}>
                  {m} {m === 1 ? 'mês' : 'meses'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Primeira semana</label>
            <div className="grid grid-cols-2 gap-2">
              {['A', 'B'].map(s => (
                <button key={s} onClick={() => setSemanaInicial(s)}
                  className="py-2 rounded-lg text-sm font-bold transition-all"
                  style={{ background: semanaInicial === s ? '#0d9488' : 'rgba(255,255,255,0.07)', color: semanaInicial === s ? '#fff' : 'rgba(255,255,255,0.4)', border: `1px solid ${semanaInicial === s ? '#0d9488' : 'rgba(255,255,255,0.12)'}` }}>
                  Semana {s}
                </button>
              ))}
            </div>
          </div>
          {dataInicio && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.3)' }}>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.65)' }}>
                Início: <strong className="text-white">{new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')}</strong>
                {' — '}{duracao} {duracao === 1 ? 'mês' : 'meses'} (~{duracao * 4} semanas A↔B)
              </p>
              <p className="text-xs mt-1" style={{ color: '#fca5a5' }}>⚠️ Substituirá todos os plantões existentes no período.</p>
            </div>
          )}
          {erro && <p className="text-xs rounded-lg p-2" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.1)' }}>{erro}</p>}
        </div>
        <div className="flex gap-2 mt-6">
          <Button variant="outline" onClick={onFechar} className="flex-1" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)' }}>Cancelar</Button>
          <Button onClick={handlePublicar} disabled={publicando || !dataInicio} className="flex-1" style={{ background: '#0d9488', color: '#fff' }}>
            {publicando ? 'Publicando…' : 'Publicar'}
          </Button>
        </div>
      </div>
    </div>
  )
}


// ── Modal Add Grupo ───────────────────────────────────────────────────────────
function ModalAddGrupo({ aberto, onFechar, setores, tiposTurno, onAdd }) {
  const [setorId, setSetorId] = useState('')
  const [tipoId, setTipoId] = useState('')
  if (!aberto) return null

  // Mostra todos os setores do banco
  const setoresFiltrados = setores

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: '#0c1445', border: '1px solid rgba(255,255,255,0.2)' }}>
        <h2 className="text-base font-bold text-white mb-4">Adicionar grupo</h2>
        <div className="space-y-3 mb-4">
          <div>
            <label className="text-xs block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Setor</label>
            <select value={setorId} onChange={e => setSetorId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff' }}>
              <option value="" style={{ background: '#0c1445' }}>Selecione…</option>
              {setoresFiltrados.map(s => <option key={s.id} value={s.id} style={{ background: '#0c1445' }}>{s.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs block mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>Tipo de turno</label>
            <select value={tipoId} onChange={e => setTipoId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff' }}>
              <option value="" style={{ background: '#0c1445' }}>Selecione…</option>
              {tiposTurno.map(t => (
                <option key={t.id} value={t.id} style={{ background: '#0c1445' }}>
                  {t.nome} ({t.hora_inicio?.slice(0, 5)}–{t.hora_fim?.slice(0, 5)})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onFechar} className="flex-1" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.5)' }}>Cancelar</Button>
          <Button onClick={() => { if (setorId && tipoId) { onAdd(parseInt(setorId), parseInt(tipoId)); setSetorId(''); setTipoId(''); onFechar() } }}
            disabled={!setorId || !tipoId} className="flex-1" style={{ background: '#0d9488', color: '#fff' }}>
            Adicionar
          </Button>
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
  const [grupConfig, setGrupConfig] = useState({})
  const [loading, setLoading] = useState(true)
  const [modalPublicar, setModalPublicar] = useState(false)
  const [modalAddGrupo, setModalAddGrupo] = useState(false)
  const [erroSave, setErroSave] = useState('')

  // Dados base: todos os profissionais (sem filtro — admin precisa de todos)
  useEffect(() => {
    async function carregarBase() {
      const [resS, resT, resP] = await Promise.all([
        supabase.from('setores').select('id, nome, cor, ordem_exibicao').order('ordem_exibicao'),
        supabase.from('tipos_turno').select('id, nome, hora_inicio, hora_fim').order('hora_inicio'),
        supabase.from('profissionais').select('id, nome, crm').order('nome'),
      ])
      setSetores(resS.data ?? [])
      setTiposTurno(resT.data ?? [])
      setProfissionais(resP.data ?? [])
    }
    carregarBase()
  }, [])

  // Slots do template para a semana selecionada
  useEffect(() => {
    async function carregarSlots() {
      setLoading(true)
      const { data, error } = await supabase
        .from('escala_template_slots')
        .select('*, profissional:profissionais(id, nome, crm)')
        .eq('semana', semana)
      if (error) setErroSave('Erro ao carregar slots: ' + error.message)
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

  // Mapa rápido para lookup O(1)
  const slotsMap = useMemo(() => {
    const m = {}
    for (const s of slots) m[`${s.setor_id}:${s.tipo_turno_id}:${s.slot_index}:${s.dia_semana}`] = s
    return m
  }, [slots])

  // Grupos ordenados por setor
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

  // Grupos agrupados por setor (para rowspan)
  const setorGrupos = useMemo(() => {
    const map = {}
    for (const g of grupos) {
      if (!map[g.setor_id]) map[g.setor_id] = { setor_id: g.setor_id, turnos: [] }
      map[g.setor_id].turnos.push(g)
    }
    return Object.values(map).sort((a, b) => {
      const oa = setores.find(s => s.id === a.setor_id)?.ordem_exibicao ?? 99
      const ob = setores.find(s => s.id === b.setor_id)?.ordem_exibicao ?? 99
      return oa - ob
    })
  }, [grupos, setores])

  // ── Handlers ──
  async function handleSave(setor_id, tipo_turno_id, slot_index, dia_semana, { profissional_id, nome_livre }) {
    setErroSave('')
    const filtro = { semana, setor_id, tipo_turno_id, slot_index, dia_semana }

    // 1) apaga o registro anterior (se existir) — evita conflito de UNIQUE
    await supabase.from('escala_template_slots').delete()
      .eq('semana', semana).eq('setor_id', setor_id).eq('tipo_turno_id', tipo_turno_id)
      .eq('slot_index', slot_index).eq('dia_semana', dia_semana)

    // 2) insere o novo
    const { data, error } = await supabase.from('escala_template_slots')
      .insert({ ...filtro, profissional_id: profissional_id || null, nome_livre: nome_livre || null })
      .select('id, semana, dia_semana, setor_id, tipo_turno_id, slot_index, profissional_id, nome_livre')
      .single()

    if (error) {
      setErroSave('Erro ao salvar: ' + error.message)
      return
    }

    // 3) enriquece localmente com o objeto profissional (sem depender de join)
    const profObj = profissional_id
      ? (profissionais.find(p => p.id === profissional_id) ?? null)
      : null

    setSlots(prev => [
      ...prev.filter(s => !(s.setor_id === setor_id && s.tipo_turno_id === tipo_turno_id &&
        s.slot_index === slot_index && s.dia_semana === dia_semana && s.semana === semana)),
      { ...data, profissional: profObj },
    ])
  }

  async function handleClear(setor_id, tipo_turno_id, slot_index, dia_semana) {
    await supabase.from('escala_template_slots').delete()
      .eq('semana', semana).eq('setor_id', setor_id).eq('tipo_turno_id', tipo_turno_id)
      .eq('slot_index', slot_index).eq('dia_semana', dia_semana)
    setSlots(prev => prev.filter(s =>
      !(s.setor_id === setor_id && s.tipo_turno_id === tipo_turno_id && s.slot_index === slot_index && s.dia_semana === dia_semana && s.semana === semana)
    ))
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

  async function removeGrupo(setor_id, tipo_turno_id) {
    await supabase.from('escala_template_slots').delete()
      .eq('semana', semana).eq('setor_id', setor_id).eq('tipo_turno_id', tipo_turno_id)
    setSlots(prev => prev.filter(s => !(s.setor_id === setor_id && s.tipo_turno_id === tipo_turno_id && s.semana === semana)))
    const k = `${setor_id}:${tipo_turno_id}`
    setGrupConfig(prev => { const n = { ...prev }; delete n[k]; return n })
  }

  function addGrupo(setor_id, tipo_turno_id) {
    const k = `${setor_id}:${tipo_turno_id}`
    setGrupConfig(prev => prev[k] ? prev : { ...prev, [k]: 1 })
  }

  async function handlePublicar({ dataInicio, duracaoMeses, semanaInicial }) {
    const [{ data: sA }, { data: sB }] = await Promise.all([
      supabase.from('escala_template_slots').select('*').eq('semana', 'A'),
      supabase.from('escala_template_slots').select('*').eq('semana', 'B'),
    ])
    const inicio = new Date(dataInicio + 'T12:00:00')
    const fim = new Date(dataInicio + 'T12:00:00')
    fim.setMonth(fim.getMonth() + duracaoMeses)

    function getMon(d) {
      const dt = new Date(d); const day = dt.getDay()
      dt.setDate(dt.getDate() + (day === 0 ? -6 : 1 - day)); dt.setHours(0, 0, 0, 0); return dt
    }
    const monInicio = getMon(inicio)
    const plantoesParaCriar = []
    const cur = new Date(inicio); cur.setHours(0, 0, 0, 0)
    while (cur < fim) {
      const dia = cur.getDay()
      const wn = Math.round((getMon(cur) - monInicio) / 604800000)
      const ehA = wn % 2 === 0 ? semanaInicial === 'A' : semanaInicial === 'B'
      const dateStr = cur.toISOString().split('T')[0]
      for (const slot of (ehA ? sA : sB || []).filter(s => s.dia_semana === dia)) {
        plantoesParaCriar.push({
          data: dateStr, setor_id: slot.setor_id, tipo_turno_id: slot.tipo_turno_id,
          slot_num: slot.slot_index, profissional_id: slot.profissional_id || null,
          status: slot.profissional_id ? 'confirmado' : 'vago',
          observacoes: `[TEMPLATE:${ehA ? 'A' : 'B'}]`,
        })
      }
      cur.setDate(cur.getDate() + 1)
    }
    const ini = inicio.toISOString().split('T')[0]
    const fin = fim.toISOString().split('T')[0]
    const { data: aEx } = await supabase.from('plantoes').select('id').gte('data', ini).lt('data', fin)
    const ids = (aEx || []).map(p => p.id)
    for (let i = 0; i < ids.length; i += 200) {
      const b = ids.slice(i, i + 200)
      await Promise.all([supabase.from('trocas').delete().in('plantao_id', b), supabase.from('desistencias').delete().in('plantao_id', b)])
    }
    await supabase.from('plantoes').delete().gte('data', ini).lt('data', fin)
    for (let i = 0; i < plantoesParaCriar.length; i += 100) {
      const { error } = await supabase.from('plantoes').insert(plantoesParaCriar.slice(i, i + 100))
      if (error) throw new Error(error.message)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const GLASS = {
    background: 'rgba(255,255,255,0.07)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  }

  const tdBase = { padding: 0, verticalAlign: 'middle' }
  const BORDER_ROW = '1px solid rgba(255,255,255,0.05)'
  const BORDER_COL = '1px solid rgba(255,255,255,0.08)'

  return (
    <div style={{ minHeight: '100vh', overflow: 'hidden', background: 'linear-gradient(145deg, #0c1445 0%, #0e2d6e 45%, #0e4d8a 100%)' }}>
      <Header />
      <main className="px-2 sm:px-4 pb-16 pt-4">

        {/* Cabeçalho */}
        <div className="max-w-full mx-auto mb-4 flex flex-wrap items-center gap-3">
          <Link to="/admin" className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>← Painel Admin</Link>
          <h1 className="text-xl font-bold text-white flex-1">Editor de Escala</h1>
          <Button onClick={() => setModalPublicar(true)}
            style={{ background: '#0d9488', color: '#fff', fontWeight: 600, boxShadow: '0 4px 16px rgba(13,148,136,0.35)' }}>
            Publicar Escala
          </Button>
        </div>

        {/* Tabs A / B */}
        <div className="mb-4 flex gap-2 items-center">
          {['A', 'B'].map(s => (
            <button key={s} onClick={() => setSemana(s)}
              className="px-7 py-2.5 rounded-xl font-bold text-sm transition-all"
              style={{
                background: semana === s ? '#0d9488' : 'rgba(255,255,255,0.08)',
                color: semana === s ? '#fff' : 'rgba(255,255,255,0.4)',
                border: `2px solid ${semana === s ? '#0d9488' : 'rgba(255,255,255,0.13)'}`,
                boxShadow: semana === s ? '0 4px 16px rgba(13,148,136,0.3)' : 'none',
              }}>
              Semana {s}
            </button>
          ))}
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
            {profissionais.length} profissionais disponíveis
          </span>
        </div>

        {/* Grade */}
        <div className="rounded-2xl" style={{ ...GLASS, overflowX: 'auto', overflowY: 'hidden' }}>
          {loading ? (
            <div className="text-center py-16"><p style={{ color: 'rgba(255,255,255,0.4)' }}>Carregando template…</p></div>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
              {/* Cabeçalho dias */}
              <thead>
                <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ width: 90, padding: '10px 8px', textAlign: 'left' }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Setor</span>
                  </th>
                  <th style={{ width: 140, padding: '10px 8px', textAlign: 'left' }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Turno</span>
                  </th>
                  <th style={{ width: 30, padding: '10px 4px', textAlign: 'center' }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>#</span>
                  </th>
                  {DIAS.map(d => (
                    <th key={d.idx} style={{ padding: '10px 4px', textAlign: 'center', minWidth: 122 }}>
                      <span className="text-xs font-bold"
                        style={{ color: d.idx === 0 ? '#fca5a5' : 'rgba(255,255,255,0.45)' }}>
                        {d.label}
                      </span>
                    </th>
                  ))}
                  <th style={{ width: 52, padding: '10px 4px' }} />
                </tr>
              </thead>

              <tbody>
                {setorGrupos.length === 0 && (
                  <tr>
                    <td colSpan={3 + DIAS.length + 1} style={{ padding: '48px 16px', textAlign: 'center' }}>
                      <p className="text-sm mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>Template vazio para Semana {semana}.</p>
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Use "+ Adicionar grupo" abaixo.</p>
                    </td>
                  </tr>
                )}

                {setorGrupos.flatMap(sg => {
                  const setor = setores.find(s => s.id === sg.setor_id)
                  const corSetor = setor?.cor ?? '#0d9488'
                  // +1 por grupo = linha do botão "+ slot" de cada turno
                  const totalRowsSetor = sg.turnos.reduce((sum, t) => sum + t.maxSlot + 1, 0)

                  return sg.turnos.flatMap((grupo, gi) => {
                    const turno = tiposTurno.find(t => t.id === grupo.tipo_turno_id)
                    const turnoRows = grupo.maxSlot + 1 // slots + linha do "+ slot"
                    const isFirstTurno = gi === 0

                    return Array.from({ length: turnoRows }, (_, si) => {
                      const isAddRow = si === grupo.maxSlot
                      const slotIdx = si + 1
                      const isFirstInSetor = isFirstTurno && si === 0
                      const isFirstInTurno = si === 0

                      return (
                        <tr key={isAddRow ? `add-${grupo.key}` : `r-${grupo.key}-${slotIdx}`}
                          style={{ borderBottom: BORDER_ROW }}>

                          {/* Coluna setor (rowspan de todos os turnos do setor) */}
                          {isFirstInSetor && (
                            <td
                              rowSpan={totalRowsSetor}
                              style={{
                                ...tdBase,
                                borderRight: `2px solid ${corSetor}66`,
                                borderBottom: '2px solid rgba(255,255,255,0.06)',
                                background: corSetor + '20',
                                width: 90,
                                verticalAlign: 'middle',
                                textAlign: 'center',
                                padding: '6px 4px',
                              }}>
                              <div style={{
                                writingMode: 'vertical-rl',
                                transform: 'rotate(180deg)',
                                fontWeight: 700,
                                fontSize: 11,
                                color: corSetor,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                                maxHeight: 200,
                                overflow: 'hidden',
                              }}>
                                {setor?.nome ?? `Setor ${sg.setor_id}`}
                              </div>
                            </td>
                          )}

                          {/* Coluna turno (rowspan do turno inteiro) */}
                          {isFirstInTurno && (
                            <td
                              rowSpan={turnoRows}
                              style={{
                                ...tdBase,
                                borderRight: BORDER_COL,
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                width: 140,
                                padding: '6px 10px',
                                verticalAlign: 'middle',
                              }}>
                              <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)', lineHeight: 1.3 }}>
                                {turno?.nome ?? 'Turno'}
                              </p>
                              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                                {turno?.hora_inicio?.slice(0, 5)}–{turno?.hora_fim?.slice(0, 5)}
                              </p>
                            </td>
                          )}

                          {/* Linha "+ slot" */}
                          {isAddRow ? (
                            <td colSpan={DIAS.length + 2} style={{ padding: '4px 8px' }}>
                              <div className="flex items-center gap-2">
                                <button onClick={() => addSlot(grupo.setor_id, grupo.tipo_turno_id)}
                                  className="text-xs px-3 py-1 rounded-md transition-colors hover:bg-white/10"
                                  style={{ color: 'rgba(255,255,255,0.35)', border: '1px dashed rgba(255,255,255,0.2)' }}>
                                  + Adicionar slot
                                </button>
                                <button onClick={() => removeGrupo(grupo.setor_id, grupo.tipo_turno_id)}
                                  className="text-xs px-2 py-1 rounded-md transition-colors hover:bg-red-500/20"
                                  style={{ color: 'rgba(255,100,100,0.4)', border: '1px dashed rgba(255,100,100,0.2)' }}>
                                  Remover turno
                                </button>
                              </div>
                            </td>
                          ) : (
                            <>
                              {/* Número do slot */}
                              <td style={{ ...tdBase, width: 30, textAlign: 'center', borderRight: BORDER_COL, padding: '2px 2px' }}>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontFamily: 'monospace' }}>
                                  {slotIdx}
                                </span>
                              </td>

                              {/* 7 células de dias */}
                              {DIAS.map(d => (
                                <td key={d.idx} style={{ ...tdBase, padding: '2px 2px', borderRight: BORDER_COL }}>
                                  <Celula
                                    cellData={slotsMap[`${grupo.setor_id}:${grupo.tipo_turno_id}:${slotIdx}:${d.idx}`]}
                                    profissionais={profissionais}
                                    onSave={payload => handleSave(grupo.setor_id, grupo.tipo_turno_id, slotIdx, d.idx, payload)}
                                    onClear={() => handleClear(grupo.setor_id, grupo.tipo_turno_id, slotIdx, d.idx)}
                                  />
                                </td>
                              ))}

                              {/* Botão remover linha */}
                              <td style={{ ...tdBase, width: 28, padding: '2px 2px', textAlign: 'center' }}>
                                <button
                                  onClick={() => removeSlotRow(grupo.setor_id, grupo.tipo_turno_id, slotIdx)}
                                  title="Remover linha"
                                  className="w-6 h-6 flex items-center justify-center rounded text-xs transition-colors hover:bg-red-500/20 mx-auto"
                                  style={{ color: 'rgba(255,255,255,0.18)' }}>
                                  ×
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })
                  })
                })}

                {/* Botão adicionar grupo */}
                <tr>
                  <td colSpan={3 + DIAS.length + 1}
                    style={{ padding: '12px 16px', borderTop: '2px solid rgba(255,255,255,0.07)' }}>
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

        <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Clique em qualquer célula para editar · Busca por nome ou CRM · Nomes não cadastrados salvos como texto livre
        </p>
        {erroSave && (
          <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
            {erroSave}
          </p>
        )}
      </main>

      <ModalPublicar aberto={modalPublicar} onFechar={() => setModalPublicar(false)} onPublicar={handlePublicar} />
      <ModalAddGrupo aberto={modalAddGrupo} onFechar={() => setModalAddGrupo(false)} setores={setores} tiposTurno={tiposTurno} onAdd={addGrupo} />

      {/* ── Painel de erros (dev) ── */}
      {erroSave && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9000,
          background: '#1e1e1e', borderTop: '2px solid #ef4444',
          padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ color: '#fca5a5', fontSize: 12, fontFamily: 'monospace' }}>
            ❌ {erroSave}
          </span>
          <button onClick={() => setErroSave('')}
            style={{ color: '#94a3b8', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            fechar ×
          </button>
        </div>
      )}
    </div>
  )
}
