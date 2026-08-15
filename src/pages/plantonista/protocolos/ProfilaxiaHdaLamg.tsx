import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function ProfilaxiaHdaLamg() {
  return (
    <ToolLayout
      title="Profilaxia de Lesão Aguda de Mucosa Gástrica (LAMG)"
      description="Prevenção de hemorragia digestiva alta por estresse em pacientes críticos."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Objetivo</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Prevenir sangramentos agudos clinicamente significativos do trato esôfago-gastroduodenal em pacientes críticos com fatores de risco.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fatores de risco</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1.5 md:grid-cols-2">
          {[
            'Ventilação mecânica', 'Coagulopatia', 'Uso de antiagregantes plaquetários',
            'Uso de anticoagulantes', 'Uso de trombolíticos', 'Choque', 'Sepse grave',
            'Insuficiência hepática aguda', 'Insuficiência renal aguda', 'Politrauma',
            'Queimaduras (> 35% SCQ)', 'Transplantes de órgãos', 'Trauma craniano ou raquimedular',
            'História de sangramento digestivo ou úlcera péptica',
            'Cirurgia de grande porte e > 4h de duração',
          ].map((f) => (
            <div key={f} className="rounded-md border px-2.5 py-1.5 text-sm">{f}</div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Terapia farmacológica</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="secondary" className="mb-1">Terapia padrão</Badge>
            <p>Pantoprazol <strong>40 mg VO/EV 1×/dia</strong>.</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="secondary" className="mb-1">Complementar</Badge>
            <p>Iniciar precocemente nutrição enteral ou oral.</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="warning" className="mb-1">Descontinuação</Badge>
            <p>Sempre que possível, se os fatores de risco forem completamente revertidos.</p>
          </div>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
