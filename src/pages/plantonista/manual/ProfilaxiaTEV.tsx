import { useState } from 'react'

import {
  CONTEXTO_DAS_DOSES, DOSES_PROFILAXIA_TEV, FORA_DO_LIVRO, MENCOES_PROFILAXIA_TEV, PROTAMINA,
  doseDiaria, fichaProfilaxiaTev, protaminaHnfSc, volumeDoseMl,
} from '@/clinico/adulto/profilaxiaTev'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'

import { Bloco, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 2) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: [number, number], casas = 2) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

/** Profilaxia de TEV: doses e menções do manual do HCFMUSP, sem escore de risco. */
export function ProfilaxiaTEV() {
  const [ui, setUi] = useState(5000)
  const prot = protaminaHnfSc(ui)

  return (
    <ToolLayout
      title="Profilaxia de TEV — doses pelo manual (adulto)"
      description="Doses de enoxaparina e HNF, onde o manual do HC cita profilaxia e a reversão da HNF SC. O livro não traz escore de risco. Adulto (14 anos ou mais)."
      ficha={fichaProfilaxiaTev}
    >
      <Bloco titulo="Doses do manual" descricao={CONTEXTO_DAS_DOSES}>
        {DOSES_PROFILAXIA_TEV.map((d) => {
          const ml = volumeDoseMl(d)
          const un = d.unidade === 'UI' ? 'UI' : 'mg'
          return (
            <LinhaManual
              key={d.id}
              nome={d.nome}
              texto={`${br(d.dose, 0)} ${un} ${d.via} ${d.vezesDia} vez${d.vezesDia > 1 ? 'es' : ''}/dia`}
              conta={<>{ml !== null && <>{br(ml)} mL por dose (1 mL = {br(d.porMl!, 0)} U) · </>}<strong>{br(doseDiaria(d), 0)} {un}/dia</strong></>}
              pagina={d.pagina}
              errata={d.errata}
            />
          )
        })}
      </Bloco>

      <Bloco titulo="Onde o manual cita profilaxia de TEV" descricao="Texto de cada capítulo; em AVC, HIP e HSA o livro fala em compressão pneumática.">
        <ul className="flex flex-col gap-1.5 text-sm">
          {MENCOES_PROFILAXIA_TEV.map((m) => (
            <li key={m.contexto} className="rounded-lg border px-3 py-2">
              <span className="font-medium">{m.contexto}</span>
              {m.mecanica && <Badge variant="secondary" className="ml-2">mecânica</Badge>}
              <br />
              <span className="text-muted-foreground">{m.texto} ({m.pagina})</span>
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Reversão da HNF SC por protamina" descricao={`${faixa(PROTAMINA.mgPor100UiSc, 1)} mg por 100 U de heparina SC; dose máxima ${PROTAMINA.maxMg} mg; ampola de ${PROTAMINA.mgPorAmpola} mg (${PROTAMINA.pagina}).`}>
        <div className="max-w-xs">
          <NumberField id="tev-ui" label="Heparina SC recebida" unit="UI" value={ui} onChange={setUi} min={0} step={500} />
        </div>
        <p className="text-sm tabular-nums">
          {!prot ? 'Informe as unidades de heparina.' : (
            <>Protamina <strong>{faixa(prot.mg, 1)} mg</strong> = {faixa(prot.ampolas)} ampola(s){prot.limitadoAoTeto && ' (no teto de 50 mg)'}</>
          )}
        </p>
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {FORA_DO_LIVRO.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </Bloco>
    </ToolLayout>
  )
}
