import { useState } from 'react'
import ModalPedirTroca from './ModalPedirTroca'
import ModalDesistir from './ModalDesistir'
import ModalDesignarAdmin from './ModalDesignarAdmin'

export default function PlantaoCard({ plantao, profissionalId, temTrocaPendente, temDesistencia, onTrocaSolicitada, onDesistencia, isAdmin, onDesignado }) {
  const vago = plantao.status === 'vago' || !plantao.profissional_id
  const ehMeu = !vago && plantao.profissional_id === profissionalId
  const trocaPendente = temTrocaPendente

  const setor = plantao.setores
  const turno = plantao.tipos_turno
  const medico = plantao.profissionais

  const [modalTroca, setModalTroca]       = useState(false)
  const [modalDesistir, setModalDesistir] = useState(false)
  const [modalDesignar, setModalDesignar] = useState(false)

  const borderColor = ehMeu
    ? temDesistencia ? '#F59E0B' : 'var(--cor-primaria)'
    : vago ? 'var(--cor-vago)'
    : trocaPendente ? '#F59E0B'
    : 'var(--cor-borda)'

  return (
    <>
      <div
        className="rounded-lg p-3 text-sm transition-all"
        style={{
          background: ehMeu ? '#F0FDFA' : 'var(--cor-superficie)',
          border: `2px solid ${borderColor}`,
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-1">
          <span
            className="text-xs font-semibold px-2 py-0.5 rounded-full text-white truncate max-w-[160px]"
            style={{ background: setor?.cor ?? '#64748B' }}
            title={setor?.nome}
          >
            {setor?.nome ?? '—'}
          </span>
          <span className="text-xs whitespace-nowrap" style={{ color: 'var(--cor-texto-suave)' }}>
            {turno?.hora_inicio?.slice(0,5)}–{turno?.hora_fim?.slice(0,5)}
          </span>
        </div>

        {vago ? (
          <p className="font-semibold" style={{ color: 'var(--cor-vago)' }}>VAGO</p>
        ) : (
          <p className="font-medium truncate" style={{ color: ehMeu ? 'var(--cor-primaria)' : 'var(--cor-texto)' }}>
            {medico?.nome ?? '—'}
            {ehMeu && <span className="ml-2 text-xs font-normal opacity-70">(você)</span>}
          </p>
        )}

        {trocaPendente && !temDesistencia && (
          <p className="text-xs mt-1 font-medium" style={{ color: '#B45309' }}>⏳ troca pendente</p>
        )}
        {temDesistencia && (
          <p className="text-xs mt-1 font-medium" style={{ color: '#B45309' }}>⚠️ desistência registrada</p>
        )}

        {plantao.observacoes && (
          <p className="text-xs mt-1 truncate" style={{ color: 'var(--cor-texto-suave)' }} title={plantao.observacoes}>
            {plantao.observacoes}
          </p>
        )}

        {ehMeu && !temDesistencia && (
          <div className="mt-2 flex gap-3">
            {!trocaPendente && (
              <button onClick={() => setModalTroca(true)} className="text-xs underline" style={{ color: 'var(--cor-texto-suave)' }}>
                Pedir transferência
              </button>
            )}
            <button onClick={() => setModalDesistir(true)} className="text-xs underline" style={{ color: 'var(--cor-vago)' }}>
              Desistir
            </button>
          </div>
        )}

        {isAdmin && (
          <button
            onClick={() => setModalDesignar(true)}
            className="mt-2 text-xs px-2.5 py-1 rounded-md font-semibold transition-all hover:opacity-80"
            style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534' }}>
            ✏️ Designar
          </button>
        )}
      </div>

      <ModalPedirTroca plantao={plantao} aberto={modalTroca} onFechar={() => setModalTroca(false)} onSucesso={onTrocaSolicitada} />
      <ModalDesistir plantao={plantao} aberto={modalDesistir} onFechar={() => setModalDesistir(false)} onSucesso={onDesistencia} />
      <ModalDesignarAdmin plantao={plantao} aberto={modalDesignar} onFechar={() => setModalDesignar(false)} onDesignado={onDesignado} />
    </>
  )
}
