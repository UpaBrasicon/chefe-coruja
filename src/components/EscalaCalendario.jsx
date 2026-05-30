import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import PlantaoCard from './PlantaoCard'
import FiltrosEscala from './FiltrosEscala'
import { Button } from './ui/button'

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const DIAS_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

const FILTROS_PADRAO = { setor: '', turno: 'todos', soMeus: false, soVagos: false }

export default function EscalaCalendario() {
  const { profissional } = useAuth()

  const [mes, setMes] = useState(3)
  const [ano, setAno] = useState(2026)
  const [plantoes, setPlantoes] = useState([])
  const [plantoesPendentes, setPlantoesPendentes] = useState(new Set())
  const [plantoesSemDesistencia, setPlantoesSemDesistencia] = useState(new Set())
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [filtros, setFiltros] = useState(FILTROS_PADRAO)

  useEffect(() => {
    async function buscar() {
      setCarregando(true)
      setErro('')

      const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const ultimoDia = new Date(ano, mes, 0).getDate()
      const fim = `${ano}-${String(mes).padStart(2, '0')}-${ultimoDia}`

      const [resPlantoes, resTrocas, resDesistencias] = await Promise.all([
        supabase
          .from('plantoes')
          .select(`
            id, data, slot_num, status, observacoes, profissional_id,
            setores(id, nome, cor, periodo_padrao, ordem_exibicao),
            tipos_turno(nome, hora_inicio, hora_fim),
            profissionais(id, nome)
          `)
          .gte('data', inicio)
          .lte('data', fim)
          .order('data', { ascending: true })
          .order('slot_num', { ascending: true }),
        supabase.from('trocas').select('plantao_id').eq('status', 'pendente'),
        supabase.from('desistencias').select('plantao_id, responsavel_ate').eq('status', 'aguardando_candidato'),
      ])

      if (resPlantoes.error) {
        setErro('Erro ao carregar escala: ' + resPlantoes.error.message)
      } else {
        setPlantoes(resPlantoes.data ?? [])
        setPlantoesPendentes(new Set((resTrocas.data ?? []).map(t => t.plantao_id)))
        setPlantoesSemDesistencia(new Set((resDesistencias.data ?? []).map(d => d.plantao_id)))
      }
      setCarregando(false)
    }
    buscar()
    setFiltros(FILTROS_PADRAO)
  }, [mes, ano])

  function mesAnterior() {
    if (mes === 1) { setMes(12); setAno(a => a - 1) }
    else setMes(m => m - 1)
  }

  function mesSeguinte() {
    if (mes === 12) { setMes(1); setAno(a => a + 1) }
    else setMes(m => m + 1)
  }

  // Lista de setores únicos para o filtro
  const setoresUnicos = useMemo(() => {
    const mapa = {}
    for (const p of plantoes) {
      if (p.setores && !mapa[p.setores.id]) mapa[p.setores.id] = p.setores
    }
    return Object.values(mapa).sort((a, b) => a.ordem_exibicao - b.ordem_exibicao)
  }, [plantoes])

  // Aplica filtros
  const plantoesFiltrados = useMemo(() => {
    return plantoes.filter(p => {
      if (filtros.setor && String(p.setores?.id) !== filtros.setor) return false
      if (filtros.turno !== 'todos' && p.setores?.periodo_padrao !== filtros.turno) return false
      if (filtros.soMeus && p.profissional_id !== profissional?.id) return false
      if (filtros.soVagos && !(p.status === 'vago' || !p.profissional_id)) return false
      return true
    })
  }, [plantoes, filtros, profissional])

  // Agrupa por data
  const porDia = useMemo(() => {
    const mapa = {}
    for (const p of plantoesFiltrados) {
      if (!mapa[p.data]) mapa[p.data] = []
      mapa[p.data].push(p)
    }
    for (const dia of Object.keys(mapa)) {
      mapa[dia].sort((a, b) => {
        const diff = (a.setores?.ordem_exibicao ?? 99) - (b.setores?.ordem_exibicao ?? 99)
        return diff !== 0 ? diff : a.slot_num - b.slot_num
      })
    }
    return mapa
  }, [plantoesFiltrados])

  const dias = Object.keys(porDia).sort()

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12">
      {/* Navegação de mês */}
      <div
        className="flex items-center justify-between py-4 sticky top-[56px] z-10"
        style={{ background: 'var(--cor-fundo)' }}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={mesAnterior}
          style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)' }}
        >
          ‹
        </Button>
        <h2 className="font-semibold text-lg" style={{ color: 'var(--cor-texto)' }}>
          {MESES_PT[mes - 1]} {ano}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={mesSeguinte}
          style={{ borderColor: 'var(--cor-borda)', color: 'var(--cor-texto)' }}
        >
          ›
        </Button>
      </div>

      {/* Filtros */}
      {!carregando && plantoes.length > 0 && (
        <FiltrosEscala
          setores={setoresUnicos}
          filtros={filtros}
          onChange={setFiltros}
          totalSlots={plantoes.length}
          slotsVisiveis={plantoesFiltrados.length}
        />
      )}

      {/* Estados */}
      {carregando && (
        <div className="text-center py-16" style={{ color: 'var(--cor-texto-suave)' }}>
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-full object-cover mx-auto mb-2" />
          <p>Carregando escala...</p>
        </div>
      )}

      {erro && (
        <p className="text-center py-8 px-4 rounded-lg" style={{ color: 'var(--cor-vago)', background: '#FEF2F2' }}>
          {erro}
        </p>
      )}

      {!carregando && !erro && plantoes.length === 0 && (
        <div className="text-center py-16" style={{ color: 'var(--cor-texto-suave)' }}>
          <p className="text-4xl mb-3">📭</p>
          <p>Nenhum plantão encontrado para este mês.</p>
        </div>
      )}

      {!carregando && !erro && plantoes.length > 0 && dias.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--cor-texto-suave)' }}>
          <p className="text-3xl mb-3">🔍</p>
          <p>Nenhum plantão corresponde aos filtros selecionados.</p>
          <button
            onClick={() => setFiltros(FILTROS_PADRAO)}
            className="mt-3 text-sm underline"
            style={{ color: 'var(--cor-primaria)' }}
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Lista de dias */}
      <div className="space-y-4">
        {dias.map(dia => (
          <DiaCard
            key={dia}
            dia={dia}
            slots={porDia[dia]}
            profissionalId={profissional?.id}
            plantoesPendentes={plantoesPendentes}
            plantoesSemDesistencia={plantoesSemDesistencia}
            onTrocaSolicitada={() => setPlantoesPendentes(prev => new Set(prev))}
            onDesistencia={() => setPlantoesSemDesistencia(prev => new Set(prev))}
          />
        ))}
      </div>
    </div>
  )
}

