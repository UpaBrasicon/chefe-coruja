import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import ComboboxMedico from '../ComboboxMedico'
import ModalCriarPlantao from './ModalCriarPlantao'

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function formatarData(dataStr) {
  if (!dataStr) return ''
  const [, m, d] = dataStr.split('-')
  return `${parseInt(d,10)} de ${MESES_PT[parseInt(m,10)-1]}`
}

function extrairRecId(observacoes) {
  const match = (observacoes ?? '').match(/\[REC:([a-z0-9]+)\]/)
  return match ? match[1] : null
}

function diasAte(dataStr) {
  const hoje = new Date(); hoje.setHours(0,0,0,0)
  return Math.ceil((new Date(dataStr + 'T12:00:00') - hoje) / 86400000)
}

export default function TabEscalaAdmin() {
  const [setores, setSetores] = useState([])
  const [medicos, setMedicos] = useState([])
  const [plantoes, setPlantoes] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [buscou, setBuscou] = useState(false)
  const [erro, setErro] = useState('')
  const [salvandoId, setSalvandoId] = useState(null)
  const [excluindoId, setExcluindoId] = useState(null)
  const [editando, setEditando] = useState({})
  const [sucessos, setSucessos] = useState({})
  const [modalCriar, setModalCriar] = useState(false)
  const [confirmarExclusao, setConfirmarExclusao] = useState(null) // plantão sendo excluído

  const [filtros, setFiltros] = useState({ data: '', setor: '', profissional: '' })

  useEffect(() => {
    async function carregarBase() {
      const [resS, resM] = await Promise.all([
        supabase.from('setores').select('id, nome, cor').order('ordem_exibicao'),
        supabase.from('profissionais').select('id, nome, crm').eq('status_aprovacao', 'aprovado').eq('ativo', true).order('nome'),
      ])
      setSetores(resS.data ?? [])
      setMedicos(resM.data ?? [])
    }
    carregarBase()
  }, [])

  async function buscar() {
    if (!filtros.data && !filtros.setor && !filtros.profissional) {
      setErro('Preencha pelo menos um filtro.'); return
    }
    setErro(''); setCarregando(true); setBuscou(false)
    setEditando({}); setSucessos({}); setConfirmarExclusao(null)

    let query = supabase.from('plantoes')
      .select(`id, data, slot_num, status, profissional_id, observacoes,
        setores(id, nome, cor, periodo_padrao),
        tipos_turno(nome, hora_inicio, hora_fim),
        profissionais(id, nome)`)
      .order('data').order('slot_num').limit(100)

    if (filtros.data) query = query.eq('data', filtros.data)
    if (filtros.setor) query = query.eq('setor_id', parseInt(filtros.setor))
    if (filtros.profissional) query = query.eq('profissional_id', filtros.profissional)

    const { data, error } = await query
    if (error) setErro('Erro: ' + error.message)
    else { setPlantoes(data ?? []); setBuscou(true) }
    setCarregando(false)
  }

  async function salvar(plantao) {
    const novoProfissionalId = editando[plantao.id]
    if (novoProfissionalId === undefined) return
    setSalvandoId(plantao.id); setErro('')

    const { error } = await supabase.from('plantoes').update({
      profissional_id: novoProfissionalId || null,
      status: novoProfissionalId ? 'confirmado' : 'vago',
    }).eq('id', plantao.id)

    if (error) {
      setErro('Erro ao salvar: ' + error.message)
    } else {
      setSucessos(prev => ({ ...prev, [plantao.id]: true }))
      setEditando(prev => { const n = { ...prev }; delete n[plantao.id]; return n })
      setPlantoes(prev => prev.map(p => p.id !== plantao.id ? p : {
        ...p,
        profissional_id: novoProfissionalId,
        status: novoProfissionalId ? 'confirmado' : 'vago',
        profissionais: medicos.find(m => m.id === novoProfissionalId) ?? null,
      }))
      setTimeout(() => setSucessos(prev => { const n = { ...prev }; delete n[plantao.id]; return n }), 3000)
    }
    setSalvandoId(null)
  }

  async function confirmarEExcluir(plantao, encerrarRecorrencia = false) {
    setExcluindoId(plantao.id)
    const recId = extrairRecId(plantao.observacoes)

    if (encerrarRecorrencia && recId) {
      // Busca todos os plantões futuros da recorrência (VAGO)
      const hoje = new Date().toISOString().split('T')[0]
      const { data: futuros } = await supabase
        .from('plantoes').select('id')
        .eq('status', 'vago')
        .gte('data', hoje)
        .ilike('observacoes', `%[REC:${recId}]%`)

      const ids = (futuros ?? []).map(p => p.id)
      if (ids.length > 0) {
        // Remove desistências associadas
        await supabase.from('desistencias').delete().in('plantao_id', ids)
        // Remove plantões
        const { error } = await supabase.from('plantoes').delete().in('id', ids)
        if (error) { setErro('Erro ao encerrar recorrência: ' + error.message); setExcluindoId(null); return }
        setPlantoes(prev => prev.filter(p => !ids.includes(p.id)))
      }
    } else {
      // Exclui só este
      await supabase.from('desistencias').delete().eq('plantao_id', plantao.id)
      const { error } = await supabase.from('plantoes').delete().eq('id', plantao.id)
      if (error) { setErro('Erro ao excluir: ' + error.message); setExcluindoId(null); return }
      setPlantoes(prev => prev.filter(p => p.id !== plantao.id))
    }

    setExcluindoId(null)
    setConfirmarExclusao(null)
  }

  return (
    <div className="space-y-5">
      {/* Botão criar */}
      <div className="flex justify-end">
        <Button onClick={() => setModalCriar(true)}
          style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
          + Novo plantão
        </Button>
      </div>

      {/* Filtros */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>
        <p className="font-semibold text-sm" style={{ color: 'var(--cor-texto)' }}>Buscar plantão</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label style={{ color: 'var(--cor-texto)', fontSize: '12px' }}>Data</Label>
            <Input type="date" value={filtros.data} onChange={e => setFiltros(p => ({ ...p, data: e.target.value }))}
              style={{ borderColor: 'var(--cor-borda)' }} />
          </div>
          <div className="space-y-1">
            <Label style={{ color: 'var(--cor-texto)', fontSize: '12px' }}>Setor</Label>
            <select value={filtros.setor} onChange={e => setFiltros(p => ({ ...p, setor: e.target.value }))}
              className="w-full h-9 rounded-md border px-3 text-sm"
              style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)', background: '#fff' }}>
              <option value="">Todos os setores</option>
              {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label style={{ color: 'var(--cor-texto)', fontSize: '12px' }}>Profissional</Label>
            <ComboboxMedico medicos={medicos} value={filtros.profissional} onChange={v => setFiltros(p => ({ ...p, profissional: v }))} />
          </div>
        </div>
        {erro && <p className="text-sm" style={{ color: 'var(--cor-vago)' }}>{erro}</p>}
        <Button onClick={buscar} disabled={carregando} style={{ background: 'var(--cor-primaria)', color: '#fff' }}>
          {carregando ? 'Buscando...' : 'Buscar'}
        </Button>
      </div>

      {/* Resultados */}
      {buscou && plantoes.length === 0 && (
        <p className="text-center py-8" style={{ color: 'var(--cor-texto-suave)' }}>Nenhum plantão encontrado.</p>
      )}

      {plantoes.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm" style={{ color: 'var(--cor-texto-suave)' }}>{plantoes.length} plantão(ões) encontrado(s)</p>
          {plantoes.map(p => {
            const vago = !p.profissional_id
            const temEdicao = editando[p.id] !== undefined
            const sucesso = sucessos[p.id]
            const dias = diasAte(p.data)
            const dentroDoPrazo = dias >= 0 && dias <= 15
            const estaSendoExcluido = confirmarExclusao?.id === p.id
            const ehRecorrente = !!extrairRecId(p.observacoes)

            return (
              <div key={p.id} className="rounded-xl p-4 space-y-3"
                style={{ background: 'var(--cor-superficie)', border: `1px solid ${temEdicao ? 'var(--cor-primaria)' : estaSendoExcluido ? 'var(--cor-vago)' : 'var(--cor-borda)'}` }}>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-semibold text-sm" style={{ color: 'var(--cor-texto)' }}>{formatarData(p.data)}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ background: p.setores?.cor ?? '#64748B' }}>{p.setores?.nome}</span>
                      <span className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>
                        {p.tipos_turno?.hora_inicio?.slice(0,5)}–{p.tipos_turno?.hora_fim?.slice(0,5)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm" style={{ color: vago ? 'var(--cor-vago)' : 'var(--cor-texto-suave)' }}>
                        {vago ? 'VAGO' : p.profissionais?.nome}
                      </p>
                      {ehRecorrente && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: '#EDE9FE', color: '#5B21B6' }}>🔁 recorrente</span>
                      )}
                    </div>
                  </div>

                  {/* Edição do médico */}
                  <div className="flex items-center gap-2 min-w-0 sm:min-w-[220px]">
                    <div className="flex-1">
                      <ComboboxMedico medicos={medicos}
                        value={editando[p.id] ?? p.profissional_id ?? ''}
                        onChange={v => setEditando(prev => ({ ...prev, [p.id]: v }))} />
                    </div>
                    {temEdicao && (
                      <Button size="sm" onClick={() => salvar(p)} disabled={salvandoId === p.id}
                        style={{ background: 'var(--cor-primaria)', color: '#fff', whiteSpace: 'nowrap' }}>
                        {salvandoId === p.id ? '...' : 'Salvar'}
                      </Button>
                    )}
                    {sucesso && <span className="text-xs font-medium" style={{ color: 'var(--cor-sucesso)' }}>✓</span>}
                  </div>

                  {/* Botão excluir */}
                  {!estaSendoExcluido && (
                    <button onClick={() => setConfirmarExclusao(p)}
                      className="text-xs px-2 py-1 rounded border shrink-0"
                      style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}>
                      Excluir
                    </button>
                  )}
                </div>

                {/* Confirmação de exclusão */}
                {estaSendoExcluido && (() => {
                  const recId = extrairRecId(p.observacoes)
                  return (
                    <div className="rounded-lg p-3 space-y-2"
                      style={{ background: dentroDoPrazo ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${dentroDoPrazo ? 'var(--cor-vago)' : 'var(--cor-borda)'}` }}>
                      {dentroDoPrazo && p.profissional_id && (
                        <p className="text-sm font-medium" style={{ color: 'var(--cor-vago)' }}>
                          ⚠️ Este plantão é em <strong>{dias} dia{dias !== 1 ? 's' : ''}</strong> — dentro do prazo de 15 dias. O médico não terá aviso prévio suficiente.
                        </p>
                      )}
                      {recId ? (
                        <>
                          <p className="text-sm" style={{ color: 'var(--cor-texto)' }}>
                            🔁 Este plantão é <strong>recorrente</strong>. O que deseja fazer?
                          </p>
                          <div className="flex flex-col gap-2">
                            <Button size="sm" onClick={() => confirmarEExcluir(p, true)} disabled={excluindoId === p.id}
                              style={{ background: 'var(--cor-vago)', color: '#fff' }}>
                              {excluindoId === p.id ? 'Excluindo...' : '🛑 Encerrar recorrência (excluir este e todos os futuros)'}
                            </Button>
                            <Button size="sm" onClick={() => confirmarEExcluir(p, false)} disabled={excluindoId === p.id}
                              variant="outline" style={{ borderColor: 'var(--cor-vago)', color: 'var(--cor-vago)' }}>
                              Excluir só este dia
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setConfirmarExclusao(null)}
                              style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}>
                              Cancelar
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm" style={{ color: 'var(--cor-texto)' }}>Confirma a exclusão deste plantão?</p>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => confirmarEExcluir(p, false)} disabled={excluindoId === p.id}
                              style={{ background: 'var(--cor-vago)', color: '#fff' }}>
                              {excluindoId === p.id ? 'Excluindo...' : dentroDoPrazo && p.profissional_id ? 'Excluir mesmo assim' : 'Confirmar'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setConfirmarExclusao(null)}
                              style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}>
                              Cancelar
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}

      <ModalCriarPlantao aberto={modalCriar} onFechar={() => setModalCriar(false)} onSucesso={buscar} />
    </div>
  )
}
