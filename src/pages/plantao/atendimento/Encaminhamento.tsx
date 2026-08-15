import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent } from '@/components/ui/card'

export function Encaminhamento() {
  return (
    <ToolLayout
      title="Encaminhamento"
      description="Encaminhamento do paciente para especialidade/referência."
    >
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <p>
            Em construção. Seguirá o <strong>modelo de página</strong> que você vai enviar. Aqui
            entrará: paciente, especialidade de destino, hipótese diagnóstica e observações.
          </p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
