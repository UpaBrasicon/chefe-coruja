import { useState } from 'react'

import {
  AVISO_DILUIR, AVISO_VOLUME_PEQUENO, ITENS_COM_AMPOLA, PECA_A_AMPOLA, PECA_A_SOLUCAO, ampolasDoItem, volumeAbaixoDe01, volumeDaAmpola, type Apresentacao, type BaseDose,
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
export function EscolhaDaAmpola({ chave, ampolas: lista, dose, doses, unidade, base, grande }: {
  /** "lista:id", ex. 'rcp:amiodarona' (ver ITENS_COM_AMPOLA); ou passe `ampolas` */
  chave?: string
  /** ampolas do item, quando não vêm do cadastro da pediatria (ex.: PCR do adulto) */
  ampolas?: Apresentacao[]
  dose?: [number, number]
  /** várias doses do mesmo item (ex.: 1ª e 2ª dose), cada uma com o seu volume */
  doses?: { rotulo: string; dose: [number, number] }[]
  unidade: string
  base?: BaseDose
  /** volume no estilo do guia de parada (texto maior, cor de ação) */
  grande?: boolean
}) {
  const ampolas = lista ?? (chave ? ampolasDoItem(chave) : [])
  const [escolhida, setEscolhida] = useState<string | null>(null)
  if (ampolas.length === 0) return null
  const ampola = ampolas.find((a) => a.id === escolhida)
  const baseDaDose = base ?? (chave ? ITENS_COM_AMPOLA[chave]?.base : undefined)
  // aviso de diluir pela ampola (bula) ou pelo item (infusão do livro)
  const diluirItem = chave ? ITENS_COM_AMPOLA[chave]?.diluir === true : false
  const linhas = (doses ?? (dose ? [{ rotulo: '', dose }] : []))
    .map((l) => ({ rotulo: l.rotulo, volume: volumeDaAmpola(l.dose, ampola, baseDaDose) }))
  const algum = linhas.find((l) => l.volume)?.volume
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
      {!algum && <p className="text-tinta-sussurro">{ampolas.every((a) => a.pronta) ? PECA_A_SOLUCAO : PECA_A_AMPOLA}</p>}
      {algum && ampola && (
        <>
          {linhas.map((l) => l.volume && (
            <p key={l.rotulo} className={cn('tabular-nums', grande ? 'text-corpo font-semibold text-acao' : 'text-tinta')}>
              {l.rotulo && <>{l.rotulo}: </>}<strong>{faixaMl(l.volume.ml)} mL</strong>{ampola.pronta
                ? <> da solução pronta de {numeroSemMilhar(ampola.porMl, 3)} {unidade}/mL (volume a infundir)</>
                : ampola.seringa
                  ? <> da seringa preenchida de {numeroSemMilhar(ampola.porMl, 3)} {unidade}/mL (volume a aplicar)</>
                  : <> da ampola de {numeroSemMilhar(ampola.porMl, 3)} {unidade}/mL</>}
            </p>
          ))}
          {(algum.aspirar || diluirItem) && <p className="font-medium text-atencao">{AVISO_DILUIR}</p>}
          {linhas.some((l) => volumeAbaixoDe01(l.volume?.ml)) && <p className="font-medium text-atencao">{AVISO_VOLUME_PEQUENO}</p>}
          <p className="text-rotulo text-tinta-sussurro">Concentração: {ampola.fonte}.</p>
        </>
      )}
    </div>
  )
}
