import { useState } from 'react'

import {
  BCC_EV, LIDOCAINA_TV, MAGNESIO_TORSADES, adenosina, esquemaAmiodarona, fichaTaquiarritmiaAdulto, lidocainaTv, type Faixa,
} from '@/clinico/adulto/pcr'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

/** Drogas EV das taquiarritmias do adulto (cap. 18 do manual do HCFMUSP). */
export function TaquiarritmiasAdulto() {
  const [peso, setPeso] = useState(0)
  const [central, setCentral] = useState(false)
  const ami = esquemaAmiodarona()
  const lido = lidocainaTv(peso)
  return (
    <ToolLayout
      title="Taquiarritmias — drogas EV (adulto)"
      description="Adenosina, amiodarona, lidocaína, bloqueadores de canal de cálcio e magnésio, com totais e tempos. Adulto (14 anos ou mais)."
      ficha={fichaTaquiarritmiaAdulto}
    >
      <CampoPeso id="taqui-peso" peso={peso} onChange={setPeso}>
        <label className="flex items-center gap-2 self-end text-sm md:col-span-2">
          <input type="checkbox" checked={central} onChange={(e) => setCentral(e.target.checked)} />
          Adenosina por acesso venoso central de cava superior
        </label>
      </CampoPeso>

      <p className="text-sm text-tinta-sussurro">
        No paciente instável o manual traz cardioversão elétrica sincronizada (desfibrilação na torsades de pointes), p. 262. O capítulo não traz a carga
        da cardioversão; a carga da desfibrilação está na tela de PCR (cap. 2, p. 48).
      </p>

      <Bloco titulo="QRS estreito">
        <LinhaManual
          nome="Adenosina"
          texto="6 mg em bolus rápido; sem resolução em 2 min, 12 mg em bolus rápido, que pode ser repetida uma vez; metade da dose por acesso central de cava superior"
          conta={<strong>{adenosina(central).map((d) => br(d)).join(' → ')} mg</strong>}
          pagina="p. 265"
        />
        {BCC_EV.map((b) => (
          <LinhaManual key={b.id} nome={b.nome} texto={`${br(b.mgMin)} mg/min até o total de ${b.totalMg} mg`} conta={<>total em <strong>{br(b.minutosAteTotal, 0)} min</strong></>} pagina={b.pagina}
            nota="O manual contraindica em disfunção de VE e em FA com Wolff-Parkinson-White." />
        ))}
      </Bloco>

      <Bloco titulo="TV monomórfica estável (tratamento medicamentoso)">
        <LinhaManual
          nome="Amiodarona"
          texto="150 mg (1 ampola) em 10 min, 1 mg/min pelas próximas 6 h, 0,5 mg/min pelas 18 h subsequentes"
          conta={<>{ami.fases.map((f) => `${f.mg} mg`).join(' + ')} = <strong>{br(ami.total24hMg, 0)} mg em 24 h</strong></>}
          pagina="p. 265"
        />
        <LinhaManual
          nome="Lidocaína"
          texto={`ataque ${faixa(LIDOCAINA_TV.ataqueMgKg)} mg/kg a ${LIDOCAINA_TV.velocidadeMgMin} mg/min, repetível após 5 min; não infundir mais que ${faixa(LIDOCAINA_TV.tetoMgHora, 0)} mg em 1 hora`}
          conta={lido ? (
            <>
              <strong>{faixa(lido.ataqueMg, 0)} mg</strong> em {faixa(lido.minutos)} min · dois ataques {faixa(lido.doisAtaquesMg, 0)} mg
              {lido.doisAtaquesPassamDe200 && <span className="text-atencao"> (acima de 200 mg)</span>}
            </>
          ) : 'informe o peso'}
          pagina={LIDOCAINA_TV.pagina}
          errata={LIDOCAINA_TV.errata}
        />
      </Bloco>

      <Bloco titulo="Torsades de pointes (paciente estável)">
        <LinhaManual nome="Sulfato de magnésio" texto={`${MAGNESIO_TORSADES.g} g EV durante ${MAGNESIO_TORSADES.minutos} min, mesmo sem hipomagnesemia`} pagina={MAGNESIO_TORSADES.pagina} />
      </Bloco>
    </ToolLayout>
  )
}
