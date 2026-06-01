import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Header from '../components/Header'
import TabMedicos from '../components/admin/TabMedicos'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'

const MESES_PT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function formatarData(dataStr) {
  if (!dataStr) return ''
  const [, m, d] = dataStr.split('-')
  return `${parseInt(d,10)} de ${MESES_PT[parseInt(m,10)-1]}`
}

function horasAte(dataStr) {
  return Math.ceil((new Date(dataStr + 'T12:00:00') - new Date()) / 3600000)
}

function StatusBadge({ status }) {
  const map = {
    aguardando_candidato:   { bg: '#FEF9C3', cor: '#854D0E', label: '⏳ Aguardando' },
    preenchida:             { bg: '#DCFCE7', cor: '#166534', label: '✅ Preenchida' },
    expirada_sem_candidato: { bg: '#FEE2E2', cor: '#991B1B', label: '❌ Expirada' },
    cancelada:              { bg: '#F1F5F9', cor: '#64748B', label: '🚫 Cancelada' },
    pendente:               { bg: '#FEF9C3', cor: '#854D0E', label: '⏳ Pendente' },
    aceita:                 { bg: '#DCFCE7', cor: '#166534', label: '✅ Aceita' },
    recusada:               { bg: '#FEE2E2', cor: '#991B1B', label: '❌ Recusada' },
  }
  const s = map[status] ?? { bg: '#F1F5F9', cor: '#64748B', label: status }
  return <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.cor }}>{s.label}</span>
}

