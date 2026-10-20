import { useState } from 'react'

import {
  ALTEPLASE_AVC, ALVOS_PA_AVC, ANGIOEDEMA_POS_ALTEPLASE, ASPECTS_LIVRO, CONTRAINDICACOES_ABSOLUTAS, CORRECAO_AHA_2026, CUIDADOS_AVC, DIRETRIZ_AVC_2026, ERRATA_PA_AVC,
  NITROPRUSSIATO_AVC, SANGRAMENTO_POS_ALTEPLASE, TABELA4_PAGINA, TENECTEPLASE_2026, TENECTEPLASE_AVC, alteplaseAvc, avaliarTrombolise, conferirPa,
  fichaTromboliseAvcAdulto, nitroprussiatoMlH, reducao15, tenecteplase2026, tenecteplaseAvc, tranexamicoPosAlteplase, type Faixa, type SituacaoPa,
} from '@/clinico/adulto/avcTrombolise'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { numero } from '@/lib/formato'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Chip } from '@/components/monitor/Pagina'

const br = (x: number, casas = 1) => numero(Math.round(x * 10 ** casas) / 10 ** casas)
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)
const opc = (x: number) => (x > 0 ? x : undefined)


function Lista({ titulo, itens, tom }: { titulo: string; itens: string[]; tom?: 'critico' | 'atencao' }) {
  if (!itens.length) return null
  return (
    <div className="text-apoio">
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
  const tnk26 = tenecteplase2026(peso)
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
      description="Alteplase e tenecteplase por peso (manual do HC e AHA/ASA 2026), critérios numéricos da Tabela 4, alvos de PA, nitroprussiato, sangramento e angioedema pós-trombólise. Adulto (14 anos ou mais); o critério do livro para trombólise é ≥ 18 anos."
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
        <LinhaManual
          nome="Tenecteplase — AHA/ASA 2026"
          texto={TENECTEPLASE_2026.texto}
          conta={tnk26 ? <>0,25 mg/kg = <strong>{br(tnk26.mg)} mg</strong>{tnk26.limitadoAoTeto && ' (no teto de 25 mg)'} · Tabela 7 ({tnk26.faixaTabela7.faixa}): <strong>{br(tnk26.faixaTabela7.mg)} mg = {br(tnk26.faixaTabela7.ml)} mL</strong> a 5 mg/mL</> : 'informe o peso'}
          pagina={TENECTEPLASE_2026.pagina}
        />
        <LinhaManual nome="Tenecteplase — manual do HC (superada pela AHA/ASA 2026)" texto={TENECTEPLASE_AVC.texto} conta={tnk !== null ? <strong>{br(tnk)} mg</strong> : 'informe o peso'} pagina={TENECTEPLASE_AVC.pagina} errata={`${TENECTEPLASE_AVC.errata} A AHA/ASA 2026 não recomenda 0,4 mg/kg (Classe 3: sem benefício, LOE A; p. 42).`} />
      </Bloco>

      <Bloco titulo="AHA/ASA 2026 — o que a diretriz escreve, com classe e página" descricao="Prabhakaran et al., Stroke 2026;57:e316–e436 (páginas do PDF). Decisão do responsável técnico (28/09/2026): alteplase e tenecteplase lado a lado. A ferramenta mostra; a indicação é do médico.">
        <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">
          {CORRECAO_AHA_2026.texto} <a className="underline" href={CORRECAO_AHA_2026.url} target="_blank" rel="noreferrer">Correção</a>
        </p>
        <div className="overflow-x-auto">
          <Table variante="referencia" className="w-full min-w-[720px] text-left align-top text-apoio">
            <TableHeader className="text-tinta-sussurro">
              <TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">AHA/ASA 2026</TableHead><TableHead className="pr-3 pb-2">Classe · página</TableHead><TableHead className="pb-2">Manual do HC</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {DIRETRIZ_AVC_2026.map((d) => (
                <TableRow key={d.tema} className="border-t">
                  <TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell>
                  <TableCell className="pr-3 py-2">{d.texto}</TableCell>
                  <TableCell className="pr-3 py-2 text-tinta-sussurro">{d.classe} · {d.pagina}</TableCell>
                  <TableCell className="py-2 text-tinta-sussurro">{d.livro ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
        <div className="flex flex-wrap items-center gap-2 text-apoio">
          <span>Rankin prévio:</span>
          {[0, 1, 2, 3, 4, 5].map((g) => (
            <Chip key={g} variante="opcao" ativo={rankinPrev === g} onClick={() => setRankinPrev(rankinPrev === g ? -1 : g)}>{g}</Chip>
          ))}
          <label className="ml-2 flex items-center gap-2"><input type="checkbox" className="size-4" checked={varfarina} onChange={(e) => setVarfarina(e.target.checked)} /> Uso de varfarina</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={avcDm} onChange={(e) => setAvcDm(e.target.checked)} /> AVC prévio + diabetes</label>
        </div>
        <p className="text-apoio text-tinta-sussurro">Campo vazio ou 0 conta como não informado (vale para NIHSS, laboratório e PA). Para somar o NIHSS, use a escala do manual.</p>
        <Lista titulo="Critérios de indicação preenchidos" itens={av.indicacao} />
        <Lista titulo="Fora dos critérios de indicação" itens={av.foraDaIndicacao} tom="atencao" />
        <Lista titulo="Contraindicações absolutas (numéricas)" itens={av.absolutas} tom="critico" />
        <Lista titulo="Situações que merecem consideração de risco e benefício" itens={av.ponderar} tom="atencao" />
        {av.faltando.length > 0 && <p className="text-apoio text-tinta-sussurro">Falta informar: {av.faltando.join(', ')}.</p>}
        <p className="text-apoio font-medium">Contraindicações absolutas não numéricas (marque as presentes)</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {CONTRAINDICACOES_ABSOLUTAS.map((c) => (
            <label key={c} className="flex cursor-pointer items-center gap-2 rounded-controle border px-2.5 py-1.5 text-apoio hover:bg-trilha/50">
              <input type="checkbox" className="size-4" checked={marcadas.includes(c)} onChange={(e) => setMarcadas((x) => (e.target.checked ? [...x, c] : x.filter((y) => y !== c)))} />
              {c}
            </label>
          ))}
        </div>
        {marcadas.length > 0 && <p className="text-apoio text-critico">{marcadas.length} contraindicação(ões) absoluta(s) marcada(s) na lista do livro.</p>}
        <p className="text-apoio text-tinta-sussurro">{ASPECTS_LIVRO}</p>
      </Bloco>

      <Bloco titulo="Pressão arterial">
        <p className="text-apoio text-atencao"><Badge variant="warning" className="mr-1">errata</Badge>{ERRATA_PA_AVC}</p>
        <ul className="flex flex-col gap-1 text-apoio">
          {ALVOS_PA_AVC.map((a) => <li key={a.situacao}><span className="font-medium">{a.situacao}:</span> {a.texto} <span className="text-tinta-sussurro">({a.pagina})</span></li>)}
        </ul>
        <div className="flex flex-wrap gap-2">
          {([['pre-trombolise', 'Antes da trombólise'], ['pos-trombolise', 'Após trombólise'], ['sem-trombolise', 'Sem trombólise']] as const).map(([v, r]) => (
            <Chip key={v} variante="opcao" ativo={sitPa === v} onClick={() => setSitPa(v)}>{r}</Chip>
          ))}
        </div>
        {pa ? (
          <p className="text-apoio">
            PA {pas} × {pad} mmHg: <strong className={pa.acimaDoCorte ? 'text-atencao' : undefined}>{pa.acimaDoCorte ? 'no corte ou acima' : 'abaixo do corte'}</strong> — {pa.corte} ({pa.pagina})
            {sitPa === 'sem-trombolise' && pa.acimaDoCorte && r15 && <> · 15% abaixo: {br(r15.pas, 0)} × {br(r15.pad, 0)} mmHg</>}
          </p>
        ) : <p className="text-apoio text-tinta-sussurro">Informe PAS e PAD acima.</p>}
        <LinhaManual nome="Nitroprussiato" texto={NITROPRUSSIATO_AVC.texto} conta={nitro !== null ? <>0,25 µg/kg/min = <strong>{br(nitro, 2)} mL/h</strong> (200 µg/mL)</> : 'informe o peso'} pagina={NITROPRUSSIATO_AVC.pagina} errata={NITROPRUSSIATO_AVC.errata} />
      </Bloco>

      <Bloco titulo={`Sangramento intracraniano nas 24 h da alteplase (${SANGRAMENTO_POS_ALTEPLASE.pagina})`} descricao={`Sinais de alarme: ${SANGRAMENTO_POS_ALTEPLASE.sinaisAlarme}.`}>
        <ul className="list-disc pl-5 text-apoio">{SANGRAMENTO_POS_ALTEPLASE.itens.map((i) => <li key={i}>{i}</li>)}</ul>
        <LinhaManual nome="Ácido tranexâmico" texto="10–15 mg/kg EV em 20 min" conta={txa ? <strong>{faixa(txa, 0)} mg</strong> : 'informe o peso'} pagina="p. 528 (Tabela 6)" errata={SANGRAMENTO_POS_ALTEPLASE.errata} />
      </Bloco>

      <Bloco titulo={`Angioedema orolingual (${ANGIOEDEMA_POS_ALTEPLASE.pagina})`}>
        <ul className="list-disc pl-5 text-apoio">{ANGIOEDEMA_POS_ALTEPLASE.itens.map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="text-apoio text-tinta-sussurro">{ANGIOEDEMA_POS_ALTEPLASE.errata}</p>
      </Bloco>

      <Bloco titulo="Outros cuidados do capítulo">
        <ul className="flex flex-col gap-1 text-apoio">
          {CUIDADOS_AVC.map((c) => <li key={c.texto}>{c.texto} <span className="text-tinta-sussurro">({c.pagina})</span></li>)}
        </ul>
      </Bloco>
    </ToolLayout>
  )
}
