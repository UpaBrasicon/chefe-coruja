import { Popover } from '@base-ui/react/popover'
import { AlertTriangle } from 'lucide-react'

import { AVISO_ANEXO, referenciaDoSinal } from '@/clinico/triagem/anexosSinaisVitais'
import { rotuloVital } from '@/domain/vitais'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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
        className="inline-grid size-5 cursor-help place-items-center rounded-controle text-observacao hover:bg-alerta-atencao"
      >
        <AlertTriangle className="size-[13px]" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={8} className="z-[90]">
          <Popover.Popup className="flex max-h-[min(420px,70dvh)] w-[min(460px,calc(100vw-16px))] flex-col gap-0.5 overflow-y-auto rounded-container border border-fio bg-superficie px-3 py-2.5 shadow-popover outline-none">
            <span className="text-apoio font-semibold text-tinta">{grupo.titulo}</span>
            <span className="text-rotulo text-tinta-sussurro">{anexo} do protocolo da unidade · consulta, não define a cor</span>
            <Table className="mt-1 text-rotulo">
              <TableHeader className="bg-transparent">
                <TableRow>
                  {grupo.colunas.map((c) => <TableHead key={c} className="h-auto px-1.5 py-[3px] text-tinta-apoio">{c}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupo.linhas.map((l, i) => (
                  <TableRow key={i} className="border-trilha">
                    {l.map((c, j) => <TableCell key={j} className="px-1.5 py-[3px] align-top break-words whitespace-normal text-tinta">{c}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {grupo.conferir && <span className="mt-1 text-rotulo text-atencao">{grupo.conferir}</span>}
            <span className="mt-1 text-rotulo text-tinta-sussurro">{AVISO_ANEXO}</span>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
