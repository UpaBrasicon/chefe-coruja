import InternacaoPainel from '@/pages/InternacaoPainel'

export function PacientesObservacao() {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-atencao/30 bg-atencao/[0.08] px-4 py-3 text-sm text-atencao">
        ⏱️ <strong>Observação:</strong> pacientes permanecem em observação por no máximo{' '}
        <strong>6 horas</strong>. Ao fim desse período, devem ser internados (enfermaria/sala
        vermelha) ou liberados.
      </div>
      <InternacaoPainel modo="observacao" embutido />
    </div>
  )
}
