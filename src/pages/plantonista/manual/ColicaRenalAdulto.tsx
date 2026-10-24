import { useState } from 'react'

import { ANALGESIA, EXAMES_E_INFECCAO, INTERNACAO, condutaPorTamanho, fichaColicaRenalAdulto, quetaminaMg } from '@/clinico/adulto/colicaRenal'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numero } from '@/lib/formato'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number) => numero(Math.round(x * 10) / 10)

/** Cólica nefrética do adulto (cap. 62 do manual do HCFMUSP). */
export function ColicaRenalAdulto() {
  const [peso, setPeso] = useState(0)
  const [mm, setMm] = useState(0)
  const q = quetaminaMg(peso)
  const calculo = condutaPorTamanho(mm)

  return (
    <ToolLayout
      title="Cólica nefrética"
      description="Analgesia em degraus com as doses do manual do HC, conduta pelo tamanho do cálculo, tansulosina com a divergência do ensaio de 2018 e indicações de internação. Adulto (14 anos ou mais)."
      ficha={fichaColicaRenalAdulto}
    >
      <CampoPeso id="col-peso" peso={peso} onChange={setPeso}>
        <NumberField id="col-mm" label="Tamanho do cálculo ureteral" unit="mm" value={mm} onChange={setMm} min={0} step={0.5} />
      </CampoPeso>

      <Bloco titulo="Analgesia (p. 848)" descricao="O manejo inicial é o controle da dor.">
        {ANALGESIA.map((a) => (
          <LinhaManual
            key={a.droga}
            nome={`${a.linha} — ${a.droga}`}
            texto={a.dose}
            pagina={a.pagina}
            nota={a.nota}
            conta={a.droga === 'Quetamina' ? (q ? <strong>{br(q[0])} a {br(q[1])} mg</strong> : 'informe o peso') : undefined}
          />
        ))}
      </Bloco>

      <Bloco titulo="Cálculo ureteral pelo tamanho (p. 849)">
        {calculo ? <p className="text-apoio text-tinta">{calculo.texto} ({calculo.pagina})</p> : <p className="text-apoio text-tinta-sussurro">Informe o tamanho do cálculo na imagem.</p>}
        {(!calculo || calculo.tansulosina) && (
          <p className="text-apoio text-tinta-apoio">
            Divergência: no ensaio de Meltzer 2018 (cálculo menor que 9 mm), a tansulosina 0,4 mg não aumentou a eliminação em 28 dias (50% × 47% com placebo). O próprio manual diz que é provável que as diretrizes deixem de indicá-la abaixo de 9 mm.
          </p>
        )}
      </Bloco>

      <Bloco titulo="Exames e infecção">
        {EXAMES_E_INFECCAO.map((e) => <p key={e.texto} className="text-apoio text-tinta-apoio">{e.texto} ({e.pagina})</p>)}
      </Bloco>

      <Bloco titulo="Internar (Tabela 5, p. 849–850)">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-apoio text-tinta-apoio">{INTERNACAO.map((i) => <li key={i}>{i}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
