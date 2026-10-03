import { useState } from 'react'

import {
  ANEXO2_SEM_REGISTRO, DIVERGENCIA_MANUAL_HC, NEONATO_FORA, avaliarHiperpotassemia, avaliarHiperpotassemiaPed, fichaHiperpotassemia, neonatoPelaIdade,
  type Ecg, type ResultadoHiperKPed,
} from '@/clinico/hiperpotassemia'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { usePacienteCentral } from '@/lib/pacienteCentral'
import { cn } from '@/lib/utils'
import { faixaBr } from '@/pages/plantonista/pediatria/formatoIcr'
import { LinhaLivro, Nota } from '@/pages/plantonista/pediatria/PecasIcr'

function Escolha<T extends string>({ titulo, opcoes, valor, set }: { titulo: string; opcoes: [T, string][]; valor: T | null; set: (v: T) => void }) {
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
            className={cn('rounded-lg border px-3 py-2 text-sm', valor === v ? 'border-acao bg-acao/5 ring-1 ring-acao' : 'hover:bg-trilha/50')}
          >
            {rotulo}
          </button>
        ))}
      </div>
    </div>
  )
}

type Sim = 'sim' | 'nao'
const simNao = (b: boolean | null): Sim | null => (b === null ? null : b ? 'sim' : 'nao')

