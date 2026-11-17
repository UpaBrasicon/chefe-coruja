import { Calculator, ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { acharSecao } from '@/content/registry'
import type { FaixaEtaria } from '@/domain/idade'
import { ROTULO_BLOCO_CID, ferramentasDosCids } from '@/lib/ferramentasDoCid'
import { cn } from '@/lib/utils'

// F2 das ferramentas pelo CID (pedido do RT de 17/11/2026; diagnóstico em
// docs/clinico/CID-FERRAMENTAS-CELULAR-DIAGNOSTICO.md, CF1–CF9 = A, e as
// condições da sessão de obrigatórios legais). Escolhido o CID, o bloco lista
// as ferramentas da Central ligadas a ele (mapa aprovado pelo RT). CF4: só
// lista e abre; não mostra resultado, dose, cor nem conduta. Nada vai na URL
// além da rota da ferramenta: CID, idade e peso não saem do atendimento.
// A ferramenta abre numa aba nova; a janela por cima do atendimento, com a
// idade e o peso do paciente, é a F3.

function rotuloDaRota(rota: string): string {
  const [, , secao, slug] = rota.split('/')
  return acharSecao(secao)?.tools.find((t) => t.slug === slug)?.label ?? slug
}

export function FerramentasDoCid({ cids, faixa, className }: {
  /** CIDs do atendimento (campo CID-10, problemas da conduta) */
  cids: (string | null | undefined)[]
  faixa: FaixaEtaria
  className?: string
}) {
  const lista = ferramentasDosCids(cids, faixa)
  if (lista.length === 0) return null
  return (
    <div role="group" aria-label="Ferramentas para este CID" className={cn('flex flex-col gap-1.5', className)}>
      <span className="flex items-center gap-1.5 text-rotulo font-semibold text-tinta">
        <Calculator className="size-3.5" aria-hidden /> Ferramentas para este CID
      </span>
      <div className="flex flex-wrap gap-1.5">
        {lista.map((f) => (
          <Link key={f.ficha} to={f.rota} target="_blank" rel="noopener" title={`Ferramenta ligada ao CID ${f.cid}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'xs' }), 'max-w-full')}>
            <span className="truncate">{rotuloDaRota(f.rota)}</span>
            <ExternalLink className="size-3 shrink-0" aria-hidden />
          </Link>
        ))}
      </div>
      <span className="text-rotulo text-tinta-sussurro">{ROTULO_BLOCO_CID} Abre numa aba nova.</span>
    </div>
  )
}
