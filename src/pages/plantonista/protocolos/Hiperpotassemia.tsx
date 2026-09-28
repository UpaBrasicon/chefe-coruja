import { useState } from 'react'

import { DIVERGENCIA_MANUAL_HC, avaliarHiperpotassemia, fichaHiperpotassemia, type Ecg } from '@/clinico/hiperpotassemia'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

function Escolha<T extends string>({ titulo, opcoes, valor, set }: { titulo: string; opcoes: [T, string][]; valor: T; set: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-sm font-semibold">{titulo}</Label>
      <div className="flex flex-wrap gap-2">
        {opcoes.map(([v, rotulo]) => (
          <button
            key={v}
            type="button"
            aria-pressed={valor === v}
            onClick={() => set(v)}
            className={cn('rounded-lg border px-3 py-2 text-sm', valor === v ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')}
          >
            {rotulo}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Hiperpotassemia() {
  const [paciente, setPaciente] = useState<'adulto' | 'crianca'>('adulto')
  const [potassio, setPotassio] = useState(0)
  const [peso, setPeso] = useState(0)
  const [ecg, setEcg] = useState<Ecg>('nao_feito')
  const [diurese, setDiurese] = useState<'preservada' | 'comprometida'>('preservada')
  const [acidose, setAcidose] = useState<'ausente' | 'presente'>('ausente')

  const r = potassio > 0
    ? avaliarHiperpotassemia({
        potassio,
        ecg,
        diureseComprometida: diurese === 'comprometida',
        acidose: acidose === 'presente',
        pediatrico: paciente === 'crianca',
        pesoKg: peso > 0 ? peso : undefined,
      })
    : null

  return (
    <ToolLayout
      title="Hiperpotassemia — conduta por nível e por ECG"
      description="Gravidade, indicação de cálcio e a conduta em três tempos: estabilizar a membrana, deslocar o potássio e removê-lo."
      ficha={fichaHiperpotassemia}
    >
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <Escolha titulo="Paciente" opcoes={[['adulto', 'Adulto (14 anos ou mais)'], ['crianca', 'Criança (menos de 14 anos)']]} valor={paciente} set={setPaciente} />
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField id="hk-k" label="Potássio sérico" unit="mEq/L" value={potassio} onChange={setPotassio} step={0.1} />
            <NumberField id="hk-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} />
          </div>
          <Escolha titulo="ECG" opcoes={[['nao_feito', 'Não feito'], ['sem_alteracao', 'Sem alteração'], ['alterado', 'Alterado']]} valor={ecg} set={setEcg} />
          <Escolha titulo="Diurese" opcoes={[['preservada', 'Preservada'], ['comprometida', 'Anúrico ou oligúrico grave']]} valor={diurese} set={setDiurese} />
          <Escolha titulo="Acidose metabólica" opcoes={[['ausente', 'Ausente'], ['presente', 'Presente']]} valor={acidose} set={setAcidose} />
        </CardContent>
      </Card>

      {!r && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Sem o potássio sérico não há faixa a classificar. O ECG e os sintomas mandam na urgência, mas o número define a faixa.
          </CardContent>
        </Card>
      )}

      {r && (
        <>
          <Card className={r.gravidade === 2 ? 'border-critico/30' : r.gravidade === 1 ? 'border-atencao/30' : 'border-primary'}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-3 text-base">
                Gravidade <Badge className="text-base">{r.faixa}</Badge>
              </CardTitle>
              <CardDescription>
                {r.calcio === 'indicado' ? 'Cálcio indicado' : r.calcio === 'indeterminado' ? 'Sem ECG, a indicação de cálcio não pode ser descartada' : 'Cálcio não indicado por estes dados'}
              </CardDescription>
            </CardHeader>
            {r.alertas.length > 0 && (
              <CardContent className="flex flex-col gap-1 text-sm text-critico">
                {r.alertas.map((a) => <p key={a}>{a}</p>)}
              </CardContent>
            )}
          </Card>

          {r.blocos.map((b) => (
            <Card key={b.titulo}>
              <CardHeader>
                <CardTitle className="text-base">{b.titulo}</CardTitle>
                <CardDescription>{b.sub}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {b.linhas.map((l) => (
                  <div key={l.item} className="rounded-lg border px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{l.item}</span>
                      {l.quando && <Badge variant="secondary">{l.quando}</Badge>}
                    </div>
                    <p className="mt-1 text-muted-foreground">{l.texto}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Divergência: {DIVERGENCIA_MANUAL_HC.fonte}</CardTitle>
          <CardDescription>
            Esta tela segue a referência mais recente (decisão do responsável técnico). O manual do HCFMUSP traz outra classificação e quantifica as doses.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>{DIVERGENCIA_MANUAL_HC.classificacao}</p>
          {DIVERGENCIA_MANUAL_HC.itens.map((l) => (
            <div key={l.item} className="rounded-lg border px-3 py-2">
              <span className="font-medium">{l.item}: </span>
              <span className="text-muted-foreground">{l.texto} ({l.pagina})</span>
            </div>
          ))}
          <ul className="list-disc pl-5 text-muted-foreground">
            {DIVERGENCIA_MANUAL_HC.diferencas.map((d) => <li key={d}>{d}</li>)}
          </ul>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}
