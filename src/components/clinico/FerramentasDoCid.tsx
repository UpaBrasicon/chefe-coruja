import { Calculator } from 'lucide-react'
import * as React from 'react'

import { JanelaFerramenta, type FerramentaNaJanela } from '@/components/clinico/JanelaFerramenta'
import { Button } from '@/components/ui/button'
import { acharSecao } from '@/content/registry'
import type { FaixaEtaria } from '@/domain/idade'
import { ROTULO_BLOCO_CID, ferramentasDosCids } from '@/lib/ferramentasDoCid'
import { cn } from '@/lib/utils'

// F2 e F3 das ferramentas pelo CID (pedido do RT de 17/11/2026; diagnóstico em
// docs/clinico/CID-FERRAMENTAS-CELULAR-DIAGNOSTICO.md, CF1–CF9 = A, e as
// condições da sessão de obrigatórios legais). Escolhido o CID, o bloco lista
// as ferramentas da Central ligadas a ele (mapa aprovado pelo RT). CF4: só
// lista e abre; não mostra resultado, dose, cor nem conduta. CF5 (F3): a
// ferramenta abre por cima do atendimento (JanelaFerramenta), e idade e peso
// só entram nela depois do clique do médico. Nada do paciente vai na URL.

function rotuloDaRota(rota: string): string {
  const [, , secao, slug] = rota.split('/')
  return acharSecao(secao)?.tools.find((t) => t.slug === slug)?.label ?? slug
}

export function FerramentasDoCid({ cids, faixa, pacienteId, nascimento, className }: {
  /** CIDs do atendimento (campo CID-10, problemas da conduta) */
  cids: (string | null | undefined)[]
  faixa: FaixaEtaria
  pacienteId: string
  /** data de nascimento do paciente (idade para a ferramenta) */
  nascimento: string | null
  className?: string
}) {
  const [aberta, setAberta] = React.useState<FerramentaNaJanela | null>(null)
  const lista = ferramentasDosCids(cids, faixa)
  if (lista.length === 0) return null
  return (
    <div role="group" aria-label="Ferramentas para este CID" className={cn('flex flex-col gap-1.5', className)}>
      <span className="flex items-center gap-1.5 text-rotulo font-semibold text-tinta">
        <Calculator className="size-3.5" aria-hidden /> Ferramentas para este CID
      </span>
      <div className="flex flex-wrap gap-1.5">
        {lista.map((f) => {
          const rotulo = rotuloDaRota(f.rota)
          return (
            <Button key={f.ficha} type="button" size="xs" variant="outline" className="max-w-full"
              title={`Ferramenta ligada ao CID ${f.cid}`} onClick={() => setAberta({ rota: f.rota, rotulo })}>
              <span className="truncate">{rotulo}</span>
            </Button>
          )
        })}
      </div>
      <span className="text-rotulo text-tinta-sussurro">{ROTULO_BLOCO_CID}</span>
      <JanelaFerramenta key={aberta?.rota ?? ''} ferramenta={aberta} pacienteId={pacienteId} nascimento={nascimento} faixa={faixa}
        aoFechar={() => setAberta(null)} />
    </div>
  )
}
