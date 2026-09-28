import { useState } from 'react'

import {
  ALBUMINA_COM_TERLIPRESSINA, ALBUMINA_FRASCO, ALBUMINA_PARACENTESE, ALBUMINA_PBE, ALBUMINA_SHR, ATB_PBE, CRITERIOS_SHR, DIFERENCIAL_LRA_CIRROSE, ERRATA_DISPENSA_ALBUMINA_PBE,
  ERRATA_GASA, ERRATA_NEJM_TERLIPRESSINA, ERRATA_RESPOSTA_PBE, FORA_HEPATOPATA, LIQUIDO_ASCITICO, NOTA_ALBUMINA_D1_TERLIPRESSINA, NOTA_ICA_AKI, NOTA_PARACENTESE,
  NOTA_PMN_250, NOTA_PROTEINURIA_INDICE, NOTA_RESPOSTA_25, NOTA_TERLIPRESSINA_CONTINUA, PROFILAXIA_PBE, TERLIPRESSINA_SHR, albuminaComTerlipressina,
  albuminaParacentese, albuminaPbe, albuminaShr, classificarLiquidoAscitico, criteriosDispensaAlbuminaPbe, criteriosPeritoniteSecundaria, degrausContinua,
  estadioIcaAki, fichaAsciteShr, gasa, quedaPmn, respostaTerlipressina, terlipressinaContinua, type CulturaLa,
} from '@/clinico/adulto/hepatopata'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, Escolha, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'
import { CampoPeso, LinhaManual } from './PecasLoteC'
import { Errata, Fora, ListaRef, Marca } from './PecasLoteE6'

const frascos = (f: { exato: number; inteiros: number } | null) => (f ? `${br(f.exato)} frascos de 10 g (${f.inteiros} inteiros)` : '—')

