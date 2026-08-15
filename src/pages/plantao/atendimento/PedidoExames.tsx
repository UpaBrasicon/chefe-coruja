import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent } from '@/components/ui/card'

export function PedidoExames() {
  return (
    <ToolLayout
      title="Pedido de Exames"
      description="Solicitação de exames laboratoriais e de imagem."
    >
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <p>
            Em construção. Seguirá o <strong>modelo de página</strong> que você vai enviar. Aqui
            entrará: paciente, exames solicitados, justificativa clínica e assinatura.
          </p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
