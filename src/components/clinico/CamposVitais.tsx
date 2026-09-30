import type { ReactNode } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { obrigatorio, VITAIS, type Publico } from '@/domain/vitais'

export function CamposVitais({
  publico,
  valores,
  onChange,
  prefixo = 'v',
  aoLadoDoRotulo,
  somenteLeitura = [],
  rotulo,
  dica,
}: {
  publico: Publico | null
  valores: Record<string, string>
  onChange: (k: string, v: string) => void
  prefixo?: string
  /** algo ao lado do rótulo de cada sinal (a triagem põe o ⚠ das faixas do protocolo) */
  aoLadoDoRotulo?: (k: string) => ReactNode
  /** sinais calculados em outro lugar (a dor pela NIPS/FLACC) */
  somenteLeitura?: readonly string[]
  /** troca o rótulo padrão de um sinal */
  rotulo?: (k: string, padrao: string) => string
  /** texto de ajuda no campo (placeholder) no lugar da unidade */
  dica?: (k: string) => string | undefined
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {VITAIS.map((v) => {
        const leitura = somenteLeitura.includes(v.k)
        return (
          <div key={v.k} className="flex flex-col gap-1">
            <div className="flex items-start gap-1">
              <Label htmlFor={`${prefixo}-${v.k}`}>
                {rotulo ? rotulo(v.k, v.rotulo) : v.rotulo}
                {obrigatorio(v, publico) ? ' *' : ''}
              </Label>
              {aoLadoDoRotulo?.(v.k)}
            </div>
            <Input
              id={`${prefixo}-${v.k}`}
              inputMode="decimal"
              placeholder={dica?.(v.k) ?? v.un}
              value={valores[v.k] ?? ''}
              readOnly={leitura}
              aria-readonly={leitura || undefined}
              className={leitura ? 'bg-trilha' : undefined}
              onChange={(e) => onChange(v.k, e.target.value)}
            />
          </div>
        )
      })}
    </div>
  )
}
