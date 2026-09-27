import { useState } from 'react'

import { cargasPorPeso, equipamentoPorPeso, fichaViaAereaPediatrica } from '@/clinico/pediatria/viaAerea'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const n = (x: number) => x.toLocaleString('pt-BR')

/** Via aérea (pela cor da fita de Broselow) e cargas de desfibrilação por peso. */
export function ViaAereaPediatrica() {
  const [peso, setPeso] = useState(0)
  const eq = equipamentoPorPeso(peso)
  const c = cargasPorPeso(peso)

  return (
    <ToolLayout
      title="Via aérea e desfibrilação pediátrica"
      description="Equipamento pela cor da fita de Broselow e cargas elétricas por peso. Pediatria: até antes dos 14 anos."
      ficha={fichaViaAereaPediatrica}
    >
      <Card>
        <CardContent className="pt-6">
          <NumberField id="va-peso" label="Peso aferido ou estimado" unit="kg" value={peso} onChange={setPeso} min={0} step={0.1} />
        </CardContent>
      </Card>

      {peso > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              Via aérea {eq && <Badge>{eq.cor} · {eq.kg[0]}–{eq.kg[1]} kg</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {eq ? (
              <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
                <dt className="text-muted-foreground">Tubo traqueal com cuff</dt><dd>{n(eq.tuboCuffMm)} mm (separar também 0,5 mm menor)</dd>
                <dt className="text-muted-foreground">Fixação na gengiva</dt><dd>{eq.fixacaoCm} cm</dd>
                <dt className="text-muted-foreground">Lâmina</dt><dd>{eq.lamina}</dd>
                <dt className="text-muted-foreground">Máscara laríngea</dt><dd>{eq.mascaraLaringea}</dd>
                <dt className="text-muted-foreground">Sonda de aspiração</dt><dd>{eq.sondaAspiracaoFr} Fr</dd>
                <dt className="text-muted-foreground">Bougie</dt><dd>{eq.bougieFr} Fr</dd>
              </dl>
            ) : (
              <p className="text-muted-foreground">Fora da fita de Broselow (3 a 36 kg): a tabela de equipamento não se aplica a este peso.</p>
            )}
            <p className="mt-2 text-muted-foreground">A fita estima pelo comprimento; aqui a cor sai do peso. Peso de balança, quando existe, manda.</p>
          </CardContent>
        </Card>
      )}

      {c && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cargas elétricas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">1ª desfibrilação (2 J/kg)</dt><dd>{c.desfib1J} J</dd>
              <dt className="text-muted-foreground">2ª desfibrilação (4 J/kg)</dt><dd>{c.desfib2J} J</dd>
              <dt className="text-muted-foreground">Cardioversão (0,5–1 J/kg)</dt><dd>{c.cardioversao[0]}–{c.cardioversao[1]} J</dd>
              <dt className="text-muted-foreground">Cardioversão refratária (2 J/kg)</dt><dd>{c.cardioversaoRefrataria} J</dd>
            </dl>
          </CardContent>
        </Card>
      )}
    </ToolLayout>
  )
}
