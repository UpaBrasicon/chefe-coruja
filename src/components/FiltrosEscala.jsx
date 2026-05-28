import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'

export default function FiltrosEscala({ setores, filtros, onChange, totalSlots, slotsVisiveis }) {
  const algumFiltroAtivo = filtros.setor || filtros.turno !== 'todos' || filtros.soMeus || filtros.soVagos

  function set(campo, valor) {
    onChange({ ...filtros, [campo]: valor })
  }

  function limpar() {
    onChange({ setor: '', turno: 'todos', soMeus: false, soVagos: false })
  }

  return (
    <div
      className="rounded-xl p-3 mb-4 space-y-3"
      style={{ background: 'var(--cor-superficie)', border: '1px solid var(--cor-borda)' }}
    >
      <div className="flex flex-wrap gap-2 items-center">
        {/* Filtro de setor */}
        <Select value={filtros.setor || 'todos'} onValueChange={v => set('setor', v === 'todos' ? '' : v)}>
          <SelectTrigger
            className="h-8 text-xs w-auto min-w-[140px]"
            style={{ borderColor: filtros.setor ? 'var(--cor-primaria)' : 'var(--cor-borda)' }}
          >
            <SelectValue placeholder="Todos os setores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os setores</SelectItem>
            {setores.map(s => (
              <SelectItem key={s.id} value={String(s.id)}>
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: s.cor }}
                  />
                  {s.nome}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro de turno */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--cor-borda)' }}>
          {[
            { valor: 'todos', label: 'Todos' },
            { valor: 'diurno', label: '☀ Dia' },
            { valor: 'noturno', label: '🌙 Noite' },
          ].map(({ valor, label }) => (
            <button
              key={valor}
              onClick={() => set('turno', valor)}
              className="px-3 py-1 text-xs font-medium transition-colors"
              style={{
                background: filtros.turno === valor ? 'var(--cor-primaria)' : 'var(--cor-superficie)',
                color: filtros.turno === valor ? '#fff' : 'var(--cor-texto-suave)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Toggle: Meus plantões */}
        <button
          onClick={() => set('soMeus', !filtros.soMeus)}
          className="h-8 px-3 text-xs font-medium rounded-lg transition-colors"
          style={{
            background: filtros.soMeus ? 'var(--cor-primaria)' : 'var(--cor-superficie)',
            color: filtros.soMeus ? '#fff' : 'var(--cor-texto-suave)',
            border: `1px solid ${filtros.soMeus ? 'var(--cor-primaria)' : 'var(--cor-borda)'}`,
          }}
        >
          Meus plantões
        </button>

        {/* Toggle: Vagos */}
        <button
          onClick={() => set('soVagos', !filtros.soVagos)}
          className="h-8 px-3 text-xs font-medium rounded-lg transition-colors"
          style={{
            background: filtros.soVagos ? 'var(--cor-vago)' : 'var(--cor-superficie)',
            color: filtros.soVagos ? '#fff' : 'var(--cor-texto-suave)',
            border: `1px solid ${filtros.soVagos ? 'var(--cor-vago)' : 'var(--cor-borda)'}`,
          }}
        >
          Vagos
        </button>

        {/* Limpar filtros */}
        {algumFiltroAtivo && (
          <button
            onClick={limpar}
            className="h-8 px-3 text-xs rounded-lg underline"
            style={{ color: 'var(--cor-texto-suave)' }}
          >
            Limpar
          </button>
        )}
      </div>

      {/* Contador */}
      {algumFiltroAtivo && (
        <p className="text-xs" style={{ color: 'var(--cor-texto-suave)' }}>
          Exibindo <strong>{slotsVisiveis}</strong> de <strong>{totalSlots}</strong> plantões
        </p>
      )}
    </div>
  )
}
