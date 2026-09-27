import { useState } from 'react'

import {
  BIVALIRUDINA, CONTEXTOS_ENOXAPARINA, ORAIS, OUTRAS_HBPM, bivalirudinaMgH, edoxabanaMg, enoxaparina, fichaAnticoagulacaoPlenaAdulto, fondaparinuxMg, hnfSc,
  type ContextoEnoxaparina, type Faixa,
} from '@/clinico/adulto/anticoagulacao'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Label } from '@/components/ui/label'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

/** Anticoagulação plena por peso do adulto (caps. 13, 14, 25 e 32 do manual do HCFMUSP). */
export function AnticoagulacaoPlenaAdulto() {
  const [peso, setPeso] = useState(0)
  const [idade, setIdade] = useState(0)
  const [clcr, setClcr] = useState(0)
  const [ctx, setCtx] = useState<ContextoEnoxaparina>('tep-12h')
  const [sk, setSk] = useState(false)
  const clcrInformado = clcr > 0 ? clcr : undefined
  const enox = enoxaparina(ctx, { pesoKg: peso, idadeAnos: idade > 0 ? idade : undefined, clcr: clcrInformado, estreptoquinase: sk })
  const fonda = fondaparinuxMg(peso, clcrInformado)
  const sc = hnfSc(peso)
  const edo = edoxabanaMg(peso)

  return (
    <ToolLayout
      title="Anticoagulação plena por peso — adulto"
      description="Enoxaparina por contexto, com ajuste renal e por idade quando o capítulo traz; fondaparinux, HNF subcutânea, outras HBPM, bivalirudina e orais. Adulto (14 anos ou mais)."
      ficha={fichaAnticoagulacaoPlenaAdulto}
    >
      <CampoPeso id="acp-peso" peso={peso} onChange={setPeso}>
        <NumberField id="acp-idade" label="Idade" unit="anos" value={idade} onChange={setIdade} min={0} />
        <NumberField id="acp-clcr" label="Clearance de creatinina" unit="mL/min" value={clcr} onChange={setClcr} min={0} />
      </CampoPeso>

      <Bloco titulo="Enoxaparina">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="acp-ctx">Contexto do capítulo</Label>
          <select id="acp-ctx" className="h-9 rounded-md border bg-transparent px-2 text-sm" value={ctx} onChange={(e) => setCtx(e.target.value as ContextoEnoxaparina)}>
            {(Object.keys(CONTEXTOS_ENOXAPARINA) as ContextoEnoxaparina[]).map((k) => <option key={k} value={k}>{CONTEXTOS_ENOXAPARINA[k].rotulo}</option>)}
          </select>
          {ctx === 'iamcsst-trombolise' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sk} onChange={(e) => setSk(e.target.checked)} /> Trombólise feita com estreptoquinase
            </label>
          )}
        </div>
        <LinhaManual
          nome={CONTEXTOS_ENOXAPARINA[ctx].rotulo}
          texto={{
            iamsst: '1 mg/kg 12/12 h SC',
            'iamcsst-trombolise': 'ataque 30 mg EV e 1 mg/kg SC 12/12 h por 7 dias; > 75 anos sem ataque e 0,75 mg/kg 12/12 h; ClCr 15–30: 1 mg/kg 1 x/d',
            'tep-12h': '1 mg/kg SC 12/12 h; ClCr < 30: 1 mg/kg 1 x/dia; sugere não usar com ClCr < 15',
            'tep-1x': '1,5 mg/kg SC 1 x/d; ClCr < 30: 1 mg/kg 1 x/dia; sugere não usar com ClCr < 15',
            tvp: '1,5 mg/kg SC 1 x/dia',
          }[ctx]}
          conta={!enox ? 'informe o peso' : enox.doseMg === null ? 'sem dose no capítulo' : (
            <>
              {enox.bolusEvMg !== null && <>ataque <strong>{enox.bolusEvMg} mg EV</strong> + </>}
              <strong>{br(enox.doseMg)} mg</strong> {enox.intervalo}
            </>
          )}
          pagina={CONTEXTOS_ENOXAPARINA[ctx].pagina}
        />
        {enox?.observacoes.map((o) => <p key={o} className="text-sm text-muted-foreground">{o}</p>)}
        {!clcrInformado && <p className="text-sm text-muted-foreground">Sem clearance informado, a conta não aplica ajuste renal.</p>}
      </Bloco>

      <Bloco titulo="Outras heparinas (cap. 25, p. 352)">
        <LinhaManual
          nome="Fondaparinux"
          texto="< 50 kg: 5 mg; 50–100 kg: 7,5 mg; > 100 kg: 10 mg SC 1 x/dia; não pode ser usado com ClCr < 30 mL/min"
          conta={!(peso > 0) ? 'informe o peso' : fonda === null ? 'ClCr < 30: não usar' : <strong>{br(fonda)} mg SC 1 x/dia</strong>}
          pagina="p. 352"
        />
        <LinhaManual
          nome="Heparina não fracionada SC (concentrada)"
          texto="dose inicial 333 U/kg SC; manutenção 250 U/kg SC 12/12 h; só com frasco de 20.000 ou 25.000 U/mL (a de 5.000 U/mL não serve); sem controle de coagulograma"
          conta={sc ? (
            <>
              <strong>{br(sc.inicialU, 0)} U</strong> e depois <strong>{br(sc.manutencaoU, 0)} U</strong> 12/12 h
              {sc.volumes.map((v) => <span key={v.uMl}> · {br(v.uMl, 0)} U/mL: {br(v.inicialMl, 2)} e {br(v.manutencaoMl, 2)} mL</span>)}
            </>
          ) : 'informe o peso'}
          pagina="p. 352"
        />
        {OUTRAS_HBPM.map((h) => (
          <LinhaManual key={h.id} nome={h.nome} texto={`${h.uKg} unidades/kg, 1 x/dia`} conta={peso > 0 ? <strong>{br(h.uKg * peso, 0)} unidades 1 x/dia</strong> : 'informe o peso'} pagina="p. 352" />
        ))}
        {BIVALIRUDINA.map((b) => {
          const mgH = bivalirudinaMgH(b.mgKgH, peso)
          return (
            <LinhaManual key={b.situacao} nome={`Bivalirudina — ${b.situacao}`} texto={`${faixa(b.mgKgH, 2)} mg/kg/h, TTPA 1,5–2,5 vezes o controle (plaquetopenia induzida por heparina)`}
              conta={mgH ? <strong>{faixa(mgH, 2)} mg/h</strong> : 'informe o peso'} pagina="p. 352" />
          )
        })}
      </Bloco>

      <Bloco titulo="Anticoagulantes orais">
        {ORAIS.map((o) => (
          <LinhaManual key={o.id} nome={o.nome} texto={o.dose} pagina={o.pagina}
            conta={o.id === 'edoxabana' && peso > 0 ? (edo === null ? '60 kg exatos: sem dose no livro' : <strong>{edo} mg VO 1 x/dia</strong>) : undefined}
            errata={o.id === 'edoxabana' ? 'O livro escreve "< 60 kg" e "> 60 kg": com exatamente 60 kg não há dose. A conta não escolhe.' : undefined} />
        ))}
      </Bloco>
    </ToolLayout>
  )
}
