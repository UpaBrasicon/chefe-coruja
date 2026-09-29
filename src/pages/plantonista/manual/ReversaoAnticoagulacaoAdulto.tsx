import { useState } from 'react'

import {
  CCP, CRIOPRECIPITADO, DOAC_PAGINA, ERRATA_DOAC, ERRATA_HIP_CIRURGIA, ERRATA_VITAMINA_K, HIP_METAS, PLASMA, PROTAMINA_REVERSAO,
  REVERSAO_DOAC, SANGRAMENTO_MAIOR, TABELA_PROTAMINA, VITAMINA_K, ccpUnidades, conferirPasHip, crioUnidades,
  fichaReversaoAnticoagulacaoAdulto, plasmaMl, protamina, reversaoVarfarina, type Faixa, type Sangramento, type TempoHeparina,
} from '@/clinico/adulto/reversaoAnticoagulacao'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

const botao = (ativo: boolean) =>
  cn('rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors', ativo ? 'border-acao bg-acao/5 ring-1 ring-acao' : 'hover:bg-trilha/50')

/** Reversão de anticoagulação e HIP do adulto (caps. 39 e 79 do manual do HCFMUSP). */
export function ReversaoAnticoagulacaoAdulto() {
  const [peso, setPeso] = useState(0)
  const [inr, setInr] = useState(0)
  const [sang, setSang] = useState<Sangramento>('nao')
  const [ui, setUi] = useState(0)
  const [tempo, setTempo] = useState<TempoHeparina>('imediato')
  const [pas, setPas] = useState(0)

  const varf = reversaoVarfarina(inr, sang)
  const ccp = ccpUnidades(peso, inr)
  const pfc = plasmaMl(peso)
  const crio = crioUnidades(peso)
  const prot = protamina(ui, tempo)
  const pasHip = conferirPasHip(pas)

  return (
    <ToolLayout
      title="Reversão de anticoagulação e sangramento — adulto"
      description="Varfarina por INR × sangramento, CCP, plasma, vitamina K, crioprecipitado, protamina por tempo desde a heparina, DOAC e metas da hemorragia intraparenquimatosa, pelo manual do HC. Adulto (14 anos ou mais)."
      ficha={fichaReversaoAnticoagulacaoAdulto}
    >
      <CampoPeso id="rev-peso" peso={peso} onChange={setPeso}>
        <NumberField id="rev-inr" label="INR" value={inr} onChange={setInr} min={0} step={0.1} />
      </CampoPeso>

      <Bloco titulo="Varfarina — Tabela 4 (cap. 79, p. 1043)">
        <div className="flex flex-wrap gap-2">
          {([['nao', 'Sem sangramento'], ['leve', 'Sangramento leve'], ['grave', 'Sangramento grave']] as const).map(([v, r]) => (
            <button key={v} type="button" aria-pressed={sang === v} onClick={() => setSang(v)} className={botao(sang === v)}>{r}</button>
          ))}
        </div>
        {!varf ? <p className="text-sm text-tinta-sussurro">Informe o INR.</p> : (
          <>
            {varf.linhas.map((l) => (
              <div key={l.inr + l.sangramento} className="rounded-lg border px-3 py-2 text-sm">
                <span className="font-medium">INR {l.inr} · {l.sangramento}</span>
                <p>{l.texto}</p>
              </div>
            ))}
            {varf.nota && <p className="text-sm text-atencao">{varf.nota}</p>}
          </>
        )}
        <LinhaManual
          nome="Complexo protrombínico (CCP)"
          texto={CCP.texto}
          conta={ccp ? (ccp.unidades !== null ? <strong>{br(ccp.unidades, 0)} U</strong> : ccp.nota) : 'informe peso e INR'}
          pagina={CCP.pagina}
          errata={CCP.errata}
          nota="Na HIP, o livro cita o CCP como opção mais rápida que o plasma, em pequeno volume (20–40 mL), com normalização do INR em minutos (p. 548–549)."
        />
        <LinhaManual nome="Plasma fresco congelado" texto={PLASMA.texto} conta={pfc ? <>HIP <strong>{faixa(pfc.hip, 0)} mL</strong> · hepatopatia {br(pfc.hepatopatia, 0)} mL</> : 'informe o peso'} pagina={PLASMA.pagina} />
        <LinhaManual nome="Crioprecipitado" texto={CRIOPRECIPITADO.texto} conta={crio !== null ? <><strong>{br(crio)} unidades</strong> (~ +50 mg/dL)</> : 'informe o peso'} pagina={CRIOPRECIPITADO.pagina} />
        <div className="text-sm">
          <p className="font-medium">Vitamina K1</p>
          <ul className="list-disc pl-5">{VITAMINA_K.map((v) => <li key={v.contexto}>{v.contexto}: {v.texto} <span className="text-tinta-sussurro">({v.pagina})</span></li>)}</ul>
          <p className="text-atencao"><Badge variant="warning" className="mr-1">errata</Badge>{ERRATA_VITAMINA_K}</p>
        </div>
      </Bloco>

      <Bloco titulo="Heparina — protamina (Tabela 5, cap. 79, p. 1044)" descricao={`${PROTAMINA_REVERSAO.hipTexto} (cap. 39, p. 548); ${PROTAMINA_REVERSAO.scTexto}.`}>
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField id="rev-ui" label="Heparina a neutralizar" unit="U" value={ui} onChange={setUi} min={0} step={100} />
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TABELA_PROTAMINA) as TempoHeparina[]).map((t) => (
            <button key={t} type="button" aria-pressed={tempo === t} onClick={() => setTempo(t)} className={botao(tempo === t)}>
              {TABELA_PROTAMINA[t].rotulo}: {faixa(TABELA_PROTAMINA[t].mgPor100U, 3)} mg/100 U
            </button>
          ))}
        </div>
        {prot ? (
          <p className="text-sm"><strong>{faixa(prot.mg, 1)} mg</strong>{prot.limitadoAoTeto && ' (no teto de 50 mg)'} = {faixa(prot.ampolas, 2)} ampola(s) de 50 mg</p>
        ) : <p className="text-sm text-tinta-sussurro">Informe as unidades de heparina.</p>}
        <p className="text-sm text-atencao"><Badge variant="warning" className="mr-1">errata</Badge>{PROTAMINA_REVERSAO.errata}</p>
      </Bloco>

      <Bloco titulo={`Anticoagulantes orais diretos (${DOAC_PAGINA})`} descricao={SANGRAMENTO_MAIOR}>
        {REVERSAO_DOAC.map((d) => (
          <div key={d.droga} className="rounded-lg border px-3 py-2 text-sm">
            <p className="font-medium">{d.droga}</p>
            <p><span className="text-tinta-sussurro">Sangramento maior:</span> {d.maior.join('; ')}</p>
            <p><span className="text-tinta-sussurro">Sangramento menor:</span> {d.menor.join('; ')}</p>
          </div>
        ))}
        <p className="text-sm text-atencao"><Badge variant="warning" className="mr-1">errata</Badge>{ERRATA_DOAC}</p>
      </Bloco>

      <Bloco titulo="Hemorragia intraparenquimatosa (cap. 39, p. 543–549)" descricao="O escore ICH está na tela própria.">
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField id="rev-pas" label="PAS" unit="mmHg" value={pas} onChange={setPas} min={0} />
        </div>
        {pasHip && <p className="text-sm">{pasHip}</p>}
        <ul className="flex flex-col gap-1 text-sm">
          {HIP_METAS.map((m) => <li key={m.texto}>{m.texto} <span className="text-tinta-sussurro">({m.pagina})</span></li>)}
        </ul>
        <p className="text-sm text-atencao"><Badge variant="warning" className="mr-1">errata</Badge>{ERRATA_HIP_CIRURGIA}</p>
      </Bloco>
    </ToolLayout>
  )
}