/** Ascite, PBE e síndrome hepatorrenal (caps. 55, 57 e 58 do manual do HCFMUSP). */
export function AsciteHepatorrenalAdulto() {
  const [peso, setPeso] = useState(0)
  const [albS, setAlbS] = useState(0)
  const [albA, setAlbA] = useState(0)
  const [litros, setLitros] = useState(0)
  const [pmn, setPmn] = useState(0)
  const [cultura, setCultura] = useState<CulturaLa>('pendente')
  const [glic, setGlic] = useState(0)
  const [prot, setProt] = useState(0)
  const [dhl, setDhl] = useState(false)
  const [pmn48, setPmn48] = useState(0)
  const [cr, setCr] = useState(0)
  const [bt, setBt] = useState(0)
  const [ureia, setUreia] = useState(0)
  const [crBasal, setCrBasal] = useState(0)
  const [crAtual, setCrAtual] = useState(0)
  const [crInicial, setCrInicial] = useState(0)
  const [dialise, setDialise] = useState(false)
  const [mgDia, setMgDia] = useState(3)

  const g = albS > 0 ? gasa(albS, albA) : null
  const para = albuminaParacentese(litros)
  const pbe = albuminaPbe(peso)
  const shr = albuminaShr(peso)
  const terl = albuminaComTerlipressina(peso)
  const liq = pmn > 0 ? classificarLiquidoAscitico(pmn, cultura) : null
  const pbs = criteriosPeritoniteSecundaria(pmn, informado(glic), informado(prot), dhl)
  const queda = pmn > 0 && pmn48 > 0 ? quedaPmn(pmn, pmn48) : null
  const dispensa = criteriosDispensaAlbuminaPbe(informado(cr), informado(bt), informado(ureia))
  const est = estadioIcaAki(crBasal, crAtual, dialise)
  const resp = respostaTerlipressina(crInicial, crAtual, informado(crBasal))
  const cont = terlipressinaContinua(mgDia)

  return (
    <ToolLayout
      title="Ascite, PBE e síndrome hepatorrenal — adulto"
      description="GASA, albumina pós-paracentese, na PBE e na SHR, terlipressina escalonada e estádio ICA-AKI, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaAsciteShr}
    >
      <CampoPeso id="as-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="GASA e líquido ascítico">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="as-albs" label="Albumina sérica" unit="g/dL" value={albS} onChange={setAlbS} step={0.1} />
          <NumberField id="as-alba" label="Albumina do líquido" unit="g/dL" value={albA} onChange={setAlbA} step={0.1} />
          <Resultado rotulo="GASA" valor={g ? `${br(g.gasa, 2)} g/dL — ${g.texto}` : 'informe as albuminas'} />
        </div>
        <Errata texto={ERRATA_GASA} />
        <ListaRef itens={LIQUIDO_ASCITICO} />
      </Bloco>

      <Bloco titulo="Albumina pós-paracentese" descricao={`${ALBUMINA_PARACENTESE.texto} (${ALBUMINA_PARACENTESE.pagina}). ${ALBUMINA_FRASCO.texto} (${ALBUMINA_FRASCO.pagina}).`}>
        <NumberField id="as-litros" label="Volume retirado" unit="L" value={litros} onChange={setLitros} step={0.5} />
        {para && !para.acimaDoLimite && <p>Até 5 L: o livro não indica reposição.</p>}
        {para && para.acimaDoLimite && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Resultado rotulo="8 g × litros retirados" valor={`${br(para.gVolumeTotal)} g — ${frascos(para.frascosTotal)}`} />
            <Resultado rotulo="8 g × litros acima de 5" valor={`${br(para.gSoExcedente)} g — ${frascos(para.frascosExcedente)}`} />
          </div>
        )}
        <p className="text-muted-foreground">{NOTA_PARACENTESE}</p>
      </Bloco>

      <Bloco titulo="Peritonite bacteriana espontânea" descricao={NOTA_PMN_250}>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="as-pmn" label="PMN no líquido" unit="/mm³" value={pmn} onChange={setPmn} step={10} />
          <NumberField id="as-glic" label="Glicose no líquido (opcional)" unit="mg/dL" value={glic} onChange={setGlic} />
          <NumberField id="as-prot" label="Proteínas no líquido (opcional)" unit="g/dL" value={prot} onChange={setProt} step={0.1} />
        </div>
        <Escolha label="Cultura" value={cultura} onChange={setCultura} opcoes={[{ value: 'pendente', label: 'Pendente' }, { value: 'positiva', label: 'Positiva (agente único)' }, { value: 'negativa', label: 'Negativa' }]} />
        <Marca rotulo="DHL do líquido > limite superior sérico" marcado={dhl} onChange={setDhl} />
        {liq && <Trecho texto={liq.texto} pagina={liq.pagina} />}
        {pmn > 0 && (
          <p>
            Peritonite secundária (p. 781): {pbs.achados.length ? pbs.achados.join('; ') : 'nenhum critério bioquímico marcado'} —{' '}
            {pbs.criterioDoLivro ? <strong>PMN &gt; 250 e 2 ou mais critérios: cabe no critério do livro</strong> : 'critério do livro não preenchido'}.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="as-pmn48" label="PMN em 48 h" unit="/mm³" value={pmn48} onChange={setPmn48} step={10} />
          <Resultado rotulo="Queda dos PMN" valor={queda ? `${br(queda.quedaPct, 0)}%${queda.atingiu25 ? ' (≥ 25%)' : ' (< 25%)'}` : '—'} />
        </div>
        <Errata texto={ERRATA_RESPOSTA_PBE} />
        <LinhaManual nome="Albumina na PBE" texto={ALBUMINA_PBE.texto} pagina={ALBUMINA_PBE.pagina}
          conta={pbe ? <strong>D1 {br(pbe.d1G)} g em 6 h · D3 {br(pbe.d3G)} g</strong> : 'informe o peso'}
          nota={pbe ? `D1: ${frascos(pbe.frascosD1)}; D3: ${frascos(pbe.frascosD3)}.` : undefined} />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="as-cr" label="Creatinina" unit="mg/dL" value={cr} onChange={setCr} step={0.1} />
          <NumberField id="as-bt" label="Bilirrubina total" unit="mg/dL" value={bt} onChange={setBt} step={0.1} />
          <NumberField id="as-ur" label="Ureia" unit="mg/dL" value={ureia} onChange={setUreia} />
        </div>
        {(cr > 0 || bt > 0 || ureia > 0) && <p>Critérios de dispensa da p. 785 presentes: {dispensa.length ? dispensa.join('; ') : 'nenhum'}.</p>}
        <Errata texto={ERRATA_DISPENSA_ALBUMINA_PBE} />
        {ATB_PBE.map((a) => <LinhaManual key={a.droga} nome={a.droga} texto={a.texto} pagina={a.pagina} errata={a.errata} />)}
        <ListaRef itens={PROFILAXIA_PBE} />
      </Bloco>

      <Bloco titulo="Síndrome hepatorrenal — estádio ICA-AKI e critérios" descricao={NOTA_ICA_AKI}>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="as-crb" label="Creatinina basal" unit="mg/dL" value={crBasal} onChange={setCrBasal} step={0.1} />
          <NumberField id="as-cra" label="Creatinina atual" unit="mg/dL" value={crAtual} onChange={setCrAtual} step={0.1} />
        </div>
        <Marca rotulo="Início de diálise" marcado={dialise} onChange={setDialise} />
        <Resultado rotulo="Estádio ICA-AKI (Tabela 2, p. 791)" valor={est ? `${est.estadio === 0 ? 'sem estádio' : `estádio ${est.estadio}`} — ${est.motivos.join('; ')}` : 'informe as creatininas'} />
        <ul className="list-disc pl-5">{CRITERIOS_SHR.map((c) => <li key={c}>{c}</li>)}</ul>
        <p className="text-muted-foreground">Critérios diagnósticos da SHR (Tabela 2, p. 790–791).</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="border-b"><th className="py-1 pr-2">Tabela 4 (p. 792–793)</th><th className="pr-2">Pré-renal</th><th className="pr-2">SHR</th><th>NTA</th></tr></thead>
            <tbody>
              {DIFERENCIAL_LRA_CIRROSE.map((d) => <tr key={d.item} className="border-b"><td className="py-1 pr-2 font-medium">{d.item}</td><td className="pr-2">{d.preRenal}</td><td className="pr-2">{d.shr}</td><td>{d.nta}</td></tr>)}
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground">{NOTA_PROTEINURIA_INDICE}</p>
      </Bloco>

      <Bloco titulo="Síndrome hepatorrenal — albumina e terlipressina" descricao={`${TERLIPRESSINA_SHR.pagina}.`}>
        <LinhaManual nome="Albumina — expansão" texto={ALBUMINA_SHR.texto} pagina={ALBUMINA_SHR.pagina}
          conta={shr ? <strong>{br(shr.gDia)} g/dia × 2 dias{shr.limitadoA100 ? ' (limitado a 100 g/dia)' : ''}</strong> : 'informe o peso'}
          nota={shr ? `Por dia: ${frascos(shr.frascosDia)}.` : undefined} />
        <LinhaManual nome="Albumina com terlipressina" texto={ALBUMINA_COM_TERLIPRESSINA.texto} pagina={ALBUMINA_COM_TERLIPRESSINA.pagina}
          conta={terl ? <strong>D1 {br(terl.d1G)} g{terl.d1AcimaDe100 ? ' (acima de 100 g)' : ''}; depois {faixaBr(terl.demaisGDia, 0)} g/dia</strong> : 'informe o peso'}
          nota={NOTA_ALBUMINA_D1_TERLIPRESSINA} />
        <p className="font-medium">Terlipressina em bolus — sobe a cada {TERLIPRESSINA_SHR.avaliarAposDias} dias sem resposta, até {TERLIPRESSINA_SHR.maxMgDia} mg/dia (p. 797)</p>
        <ol className="list-decimal pl-5">
          {TERLIPRESSINA_SHR.degraus.map((d) => <li key={d.rotulo}>{d.rotulo} = {d.mgDia} mg/dia</li>)}
        </ol>
        <p className="font-medium">Terlipressina em infusão contínua — 3 mg/dia, +1 mg/dia a cada 2 dias, em SG 5% 50 mL (p. 797)</p>
        <p className="text-muted-foreground">{degrausContinua().map((d) => `dia ${d.diaInicio}: ${d.mgDia} mg`).join(' · ')}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="as-mgdia" label="Dose do dia" unit="mg/dia" value={mgDia} onChange={setMgDia} step={1} />
          <Resultado rotulo="Concentração em 50 mL" valor={cont ? `${br(cont.concentracaoMgMl, 2)} mg/mL` : '—'} />
          <Resultado rotulo="Dose do dia" valor={cont ? `${br(cont.mgDia, 1)} mg/dia${cont.acimaDoTetoBolus ? ' (acima dos 12 mg/dia da sequência em bolus)' : ''}` : '—'} />
        </div>
        <p className="text-muted-foreground">{NOTA_TERLIPRESSINA_CONTINUA}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="as-cri" label="Creatinina no início da terlipressina" unit="mg/dL" value={crInicial} onChange={setCrInicial} step={0.1} />
          <Resultado rotulo="Queda em relação à inicial (usa a creatinina atual)" valor={resp ? `${br(resp.quedaPct, 0)}%${resp.atingiu25 ? ' (≥ 25%: resposta pela p. 795)' : ' (< 25%)'}` : '—'} />
          <Resultado rotulo="Até basal + 0,3 mg/dL" valor={resp?.completa == null ? 'informe a basal' : resp.completa ? 'sim' : 'não'} />
        </div>
        <p className="text-muted-foreground">{NOTA_RESPOSTA_25} Tempo máximo de {TERLIPRESSINA_SHR.maxDias} dias (p. 795). Efeitos colaterais na Tabela 5 (p. 797).</p>
        <Errata texto={ERRATA_NEJM_TERLIPRESSINA} />
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <Fora itens={FORA_HEPATOPATA} />
      </Bloco>
    </ToolLayout>
  )
}
