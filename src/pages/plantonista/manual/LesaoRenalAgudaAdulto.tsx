import { useState } from 'react'

import {
  FORA_RENAL, FUROSEMIDA_ESTRESSE, INDICACOES_TSR, NOTAS_FRACOES, OUTROS_LRA, fena, feur, fichaLesaoRenalAguda, furosemidaEstresse, indicesUrinarios, kdigo,
} from '@/clinico/adulto/renal'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Alertas, Bloco, Resultado } from './LoteAPecas'
import { br, informado } from './loteAFormato'
import { CampoPeso, LinhaManual } from './PecasLoteC'
import { Fora, ListaRef, Marca } from './PecasLoteE6'

const est = (e: number | null) => (e === null ? '—' : e === 0 ? 'sem estágio' : `estágio ${['', 'I', 'II', 'III'][e]}`)

/** Lesão renal aguda (cap. 61 do manual do HCFMUSP). */
export function LesaoRenalAgudaAdulto() {
  const [peso, setPeso] = useState(0)
  const [crB, setCrB] = useState(0)
  const [crA, setCrA] = useState(0)
  const [d48, setD48] = useState(0)
  const [du, setDu] = useState(0)
  const [horas, setHoras] = useState(0)
  const [anuria, setAnuria] = useState(0)
  const [tsr, setTsr] = useState(false)
  const [naU, setNaU] = useState(0)
  const [naP, setNaP] = useState(0)
  const [crU, setCrU] = useState(0)
  const [crP, setCrP] = useState(0)
  const [urU, setUrU] = useState(0)
  const [urP, setUrP] = useState(0)
  const [osmU, setOsmU] = useState(0)
  const [previa, setPrevia] = useState(false)

  const k = kdigo({ crBasal: informado(crB), crAtual: informado(crA), aumento48h: informado(d48), pesoKg: informado(peso), diureseMl: du > 0 || horas > 0 ? du : undefined, periodoH: informado(horas), anuriaH: informado(anuria), tsr })
  const fn = fena(naU, crP, naP, crU)
  const fu = feur(urU, crP, urP, crU)
  const ind = indicesUrinarios({ ureiaP: informado(urP), crP: informado(crP), naU: informado(naU), osmU: informado(osmU) })
  const furo = furosemidaEstresse(peso, previa)

  return (
    <ToolLayout
      title="Lesão renal aguda — adulto"
      description="Estágio KDIGO por creatinina e diurese, FENa, FEUr, índices urinários, teste de furosemida e indicações de diálise, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaLesaoRenalAguda}
    >
      <CampoPeso id="lra-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="KDIGO — definição e estadiamento" descricao="Tabela 1, p. 825. O estágio final é o maior entre creatinina e diurese.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="lra-crb" label="Creatinina basal" unit="mg/dL" value={crB} onChange={setCrB} step={0.1} />
          <NumberField id="lra-cra" label="Creatinina atual" unit="mg/dL" value={crA} onChange={setCrA} step={0.1} />
          <NumberField id="lra-d48" label="Aumento em 48 h (opcional)" unit="mg/dL" value={d48} onChange={setD48} step={0.1} />
          <NumberField id="lra-du" label="Diurese no período" unit="mL" value={du} onChange={setDu} step={10} />
          <NumberField id="lra-h" label="Período" unit="h" value={horas} onChange={setHoras} step={1} />
          <NumberField id="lra-an" label="Anúria (opcional)" unit="h" value={anuria} onChange={setAnuria} step={1} />
        </div>
        <Marca rotulo="Início de terapia de substituição renal" marcado={tsr} onChange={setTsr} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Resultado rotulo="Razão atual/basal" valor={k.razao ? `${br(k.razao, 2)} ×` : '—'} />
          <Resultado rotulo="Diurese" valor={k.mlKgH !== null ? `${br(k.mlKgH, 2)} mL/kg/h` : peso > 0 ? '—' : 'informe o peso'} />
          <Resultado rotulo="Pela creatinina / pela diurese" valor={`${est(k.estadioCreatinina)} / ${est(k.estadioDiurese)}`} />
          <Resultado rotulo="Estágio KDIGO" valor={est(k.estadio)} />
        </div>
        {k.motivos.length > 0 && <p className="text-muted-foreground">{k.motivos.join('; ')}.</p>}
        <Alertas itens={k.avisos} />
      </Bloco>

      <Bloco titulo="Frações excretórias e índices" descricao="Fórmulas da Tabela 3 (p. 832); índices da Tabela 2 (p. 826–827).">
        <div className="grid gap-4 sm:grid-cols-4">
          <NumberField id="lra-nau" label="Na urinário" unit="mEq/L" value={naU} onChange={setNaU} />
          <NumberField id="lra-nap" label="Na plasmático" unit="mEq/L" value={naP} onChange={setNaP} />
          <NumberField id="lra-cru" label="Cr urinária" unit="mg/dL" value={crU} onChange={setCrU} step={0.1} />
          <NumberField id="lra-crp" label="Cr plasmática" unit="mg/dL" value={crP} onChange={setCrP} step={0.1} />
          <NumberField id="lra-uru" label="Ureia urinária" unit="mg/dL" value={urU} onChange={setUrU} />
          <NumberField id="lra-urp" label="Ureia plasmática" unit="mg/dL" value={urP} onChange={setUrP} />
          <NumberField id="lra-osm" label="Osmolaridade urinária" unit="mOsm/kg" value={osmU} onChange={setOsmU} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Resultado rotulo="FENa = (NaU × CrP) / (NaP × CrU)" valor={fn ? `${br(fn.valor, 2)}% — ${fn.texto}` : 'informe Na e Cr de urina e plasma'} />
          <Resultado rotulo="FEUr = (UrU × CrP) / (UrP × CrU)" valor={fu ? `${br(fu.valor, 1)}% — ${fu.texto}` : 'informe ureia e Cr de urina e plasma'} />
        </div>
        {ind.map((i) => <Resultado key={i.indice} rotulo={i.indice} valor={`${i.valor} — ${i.leitura}`} />)}
        <ListaRef itens={NOTAS_FRACOES} />
      </Bloco>

      <Bloco titulo="Teste de estresse com furosemida">
        <Marca rotulo="Uso prévio de furosemida" marcado={previa} onChange={setPrevia} />
        <LinhaManual nome="Furosemida EV" texto={FUROSEMIDA_ESTRESSE.texto} pagina={FUROSEMIDA_ESTRESSE.pagina}
          conta={furo ? <strong>{br(furo, 0)} mg; corte &lt; {FUROSEMIDA_ESTRESSE.corteMl} mL em {FUROSEMIDA_ESTRESSE.horas} h</strong> : 'informe o peso'} />
      </Bloco>

      <Bloco titulo="Indicações convencionais de terapia de substituição renal" descricao="Tabela 5, p. 837–838. A decisão de TSR precoce é individualizada (p. 839).">
        <ListaRef itens={INDICACOES_TSR} />
        <ListaRef itens={OUTROS_LRA} />
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <Fora itens={FORA_RENAL} />
      </Bloco>
    </ToolLayout>
  )
}
