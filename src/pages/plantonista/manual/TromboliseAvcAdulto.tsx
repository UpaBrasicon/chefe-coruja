import { useState } from 'react'

import {
  ALTEPLASE_AVC, ALVOS_PA_AVC, ANGIOEDEMA_POS_ALTEPLASE, ASPECTS_LIVRO, CONTRAINDICACOES_ABSOLUTAS, CUIDADOS_AVC, ERRATA_PA_AVC,
  NITROPRUSSIATO_AVC, SANGRAMENTO_POS_ALTEPLASE, TABELA4_PAGINA, TENECTEPLASE_AVC, alteplaseAvc, avaliarTrombolise, conferirPa,
  fichaTromboliseAvcAdulto, nitroprussiatoMlH, reducao15, tenecteplaseAvc, tranexamicoPosAlteplase, type Faixa, type SituacaoPa,
} from '@/clinico/adulto/avcTrombolise'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)
const opc = (x: number) => (x > 0 ? x : undefined)

const botao = (ativo: boolean) =>
  cn('rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors', ativo ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50')

function Lista({ titulo, itens, tom }: { titulo: string; itens: string[]; tom?: 'critico' | 'atencao' }) {
  if (!itens.length) return null
  return (
    <div className="text-sm">
      <p className={cn('font-medium', tom === 'critico' && 'text-critico', tom === 'atencao' && 'text-atencao')}>{titulo}</p>
      <ul className="list-disc pl-5">{itens.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  )
}

/** Trombólise no AVC isquêmico do adulto (cap. 38 do manual do HCFMUSP). */
export function TromboliseAvcAdulto() {
  const [peso, setPeso] = useState(0)
  const [idade, setIdade] = useState(0)
  const [horas, setHoras] = useState(0)
  const [nihss, setNihss] = useState(0)
  const [plaq, setPlaq] = useState(0)
  const [inr, setInr] = useState(0)
  const [ttpa, setTtpa] = useState(0)
  const [tp, setTp] = useState(0)
  const [pas, setPas] = useState(0)
  const [pad, setPad] = useState(0)
  const [glic, setGlic] = useState(0)
  const [rankinPrev, setRankinPrev] = useState(-1)
  const [varfarina, setVarfarina] = useState(false)
  const [avcDm, setAvcDm] = useState(false)
  const [marcadas, setMarcadas] = useState<string[]>([])
  const [sitPa, setSitPa] = useState<SituacaoPa>('pre-trombolise')

  const alt = alteplaseAvc(peso)
  const tnk = tenecteplaseAvc(peso)
  const nitro = nitroprussiatoMlH(peso)
  const txa = tranexamicoPosAlteplase(peso)
  const av = avaliarTrombolise({
    idadeAnos: opc(idade), horas: horas > 0 ? horas : undefined, nihss: opc(nihss), plaquetas: opc(plaq), inr: opc(inr), ttpaS: opc(ttpa), tpS: opc(tp),
    pas: opc(pas), pad: opc(pad), glicemia: opc(glic), rankinPrevio: rankinPrev >= 0 ? rankinPrev : undefined, varfarina, avcPrevioEDiabetes: avcDm,
  })
  const pa = conferirPa(sitPa, pas, pad)
  const r15 = reducao15(pas, pad)

  return (
    <ToolLayout
      title="Trombólise no AVC isquêmico — adulto"
      description="Alteplase e tenecteplase por peso, critérios numéricos da Tabela 4, alvos de PA (com a errata do livro), nitroprussiato, sangramento e angioedema pós-alteplase. Adulto (14 anos ou mais); o critério do livro para trombólise é ≥ 18 anos."
      ficha={fichaTromboliseAvcAdulto}
    >
      <CampoPeso id="avc-peso" peso={peso} onChange={setPeso}>
        <NumberField id="avc-idade" label="Idade" unit="anos" value={idade} onChange={setIdade} min={0} />
        <NumberField id="avc-horas" label="Desde a última vez assintomático" unit="h" value={horas} onChange={setHoras} min={0} step={0.1} />
      </CampoPeso>

      <Bloco titulo="Dose do trombolítico">
        <LinhaManual
          nome="Alteplase"
          texto="0,9 mg/kg (no máximo 90 mg); 10% da dose em bolus de 1 min e o restante ao longo de 60 min"
          conta={alt ? <>total <strong>{br(alt.totalMg)} mg</strong>{alt.limitadoAoTeto && ' (no teto)'} · bolus <strong>{br(alt.bolusMg)} mg</strong> · {br(alt.infusaoMg)} mg em 60 min ({br(alt.infusaoMgH)} mg/h)</> : 'informe o peso'}
          pagina={ALTEPLASE_AVC.pagina}
        />
        <LinhaManual nome="Tenecteplase" texto={TENECTEPLASE_AVC.texto} conta={tnk !== null ? <strong>{br(tnk)} mg</strong> : 'informe o peso'} pagina={TENECTEPLASE_AVC.pagina} errata={TENECTEPLASE_AVC.errata} />
      </Bloco>

      <Bloco titulo={`Critérios numéricos da Tabela 4 (${TABELA4_PAGINA})`} descricao="A ferramenta confere os cortes contra os dados informados e mostra em que grupo do livro cada um cai. A indicação é do médico.">
        <div className="grid gap-4 md:grid-cols-4">
          <NumberField id="avc-nihss" label="NIHSS" value={nihss} onChange={setNihss} min={0} max={42} />
          <NumberField id="avc-plaq" label="Plaquetas" unit="/mm³" value={plaq} onChange={setPlaq} min={0} step={1000} />
          <NumberField id="avc-inr" label="INR" value={inr} onChange={setInr} min={0} step={0.1} />
          <NumberField id="avc-ttpa" label="TTPa" unit="s" value={ttpa} onChange={setTtpa} min={0} />
          <NumberField id="avc-tp" label="TP" unit="s" value={tp} onChange={setTp} min={0} />
          <NumberField id="avc-pas" label="PAS" unit="mmHg" value={pas} onChange={setPas} min={0} />
          <NumberField id="avc-pad" label="PAD" unit="mmHg" value={pad} onChange={setPad} min={0} />
          <NumberField id="avc-glic" label="Glicemia" unit="mg/dL" value={glic} onChange={setGlic} min={0} />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>Rankin prévio:</span>
          {[0, 1, 2, 3, 4, 5].map((g) => (
            <button key={g} type="button" aria-pressed={rankinPrev === g} onClick={() => setRankinPrev(rankinPrev === g ? -1 : g)} className={botao(rankinPrev === g)}>{g}</button>
          ))}
          <label className="ml-2 flex items-center gap-2"><input type="checkbox" className="size-4" checked={varfarina} onChange={(e) => setVarfarina(e.target.checked)} /> Uso de varfarina</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={avcDm} onChange={(e) => setAvcDm(e.target.checked)} /> AVC prévio + diabetes</label>
        </div>
        <p className="text-sm text-muted-foreground">Campo vazio ou 0 conta como não informado (vale para NIHSS, laboratório e PA). Para somar o NIHSS, use a escala do manual.</p>
        <Lista titulo="Critérios de indicação preenchidos" itens={av.indicacao} />
        <Lista titulo="Fora dos critérios de indicação" itens={av.foraDaIndicacao} tom="atencao" />
        <Lista titulo="Contraindicações absolutas (numéricas)" itens={av.absolutas} tom="critico" />
        <Lista titulo="Situações que merecem consideração de risco e benefício" itens={av.ponderar} tom="atencao" />
        {av.faltando.length > 0 && <p className="text-sm text-muted-foreground">Falta informar: {av.faltando.join(', ')}.</p>}
        <p className="text-sm font-medium">Contraindicações absolutas não numéricas (marque as presentes)</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CONTRAINDICACOES_ABSOLUTAS.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted/50">
              <input type="checkbox" className="size-4" checked={marcadas.includes(c)} onChange={(e) => setMarcadas((x) => (e.target.checked ? [...x, c] : x.filter((y) => y !== c)))} />
              {c}
            </label>
          ))}
        </div>
        {marcadas.length > 0 && <p className="text-sm text-critico">{marcadas.length} contraindicação(ões) absoluta(s) marcada(s) na lista do livro.</p>}
        <p className="text-sm text-muted-foreground">{ASPECTS_LIVRO}</p>
      </Bloco>

      <Bloco titulo="Pressão arterial">
        <p className="text-sm text-atencao"><Badge variant="warning" className="mr-1">errata</Badge>{ERRATA_PA_AVC}</p>
        <ul className="flex flex-col gap-1 text-sm">
          {ALVOS_PA_AVC.map((a) => <li key={a.situacao}><span className="font-medium">{a.situacao}:</span> {a.texto} <span className="text-muted-foreground">({a.pagina})</span></li>)}
        </ul>
        <div className="flex flex-wrap gap-2">
          {([['pre-trombolise', 'Antes da trombólise'], ['pos-trombolise', 'Após trombólise'], ['sem-trombolise', 'Sem trombólise']] as const).map(([v, r]) => (
            <button key={v} type="button" aria-pressed={sitPa === v} onClick={() => setSitPa(v)} className={botao(sitPa === v)}>{r}</button>
          ))}
        </div>
        {pa ? (
          <p className="text-sm">
            PA {pas} × {pad} mmHg: <strong className={pa.acimaDoCorte ? 'text-atencao' : undefined}>{pa.acimaDoCorte ? 'no corte ou acima' : 'abaixo do corte'}</strong> — {pa.corte} ({pa.pagina})
            {sitPa === 'sem-trombolise' && pa.acimaDoCorte && r15 && <> · 15% abaixo: {br(r15.pas, 0)} × {br(r15.pad, 0)} mmHg</>}
          </p>
        ) : <p className="text-sm text-muted-foreground">Informe PAS e PAD acima.</p>}
        <LinhaManual nome="Nitroprussiato" texto={NITROPRUSSIATO_AVC.texto} conta={nitro !== null ? <>0,25 µg/kg/min = <strong>{br(nitro, 2)} mL/h</strong> (200 µg/mL)</> : 'informe o peso'} pagina={NITROPRUSSIATO_AVC.pagina} errata={NITROPRUSSIATO_AVC.errata} />
      </Bloco>

      <Bloco titulo={`Sangramento intracraniano nas 24 h da alteplase (${SANGRAMENTO_POS_ALTEPLASE.pagina})`} descricao={`Sinais de alarme: ${SANGRAMENTO_POS_ALTEPLASE.sinaisAlarme}.`}>
        <ul className="list-disc pl-5 text-sm">{SANGRAMENTO_POS_ALTEPLASE.itens.map((i) => <li key={i}>{i}</li>)}</ul>
        <LinhaManual nome="Ácido tranexâmico" texto="10–15 mg/kg EV em 20 min" conta={txa ? <strong>{faixa(txa, 0)} mg</strong> : 'informe o peso'} pagina="p. 528 (Tabela 6)" errata={SANGRAMENTO_POS_ALTEPLASE.errata} />
      </Bloco>

      <Bloco titulo={`Angioedema orolingual (${ANGIOEDEMA_POS_ALTEPLASE.pagina})`}>
        <ul className="list-disc pl-5 text-sm">{ANGIOEDEMA_POS_ALTEPLASE.itens.map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="text-sm text-muted-foreground">{ANGIOEDEMA_POS_ALTEPLASE.errata}</p>
      </Bloco>

      <Bloco titulo="Outros cuidados do capítulo">
        <ul className="flex flex-col gap-1 text-sm">
          {CUIDADOS_AVC.map((c) => <li key={c.texto}>{c.texto} <span className="text-muted-foreground">({c.pagina})</span></li>)}
        </ul>
      </Bloco>
    </ToolLayout>
  )
}
