import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function Abstinencia() {
  return (
    <ToolLayout
      title="Manejo da Abstinência"
      description="Abstinência de sedativos/opioides no paciente crítico."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fatores de risco</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>• Infusão contínua de opioide ou benzodiazepínico por &gt; 5 dias, com interrupção abrupta.</p>
          <p>• Dose acumulada de fentanil &gt; 1,5 mg/kg ou de midazolam &gt; 60 mg/kg.</p>
          <p>• Fentanil &gt; 5 mcg/kg/h.</p>
          <p>• Uso concomitante de bloqueadores neuromusculares.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tratamento</CardTitle>
          <CardDescription>Redução gradual do EV + substituição por VO/SC.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="secondary" className="mb-1">Desmame</Badge>
            <p>Reduzir 25% da analgesia e sedação a cada 6 horas. Despertar diário.</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="secondary" className="mb-1">Benzodiazepínicos</Badge>
            <p>Lorazepam 0,05–0,1 mg/kg/dose VO 6/6h (até 4/4h) · Diazepam 0,12–0,8 mg/kg/dia 6–8h.</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="secondary" className="mb-1">Opioides</Badge>
            <p>Metadona 0,05–0,2 mg/kg/dose VO 6/6h, ou dose diária de fentanil (mg) × 2,5 dividida em 4 tomadas.</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="secondary" className="mb-1">Clonidina</Badge>
            <p>1–4 mcg/kg/dose VO 8/8h. Útil com HAS e taquicardia acentuada.</p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <Badge variant="secondary" className="mb-1">Cetamina / Dexmedetomidina</Badge>
            <p>Cetamina 5–20 mcg/kg/min · Dexmedetomidina 0,1–1,4 mcg/kg/h EV — se sintomas persistentes.</p>
          </div>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
