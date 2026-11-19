import { useState } from 'react'

import {
  AVISO_DILUIR, ITENS_COM_AMPOLA, PECA_A_AMPOLA, ampolasDoItem, volumeDaAmpola, type BaseDose,
} from '@/clinico/pediatria/ampolas'
import { Button } from '@/components/ui/button'
import { numeroSemMilhar } from '@/lib/formato'
import { cn } from '@/lib/utils'

const ml = (x: number) => numeroSemMilhar(x, 2)
const faixaMl = ([a, b]: [number, number]) => (Math.abs(a - b) < 1e-9 ? ml(a) : `${ml(a)}–${ml(b)}`)

/**
 * Escolha da ampola e volume em mL (pedido do RT de 19/11/2026, ML1–ML11 = A).
 * Nenhuma ampola vem marcada; sem escolha, a tela não mostra mL. Item sem
 * ampola cadastrada não mostra nada (a linha fica como antes).
 */
export function EscolhaDaAmpola({ chave, dose, unidade, base }: {
  /** "lista:id", ex. 'rcp:atropina' (ver ITENS_COM_AMPOLA) */
  chave: string
  dose: [number, number]
  unidade: string
  base?: BaseDose
}) {
  const ampolas = ampolasDoItem(chave)
  const [escolhida, setEscolhida] = useState<string | null>(null)
  if (ampolas.length === 0) return null
  const ampola = ampolas.find((a) => a.id === escolhida)
  const volume = volumeDaAmpola(dose, ampola, base ?? ITENS_COM_AMPOLA[chave]?.base)
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div role="group" aria-label="Ampola" className="flex flex-wrap gap-1.5">
        {ampolas.map((a) => (
          <Button key={a.id} type="button" size="sm" variant={a.id === escolhida ? 'default' : 'outline'}
            aria-pressed={a.id === escolhida} className="h-auto min-h-9 whitespace-normal text-left"
            onClick={() => setEscolhida(a.id === escolhida ? null : a.id)}>
            {a.rotulo}
          </Button>
        ))}
      </div>
      {!volume && <p className="text-tinta-sussurro">{PECA_A_AMPOLA}</p>}
      {volume && ampola && (
        <>
          <p className="tabular-nums text-tinta">
            <strong>{faixaMl(volume.ml)} mL</strong> da ampola de {numeroSemMilhar(ampola.porMl, 3)} {unidade}/mL
          </p>
          {volume.aspirar && <p className={cn('font-medium text-atencao')}>{AVISO_DILUIR}</p>}
          <p className="text-rotulo text-tinta-sussurro">Concentração: {ampola.fonte}.</p>
        </>
      )}
    </div>
  )
}
