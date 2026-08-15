import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent } from '@/components/ui/card'

export function ReceituarioMedico() {
  return (
    <ToolLayout
      title="Receituário Médico"
      description="Prescrição e receita digital (assinatura ICP-Brasil)."
    >
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          <p>
            Em construção. O layout seguirá o <strong>modelo de página</strong> que você vai enviar
            (o mesmo usado na Dengue). Aqui entrará: paciente, itens do medicamento, posologia,
            tipo de receituário (branca/azul/amarela) e o fluxo de assinatura.
          </p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
