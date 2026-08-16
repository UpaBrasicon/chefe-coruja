import InternacaoPainel from '@/pages/InternacaoPainel'

export default function ObservacaoPainel() {
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⏱️ <strong>Observação:</strong> pacientes permanecem em observação por no máximo{' '}
        <strong>6 horas</strong>. Ao fim desse período, devem ser internados (enfermaria/sala vermelha)
        ou liberados.
      </div>
      <InternacaoPainel modo="observacao" />
    </div>
  )
}
