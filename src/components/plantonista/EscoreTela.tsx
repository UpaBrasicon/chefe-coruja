import { useState } from 'react'

import { temReferenciaPediatrica } from '@/clinico/ficha'
import { numero, type Escore, type Respostas } from '@/clinico/escore'
import { SemReferenciaPediatrica } from '@/components/plantonista/SemReferenciaPediatrica'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const botao = (ativo: boolean) =>
  cn('rounded-lg border px-3 py-2 text-left text-sm transition-colors', ativo ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')

/** Tela única dos escores do pacote src/clinico. */
export function EscoreTela({ escore }: { escore: Escore }) {
  const [r, setR] = useState<Respostas>({})
  const [paciente, setPaciente] = useState<'adulto' | 'crianca'>(escore.ficha.publico === 'pediatrico' ? 'crianca' : 'adulto')
  const semRefPedi = paciente === 'crianca' && !temReferenciaPediatrica(escore.ficha)
  const semRefAdulto = paciente === 'adulto' && escore.ficha.publico === 'pediatrico'
  const res = semRefPedi || semRefAdulto ? null : escore.calcular(r)

  return (
    <ToolLayout title={escore.ficha.titulo} description={escore.descricao} ficha={escore.ficha}>
      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-2">
            <Label className="text-sm font-semibold">Paciente</Label>
            <div className="flex flex-wrap gap-2">
              {([['adulto', 'Adulto (14 anos ou mais)'], ['crianca', 'Criança (menos de 14 anos)']] as const).map(([v, rotulo]) => (
                <button key={v} type="button" aria-pressed={paciente === v} onClick={() => setPaciente(v)} className={botao(paciente === v)}>
                  {rotulo}
                </button>
              ))}
            </div>
          </div>

          {escore.itens.map((item) =>
            item.tipo === 'numero' ? (
              <div key={item.id} className="flex flex-col gap-1.5">
                <Label htmlFor={`esc-${item.id}`} className="text-sm font-semibold">
                  {item.rotulo}
                  {item.unidade && <span className="ml-1 font-normal text-tinta-sussurro">({item.unidade})</span>}
                  {item.opcional && <span className="ml-1 font-normal text-tinta-sussurro">— opcional</span>}
                </Label>
                {item.ajuda && <p className="text-apoio text-tinta-sussurro">{item.ajuda}</p>}
                <Input
                  id={`esc-${item.id}`}
                  type="number"
                  inputMode="decimal"
                  className="max-w-48"
                  min={item.min}
                  max={item.max}
                  step={item.passo ?? 'any'}
                  value={typeof r[item.id] === 'number' ? String(r[item.id]) : ''}
                  onChange={(e) => {
                    const v = e.target.value.replace(',', '.')
                    setR((x) => ({ ...x, [item.id]: v === '' ? undefined : Number(v) }))
                  }}
                />
                {typeof r[item.id] === 'number' && numero(escore, r, item.id) === undefined && (
                  <p className="text-apoio text-critico">Valor fora da faixa aceita ({item.min ?? '—'} a {item.max ?? '—'}).</p>
                )}
              </div>
            ) : item.tipo === 'escolha' ? (
              <div key={item.id} className="flex flex-col gap-2">
                <Label className="text-sm font-semibold">{item.rotulo}</Label>
                {item.ajuda && <p className="text-apoio text-tinta-sussurro">{item.ajuda}</p>}
                <div className="grid gap-2 sm:grid-cols-2">
                  {item.opcoes.map((o, idx) => (
                    <button
                      key={o.rotulo}
                      type="button"
                      aria-pressed={r[item.id] === idx}
                      onClick={() => setR((x) => ({ ...x, [item.id]: idx }))}
                      className={botao(r[item.id] === idx)}
                    >
                      {o.rotulo}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={r[item.id] === true}
                  onChange={(e) => setR((x) => ({ ...x, [item.id]: e.target.checked }))}
                />
                <span className="flex-1">{item.rotulo}</span>
                <span className="tabular-nums text-tinta-sussurro">{item.pontos > 0 ? `+${item.pontos}` : item.pontos}</span>
              </label>
            ),
          )}
        </CardContent>
      </Card>

      {semRefPedi && <SemReferenciaPediatrica detalhe="Este escore foi validado em adultos." />}
      {semRefAdulto && <p className="text-corpo text-tinta-sussurro">Escore pediátrico: não se aplica ao adulto.</p>}

      {!semRefPedi && !semRefAdulto && !res && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Responda todos os itens obrigatórios para ver o resultado.</CardContent>
        </Card>
      )}

      {res && (
        <Card className={res.estado === 2 ? 'border-critico/30' : res.estado === 1 ? 'border-atencao/30' : 'border-primary'}>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-3 text-base">
              {res.rotulo}
              <Badge className="text-lg">{res.valor}</Badge>
              {res.unidade && <span className="text-sm font-normal text-muted-foreground">{res.unidade}</span>}
            </CardTitle>
            <CardDescription>{res.nota}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
              {res.derivados.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {res.alerta && <p className={res.estado === 2 ? 'text-critico' : 'text-atencao'}>{res.alerta}</p>}
            {res.cuidados.length > 0 && (
              <ul className="list-disc pl-5 text-muted-foreground">
                {res.cuidados.map((c) => <li key={c}>{c}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </ToolLayout>
  )
}
