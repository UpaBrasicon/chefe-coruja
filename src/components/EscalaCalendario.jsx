import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import PlantaoCard from './PlantaoCard'
import { Button } from './ui/button'

const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_LONGO = ['janeiro','fevereiro','março','abril','maio','junho',
  'julho','agosto','setembro','outubro','novembro','dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']
const DIAS_NOME = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado']

// ── Feriados ──────────────────────────────────────────────────────────────────
function calcularPascoa(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(ano, mes - 1, dia)
}

function toStr(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

function calcularFeriados(ano) {
  const f = {}
  const add = (mes, dia, nome) => {
    f[`${ano}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`] = nome
  }
  add(1,  1,  'Confraternização Universal')
  add(4,  21, 'Tiradentes')
  add(5,  1,  'Dia do Trabalho')
  add(9,  7,  'Independência do Brasil')
  add(10, 12, 'N. Sra. Aparecida')
  add(11, 2,  'Finados')
  add(11, 15, 'Proclamação da República')
  add(11, 20, 'Consciência Negra')
  add(12, 25, 'Natal')

  const pascoa = calcularPascoa(ano)
  const relativo = (dias, nome) => {
    const d = new Date(pascoa); d.setDate(d.getDate() + dias)
    f[toStr(d)] = nome
  }
  relativo(-48, 'Carnaval')
  relativo(-47, 'Carnaval')
  relativo(-2,  'Sexta-feira Santa')
  relativo(0,   'Páscoa')
  relativo(60,  'Corpus Christi')
  return f
}

// ── Calendário ────────────────────────────────────────────────────────────────
function gerarDias(mes, ano) {
  const primeiroDia = new Date(ano, mes - 1, 1).getDay()
  const ultimoDia   = new Date(ano, mes, 0).getDate()
  const dias = []
  for (let i = 0; i < primeiroDia; i++) dias.push(null)
  for (let d = 1; d <= ultimoDia; d++) {
    dias.push(`${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`)
  }
  const resto = (7 - (dias.length % 7)) % 7
  for (let i = 0; i < resto; i++) dias.push(null)
  return dias
}

function formatarDataLonga(dateStr) {
  const data = new Date(`${dateStr}T12:00:00`)
  const [, mes, dia] = dateStr.split('-')
  return `${DIAS_NOME[data.getDay()]}, ${parseInt(dia)} de ${MESES_LONGO[parseInt(mes) - 1]}`
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function EscalaCalendario() {
  const { profissional } = useAuth()
  const hoje = new Date()
  const [mes, setMes]   = useState(hoje.getMonth() + 1)
  const [ano, setAno]   = useState(hoje.getFullYear())
  const [plantoes, setPlantoes]                         = useState([])
  const [plantoesPendentes, setPlantoesPendentes]       = useState(new Set())
  const [plantoesSemDesistencia, setPlantoesSemDesistencia] = useState(new Set())
  const [carregando, setCarregando] = useState(true)
  const [diaSelecionado, setDiaSelecionado] = useState(null)
  const [filtroDetalhe, setFiltroDetalhe]   = useState('todos')

  // Ao montar, busca o mês mais próximo com dados (atual ou passado recente)
  useEffect(() => {
    async function encontrarMesComDados() {
      const { data } = await supabase
        .from('plantoes')
        .select('data')
        .order('data', { ascending: false })
        .limit(1)
      if (data && data.length > 0) {
        const [anoD, mesD] = data[0].data.split('-').map(Number)
        const maisRecente = new Date(anoD, mesD - 1, 1)
        const atual = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
        // Usa o mês atual se tiver dados futuros/presentes, senão o mais recente com dados
        if (maisRecente >= atual) {
          setMes(hoje.getMonth() + 1)
          setAno(hoje.getFullYear())
        } else {
          setMes(mesD)
          setAno(anoD)
        }
      }
    }
    encontrarMesComDados()
  }, [])

  const feriados       = useMemo(() => calcularFeriados(ano), [ano])
  const diasCalendario = useMemo(() => gerarDias(mes, ano), [mes, ano])
  const hojeStr        = toStr(hoje)

  useEffect(() => {
    async function buscar() {
      setCarregando(true)
      const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`
      const fim    = `${ano}-${String(mes).padStart(2,'0')}-${new Date(ano, mes, 0).getDate()}`

      const [resP, resT, resD] = await Promise.all([
        supabase.from('plantoes')
          .select(`id, data, slot_num, status, observacoes, profissional_id,
            setores(id, nome, cor, periodo_padrao, ordem_exibicao),
            tipos_turno(nome, hora_inicio, hora_fim),
            profissionais(id, nome)`)
          .gte('data', inicio).lte('data', fim)
          .order('data').order('slot_num'),
        supabase.from('trocas').select('plantao_id').eq('status', 'pendente'),
        supabase.from('desistencias').select('plantao_id').eq('status', 'aguardando_candidato'),
      ])

      setPlantoes(resP.data ?? [])
      setPlantoesPendentes(new Set((resT.data ?? []).map(t => t.plantao_id)))
      setPlantoesSemDesistencia(new Set((resD.data ?? []).map(d => d.plantao_id)))
      setCarregando(false)
    }
    buscar()
    setDiaSelecionado(null)
    setFiltroDetalhe('todos')
  }, [mes, ano])

  const plantoesPorDia = useMemo(() => {
    const mapa = {}
    for (const p of plantoes) {
      if (!mapa[p.data]) mapa[p.data] = []
      mapa[p.data].push(p)
    }
    return mapa
  }, [plantoes])

  const plantoesDodia = useMemo(() => {
    if (!diaSelecionado) return []
    const lista = (plantoesPorDia[diaSelecionado] ?? []).slice().sort((a, b) => {
      const d = (a.setores?.ordem_exibicao ?? 99) - (b.setores?.ordem_exibicao ?? 99)
      return d !== 0 ? d : a.slot_num - b.slot_num
    })
    return lista.filter(p => {
      if (filtroDetalhe === 'meus')      return p.profissional_id === profissional?.id
      if (filtroDetalhe === 'vagos')     return p.status === 'vago' || !p.profissional_id
      if (filtroDetalhe === 'pendentes') return plantoesPendentes.has(p.id)
      return true
    })
  }, [diaSelecionado, plantoesPorDia, filtroDetalhe, profissional, plantoesPendentes])

  // Contadores para filtros do painel
  const contadores = useMemo(() => {
    if (!diaSelecionado) return {}
    const lista = plantoesPorDia[diaSelecionado] ?? []
    return {
      todos:     lista.length,
      meus:      lista.filter(p => p.profissional_id === profissional?.id).length,
      vagos:     lista.filter(p => p.status === 'vago' || !p.profissional_id).length,
      pendentes: lista.filter(p => plantoesPendentes.has(p.id)).length,
    }
  }, [diaSelecionado, plantoesPorDia, profissional, plantoesPendentes])

  function mesAnterior() { mes === 1 ? (setMes(12), setAno(a => a - 1)) : setMes(m => m - 1) }
  function mesSeguinte() { mes === 12 ? (setMes(1),  setAno(a => a + 1)) : setMes(m => m + 1) }

  return (
    <div className="pb-12">
      <style>{`
        .painel-dia { animation: slideInPainel .2s ease forwards; }
        @keyframes slideInPainel {
          from { opacity:0; transform:translateX(24px) scale(.98); }
          to   { opacity:1; transform:translateX(0)   scale(1); }
        }
        .dia-btn { transition: transform .15s ease, box-shadow .15s ease; }
        .dia-btn:hover { transform: scale(1.07); z-index:2; }
        .dia-btn:active { transform: scale(.97); }
      `}</style>

      {/* ── Fundo pastel (herda do pai) ── */}
      <div style={{ minHeight: '100vh', padding: '24px 16px 48px' }}>
        <div className="max-w-6xl mx-auto">

          {/* Navegação + caixa mês/ano */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={mesAnterior}
              className="flex items-center justify-center w-10 h-10 rounded-full transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(148,163,184,0.4)', color: '#334155', fontSize: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              ‹
            </button>

            {/* Caixa mês/ano destacada */}
            <div className="text-center px-8 py-3 rounded-2xl select-none"
              style={{
                background: 'rgba(255,255,255,0.85)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(148,163,184,0.3)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              }}>
              <h2 className="font-bold text-2xl leading-tight tracking-wide" style={{ color: '#0f172a' }}>
                {MESES_PT[mes - 1]}
              </h2>
              <p className="text-sm font-semibold" style={{ color: '#64748b', letterSpacing: '0.1em' }}>
                {ano}
              </p>
            </div>

            <button onClick={mesSeguinte}
              className="flex items-center justify-center w-10 h-10 rounded-full transition-all hover:scale-110 active:scale-95"
              style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(148,163,184,0.4)', color: '#334155', fontSize: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
              ›
            </button>
          </div>

      {carregando ? (
        <div className="text-center py-20">
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-full mx-auto mb-3 opacity-70 animate-pulse" />
          <p style={{ color: '#64748b' }}>Carregando escala...</p>
        </div>
      ) : (
        <div className="flex gap-3 items-start">

          {/* ── Grade calendário ── */}
          <div className={`${diaSelecionado ? 'hidden md:block md:flex-1 min-w-0' : 'w-full'} rounded-2xl p-3 sm:p-4`}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
            }}>

            {/* Cabeçalho dias */}
            <div className="grid grid-cols-7 mb-2">
              {DIAS_SEMANA.map((d, i) => (
                <div key={d} className="text-center py-1.5 text-xs font-bold tracking-wide"
                  style={{ color: i === 0 ? '#dc2626' : '#475569' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Quadrados — fundo do grid visível como linhas de grade */}
            <div className="grid grid-cols-7 gap-0.5 rounded-xl overflow-hidden"
              style={{ background: '#cbd5e1' }}>
              {diasCalendario.map((data, idx) => {
                if (!data) return <div key={idx} />

                const lista     = plantoesPorDia[data] ?? []
                const temMeu    = lista.some(p => p.profissional_id === profissional?.id)
                const temVaga   = lista.some(p => p.status === 'vago' || !p.profissional_id)
                const temTroca  = lista.some(p => plantoesPendentes.has(p.id))
                const feriado   = feriados[data]
                const isHoje    = data === hojeStr
                const isSel     = data === diaSelecionado
                const ehDom     = new Date(`${data}T12:00`).getDay() === 0
                const dia       = parseInt(data.split('-')[2], 10)

                return (
                  <button
                    key={data}
                    onClick={() => {
                      setDiaSelecionado(prev => prev === data ? null : data)
                      setFiltroDetalhe('todos')
                    }}
                    className="dia-btn aspect-square rounded-xl flex flex-col items-center justify-start pt-1.5 pb-1 px-0.5 relative"
                    style={{
                      background: isSel
                        ? '#0d9488'
                        : temMeu
                        ? '#d1fae5'
                        : feriado
                        ? '#fee2e2'
                        : isHoje
                        ? '#f0fdfa'
                        : '#f8fafc',
                      outline: isSel ? '2px solid #0d9488'
                        : isHoje ? '2px solid #0d9488'
                        : 'none',
                      outlineOffset: '-2px',
                      boxShadow: isSel ? '0 4px 16px rgba(13,148,136,0.3)' : 'none',
                    }}
                  >
                    {/* Número */}
                    <span className="text-xs sm:text-sm font-bold leading-none"
                      style={{
                        color: isSel ? '#fff'
                          : feriado || ehDom ? '#dc2626'
                          : isHoje ? '#0d9488'
                          : '#0f172a',
                        fontWeight: isHoje || isSel ? 700 : 600,
                      }}>
                      {dia}
                    </span>

                    {/* Nome feriado mini */}
                    {feriado && (
                      <span className="hidden sm:block text-center leading-none mt-0.5 px-0.5 truncate w-full"
                        style={{ fontSize: '7px', color: isSel ? 'rgba(255,255,255,0.9)' : '#dc2626' }}>
                        {feriado.split(' ')[0]}
                      </span>
                    )}

                    {/* Dots indicadores */}
                    {(temMeu || temVaga || temTroca) && (
                      <div className="flex gap-0.5 mt-auto justify-center flex-wrap">
                        {temMeu   && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isSel ? '#fff' : '#0d9488' }} />}
                        {temVaga  && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isSel ? 'rgba(255,255,255,0.8)' : '#f59e0b' }} />}
                        {temTroca && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isSel ? 'rgba(255,255,255,0.8)' : '#8b5cf6' }} />}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legenda */}
            <div className="flex items-center gap-3 sm:gap-5 mt-4 px-1 flex-wrap">
              {[
                { cor: '#0d9488', label: 'Meu plantão' },
                { cor: '#f59e0b', label: 'Vaga aberta' },
                { cor: '#8b5cf6', label: 'Troca pendente' },
                { cor: '#dc2626', label: 'Feriado / Dom.' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-xs" style={{ color: '#64748b' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.cor }} />
                  {l.label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Painel lateral do dia ── */}
          {diaSelecionado && (
            <div className="painel-dia w-full md:w-72 lg:w-80 flex-shrink-0 rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(148,163,184,0.25)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              }}>

              {/* Header */}
              <div className="px-4 py-3 flex items-start justify-between"
                style={{ background: 'var(--cor-primaria)' }}>
                <div>
                  <p className="text-white font-bold text-sm leading-tight">
                    {formatarDataLonga(diaSelecionado)}
                  </p>
                  {feriados[diaSelecionado] && (
                    <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>
                      🎉 {feriados[diaSelecionado]}
                    </p>
                  )}
                  <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    {(plantoesPorDia[diaSelecionado] ?? []).length} plantão(ões) no dia
                  </p>
                </div>
                <button onClick={() => setDiaSelecionado(null)}
                  className="text-white/60 hover:text-white text-lg leading-none mt-0.5 transition-colors ml-2">
                  ✕
                </button>
              </div>

              {/* Filtros rápidos */}
              <div className="flex gap-1 p-2 flex-wrap" style={{ borderBottom: '1px solid var(--cor-borda)' }}>
                {[
                  { key: 'todos',     emoji: '',   label: 'Todos',   n: contadores.todos },
                  { key: 'meus',      emoji: '🟢', label: 'Meus',    n: contadores.meus },
                  { key: 'vagos',     emoji: '🟡', label: 'Vagos',   n: contadores.vagos },
                  { key: 'pendentes', emoji: '🟣', label: 'Trocas',  n: contadores.pendentes },
                ].map(f => (
                  <button key={f.key} onClick={() => setFiltroDetalhe(f.key)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: filtroDetalhe === f.key ? 'var(--cor-primaria)' : 'var(--cor-fundo)',
                      color: filtroDetalhe === f.key ? '#fff' : 'var(--cor-texto-suave)',
                      border: `1px solid ${filtroDetalhe === f.key ? 'var(--cor-primaria)' : 'var(--cor-borda)'}`,
                    }}>
                    {f.emoji} {f.label}
                    {f.n > 0 && (
                      <span className="ml-0.5 text-xs font-bold"
                        style={{ color: filtroDetalhe === f.key ? 'rgba(255,255,255,0.8)' : 'var(--cor-texto-suave)' }}>
                        ({f.n})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Lista */}
              <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
                {plantoesDodia.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-sm" style={{ color: 'var(--cor-texto-suave)' }}>
                      Nenhum plantão encontrado.
                    </p>
                    {filtroDetalhe !== 'todos' && (
                      <button onClick={() => setFiltroDetalhe('todos')}
                        className="mt-2 text-xs underline" style={{ color: 'var(--cor-primaria)' }}>
                        Ver todos
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-2 space-y-2">
                    {plantoesDodia.map(p => (
                      <PlantaoCard
                        key={p.id}
                        plantao={p}
                        profissionalId={profissional?.id}
                        temTrocaPendente={plantoesPendentes?.has(p.id)}
                        temDesistencia={plantoesSemDesistencia?.has(p.id)}
                        onTrocaSolicitada={() => setPlantoesPendentes(prev => new Set(prev))}
                        onDesistencia={() => setPlantoesSemDesistencia(prev => new Set(prev))}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
        </div>{/* max-w-6xl */}
      </div>{/* fundo teal */}
    </div>
  )
}
