import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function VideoDengue() {
  return (
    <ToolLayout
      title="Dengue — Vídeo Dr. Daniel Wagner"
      description="Vídeo do infectologista Dr. Daniel Wagner sobre manejo da dengue."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como assistir</CardTitle>
          <CardDescription>
            No site de referência, o vídeo está disponível na página da calculadora de Dengue. Aqui
            você encontra o passo a passo do conteúdo apresentado:
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>1. Classificação clínica em grupos A–D.</p>
          <p>2. Importância da reidratação precoce e da reavaliação seriada.</p>
          <p>3. Critérios de internação e de acompanhamento em UTI.</p>
          <p>4. Reconhecimento precoce dos sinais de alarme e choque.</p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