function DesistenciaCard({ d, onDesignar, designandoId }) {
  const plantao = d.plantoes; const setor = plantao?.setores; const turno = plantao?.tipos_turno
  const candidatos = (d.candidaturas ?? []).sort((a, b) => a.ordem_fila - b.ordem_fila)
  const encerrada = d.status !== 'aguardando_candidato'

  return (
    <div className="rounded-xl p-4 space-y-3"
      style={{ background: 'var(--cor-superficie)', border: `1px solid ${encerrada ? 'var(--cor-borda)' : 'var(--cor-secundaria)'}` }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold" style={{ color: 'var(--cor-texto)' }}>
            {formatarData(plantao?.data)}
            {setor && <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: setor.cor }}>{setor.nome}</span>}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--cor-texto-suave)' }}>
            {turno?.hora_inicio?.slice(0,5)}–{turno?.hora_fim?.slice(0,5)} · {d.motivo === '__vaga_admin__' ? '🏥 Vaga do coordenador' : <>Desistência de <strong>{d.profissional?.nome}</strong></>}
          </p>
        </div>
        <StatusBadge status={d.status} />
      </div>
      {d.motivo && <p className="text-xs italic" style={{ color: 'var(--cor-texto-suave)' }}>"{d.motivo}"</p>}
      <p className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>
        Responsável até {new Date(d.responsavel_ate).toLocaleDateString('pt-BR')}
        {d.status === 'preenchida' && d.preenchido_por && (
          <> · Preenchida por <strong style={{ color: 'var(--cor-sucesso)' }}>{d.preenchido_por.nome}</strong></>
        )}
      </p>
      {!encerrada && (
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--cor-texto-suave)' }}>
            {candidatos.length === 0 ? 'Sem candidatos' : `Fila (${candidatos.length})`}
          </p>
          <div className="space-y-2">
            {candidatos.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                style={{ background: '#F8FAFC', border: '1px solid var(--cor-borda)' }}>
                <div>
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded mr-2" style={{ background: 'var(--cor-borda)', color: 'var(--cor-texto-suave)' }}>#{c.ordem_fila}</span>
                  <span className="text-sm" style={{ color: 'var(--cor-texto)' }}>{c.profissionais?.nome}</span>
                </div>
                <Button size="sm" onClick={() => onDesignar(d, c)} disabled={designandoId === c.id}
                  style={{ background: 'var(--cor-sucesso)', color: '#fff', fontSize: '12px', padding: '2px 10px' }}>
                  {designandoId === c.id ? '...' : 'Designar'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function PainelAdmin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const abaInicial = searchParams.get('aba') || 'medicos'
  const [desistencias, setDesistencias] = useState([])
  const [trocas, setTrocas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [designandoId, setDesignandoId] = useState(null)
  const [filtroTroca, setFiltroTroca] = useState('todos')
  const [erro, setErro] = useState('')
  const [pendentesCount, setPendentesCount] = useState(0)
  const [unidades, setUnidades] = useState([])
  const [setoresList, setSetoresList] = useState([])
  const [filtroUnidade, setFiltroUnidade] = useState('')
  const [filtroSetor, setFiltroSetor] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome'),
      supabase.from('setores').select('id, nome, unidade_id').order('nome'),
    ]).then(([{ data: uns }, { data: setos }]) => {
      setUnidades(uns ?? [])
      setSetoresList(setos ?? [])
    })
  }, [])

  const setoresFiltrados = filtroUnidade
    ? setoresList.filter(s => s.unidade_id === Number(filtroUnidade))
    : setoresList

  async function carregar() {
    setCarregando(true)
    const [resD, resT, resP] = await Promise.all([
      supabase.from('desistencias').select(`
        id, status, responsavel_ate, motivo, avisado_em, preenchida_em,
        plantoes(id, data, setores(nome, cor), tipos_turno(hora_inicio, hora_fim)),
        profissional:profissionais!desistencias_profissional_id_fkey(nome),
        preenchido_por:profissionais!desistencias_preenchida_por_fkey(nome),
        candidaturas(id, profissional_id, status, ordem_fila, profissionais(nome))
      `).order('avisado_em', { ascending: false }).limit(100),
      supabase.from('trocas').select(`
        id, status, mensagem, solicitado_em, respondido_em,
        plantoes(id, data, setores(nome, cor), tipos_turno(hora_inicio, hora_fim)),
        de_profissional:profissionais!trocas_de_profissional_id_fkey(nome),
        para_profissional:profissionais!trocas_para_profissional_id_fkey(nome)
      `).order('solicitado_em', { ascending: false }).limit(100),
      supabase.from('profissionais').select('id', { count: 'exact', head: true }).eq('status_aprovacao', 'pendente'),
    ])
    setDesistencias(resD.data ?? [])
    setTrocas(resT.data ?? [])
    setPendentesCount(resP.count ?? 0)
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  async function handleDesignar(desistencia, candidatura) {
    setErro(''); setDesignandoId(candidatura.id)
    const { error: e1 } = await supabase.from('desistencias').update({
      status: 'preenchida', preenchida_por: candidatura.profissional_id, preenchida_em: new Date().toISOString(),
    }).eq('id', desistencia.id)
    if (e1) { setErro('Erro: ' + e1.message); setDesignandoId(null); return }
    await supabase.from('plantoes').update({ profissional_id: candidatura.profissional_id, status: 'confirmado' }).eq('id', desistencia.plantoes?.id)
    await supabase.from('candidaturas').update({ status: 'selecionado' }).eq('id', candidatura.id)
    setDesignandoId(null); await carregar()
  }

  const alertas = desistencias.filter(d => {
    if (d.status !== 'aguardando_candidato') return false
    const h = horasAte(d.plantoes?.data); return h >= 0 && h <= 72
  })
  const desistenciasAbertas = desistencias.filter(d => d.status === 'aguardando_candidato')
  const desistenciasEncerradas = desistencias.filter(d => d.status !== 'aguardando_candidato')
  const trocasFiltradas = filtroTroca === 'todos' ? trocas : trocas.filter(t => t.status === filtroTroca)
  const contT = { todos: trocas.length, pendente: trocas.filter(t => t.status === 'pendente').length, aceita: trocas.filter(t => t.status === 'aceita').length, recusada: trocas.filter(t => t.status === 'recusada').length }

  return (
    <div className="min-h-screen" style={{ background: 'var(--cor-fundo)' }}>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Link to="/escala" className="text-sm underline" style={{ color: 'var(--cor-texto-suave)' }}>← Voltar</Link>
          <h1 className="text-xl font-bold flex-1" style={{ color: 'var(--cor-texto)' }}>Painel Admin</h1>
        </div>

        {/* Alerta 72h */}
        {alertas.length > 0 && (
          <div className="rounded-xl p-4 mb-5" style={{ background: '#FEF2F2', border: '2px solid var(--cor-vago)' }}>
            <p className="font-bold mb-2" style={{ color: 'var(--cor-vago)' }}>🚨 {alertas.length} plantão(ões) vago(s) nas próximas 72h</p>
            {alertas.map(d => (
              <p key={d.id} className="text-sm" style={{ color: '#7F1D1D' }}>• {formatarData(d.plantoes?.data)} — {d.plantoes?.setores?.nome} ({horasAte(d.plantoes?.data)}h)</p>
            ))}
          </div>
        )}

        {erro && <p className="mb-4 text-sm rounded-lg p-3" style={{ color: 'var(--cor-vago)', background: '#FEF2F2' }}>{erro}</p>}

        {carregando ? (
          <div className="text-center py-16" style={{ color: 'var(--cor-texto-suave)' }}><img src="/logo.png" alt="" className="h-10 w-10 rounded-full object-cover mx-auto mb-2" /><p>Carregando...</p></div>
        ) : (
          <>
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-2"
              style={{ background: '#fff', border: '1px solid var(--cor-borda)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: 14 }}>🏥</span>
              <select
                value={filtroUnidade}
                onChange={e => { setFiltroUnidade(e.target.value); setFiltroSetor('') }}
                className="text-sm font-medium bg-transparent focus:outline-none cursor-pointer"
                style={{ color: filtroUnidade ? 'var(--cor-primaria)' : 'var(--cor-texto-suave)', minWidth: 160 }}>
                <option value="">Todas as unidades</option>
                {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5 rounded-xl px-3 py-2"
              style={{ background: '#fff', border: '1px solid var(--cor-borda)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: 14 }}>🏬</span>
              <select
                value={filtroSetor}
                onChange={e => setFiltroSetor(e.target.value)}
                className="text-sm font-medium bg-transparent focus:outline-none cursor-pointer"
                style={{ color: filtroSetor ? 'var(--cor-primaria)' : 'var(--cor-texto-suave)', minWidth: 160 }}>
                <option value="">Todos os setores</option>
                {setoresFiltrados.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>
            {(filtroUnidade || filtroSetor) && (
              <button onClick={() => { setFiltroUnidade(''); setFiltroSetor('') }}
                className="text-xs px-3 py-2 rounded-xl transition-all hover:bg-gray-100"
                style={{ color: 'var(--cor-texto-suave)', border: '1px solid var(--cor-borda)' }}>
                ✕ Limpar
              </button>
            )}
          </div>

          <Tabs defaultValue={abaInicial} onValueChange={v => { if (v === 'editor') navigate('/admin/editor-escala') }}>
            <TabsList className="w-full mb-5 grid grid-cols-4 text-xs sm:text-sm"
              style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid var(--cor-borda)', borderRadius: 12, padding: 4, gap: 2 }}>
              <TabsTrigger value="medicos" className="relative px-1 sm:px-3 rounded-lg transition-all duration-200 hover:bg-white/80">
                <span className="hidden sm:inline">Médicos</span>
                <span className="sm:hidden">Médicos</span>
                {pendentesCount > 0 && (
                  <span className="absolute -top-1 -right-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--cor-vago)', fontSize: '10px' }}>{pendentesCount}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="desistencias" className="relative px-1 sm:px-3 rounded-lg transition-all duration-200 hover:bg-white/80">
                <span className="hidden sm:inline">Desistências</span>
                <span className="sm:hidden">Desist.</span>
                {desistenciasAbertas.length > 0 && (
                  <span className="absolute -top-1 -right-1 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center text-white" style={{ background: 'var(--cor-vago)', fontSize: '10px' }}>{desistenciasAbertas.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="trocas" className="px-1 sm:px-3 rounded-lg transition-all duration-200 hover:bg-white/80">Trocas</TabsTrigger>
              <TabsTrigger value="editor" className="px-1 sm:px-3 rounded-lg transition-all duration-200 hover:bg-teal-50"
                style={{ color: 'var(--cor-primaria)', fontWeight: 600 }}>
                Editor
              </TabsTrigger>
            </TabsList>

            <TabsContent value="medicos"><TabMedicos /></TabsContent>

            <TabsContent value="desistencias" className="space-y-4">
              {desistenciasAbertas.length === 0 && desistenciasEncerradas.length === 0 && (
                <p className="text-center py-12" style={{ color: 'var(--cor-texto-suave)' }}>Nenhuma desistência.</p>
              )}
              {desistenciasAbertas.length > 0 && (
                <section>
                  <h2 className="font-semibold text-sm uppercase tracking-wider mb-3" style={{ color: 'var(--cor-texto-suave)' }}>Aguardando ({desistenciasAbertas.length})</h2>
                  <div className="space-y-4">{desistenciasAbertas.map(d => <DesistenciaCard key={d.id} d={d} onDesignar={handleDesignar} designandoId={designandoId} />)}</div>
                </section>
              )}
              {desistenciasEncerradas.length > 0 && (
                <section className="mt-4">
                  <h2 className="font-semibold text-sm uppercase tracking-wider mb-3" style={{ color: 'var(--cor-texto-suave)' }}>Encerradas</h2>
                  <div className="space-y-3">{desistenciasEncerradas.map(d => <DesistenciaCard key={d.id} d={d} onDesignar={handleDesignar} designandoId={designandoId} />)}</div>
                </section>
              )}
            </TabsContent>

            <TabsContent value="trocas">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[{ label: 'Total', key: 'todos', cor: 'var(--cor-primaria)' }, { label: 'Pendentes', key: 'pendente', cor: '#B45309' }, { label: 'Aceitas', key: 'aceita', cor: 'var(--cor-sucesso)' }, { label: 'Recusadas', key: 'recusada', cor: 'var(--cor-vago)' }].map(({ label, key, cor }) => (
                  <button key={key} onClick={() => setFiltroTroca(key)} className="rounded-xl p-3 text-left"
                    style={{ background: filtroTroca === key ? cor : 'var(--cor-superficie)', border: `2px solid ${filtroTroca === key ? cor : 'var(--cor-borda)'}`, color: filtroTroca === key ? '#fff' : 'var(--cor-texto)' }}>
                    <p className="text-xl font-bold">{contT[key]}</p><p className="text-xs opacity-80">{label}</p>
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {trocasFiltradas.map(t => {
                  const p = t.plantoes; const s = p?.setores; const tr = p?.tipos_turno
                  return (
                    <div key={t.id} className="rounded-xl p-4" style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-sm" style={{ color: 'var(--cor-texto)' }}>
                            {formatarData(p?.data)}
                            {s && <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ background: s.cor }}>{s.nome}</span>}
                            {tr && <span className="ml-1 text-xs" style={{ color: 'var(--cor-texto-suave)' }}>{tr.hora_inicio?.slice(0,5)}–{tr.hora_fim?.slice(0,5)}</span>}
                          </p>
                          <p className="text-sm mt-1" style={{ color: 'var(--cor-texto-suave)' }}>
                            <strong style={{ color: 'var(--cor-texto)' }}>{t.de_profissional?.nome}</strong>{' → '}<strong style={{ color: 'var(--cor-texto)' }}>{t.para_profissional?.nome}</strong>
                          </p>
                        </div>
                        <StatusBadge status={t.status} />
                      </div>
                      {t.mensagem && <p className="text-xs italic" style={{ color: 'var(--cor-texto-suave)' }}>"{t.mensagem}"</p>}
                      <p className="text-xs mt-1" style={{ color: 'var(--cor-texto-suave)' }}>{new Date(t.solicitado_em).toLocaleDateString('pt-BR')}{t.respondido_em && ` · ${new Date(t.respondido_em).toLocaleDateString('pt-BR')}`}</p>
                    </div>
                  )
                })}
              </div>
            </TabsContent>
          </Tabs>
          </>
        )}
      </main>
    </div>
  )
}
