// Aviso de "fora do plantão" na regulação (decisão do RT de 25/11/2026, achado
// B-07): a frase é a do servidor, sem trocar. PlantaoOrigem pergunta uma vez e
// vale para as peças de dentro (usePlantaoOrigem); AvisoPlantaoOrigem mostra a
// frase perto das ações; AvisoPlantao mostra a recusa de uma ação.
import * as React from 'react'

import { ContextoPlantaoOrigem, useMotivoPlantaoOrigem } from '@/components/regulacao/usePlantaoOrigem'
import { cn } from '@/lib/utils'

/** Pergunta o motivo para a unidade (e o paciente do pedido) e o deixa para as peças de dentro. */
export function PlantaoOrigem({ unidadeId, pacienteId, ligado = true, children }: {
  unidadeId: string | null | undefined; pacienteId?: string | null
  /** falso para quem não é a origem do pedido (central, destino): nada é desligado */
  ligado?: boolean
  children: React.ReactNode
}) {
  const motivo = useMotivoPlantaoOrigem(unidadeId, pacienteId, ligado)
  return <ContextoPlantaoOrigem.Provider value={motivo}>{children}</ContextoPlantaoOrigem.Provider>
}

/** A frase do servidor, como aviso (não como erro). */
export function AvisoPlantao({ texto, className }: { texto: string | null | undefined; className?: string }) {
  if (!texto) return null
  return (
    <p role="status" className={cn('rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-tinta', className)}>
      {texto}
    </p>
  )
}

/** O motivo do contexto, perto das ações que ele desliga. */
export function AvisoPlantaoOrigem({ className }: { className?: string }) {
  return <AvisoPlantao texto={React.useContext(ContextoPlantaoOrigem)} className={className} />
}
