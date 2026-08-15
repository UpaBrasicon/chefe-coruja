import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ManualDengue() {
  return (
    <ToolLayout
      title="Manual de Dengue — Síntese"
      description="Resumo prático do manejo da dengue, segundo o Ministério da Saúde."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avaliação inicial</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>• Triagem: febre + 2 ou mais sintomas (náusea, exantema, cefaleia, dor retro-orbital, mialgia, artralgia, petéquias).</p>
          <p>• Pesquisar sinais de alarme e sinais de choque.</p>
          <p>• Prova do laço (positiva se ≥ 10 petéquias em adultos / ≥ 8 em crianças).</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sinais de alarme</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>Dor abdominal intensa e contínua · vômitos persistentes · acúmulo de líquidos · hipotensão postural · hepatomegalia &gt; 2 cm · letargia/irritabilidade · aumento progressivo do Ht · sangramento de mucosa.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reavaliação e alta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <p>• Grupo A: alta com orientação de hidratação oral e retorno imediato se sinais de alarme.</p>
          <p>• Grupo C: reavaliar após 1h e Ht a cada 2h; internação mín. 48h após estabilização.</p>
          <p>• Grupo D: UTI; monitorar sinais de congestão durante a expansão.</p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}

