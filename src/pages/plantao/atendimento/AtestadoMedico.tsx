import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent } from '@/components/ui/card'

export function AtestadoMedico() {
  return (
    <ToolLayout
      title="Atestado Médico"
      description="Emissão de atestado médico."
    >
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <p>
            Em construção. Seguirá o <strong>modelo de página</strong> que você vai enviar. Aqui
            entrará: dados do paciente, tipo de atestado (comparecimento/dias), período e assinatura
            digital.
          </p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
