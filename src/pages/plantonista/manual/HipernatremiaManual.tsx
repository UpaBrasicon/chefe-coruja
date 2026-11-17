import { useState } from 'react'

import {
  ERRATA_ADROGUE, LIMITES_HIPERNATREMIA, NOTA_HIPERNATREMIA_VELOCIDADE, SOLUCOES_HIPERNATREMIA, aguaCorporalTotal, deficitAguaLivre, fatorAguaCorporal, fichaHipernatremia,
  litrosParaDeficit, litrosParaReducao, sodioCorrigido, variacaoPorLitro, type Sexo,
} from '@/clinico/adulto/sodio'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'
import { numero } from '@/lib/formato'

const br = (x: number | null | undefined, casas = 1) => (x === null || x === undefined ? '—' : numero(Math.round(x * 10 ** casas) / 10 ** casas))

function Opcoes<T extends string | boolean>({ label, valor, opcoes, onChange }: { label: string; valor: T; opcoes: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {opcoes.map(([v, t]) => (
          <Button key={t} type="button" size="sm" variant={valor === v ? 'default' : 'outline'} onClick={() => onChange(v)}>{t}</Button>
        ))}
      </div>
    </div>
  )
}

/** Hipernatremia no adulto: déficit de água livre e Adrogué-Madias — cap. 66 do manual do HCFMUSP. */
export function HipernatremiaManual() {
  const [peso, setPeso] = useState(0)
  const [na, setNa] = useState(0)
  const [glic, setGlic] = useState(0)
  const [sexo, setSexo] = useState<Sexo>('masculino')
  const [idoso, setIdoso] = useState(false)
  const [aguda, setAguda] = useState(false)
  const [reducao, setReducao] = useState(8)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaHipernatremia.id)

  const naRef = glic > 0 ? sodioCorrigido(na, glic) : na > 0 ? na : null
  const act = aguaCorporalTotal(peso, sexo, idoso)
  const deficit = act !== null && naRef !== null ? deficitAguaLivre(naRef, act) : null
  const horas = aguda ? LIMITES_HIPERNATREMIA.agudaHoras[1] : 24
  const limite = aguda ? LIMITES_HIPERNATREMIA.agudaPorHora * LIMITES_HIPERNATREMIA.agudaHoras[1] : LIMITES_HIPERNATREMIA.cronicaMax24h[1]
  const alertaLimite = reducao > limite ? `Acima do limite do manual (${aguda ? '1 mEq/L/h por 6–8 h' : '8–10 mEq/L em 24 h'}).` : null
  // Uma linha por solução (p. 898), a mesma conta da tela e do "Copiar".
  const porSolucao = act === null || naRef === null ? null : SOLUCOES_HIPERNATREMIA.map((s) => {
    const porL = variacaoPorLitro(naRef, s.naMeqL, act)
    return { s, porL, litros: porL === null ? null : litrosParaReducao(reducao, porL), litrosDef: deficit === null ? null : litrosParaDeficit(deficit, s) }
  })
  const textoDeficit = deficit === null ? '—' : deficit <= 0 ? 'sem déficit (Na ≤ 140)' : `${br(deficit)} L`
  const textoPorL = (porL: number | null) => (porL === null ? '—' : `${porL > 0 ? '−' : '+'}${br(Math.abs(porL))} mEq/L`)

  // Texto do "Copiar" (C4 = A): dados, ACT, déficit e a conta de cada solução.
  const copia = deficit !== null && porSolucao
    ? textoCopia({
        ferramenta: 'Hipernatremia — água livre e Adrogué-Madias (adulto)',
        dados: [
          ['Peso', `${numeroBr(peso)} kg`],
          ['Sódio medido', `${numeroBr(na)} mEq/L`],
          ['Glicemia', glic > 0 ? `${numeroBr(glic)} mg/dL` : ''],
          ['Sexo', sexo === 'masculino' ? 'masculino' : 'feminino'],
          ['Idoso', idoso ? 'sim' : 'não'],
          ['Instalação', aguda ? 'aguda (< 48 h)' : 'crônica (> 48 h) ou desconhecida'],
          ['Redução desejada', `${numeroBr(reducao)} mEq/L em ${horas} h`],
        ],
        resultado: [
          ...(glic > 0 ? [`Sódio corrigido pela glicemia (p. 896): ${br(naRef)} mEq/L`] : []),
          `ACT: ${br(act)} L (fator ${numero(fatorAguaCorporal(sexo, idoso))})`,
          `Déficit de água livre: ${textoDeficit} (p. 896–897)`,
          ...(naRef !== null && naRef <= LIMITES_HIPERNATREMIA.definicao ? ['Hipernatremia é Na > 145 mEq/L (p. 892).'] : []),
          ...(alertaLimite ? [alertaLimite] : []),
          'Por solução (Adrogué-Madias, p. 898):',
          ...porSolucao.map(({ s, porL, litros, litrosDef }) =>
            `- ${s.nome} (Na ${s.naMeqL} mEq/L): 1 L muda o Na em ${textoPorL(porL)}${litros !== null ? `; redução de ${br(reducao)} → ${br(litros, 2)} L ≈ ${br((litros * 1000) / horas, 0)} mL/h em ${horas} h` : ''}${litrosDef !== null ? `; volume que contém o déficit de água livre: ${br(litrosDef, 2)} L` : ''}`),
        ],
        fonte: textoFontes(fichaHipernatremia),
        versao: fichaHipernatremia.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Hipernatremia — água livre e Adrogué-Madias"
      description="Água corporal total, déficit de água livre, variação do sódio por litro de cada solução e volume para a redução escolhida, com os limites de velocidade do manual do HCFMUSP. Adulto (14 anos ou mais)."
      ficha={fichaHipernatremia}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 md:grid-cols-3">
          <NumberField id="hiperm-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} step={0.1} />
          <NumberField id="hiperm-na" label="Sódio medido" unit="mEq/L" value={na} onChange={setNa} />
          <NumberField id="hiperm-glic" label="Glicemia (opcional)" unit="mg/dL" value={glic} onChange={setGlic} />
          <Opcoes label="Sexo" valor={sexo} opcoes={[['masculino', 'Masculino'], ['feminino', 'Feminino']]} onChange={setSexo} />
          <Opcoes label="Idoso (o manual não define a idade)" valor={idoso} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setIdoso} />
          <Opcoes label="Instalação" valor={aguda} opcoes={[[false, 'Crônica (> 48 h) ou desconhecida'], [true, 'Aguda (< 48 h)']]} onChange={setAguda} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Água corporal e déficit (p. 896–897)</CardTitle>
          <CardDescription>ACT = peso × 0,6 (♂) ou 0,5 (♀); idoso 0,5 (♂) ou 0,45 (♀). Déficit (L) = [(Na − 140)/140] × ACT. No hipovolêmico, o manual traz expandir com SF até sinais vitais estáveis e só então calcular o déficit.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-1 text-apoio tabular-nums">
          {glic > 0 && <p>Sódio corrigido pela glicemia (p. 896): <strong>{br(naRef)} mEq/L</strong></p>}
          <p>ACT: <strong>{br(act)} L</strong> (fator {numero(fatorAguaCorporal(sexo, idoso))})</p>
          <p>Déficit de água livre: <strong>{textoDeficit}</strong></p>
          {naRef !== null && naRef <= LIMITES_HIPERNATREMIA.definicao && <p className="text-tinta-sussurro">Hipernatremia é Na &gt; 145 mEq/L (p. 892).</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Por solução (p. 898)</CardTitle>
          <CardDescription>
            Adrogué-Madias: variação por litro = (Na − Na da solução)/(ACT + 1) — estimativa; o manual traz dosar o sódio a cada 4–6 h. Limite do manual: crônica até 8–10 mEq/L nas primeiras 24 h; aguda 1 mEq/L/h nas primeiras 6–8 h.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-apoio">
          <NumberField id="hiperm-red" label={`Redução desejada em ${horas} h`} unit="mEq/L" value={reducao} onChange={setReducao} step={0.5} />
          {alertaLimite && <p className="text-atencao">{alertaLimite}</p>}
          <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">{NOTA_HIPERNATREMIA_VELOCIDADE}</p>
          {!porSolucao ? <p className="text-tinta-sussurro">Informe peso e sódio.</p> : (
            <div className="flex flex-col gap-2">
              {porSolucao.map(({ s, porL, litros, litrosDef }) => {
                return (
                  <div key={s.id} className="rounded-controle border px-3 py-2 tabular-nums">
                    <div className="font-medium">{s.nome} <span className="text-rotulo font-normal text-tinta-sussurro">(Na {s.naMeqL} mEq/L{s.aguaLivreLporL !== null && `; ${numero(s.aguaLivreLporL)} L de água livre por litro`} — {s.pagina})</span></div>
                    <div>1 L muda o Na em <strong>{textoPorL(porL)}</strong>
                      {litros !== null && <> · redução de {br(reducao)} → <strong>{br(litros, 2)} L</strong> ≈ {br((litros * 1000) / horas, 0)} mL/h em {horas} h</>}
                    </div>
                    {litrosDef !== null && <div className="text-tinta-sussurro">Volume que contém o déficit de água livre: {br(litrosDef, 2)} L</div>}
                  </div>
                )
              })}
            </div>
          )}
          <p className="text-rotulo text-tinta-sussurro">O cálculo de litros é a variação por litro do manual estendida linearmente; perdas contínuas não entram na conta.</p>
        </CardContent>
      </Card>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={deficit === null}
        armadilhas={[`Adrogué-Madias — errata do livro: ${ERRATA_ADROGUE}`, ...(guia?.armadilhas ?? [])]}
        ficha={fichaHipernatremia}
        guia={guia}
      />
      <ResumoFlutuante
        principal={deficit === null ? 'Informe peso e sódio' : deficit <= 0 ? 'Sem déficit de água livre (Na ≤ 140)' : `Déficit de água livre ${br(deficit)} L`}
        detalhe={alertaLimite ?? (deficit !== null ? `ACT ${br(act)} L · Na ${glic > 0 ? 'corrigido ' : ''}${br(naRef)} mEq/L · litros por solução nas linhas acima` : undefined)}
        tom={alertaLimite ? 'atencao' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
