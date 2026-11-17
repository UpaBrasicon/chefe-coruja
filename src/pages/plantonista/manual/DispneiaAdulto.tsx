import { useState } from 'react'

import {
  ACHADOS_IC, ERRATA_DISPNEIA, INTERNACAO_DISPNEIA, SINAIS_GRAVIDADE_QUALITATIVOS, fichaDispneiaAdulto, lerDispneia, type Achado,
} from '@/clinico/adulto/dispneia'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { textoCopia } from '@/domain/copiaCalculo'

import { Bloco } from './LoteAPecas'
import { br, informado } from './loteAFormato'

const linhaAchado = (a: Achado) => `- ${a.texto} (${a.pagina})`

function Lista({ itens, vazio }: { itens: Achado[]; vazio: string }) {
  if (!itens.length) return <p className="text-tinta-sussurro">{vazio}</p>
  return <ul className="list-disc pl-5">{itens.map((a) => <li key={a.texto}>{a.texto} <span className="text-tinta-sussurro">({a.pagina})</span></li>)}</ul>
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
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaDispneiaAdulto.id)
  const vitais = fr > 0 || sat > 0 || pao2 > 0 || fc > 0 || tec > 0
  const outros = ict > 0 || bnp > 0 || idade > 0 || macos > 0
  const temResultado = vitais || outros
  const achados = r.gravidade.length + r.abcde.length + r.oxigenio.length + r.exames.length + r.historia.length

  // Texto do "Copiar" (C4 = A): o que foi informado e cada corte do livro atingido, com a página.
  const copia = temResultado
    ? textoCopia({
        ferramenta: 'Dispneia — abordagem inicial (adulto)',
        dados: [
          ['FR', fr > 0 ? `${br(fr, 0)} irpm` : ''],
          ['SatO2', sat > 0 ? `${br(sat, 0)}%` : ''],
          ['PaO2', pao2 > 0 ? `${br(pao2, 0)} mmHg` : ''],
          ['FC', fc > 0 ? `${br(fc, 0)} bpm` : ''],
          ['Enchimento capilar', tec > 0 ? `${br(tec, 1)} s` : ''],
          ['Índice cardiotorácico', ict > 0 ? br(ict, 2) : ''],
          ['BNP', bnp > 0 ? `${br(bnp, 0)} pg/mL` : ''],
          ['Idade', idade > 0 ? `${br(idade, 0)} anos` : ''],
          ['Tabagismo', macos > 0 ? `${br(macos, 0)} maços-ano` : ''],
        ],
        resultado: [
          ...(vitais ? [`Sinais de gravidade (cap. 26, p. 360):${r.gravidade.length ? '' : ' nenhum dos cortes numéricos (FR > 30, saturação < 90%) atingido'}`, ...r.gravidade.map(linhaAchado)] : []),
          ...(r.abcde.length ? ['ABCDE (cap. 1, p. 40–41):', ...r.abcde.map(linhaAchado)] : []),
          ...(r.oxigenio.length ? ['Oxigênio (cap. 26, p. 368):', ...r.oxigenio.map(linhaAchado)] : []),
          ...(r.exames.length + r.historia.length ? ['Radiografia, BNP e história (cap. 26, p. 361–364):', ...[...r.exames, ...r.historia].map(linhaAchado)] : []),
        ],
        fonte: textoFontes(fichaDispneiaAdulto),
        versao: fichaDispneiaAdulto.versao,
        quando: new Date(),
      })
    : undefined

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
        <p className="text-tinta-sussurro">p. 368: com hipercapnia significativa na gasometria, o livro direciona para VNI ou ventilação invasiva, se necessário.</p>
      </Bloco>

      <Bloco titulo="Radiografia, BNP e história (cap. 26, p. 361–364)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="dp2-ict" label="Índice cardiotorácico" value={ict} onChange={setIct} step={0.01} />
          <NumberField id="dp2-bnp" label="BNP" unit="pg/mL" value={bnp} onChange={setBnp} step={10} />
          <NumberField id="dp2-idade" label="Idade" unit="anos" value={idade} onChange={setIdade} step={1} />
          <NumberField id="dp2-macos" label="Tabagismo" unit="maços-ano" value={macos} onChange={setMacos} step={1} />
        </div>
        <Lista itens={[...r.exames, ...r.historia]} vazio="Informe ICT, BNP, idade ou carga tabágica." />
        <p className="text-tinta-sussurro">p. 361: embolia pulmonar deve ser suspeitada com história recente (&lt; 4 semanas) de cirurgia, estrógeno ou outros fatores de TVP. O escore de Wells tem ferramenta própria no pacote.</p>
        <p className="font-medium">Achados sugestivos de disfunção cardíaca (Tabela 3, p. 363)</p>
        <ul className="list-disc pl-5">{ACHADOS_IC.map((a) => <li key={a}>{a}</li>)}</ul>
      </Bloco>

      <Bloco titulo="Internação (p. 368)">
        <ul className="list-disc pl-5">{INTERNACAO_DISPNEIA.map((i) => <li key={i}>{i}</li>)}</ul>
      </Bloco>

      {/* Errata e divergências do livro vão para "Armadilhas" (C6 = A). */}
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={[...ERRATA_DISPNEIA.map((e) => `Errata do livro — ${e}`), ...(guia?.armadilhas ?? [])]}
        ficha={fichaDispneiaAdulto}
        guia={guia}
      />
      <ResumoFlutuante
        principal={!temResultado ? 'Informe sinais vitais ou exames' : r.gravidade.length ? `${r.gravidade.length} sinal${r.gravidade.length > 1 ? 'is' : ''} de gravidade da p. 360` : vitais ? 'Nenhum corte de gravidade da p. 360' : 'Sinais vitais não informados'}
        detalhe={temResultado ? `${achados} corte${achados === 1 ? '' : 's'} do livro atingido${achados === 1 ? '' : 's'} na tela · não faz diagnóstico` : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
