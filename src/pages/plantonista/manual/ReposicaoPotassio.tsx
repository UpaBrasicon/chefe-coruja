import { useState } from 'react'

import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'

import {
  APRESENTACOES_K, ERRATA_HIPOCALEMIA_P905, calcularKEV, classificarHipocalemia, deficitPotassio, esquemaHipocalemia, fichaReposicaoPotassio,
  interpretarKUrinario, quantidadeKVO,
} from '@/clinico/adulto/eletrolitos'
import { CampoNumero } from '@/components/plantonista/calc/CampoNumero'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { textoFontes } from '@/clinico/ficha'
import { textoCopia } from '@/domain/copiaCalculo'

import { Alertas, Bloco, Escolha, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'

/** Hipocalemia no adulto: classificação, esquema do Anexo 5 e preparo do KCl EV/VO. */
export function ReposicaoPotassio() {
  const [k, setK] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaReposicaoPotassio.id)
  const [sint, setSint] = useState<'nao' | 'sim'>('nao')
  const [perda, setPerda] = useState<'nao' | 'sim'>('nao')

  const [mEq, setMEq] = useState(20)
  const [apres, setApres] = useState<'kcl-191' | 'kcl-10'>('kcl-191')
  const [diluente, setDiluente] = useState(500)
  const [horas, setHoras] = useState(2)

  const [mEqVO, setMEqVO] = useState(0)
  const [kAlvo, setKAlvo] = useState(0)
  const [k24, setK24] = useState(0)
  const [kCr, setKCr] = useState(0)
  const [naU, setNaU] = useState(0)
  const [osmU, setOsmU] = useState(0)
  const [osmP, setOsmP] = useState(0)

  const g = k > 0 ? classificarHipocalemia(k) : null
  const esq = k > 0 ? esquemaHipocalemia(k, { sintomatica: sint === 'sim', perdaUrinaria: perda === 'sim' }) : null
  const ev = calcularKEV({ mEq, apresentacao: apres, diluenteMl: diluente, horas })
  const def = k > 0 && kAlvo > k ? deficitPotassio(kAlvo - k) : null
  const urina = interpretarKUrinario({ k24h: informado(k24), kCrSpot: informado(kCr), naU: informado(naU), osmU: informado(osmU), osmP: informado(osmP) })

  // Texto do "Copiar" (C4 = A): K, classificação, esquema do anexo e o preparo EV com os alertas.
  const copia = () =>
    textoCopia({
      ferramenta: 'Hipocalemia — reposição de potássio (adulto)',
      dados: [
        ['K sérico', k > 0 ? `${br(k)} mEq/L` : ''],
        ['Sintomática', k > 0 ? (sint === 'sim' ? 'sim' : 'não') : ''],
        ['Perda urinária de K', k > 0 ? (perda === 'sim' ? 'sim' : 'não') : ''],
      ],
      resultado: [
        ...(g ? [`Classificação (p. 900): ${g === 'sem hipocalemia' ? 'sem hipocalemia' : `hipocalemia ${g}`}`] : []),
        ...(esq?.voMEqDia ? [`VO no dia: ${esq.voTexto} = ${faixaBr(esq.voMEqDia, 0)} mEq/dia (Anexo 5, p. 1498)`] : []),
        ...(esq?.ev ? [`EV: ${esq.ev.mEq} mEq em ${faixaBr(esq.ev.horas, 0)} h (Anexo 5, p. 1498)`] : []),
        ...(ev
          ? [
              `Preparo EV: ${mEq} mEq de ${apres === 'kcl-191' ? 'KCl 19,1%' : 'KCl 10%'} = ${br(ev.volumeKClMl)} mL em ${diluente} mL de SF por ${br(horas)} h`,
              `Volume final ${br(ev.volumeTotalMl)} mL · ${br(ev.concentracaoMEqL)} mEq/L · ${br(ev.mEqH)} mEq/h · bomba ${br(ev.mlH)} mL/h (p. 905 e 1498)`,
              ...ev.alertas,
            ]
          : []),
      ],
      fonte: textoFontes(fichaReposicaoPotassio),
      versao: fichaReposicaoPotassio.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Hipocalemia — reposição de potássio"
      description="Classificação, esquema de reposição do Anexo 5 e preparo do KCl (volume, ampolas, concentração, mEq/h e mL/h) com os limites que o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaReposicaoPotassio}
    >
      <Bloco titulo="Potássio sérico e esquema do manual" descricao="Anexo 5, p. 1498; classificação da p. 900.">
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoNumero id="k-serico" rotulo="K sérico" unidade="mEq/L" valor={k} onChange={setK} />
          <Escolha label="Sintomática (arritmia, fraqueza, rabdomiólise)" value={sint} onChange={setSint} opcoes={[{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }]} />
          <Escolha label="Perda urinária de K" value={perda} onChange={setPerda} opcoes={[{ value: 'nao', label: 'Não' }, { value: 'sim', label: 'Sim' }]} />
        </div>
        {g && <Resultado rotulo="Classificação (p. 900)" valor={g === 'sem hipocalemia' ? 'K ≥ 3,5 mEq/L: sem hipocalemia' : `Hipocalemia ${g}`} />}
        {esq && (
          <>
            <Trecho {...esq.referencia} />
            {esq.voMEqDia && <Resultado rotulo="VO no dia" valor={`${esq.voTexto} = ${faixaBr(esq.voMEqDia, 0)} mEq/dia`} />}
            {esq.ev && <Resultado rotulo="EV" valor={`${esq.ev.mEq} mEq em ${faixaBr(esq.ev.horas, 0)} h = ${faixaBr([esq.ev.mEq / esq.ev.horas[1], esq.ev.mEq / esq.ev.horas[0]])} mEq/h`} />}
          </>
        )}
        <Trecho texto="Classificação usada: leve 3–3,4; moderada 2,5–2,9; grave < 2,5 mEq/L." pagina="p. 900" />
      </Bloco>

      <Bloco titulo="Preparo EV de KCl" descricao="Velocidade usual 10–20 mEq/h (até 40 só se ameaçadora à vida); concentração 20–60 mEq/L em SF para veia periférica; bomba de infusão (p. 905 e 1498).">
        <Escolha label="Apresentação" value={apres} onChange={setApres} opcoes={[{ value: 'kcl-191', label: 'KCl 19,1% (25 mEq/10 mL)' }, { value: 'kcl-10', label: 'KCl 10% (13,4 mEq/10 mL)' }]} />
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoNumero id="k-meq" rotulo="Dose de K" unidade="mEq" valor={mEq} onChange={setMEq} />
          <CampoNumero id="k-dil" rotulo="Diluente (SF)" unidade="mL" valor={diluente} onChange={setDiluente} />
          <CampoNumero id="k-horas" rotulo="Tempo" unidade="h" valor={horas} onChange={setHoras} />
        </div>
        {ev ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Resultado rotulo="Volume de KCl" valor={`${br(ev.volumeKClMl)} mL (${ev.ampolas} ampola${ev.ampolas > 1 ? 's' : ''} de 10 mL)`} />
              <Resultado rotulo="Volume final" valor={`${br(ev.volumeTotalMl)} mL`} />
              <Resultado rotulo="Concentração final" valor={`${br(ev.concentracaoMEqL)} mEq/L`} />
              <Resultado rotulo="Velocidade de K" valor={`${br(ev.mEqH)} mEq/h`} />
              <Resultado rotulo="Bomba" valor={`${br(ev.mlH)} mL/h`} />
            </div>
            <Alertas itens={ev.alertas} />
          </>
        ) : <p className="text-tinta-sussurro">Informe dose e tempo.</p>}
      </Bloco>

      <Bloco titulo="Reposição VO" descricao="Xarope 6%: 15 mL = 12 mEq; cápsula 600 mg = 8 mEq (Tab. 4, p. 907; p. 1498).">
        <CampoNumero id="k-vo" rotulo="Dose VO" unidade="mEq" valor={mEqVO} onChange={setMEqVO} />
        {mEqVO > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Resultado rotulo={APRESENTACOES_K[2].nome} valor={`${br(quantidadeKVO(mEqVO, 'xarope-6'))} mL`} />
            <Resultado rotulo={APRESENTACOES_K[3].nome} valor={`${br(quantidadeKVO(mEqVO, 'capsula-600'))} cápsulas`} />
          </div>
        )}
      </Bloco>

      <Bloco titulo="Déficit corporal estimado" descricao="Cada 1 mEq/L de queda no K corresponde a ~200–400 mEq de perda corporal, se o déficit é verdadeiro (p. 905). Na hipocalemia por influxo celular há risco de hipercalemia rebote.">
        <CampoNumero id="k-alvo" rotulo="K de referência para a conta" unidade="mEq/L" valor={kAlvo} onChange={setKAlvo} />
        {def ? <Resultado rotulo={`Queda de ${br(kAlvo - k)} mEq/L`} valor={`${faixaBr(def, 0)} mEq`} /> : <p className="text-tinta-sussurro">Informe o K sérico (acima) e um K de referência maior que ele.</p>}
      </Bloco>

      <Bloco titulo="Excreção urinária de K" descricao="Tab. 2 (p. 903) e Fig. 1 (p. 906). O K urinário em amostra isolada é pouco acurado e não é interpretado aqui.">
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoNumero id="k-24" rotulo="K urinário 24 h" unidade="mEq/dia" valor={k24} onChange={setK24} />
          <CampoNumero id="k-cr" rotulo="K/Cr urinário (spot)" unidade="mEq/g" valor={kCr} onChange={setKCr} />
          <CampoNumero id="k-nau" rotulo="Na urinário" unidade="mEq/L" valor={naU} onChange={setNaU} />
          <CampoNumero id="k-osmu" rotulo="Osm urinária" unidade="mOsm/kg" valor={osmU} onChange={setOsmU} />
          <CampoNumero id="k-osmp" rotulo="Osm plasmática" unidade="mOsm/kg" valor={osmP} onChange={setOsmP} />
        </div>
        {urina.map((u) => <Trecho key={u.texto} {...u} />)}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!g && !ev}
        armadilhas={[ERRATA_HIPOCALEMIA_P905, ...(guia?.armadilhas ?? [])]}
        ficha={fichaReposicaoPotassio}
        guia={guia}
      />
      <ResumoFlutuante
        principal={g ? (g === 'sem hipocalemia' ? 'K ≥ 3,5 mEq/L: sem hipocalemia' : `K ${br(k)} mEq/L · hipocalemia ${g}`) : 'Informe o K sérico'}
        detalhe={ev ? `Preparo EV: ${br(ev.mEqH)} mEq/h · bomba ${br(ev.mlH)} mL/h · ${br(ev.concentracaoMEqL)} mEq/L` : undefined}
        tom={g && g !== 'sem hipocalemia' && g.includes('grave') ? 'critico' : 'neutro'}
        textoCopia={g || ev ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
