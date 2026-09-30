// Fila no check-out (protótipo Bloco 4, item 4: "O que bloqueia o check-out:
// documento seu aberto"). Aqui só AVISA: o check-out continua possível — o
// servidor (registrar_checkout) não trava por rascunho. Leva à tela de
// pendências, onde os rascunhos são emitidos em lote.
import { FileWarning } from 'lucide-react'
import { Link } from 'react-router-dom'

import { usePendenciasPep } from './pendenciasPep'

export function AvisoRascunhosCheckout({ unidadeId }: { unidadeId: string | null | undefined }) {
  const q = usePendenciasPep(unidadeId)
  const n = q.data?.rascunhos.length ?? 0
  if (!n) return null
  return (
    <div role="status" className="flex flex-wrap items-center gap-2 rounded-controle border border-atencao/30 bg-alerta-atencao px-3 py-2.5 text-apoio text-atencao">
      <FileWarning className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-[1_1_220px] text-pretty">
        {n === 1 ? 'Você tem 1 documento em rascunho, ainda não emitido.' : `Você tem ${n} documentos em rascunho, ainda não emitidos.`}{' '}
        Rascunho aberto impede a alta do paciente. Emita ou descarte antes de sair.
      </span>
      <Link to="/pendencias-pep" className="font-medium whitespace-nowrap text-acao underline-offset-4 hover:underline">
        Ver pendências do PEP
      </Link>
    </div>
  )
}
