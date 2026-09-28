import { useState } from 'react'

import {
  DROGAS_DPOC, ERRATA_DPOC, INDICACOES_UTI_DPOC, INDICACOES_VM_DPOC, INDICACOES_VNI_DPOC, SINTOMAS_CARDINAIS, VM_DPOC, VNI_DPOC,
  cicloVentilatorio, classificarDpoc, fichaDpocAdulto, lerGasometriaDpoc, mgBeta2, suporteVni, vcDpoc,
} from '@/clinico/adulto/asmaDpoc'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Button } from '@/components/ui/button'

import { Bloco, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'
import { CampoPeso, LinhaManual } from './PecasLoteC'

/** Exacerbação de DPOC no adulto (cap. 31 do manual do HCFMUSP). */
export function DpocExacerbacaoAdulto() {
  const [peso, setPeso] = useState(0)
  const [sintomas, setSintomas] = useState<string[]>([])
  const [pao2, setPao2] = useState(0)
  const [paco2, setPaco2] = useState(0)
  const [ph, setPh] = useState(0)
  const [gotas, setGotas] = useState(10)
  const [fr, setFr] = useState(10)
  const [ie, setIe] = useState(3)

  const classe = classificarDpoc(sintomas.length)
  const gaso = lerGasometriaDpoc({ pao2: informado(pao2), paco2: informado(paco2), ph: informado(ph) })
  const temGaso = pao2 > 0 || paco2 > 0 || ph > 0
  const vc = vcDpoc(peso)
  const ciclo = cicloVentilatorio(fr, 1, ie)
  const ps = suporteVni()
  const alternar = (id: string) => setSintomas((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <ToolLayout
      title="Exacerbação de DPOC — adulto"
      description="Classificação pelos sintomas cardinais, cortes gasométricos, broncodilatador e corticoide, VNI e parâmetros iniciais da VM invasiva, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaDpocAdulto}
    >
      <CampoPeso id="dp-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Sintomas cardinais" descricao="Tabela 1, p. 418: leve 1, moderada 2, grave 3 manifestações cardinais.">
        <div className="flex flex-wrap gap-2">
          {SINTOMAS_CARDINAIS.map((s) => (
            <Button key={s.id} type="button" size="sm" variant={sintomas.includes(s.id) ? 'default' : 'outline'} aria-pressed={sintomas.includes(s.id)} onClick={() => alternar(s.id)}>{s.rotulo}</Button>
          ))}
        </div>
        <p>{classe ? <><strong>{sintomas.length} de 3</strong> — na tabela do livro: {classe.definicao}.</> : 'Marque as manifestações presentes.'}</p>
      </Bloco>

      <Bloco titulo="Gasometria arterial" descricao="p. 422; Tabela 6 (p. 424); Tabela 9 (p. 426).">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="dp-pao2" label="PaO2" unit="mmHg" value={pao2} onChange={setPao2} step={1} />
          <NumberField id="dp-paco2" label="PaCO2" unit="mmHg" value={paco2} onChange={setPaco2} step={1} />
          <NumberField id="dp-ph" label="pH" value={ph} onChange={setPh} step={0.01} />
        </div>
        {temGaso && (
          <ul className="flex flex-col gap-1">
            <li>Insuficiência respiratória (PaO2 &lt; 60 e/ou PaCO2 &gt; 50, p. 422): {gaso.irpa.length ? gaso.irpa.join(', ') : 'nenhum corte atingido'}</li>
            <li>Grande gravidade (PaO2 &lt; 50, PaCO2 &gt; 70, pH &lt; 7,3, p. 422): {gaso.granGravidade.length ? gaso.granGravidade.join(', ') : 'nenhum corte atingido'}</li>
            <li>Tabela 6 — VNI (lido como pH &lt; 7,35 e PaCO2 &gt; 60): {gaso.vni.length ? 'critério gasométrico atingido' : 'não atingido'}</li>
            <li>Tabela 9 — UTI (PaO2 &lt; 40 ou pH &lt; 7,25): {gaso.uti.length ? gaso.uti.join(', ') : 'nenhum corte atingido'}</li>
          </ul>
        )}
      </Bloco>

      <Bloco titulo="Medicações">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="dp-gotas" label="β2 (salbutamol/fenoterol)" unit="gotas" value={gotas} onChange={setGotas} step={1} />
          <Resultado rotulo="Em mg (10 gotas = 2,5 mg, p. 423)" valor={`${br(mgBeta2(gotas), 2)} mg`} />
        </div>
        {gotas > 10 && <p className="text-atencao">Acima de 10 gotas: a p. 423 registra que a maioria dos autores recomenda não ultrapassar 10 gotas por inalação.</p>}
        {DROGAS_DPOC.map((d) => <LinhaManual key={d.id} nome={d.nome} texto={d.texto} pagina={d.pagina} nota={d.nota} />)}
      </Bloco>

      <Bloco titulo="Ventilação não invasiva" descricao={`Início com baixas pressões: IPAP ${faixaBr(VNI_DPOC.ipap, 0)} cmH2O e EPAP ${faixaBr(VNI_DPOC.epap, 0)} cmH2O (${VNI_DPOC.pagina}).`}>
        <Resultado rotulo="Pressão de suporte (IPAP − EPAP) nas pontas da faixa" valor={`${faixaBr(ps, 0)} cmH2O`} />
        <p className="font-medium">Indicações (Tabela 6, p. 424)</p>
        <ul className="list-disc pl-5">{INDICACOES_VNI_DPOC.map((i) => <li key={i}>{i}</li>)}</ul>
      </Bloco>

      <Bloco titulo="Ventilação mecânica invasiva — parâmetros iniciais" descricao={`p. 425. VC ${faixaBr(VM_DPOC.vcMlKg, 0)} mL/kg; o livro não diz se é peso real ou predito — a conta usa o peso informado.`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="VC 5–6 mL/kg" valor={vc ? `${faixaBr(vc, 0)} mL` : 'informe o peso'} />
          <Resultado rotulo="FR" valor={`${faixaBr(VM_DPOC.fr, 0)} irpm`} />
          <Resultado rotulo="PEEP inicial" valor={`${faixaBr(VM_DPOC.peep, 0)} cmH2O`} />
          <Resultado rotulo="Pressões" valor={`pico < ${VM_DPOC.picoMenorQue}; platô < ${VM_DPOC.plato} cmH2O`} />
          <Resultado rotulo="FiO2" valor={`SaO2 ${faixaBr(VM_DPOC.sao2, 0)}%; PaO2 ${faixaBr(VM_DPOC.pao2, 0)} mmHg`} />
          <Resultado rotulo="I/E (impresso)" valor={VM_DPOC.ieImpressa} />
        </div>
        <Trecho texto="I/E: 3/1" pagina="p. 425" errata="Impresso assim (conferido no PDF). A tela não converte essa relação em tempo inspiratório; a conta abaixo usa a relação 1:n que você escolher." />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="dp-fr" label="FR" unit="irpm" value={fr} onChange={setFr} step={1} />
          <NumberField id="dp-ie" label="Relação I:E  1 :" value={ie} onChange={setIe} step={0.5} />
          <Resultado rotulo="Ciclo · Ti · Te" valor={ciclo ? `${br(ciclo.cicloS, 2)} s · ${br(ciclo.tiS, 2)} s · ${br(ciclo.teS, 2)} s` : '—'} />
        </div>
        <p className="font-medium">Indicações de ventilação invasiva (Tabela 7, p. 425–426)</p>
        <ul className="list-disc pl-5">{INDICACOES_VM_DPOC.map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="font-medium">Indicações de UTI (Tabela 9, p. 426)</p>
        <ul className="list-disc pl-5">{INDICACOES_UTI_DPOC.map((i) => <li key={i}>{i}</li>)}</ul>
      </Bloco>

      <Bloco titulo="Errata e divergências do livro">
        <ul className="list-disc pl-5 text-muted-foreground">{ERRATA_DPOC.map((e) => <li key={e}>{e}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
