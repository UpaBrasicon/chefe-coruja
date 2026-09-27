import { useState } from 'react'

import { fichaViaAereaPediatrica, tuboPorIdade } from '@/clinico/pediatria/viaAerea'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const n = (x: number) => x.toLocaleString('pt-BR')

/** Tubo endotraqueal pediátrico pela idade (Anexo 2 do manual do HCFMUSP). */
export function ViaAereaPediatrica() {
  const [anos, setAnos] = useState(0)
  const t = tuboPorIdade(anos)
  return (
    <ToolLayout
      title="Tubo endotraqueal pediátrico"
      description="Diâmetro interno pela idade, com a fórmula do manual do HCFMUSP: (idade/4) + 4."
      ficha={fichaViaAereaPediatrica}
    >
      <Card>
        <CardContent className="pt-6">
          <NumberField id="va-idade" label="Idade em anos completos" unit="anos" value={anos} onChange={setAnos} min={0} step={1} />
        </CardContent>
      </Card>
      {anos > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tubo endotraqueal</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {t ? (
              <p><strong>{n(t.tuboMm)} mm</strong> <span className="text-muted-foreground">(fórmula: {n(t.calculadoMm)} mm, arredondado ao meio milímetro)</span></p>
            ) : (
              <p className="text-muted-foreground">A fórmula vale de 1 a 13 anos. Fora disso, o livro não traz referência nesta tela.</p>
            )}
            <p className="mt-2 text-muted-foreground">Equipamento por peso e carga de desfibrilação pediátrica não estão no livro e não aparecem aqui.</p>
          </CardContent>
        </Card>
      )}
    </ToolLayout>
  )
}
