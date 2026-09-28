import { useState } from 'react'

import {
  ACHADOS_IC, ERRATA_DISPNEIA, INTERNACAO_DISPNEIA, SINAIS_GRAVIDADE_QUALITATIVOS, fichaDispneiaAdulto, lerDispneia, type Achado,
} from '@/clinico/adulto/dispneia'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco } from './LoteAPecas'
import { informado } from './loteAFormato'

function Lista({ itens, vazio }: { itens: Achado[]; vazio: string }) {
  if (!itens.length) return <p className="text-muted-foreground">{vazio}</p>
  return <ul className="list-disc pl-5">{itens.map((a) => <li key={a.texto}>{a.texto} <span className="text-muted-foreground">({a.pagina})</span></li>)}</ul>
}

/** Dispneia no adulto — cortes numéricos dos caps. 26 e 1 do manual do HCFMUSP. */
export function DispneiaAdulto() {
  const [fr, setFr] = useState(0)
  const [sat, setSat] = useState(0)
  const [pao2, setPao2] = useState(0)
  const [fc, setFc] = useState(0)
  const [tec, setTec] = useState(0)
  const [ict, setIct] = useState(0)
  const [bnp, setBnp] = useState(0)
  const [idade, setIdade] = useState(0)
  const [macos, setMacos] = useState(0)

  const r = lerDispneia({ fr: informado(fr), sat: informado(sat), pao2: informado(pao2), fc: informado(fc), tec: informado(tec), ict: informado(ict), bnp: informado(bnp), idade: informado(idade), macosAno: informado(macos) })

  return (
    <ToolLayout
      title="Dispneia — abordagem inicial (adulto)"
      description="Compara sinais vitais, radiografia, BNP e história com os cortes dos caps. 26 e 1 do manual do HCFMUSP e mostra o que o livro diz de cada um. Não faz diagnóstico. Adulto (14 anos ou mais)."
      ficha={fichaDispneiaAdulto}
    >
      <Bloco titulo="Sinais vitais">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="dp2-fr" label="FR" unit="irpm" value={fr} onChange={setFr} step={1} />
          <NumberField id="dp2-sat" label="SatO2" unit="%" value={sat} onChange={setSat} step={1} />
          <NumberField id="dp2-pao2" label="PaO2" unit="mmHg" value={pao2} onChange={setPao2} step={1} />
          <NumberField id="dp2-fc" label="FC" unit="bpm" value={fc} onChange={setFc} step={1} />
          <NumberField id="dp2-tec" label="Enchimento capilar" unit="s" value={tec} onChange={setTec} step={0.5} />
        </div>
      </Bloco>

      <Bloco titulo="Sinais de gravidade (cap. 26, p. 360)">
        <Lista itens={r.gravidade} vazio="Nenhum dos cortes numéricos (FR > 30, saturação < 90%) atingido." />
        <p className="font-medium">Também citados na p. 360</p>
        <ul className="list-disc pl-5">{SINAIS_GRAVIDADE_QUALITATIVOS.map((s) => <li key={s}>{s}</li>)}</ul>
      </Bloco>

      <Bloco titulo="ABCDE — respiração e circulação (cap. 1, p. 40–41)">
        <Lista itens={r.abcde} vazio="Nenhum corte do ABCDE atingido nos valores informados." />
      </Bloco>

      <Bloco titulo="Oxigênio (cap. 26, p. 368)">
        <Lista itens={r.oxigenio} vazio="Sem PaO2 < 55 mmHg nem SaO2 < 90% nos valores informados." />
        <p className="text-muted-foreground">p. 368: com hipercapnia significativa na gasometria, o livro direciona para VNI ou ventilação invasiva, se necessário.</p>
      </Bloco>

      <Bloco titulo="Radiografia, BNP e história (cap. 26, p. 361–364)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="dp2-ict" label="Índice cardiotorácico" value={ict} onChange={setIct} step={0.01} />
          <NumberField id="dp2-bnp" label="BNP" unit="pg/mL" value={bnp} onChange={setBnp} step={10} />
          <NumberField id="dp2-idade" label="Idade" unit="anos" value={idade} onChange={setIdade} step={1} />
          <NumberField id="dp2-macos" label="Tabagismo" unit="maços-ano" value={macos} onChange={setMacos} step={1} />
        </div>
        <Lista itens={[...r.exames, ...r.historia]} vazio="Informe ICT, BNP, idade ou carga tabágica." />
        <p className="text-muted-foreground">p. 361: embolia pulmonar deve ser suspeitada com história recente (&lt; 4 semanas) de cirurgia, estrógeno ou outros fatores de TVP. O escore de Wells tem ferramenta própria no pacote.</p>
        <p className="font-medium">Achados sugestivos de disfunção cardíaca (Tabela 3, p. 363)</p>
        <ul className="list-disc pl-5">{ACHADOS_IC.map((a) => <li key={a}>{a}</li>)}</ul>
      </Bloco>

      <Bloco titulo="Internação (p. 368)">
        <ul className="list-disc pl-5">{INTERNACAO_DISPNEIA.map((i) => <li key={i}>{i}</li>)}</ul>
      </Bloco>

      <Bloco titulo="Errata e divergências do livro">
        <ul className="list-disc pl-5 text-muted-foreground">{ERRATA_DISPNEIA.map((e) => <li key={e}>{e}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
