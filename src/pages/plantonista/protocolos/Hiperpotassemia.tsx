import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function Hiperpotassemia() {
  return (
    <ToolLayout
      title="Manejo da Hipercalemia (Hiperpotassemia)"
      description="Medidas para hiperpotassemia aguda."
    >
      <Card>
        <CardContent className="flex flex-col gap-2 pt-6">
          {[
            { titulo: 'Glicoinsulinoterapia', texto: '1 U de insulina para cada 5 g de glicose. Insulina Regular (100 U/mL): 10 U + 100 mL SG 50% EV, BIC 100 mL/h. Checar glicemia antes, durante e depois.' },
            { titulo: 'Diurético de alça', texto: 'Furosemida (Amp 20 mg/2 mL): 2 amp EV 4/4h.' },
            { titulo: 'Gluconato de cálcio', texto: 'Gluconato de Cálcio 10%: 1 amp EV — se onda T apiculada (estabilizador de membrana).' },
            { titulo: 'Agonista β₂-adrenérgico', texto: 'Nebulizar com Berotec® ou Salbutamol a cada 30/30 min.' },
            { titulo: 'Bicarbonato de sódio', texto: 'Em caso de acidose metabólica.' },
            { titulo: 'Resina de troca iônica', texto: 'Sorcal®: 1 envelope + 100 mL água VO 8/8h.' },
            { titulo: 'Hemodiálise', texto: 'Avaliar necessidade (refratariedade, insuficiência renal, gravidade).' },
          ].map((t) => (
            <div key={t.titulo} className="rounded-lg border px-3 py-2 text-sm">
              <Badge variant="secondary" className="mb-1">{t.titulo}</Badge>
              <p className="text-muted-foreground">{t.texto}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
