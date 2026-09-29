import { Popover } from '@base-ui/react/popover'
import { AlertTriangle } from 'lucide-react'

import { AVISO_ANEXO, referenciaDoSinal } from '@/clinico/triagem/anexosSinaisVitais'
import { rotuloVital } from '@/domain/vitais'

// ⚠ ao lado do sinal vital: passar o mouse (ou tocar) abre a tabela do anexo
// do protocolo para aquele sinal. É consulta — nada é marcado no valor
// digitado e a cor continua do enfermeiro.

export function ReferenciaSinal({ publico, vital }: { publico: 'adulto' | 'pediatrico' | null; vital: string }) {
  const ref = referenciaDoSinal(publico, vital)
  if (!ref) return null
  const { grupo, anexo } = ref
  const nome = rotuloVital(vital).replace(/ (sistólica|diastólica)$/, '')
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={120}
        closeDelay={200}
        aria-label={`Faixas de ${nome} no protocolo`}
        title={`Faixas de ${nome} no protocolo`}
        className="inline-grid size-5 cursor-help place-items-center rounded-micro text-observacao hover:bg-[#FFFBEB]"
      >
        <AlertTriangle className="size-[13px]" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={8} className="z-[90]">
          <Popover.Popup className="flex max-h-[min(420px,70dvh)] w-[min(460px,calc(100vw-16px))] flex-col gap-0.5 overflow-y-auto rounded-container border border-fio bg-superficie px-3 py-2.5 shadow-popover outline-none">
            <span className="text-apoio font-semibold text-tinta">{grupo.titulo}</span>
            <span className="text-[11px] text-tinta-sussurro">{anexo} do protocolo da unidade · consulta, não define a cor</span>
            <table className="mt-1 w-full border-collapse text-rotulo">
              <thead>
                <tr className="border-b border-fio">
                  {grupo.colunas.map((c) => <th key={c} className="px-1.5 py-[3px] text-left font-semibold text-tinta-apoio">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {grupo.linhas.map((l, i) => (
                  <tr key={i} className="border-b border-trilha last:border-b-0">
                    {l.map((c, j) => <td key={j} className="px-1.5 py-[3px] align-top break-words text-tinta">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {grupo.conferir && <span className="mt-1 text-[11px] text-atencao">{grupo.conferir}</span>}
            <span className="mt-1 text-[11px] text-tinta-sussurro">{AVISO_ANEXO}</span>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
