import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function MobilidadeFuncional() {
  return (
    <ToolLayout
      title="Mobilidade Funcional"
      description="Níveis de mobilidade e critérios de progressão no paciente crítico."
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Níveis de mobilidade (PMC — Perme ICU Mobility Scale)</CardTitle>
          <CardDescription>Progredir conforme estabilidade clínica.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {[
            ['0 — Nenhuma', 'Paciente não realiza movimentos. Reposicionamento no leito pela equipe.'],
            ['1 — Exercícios no leito (passivos)', 'Mobilização passiva ou autoassistida de MMSS/MMII.'],
            ['2 — Exercícios ativos no leito', 'Exercícios ativos sem sair do leito.'],
            ['3 — Sentado no leito', 'Sentar na beira do leito com auxílio.'],
            ['4 — Sentado na poltrona', 'Transferência para poltrona com ajuda de 2 pessoas.'],
            ['5 — Em pé com auxílio', 'Ortostatismo com auxílio de 2 pessoas.'],
            ['6 — Deambulação com auxílio', 'Caminhar com ajuda de 1–2 pessoas.'],
            ['7 — Deambulação independente', 'Caminhar sem auxílio.'],
          ].map(([nivel, texto]) => (
            <div key={nivel} className="rounded-lg border px-3 py-2">
              <Badge variant="secondary" className="mb-1">{nivel}</Badge>
              <p className="text-sm text-muted-foreground">{texto}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Critérios de segurança para mobilização</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
          <p>• Sem sedação profunda (RASS ≥ -2).</p>
          <p>• PAS ≥ 90 mmHg sem vasopressores em dose crescente.</p>
          <p>• Sem arritmias instáveis · Sem disritmia nova.</p>
          <p>• SpO₂ &gt; 88–90% com FiO₂ &lt; 0,6.</p>
          <p>• Interromper se dispneia, dessaturação, FC/PAS anormal ou desconforto.</p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