function DiaCard({ dia, slots, profissionalId, plantoesPendentes, plantoesSemDesistencia, onTrocaSolicitada, onDesistencia }) {
  const [, mesStr, diaStr] = dia.split('-')
  const data = new Date(`${dia}T12:00:00`)
  const nomeDia = DIAS_PT[data.getDay()]
  const diurno = slots.filter(s => s.setores?.periodo_padrao === 'diurno')
  const noturno = slots.filter(s => s.setores?.periodo_padrao === 'noturno')
  const temMeuPlantao = slots.some(s => s.profissional_id === profissionalId)

  return (
    <div
      className="rounded-xl overflow-hidden shadow-sm"
      style={{
        border: `1px solid ${temMeuPlantao ? 'var(--cor-primaria)' : 'var(--cor-borda)'}`,
        background: 'var(--cor-superficie)',
      }}
    >
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{
          background: temMeuPlantao ? 'var(--cor-primaria)' : '#F1F5F9',
          color: temMeuPlantao ? '#fff' : 'var(--cor-texto)',
        }}
      >
        <span className="font-semibold">
          {parseInt(diaStr, 10)} de {MESES_PT[parseInt(mesStr, 10) - 1]}
        </span>
        <span className="text-sm opacity-75 capitalize">{nomeDia}</span>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {diurno.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--cor-texto-suave)' }}>
                ☀ Diurno
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-2">
                {diurno.map(p => (
                  <PlantaoCard key={p.id} plantao={p} profissionalId={profissionalId} temTrocaPendente={plantoesPendentes?.has(p.id)} temDesistencia={plantoesSemDesistencia?.has(p.id)} onTrocaSolicitada={onTrocaSolicitada} onDesistencia={onDesistencia} />
                ))}
              </div>
            </section>
          )}

          {noturno.length > 0 && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--cor-texto-suave)' }}>
                🌙 Noturno
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 gap-2">
                {noturno.map(p => (
                  <PlantaoCard key={p.id} plantao={p} profissionalId={profissionalId} temTrocaPendente={plantoesPendentes?.has(p.id)} temDesistencia={plantoesSemDesistencia?.has(p.id)} onTrocaSolicitada={onTrocaSolicitada} onDesistencia={onDesistencia} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