/** Criança: só o livro do ICr-HCFMUSP (cap. 54), com as divergências do mesmo livro. */
function ResultadoCrianca({ r }: { r: ResultadoHiperKPed }) {
  return (
    <>
      <Card className={r.risco ? 'border-critico/30' : r.acimaDoLimiar ? 'border-atencao/30' : 'border-acao'}>
        <CardHeader>
          <CardTitle className="text-base">Na criança — livro do ICr-HCFMUSP</CardTitle>
          <CardDescription>{r.leitura}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-sm">
          {r.alertas.map((a) => (
            <p key={a} className={a.startsWith('Em recém-nascidos') ? 'text-tinta-sussurro' : 'text-critico'}>{a}</p>
          ))}
        </CardContent>
      </Card>

      {r.neonato ? (
        <Card className="border-atencao/30">
          <CardHeader>
            <CardTitle className="text-base">Recém-nascido: sem referência pediátrica de dose</CardTitle>
            <CardDescription>{NEONATO_FORA}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tratamento da hipercalemia (cap. 54, p. 549; Tabela 7)</CardTitle>
            <CardDescription>
              Doses por peso como o livro traz, com página; a indicação e a escolha são do profissional.
              {r.semPeso && ' Informe o peso para ver a dose calculada.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {r.doses.map((d) => (
              <div key={d.id} className="flex flex-col gap-1">
                <LinhaLivro
                  nome={d.nome}
                  texto={d.texto}
                  pagina={d.pagina}
                  errata={d.errata}
                  nota={d.nota}
                  conta={
                    d.faixa && (
                      <>
                        <strong>{faixaBr(d.faixa, 2)} {d.unidade}</strong>
                        {d.noMaximo && <span className="text-atencao"> (máximo)</span>}
                      </>
                    )
                  }
                />
                {d.divergencias.length > 0 && (
                  <details className="ml-3 text-xs text-tinta-sussurro">
                    <summary className="cursor-pointer">Divergência em outras passagens do livro ({d.divergencias.length})</summary>
                    <ul className="mt-1 list-disc pl-5">
                      {d.divergencias.map((x) => <li key={x}>{x}</li>)}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sem referência pediátrica de dose</CardTitle>
          <CardDescription>O que a conduta do adulto tem e o capítulo do livro do ICr não quantifica para a criança. Nada é convertido do adulto.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {r.semReferencia.map((s) => (
            <div key={s.item} className="rounded-lg border px-3 py-2">
              <span className="font-medium">{s.item}: </span>
              <span className="text-tinta-sussurro">{s.texto}</span>
            </div>
          ))}
          <Nota>{ANEXO2_SEM_REGISTRO}</Nota>
        </CardContent>
      </Card>
    </>
  )
}

export function Hiperpotassemia() {
  const central = usePacienteCentral()
  const [pacienteLocal, setPacienteLocal] = useState<'adulto' | 'crianca'>('adulto')
  // O modo da Central manda; o seletor local só aparece sem paciente na Central.
  const paciente = central.modo ? (central.modo === 'pediatrico' ? 'crianca' : 'adulto') : pacienteLocal
  const [potassio, setPotassio] = useState(0)
  const [peso, setPeso] = useState(() => central.leitura.pesoKg ?? 0)
  const [ecg, setEcg] = useState<Ecg>('nao_feito')
  const [diurese, setDiurese] = useState<'preservada' | 'comprometida'>('preservada')
  const [acidose, setAcidose] = useState<'ausente' | 'presente'>('ausente')
  const [rn, setRn] = useState<Sim | null>(() =>
    central.modo === 'pediatrico' ? simNao(neonatoPelaIdade(central.leitura.idade, central.unidadeIdade)) : null,
  )

  const crianca = paciente === 'crianca'
  const r = potassio > 0 && !crianca
    ? avaliarHiperpotassemia({ potassio, ecg, diureseComprometida: diurese === 'comprometida', acidose: acidose === 'presente' })
    : null
  const rPed = potassio > 0 && crianca
    ? avaliarHiperpotassemiaPed({ potassio, ecg, neonato: rn === null ? null : rn === 'sim', pesoKg: peso > 0 ? peso : undefined })
    : null

  return (
    <ToolLayout
      title="Hiperpotassemia — conduta por nível e por ECG"
      description="Adulto: gravidade, indicação de cálcio e a conduta em três tempos. Criança: limiares e doses do livro do ICr-HCFMUSP, com página."
      ficha={fichaHiperpotassemia}
    >
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          {central.modo ? (
            <p className="text-sm text-tinta-sussurro">
              Paciente da Central: <strong>{crianca ? 'criança (menos de 14 anos)' : 'adulto (14 anos ou mais)'}</strong>. Para trocar, troque o paciente na Central.
            </p>
          ) : (
            <Escolha titulo="Paciente" opcoes={[['adulto', 'Adulto (14 anos ou mais)'], ['crianca', 'Criança (menos de 14 anos)']]} valor={pacienteLocal} set={setPacienteLocal} />
          )}
          {crianca && (
            <Escolha titulo="Recém-nascido (menos de 28 dias de vida)?" opcoes={[['nao', 'Não, 28 dias ou mais'], ['sim', 'Sim, recém-nascido']]} valor={rn} set={setRn} />
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <NumberField id="hk-k" label="Potássio sérico" unit="mEq/L" value={potassio} onChange={setPotassio} step={0.1} />
            <NumberField id="hk-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} />
          </div>
          <Escolha titulo="ECG" opcoes={[['nao_feito', 'Não feito'], ['sem_alteracao', 'Sem alteração'], ['alterado', 'Alterado']]} valor={ecg} set={setEcg} />
          {!crianca && (
            <>
              <Escolha titulo="Diurese" opcoes={[['preservada', 'Preservada'], ['comprometida', 'Anúrico ou oligúrico grave']]} valor={diurese} set={setDiurese} />
              <Escolha titulo="Acidose metabólica" opcoes={[['ausente', 'Ausente'], ['presente', 'Presente']]} valor={acidose} set={setAcidose} />
            </>
          )}
        </CardContent>
      </Card>

      {!r && !rPed && (
        <Card>
          <CardContent className="pt-6 text-sm text-tinta-sussurro">
            Sem o potássio sérico não há faixa a classificar. O ECG e os sintomas mandam na urgência, mas o número define a faixa.
          </CardContent>
        </Card>
      )}

      {rPed && <ResultadoCrianca r={rPed} />}

      {r && (
        <>
          <Card className={r.gravidade === 2 ? 'border-critico/30' : r.gravidade === 1 ? 'border-atencao/30' : 'border-acao'}>
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
                    <p className="mt-1 text-tinta-sussurro">{l.texto}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {!crianca && (
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
                <span className="text-tinta-sussurro">{l.texto} ({l.pagina})</span>
              </div>
            ))}
            <ul className="list-disc pl-5 text-tinta-sussurro">
              {DIVERGENCIA_MANUAL_HC.diferencas.map((d) => <li key={d}>{d}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}
    </ToolLayout>
  )
}
