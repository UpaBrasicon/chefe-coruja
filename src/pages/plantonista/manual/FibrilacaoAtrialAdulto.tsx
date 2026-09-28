import { useState } from 'react'

import {
  AMIODARONA_FA, ANTICOAGULACAO_FA, DDIMERO_FA, DIGOXINA_FA, DILTIAZEM_FA, DILUICOES_FA, ERRATA_FA, ESMOLOL_FA, MAGNESIO_FA, PROPAFENONA_FA, TEXTO_JANELA, VERAPAMIL_FA,
  amiodaronaFa, digoxinaFa, diltiazemFa, edoxabanaClcrAlto, esmololFa, fichaFibrilacaoAtrialAdulto, janelaFa, propafenonaFa, varfarinaInicialMg, verapamilFa,
} from '@/clinico/adulto/fibrilacaoAtrial'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Trecho } from './LoteAPecas'
import { br, faixaBr } from './loteAFormato'
import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const pede = 'informe o peso'

/** Fibrilação atrial do adulto (cap. 17 do manual do HCFMUSP): doses por peso, diluições da Tabela 3 e janela de 48 h. */
export function FibrilacaoAtrialAdulto() {
  const [peso, setPeso] = useState(0)
  const [horas, setHoras] = useState(0)
  const [horasSabidas, setHorasSabidas] = useState(true)
  const [idoso, setIdoso] = useState(false)
  const [clcr, setClcr] = useState(0)

  const es = esmololFa(peso)
  const ve = verapamilFa(peso)
  const di = diltiazemFa(peso)
  const dg = digoxinaFa(peso)
  const am = amiodaronaFa()
  const pr = propafenonaFa(peso)
  const wf = varfarinaInicialMg(peso, idoso)
  const janela = janelaFa(horasSabidas && horas > 0 ? horas : null)

  return (
    <ToolLayout
      title="Fibrilação atrial — adulto"
      description="Controle de frequência e de ritmo com doses por peso, mL/h nas diluições da Tabela 3, janela de 48 h e anticoagulação, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaFibrilacaoAtrialAdulto}
    >
      <CampoPeso id="fa-peso" peso={peso} onChange={setPeso} />

      <p className="text-sm text-muted-foreground">
        O livro traz cardioversão elétrica na instabilidade causada pela FA ou na FA com pré-excitação (Figura 3, p. 255; p. 248) e, de emergência, na isquemia
        coronariana aguda, no edema agudo de pulmão ou na hipoperfusão (p. 247). O capítulo não traz carga em joules. Na FA com pré-excitação o livro diz para
        nunca usar digoxina, betabloqueador nem bloqueador de canal de cálcio (p. 248).
      </p>

      <Bloco titulo="Controle de frequência">
        <LinhaManual
          nome="Esmolol"
          texto={`ataque opcional ${ESMOLOL_FA.ataqueMgKg} mg/kg em ${ESMOLOL_FA.ataqueMin} min; manutenção ${faixaBr(ESMOLOL_FA.manutUgKgMin, 0)} µg/kg/min; meia-vida de ${ESMOLOL_FA.meiaVidaMin} min. Diluição: ${DILUICOES_FA.esmolol.preparo}`}
          conta={es ? <>ataque <strong>{br(es.ataqueMg)} mg</strong> · manutenção <strong>{faixaBr(es.manutMlH)} mL/h</strong></> : pede}
          pagina={ESMOLOL_FA.pagina}
        />
        <LinhaManual
          nome="Verapamil"
          texto={`bolus EV ${faixaBr(VERAPAMIL_FA.bolusMgKg, 3)} mg/kg (por volta de ${faixaBr(VERAPAMIL_FA.referenciaMg, 0)} mg) em ${VERAPAMIL_FA.bolusMin} min; manutenção ${VERAPAMIL_FA.manutMgH} mg/h; com fração de ejeção preservada`}
          conta={ve ? <>bolus <strong>{faixaBr(ve.bolusMg)} mg</strong></> : pede}
          pagina={VERAPAMIL_FA.pagina}
          nota="O livro não traz diluição do verapamil: a manutenção fica em mg/h."
        />
        <LinhaManual
          nome="Diltiazem"
          texto={`bolus EV ${DILTIAZEM_FA.bolusMgKg} mg/kg em ${DILTIAZEM_FA.bolusMin} min; manutenção ${faixaBr(DILTIAZEM_FA.manutMgH, 0)} mg/h; com fração de ejeção preservada. Diluição: ${DILUICOES_FA.diltiazem.preparo}`}
          conta={di ? <>bolus <strong>{br(di.bolusMg)} mg</strong> · manutenção <strong>{faixaBr(di.manutMlH, 0)} mL/h</strong></> : pede}
          pagina={DILTIAZEM_FA.pagina}
          errata={DILUICOES_FA.diltiazem.errata}
        />
        <LinhaManual
          nome="Digoxina"
          texto={`bolus EV ${faixaBr(DIGOXINA_FA.bolusMg, 2)} mg até o máximo de ${DIGOXINA_FA.maximoMg} mg (dose máxima por peso ${faixaBr(DIGOXINA_FA.maximoUgKg, 0)} µg/kg); sugerida com fração de ejeção reduzida`}
          conta={dg ? <>máximo por peso <strong>{faixaBr(dg.maximoPorPesoMg, 2)} mg</strong>{dg.maximoPorPesoMg[1] > dg.maximoAbsolutoMg && <span className="text-atencao"> (acima de 1 mg: vale o teto absoluto)</span>}</> : pede}
          pagina={DIGOXINA_FA.pagina}
        />
        <LinhaManual
          nome="Amiodarona"
          texto={`ataque ${AMIODARONA_FA.ataqueMg} mg EV em ${AMIODARONA_FA.ataqueMin} min; manutenção ${faixaBr(AMIODARONA_FA.manutMgMin)} mg/min; risco de conversão para sinusal e embolismo. Diluição: ${DILUICOES_FA.amiodarona.preparo}`}
          conta={<>ataque {br(am.ataqueMgMin, 0)} mg/min · manutenção <strong>{faixaBr(am.manutMlH)} mL/h</strong> · {faixaBr(am.manut24hMg, 0)} mg em 24 h</>}
          pagina={AMIODARONA_FA.pagina}
          errata={DILUICOES_FA.amiodarona.errata}
        />
      </Bloco>

      <Bloco titulo="Controle de ritmo">
        <LinhaManual
          nome="Propafenona (cardioversão)"
          texto={`${PROPAFENONA_FA.abaixo70Mg} mg (< ${PROPAFENONA_FA.corteKg} kg) e ${PROPAFENONA_FA.aPartir70Mg} mg (≥ ${PROPAFENONA_FA.corteKg} kg); não repetir por pelo menos ${PROPAFENONA_FA.naoRepetirH} h; no primeiro uso, monitorização por pelo menos ${PROPAFENONA_FA.monitorH} h (TV, FV, assistolia, torsades)`}
          conta={pr ? <strong>{pr} mg</strong> : pede}
          pagina={PROPAFENONA_FA.pagina}
        />
        <LinhaManual nome="Magnésio" texto={`considerar bolus de ${faixaBr(MAGNESIO_FA.g, 0)} g antes da cardioversão`} pagina={MAGNESIO_FA.pagina} />
        <Trecho texto="FA inédita: pelo menos uma tentativa de conversão; considerar não cardioverter muito idosos, assintomáticos, com múltiplas comorbidades" pagina="p. 249" />
      </Bloco>

      <Bloco titulo="Tempo de FA e anticoagulação">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="fa-horas" label="Duração da FA" unit="h" value={horas} onChange={setHoras} step={1} />
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={!horasSabidas} onChange={(e) => setHorasSabidas(!e.target.checked)} />
            Tempo indeterminado
          </label>
        </div>
        <p className={janela === 'menos-de-48h' ? '' : 'text-atencao'}>{TEXTO_JANELA[janela]}</p>
        {ANTICOAGULACAO_FA.map((a) => <LinhaManual key={a.id} nome={a.nome} texto={`${a.dose} — ${a.quando}`} pagina={a.pagina} />)}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={idoso} onChange={(e) => setIdoso(e.target.checked)} />
            Idoso (o livro não define a idade)
          </label>
          <div className="flex flex-col text-sm">
            <span className="text-muted-foreground">Varfarina inicial</span>
            <strong className="tabular-nums">{wf ? `${br(wf)} mg/d` : pede}</strong>
          </div>
          <NumberField id="fa-clcr" label="Clearance de creatinina" unit="mL/min" value={clcr} onChange={setClcr} step={1} />
        </div>
        {clcr > 0 && edoxabanaClcrAlto(clcr) && <p className="text-atencao">ClCr ≥ 95 mL/min: o livro diz que a edoxabana não deve ser a preferência (p. 251).</p>}
        <p className="text-muted-foreground">CHA2DS2-VA e HAS-BLED têm telas próprias no pacote; o livro usa o CHA2DS2-VASc (Tabela 1, p. 250).</p>
        <Trecho texto={`D-dímero < ${DDIMERO_FA.corteNgMl} ng/mL com valor preditivo negativo de ${DDIMERO_FA.vpn} para trombo atrial. ${DDIMERO_FA.nota}`} pagina={DDIMERO_FA.pagina} />
      </Bloco>

      <Bloco titulo="Errata e lacunas do capítulo">
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {ERRATA_FA.map((e) => <li key={e}>{e}</li>)}
        </ul>
      </Bloco>
    </ToolLayout>
  )
}
