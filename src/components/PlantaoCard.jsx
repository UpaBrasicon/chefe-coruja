import { Badge } from './ui/badge'

export default function PlantaoCard({ plantao, profissionalId }) {
  const vago = plantao.status === 'vago' || !plantao.profissional_id
  const ehMeu = !vago && plantao.profissional_id === profissionalId

  const setor = plantao.setores
  const turno = plantao.tipos_turno
  const medico = plantao.profissionais

  return (
    <div
      className="rounded-lg p-3 text-sm transition-all"
      style={{
        background: ehMeu ? '#F0FDFA' : 'var(--cor-superficie)',
        border: `2px solid ${ehMeu ? 'var(--cor-primaria)' : vago ? 'var(--cor-vago)' : 'var(--cor-borda)'}`,
      }}
    >
      {/* Linha superior: badge do setor + horário */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full text-white truncate max-w-[160px]"
          style={{ background: setor?.cor ?? '#64748B' }}
          title={setor?.nome}
        >
          {setor?.nome ?? '—'}
        </span>
        <span className="text-xs whitespace-nowrap" style={{ color: 'var(--cor-texto-suave)' }}>
          {turno?.hora_inicio?.slice(0, 5)}–{turno?.hora_fim?.slice(0, 5)}
        </span>
      </div>

      {/* Nome do médico ou VAGO */}
      {vago ? (
        <p className="font-semibold" style={{ color: 'var(--cor-vago)' }}>VAGO</p>
      ) : (
        <p className="font-medium truncate" style={{ color: ehMeu ? 'var(--cor-primaria)' : 'var(--cor-texto)' }}>
          {medico?.nome ?? '—'}
          {ehMeu && (
            <span className="ml-2 text-xs font-normal opacity-70">(você)</span>
          )}
        </p>
      )}

      {/* Observação */}
      {plantao.observacoes && (
        <p className="text-xs mt-1 truncate" style={{ color: 'var(--cor-texto-suave)' }} title={plantao.observacoes}>
          {plantao.observacoes}
        </p>
      )}
    </div>
  )
}
