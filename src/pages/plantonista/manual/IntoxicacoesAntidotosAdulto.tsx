import { useState } from 'react'

import {
  ALCOOIS, BCC, BETABLOQUEADOR, BICARBONATO_ERRATA, BICARBONATO_LITIO, BICARBONATO_USOS, CARVAO, CARVAO_INDICACAO, CIANETO,
  DIGOXINA, FISOSTIGMINA, FLUMAZENIL, KINGS_COLLEGE, MONOXIDO, NAC, NALOXONA, ORGANOFOSFORADO, PEDIATRICO_CITADO,
  acidoFolicoMg, atropinaDobrando, bccFigura, bicarbonatoBolus, calcioBccManutencao, carvaoMultiplasDoses, carvaoPorMassaIngerida,
  carvaoPorPeso, carvaoTriciclico, etanolEV, fichaIntoxicacoesAdulto, flumazenilBolusMaximos, fomepizol, frascosPorDose,
  frascosPorNivel, gravidadeParacetamol, hidroxocobalaminaProxima, indicacoesNac, insulinaAltaDose, nacEV, nacVO,
  nitritoSodioMg, pralidoxima, tiossulfatoAdultoMl, type Faixa,
} from '@/clinico/adulto/intoxicacoes'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Escolha } from './LoteAPecas'
import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)
const PESO = 'informe o peso'

type SimNao = 'sim' | 'nao'
const SIM_NAO = [{ value: 'nao' as const, label: 'Não' }, { value: 'sim' as const, label: 'Sim' }]

function Carvao({ peso }: { peso: number }) {
  const [gramas, setGramas] = useState(0)
  const [intervalo, setIntervalo] = useState<'2' | '3' | '4'>('4')
  const porMassa = carvaoPorMassaIngerida(gramas)
  const porPeso = carvaoPorPeso(peso)
  const tca = carvaoTriciclico(peso)
  const mult = carvaoMultiplasDoses(Number(intervalo))
  return (
    <Bloco titulo="Carvão ativado (cap. 97)" descricao="Sempre VO, com ingestão voluntária; SNG só se o paciente já estiver intubado.">
      <div className="grid gap-4 md:grid-cols-3">
        <NumberField id="intox-carvao-g" label="Massa ingerida da substância" unit="g" value={gramas} onChange={setGramas} min={0} step={0.1} />
      </div>
      <LinhaManual nome="Dose conhecida" texto="10 g de carvão para cada 1 g da substância ingerida" pagina="p. 1300"
        conta={porMassa ? <strong>{br(porMassa)} g</strong> : 'informe a massa ingerida'} />
      <LinhaManual nome="Dose desconhecida" texto={`${faixa(CARVAO.semDoseConhecidaG, 0)} g (1 g/kg)`} pagina="p. 1300"
        conta={porPeso ? <><strong>{br(porPeso.g)} g</strong>{porPeso.foraDaFaixa && ' (1 g/kg fora da faixa de 25–100 g)'}</> : PESO} />
      <LinhaManual nome="Tricíclicos" texto="1 g/kg, máximo de 50 g, em até 1 h" pagina="p. 1308"
        conta={tca ? <><strong>{br(tca.g)} g</strong>{tca.limitadoAoTeto && ' (no teto)'}</> : PESO} />
      <Escolha label="Múltiplas doses: intervalo" value={intervalo} onChange={setIntervalo}
        opcoes={[{ value: '2', label: 'a cada 2 h' }, { value: '3', label: 'a cada 3 h' }, { value: '4', label: 'a cada 4 h' }]} />
      <LinhaManual nome="Múltiplas doses" texto="12,5 g/hora ou o equivalente a cada 2 a 4 horas (ex.: 50 g a cada 4 h)" pagina="p. 1302"
        conta={mult !== null ? <strong>{br(mult)} g por dose</strong> : undefined} />
      {CARVAO_INDICACAO.map((i) => <LinhaManual key={i.id} nome={i.nome} texto={i.texto} pagina={i.pagina} errata={i.errata} />)}
    </Bloco>
  )
}

function Paracetamol({ peso }: { peso: number }) {
  const [gramas, setGramas] = useState(0)
  const [nivel, setNivel] = useState<SimNao>('sim')
  const [tempoDesc, setTempoDesc] = useState<SimNao>('nao')
  const [nivelUg, setNivelUg] = useState(0)
  const [linha, setLinha] = useState<SimNao>('nao')
  const [hepato, setHepato] = useState<SimNao>('nao')
  const grav = gravidadeParacetamol(gramas)
  const ind = indicacoesNac({ gramasIngeridos: gramas, nivelDisponivel: nivel === 'sim', tempoDesconhecido: tempoDesc === 'sim', nivelUgMl: nivelUg, acimaDaLinhaNomograma: linha === 'sim', hepatotoxicidade: hepato === 'sim' })
  const vo = nacVO(peso)
  const ev = nacEV(peso)
  return (
    <Bloco titulo="Paracetamol e N-acetilcisteína (cap. 98)" descricao={`NAC: ${NAC.janela}. Carvão até 4 h (p. 1311).`}>
      <div className="grid gap-4 md:grid-cols-3">
        <NumberField id="intox-pcm-g" label="Paracetamol ingerido" unit="g" value={gramas} onChange={setGramas} min={0} step={0.5} />
        <NumberField id="intox-pcm-nivel" label="Nível sérico" unit="µg/mL" value={nivelUg} onChange={setNivelUg} min={0} step={1} />
      </div>
      {grav && <p className="text-sm">Gravidade pela quantidade: <strong>{grav.rotulo}</strong> ({grav.pagina})</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <Escolha label="Nível sérico disponível?" value={nivel} onChange={setNivel} opcoes={SIM_NAO} />
        <Escolha label="Tempo da ingestão desconhecido?" value={tempoDesc} onChange={setTempoDesc} opcoes={SIM_NAO} />
        <Escolha label="Nível após 4 h acima da linha do nomograma?" value={linha} onChange={setLinha} opcoes={SIM_NAO} />
        <Escolha label="Transaminases > 2–3 × LSN?" value={hepato} onChange={setHepato} opcoes={SIM_NAO} />
      </div>
      <p className="text-sm">
        Indicações de NAC presentes (p. 1311): {ind.length === 0 ? <strong>nenhuma das listadas</strong> : <strong>{ind.join('; ')}</strong>}
      </p>
      <p className="text-sm text-tinta-sussurro">O nomograma de Rumack-Matthew é só citado no manual (a linha não está no livro); a posição do nível em relação à linha é informada por quem usa.</p>
      <LinhaManual nome="NAC VO" texto={NAC.vo.texto} pagina={NAC.vo.pagina}
        conta={vo ? <>ataque <strong>{br(vo.ataqueMg, 0)} mg</strong> · manutenção <strong>{br(vo.manutencaoMg, 0)} mg</strong> 4/4 h (≈ {vo.doses} doses)</> : PESO} />
      <LinhaManual nome="NAC EV (3 fases)" texto={`${NAC.ev.quando}: 150 mg/kg em 60 min em 200–300 mL de SF ou SG 5%; 50 mg/kg em 4 h; 100 mg/kg em 16 h`}
        pagina={NAC.ev.pagina} errata={NAC.ev.errata}
        conta={ev ? <>total <strong>{br(ev.totalMg, 0)} mg</strong> ({ev.totalMgKg} mg/kg em 21 h)</> : PESO} />
      {ev && (
        <ul className="grid gap-1 text-sm md:grid-cols-3">
          {ev.fases.map((f) => (
            <li key={f.rotulo} className="rounded-lg border px-3 py-2">
              <span className="font-medium">{f.rotulo}</span><br />
              {br(f.mg, 0)} mg em {f.horas} h = {br(f.mgH, 0)} mg/h ({br(f.mgKgH, 2)} mg/kg/h)<br />
              <span className="text-tinta-sussurro">{f.preparo}</span>
            </li>
          ))}
        </ul>
      )}
      <LinhaManual nome={KINGS_COLLEGE.nome} texto={KINGS_COLLEGE.texto} pagina={KINGS_COLLEGE.pagina} />
    </Bloco>
  )
}

function AntidotosFixos() {
  return (
    <Bloco titulo="Antídotos de dose fixa (cap. 98)">
      <LinhaManual nome="Flumazenil" texto={FLUMAZENIL.texto} pagina={FLUMAZENIL.pagina} conta={<>até <strong>{flumazenilBolusMaximos()} bolus</strong> de 0,2 mg</>} />
      {NALOXONA.cenarios.map((c) => (
        <LinhaManual key={c.id} nome={`Naloxona — ${c.rotulo}`} texto={`${faixa(c.mg, 2)} mg IV; ${NALOXONA.alvo}`} pagina={NALOXONA.pagina} />
      ))}
      <p className="text-sm text-tinta-sussurro">Naloxona: {NALOXONA.reconsiderar}; {NALOXONA.alta} ({NALOXONA.pagina}).</p>
      <LinhaManual nome={FISOSTIGMINA.nome} texto={FISOSTIGMINA.texto} pagina={FISOSTIGMINA.pagina} nota={FISOSTIGMINA.nota} />
    </Bloco>
  )
}

function Cardiotoxicos({ peso }: { peso: number }) {
  const ins = insulinaAltaDose(peso)
  const ca = calcioBccManutencao(peso)
  const fig = bccFigura(peso)
  const b = BETABLOQUEADOR
  return (
    <>
      <Bloco titulo="Betabloqueador (p. 1317–1318)" descricao={b.sequencia}>
        <LinhaManual nome="Atropina" texto={`${b.atropina.mg} mg IV, até ${b.atropina.dosesMax} doses (com cristaloide)`} pagina={b.atropina.pagina}
          conta={<>até <strong>{b.atropina.mg * b.atropina.dosesMax} mg</strong></>} />
        <LinhaManual nome="1. Glucagon" texto={b.glucagon.texto} pagina={b.glucagon.pagina} />
        <LinhaManual nome="2. Gluconato de cálcio 10%" texto={b.calcio.texto} pagina={b.calcio.pagina} />
        <LinhaManual nome="3. Adrenalina" texto={b.adrenalina.texto} pagina={b.adrenalina.pagina} />
        <LinhaManual nome="4. Insulina em alta dose" texto={b.insulina.texto} pagina={b.insulina.pagina} errata={b.insulina.errata}
          conta={ins ? <>bolus <strong>{br(ins.bolusUi, 0)} UI</strong> · <strong>{br(ins.infusaoUiH, 0)} UI/h</strong> · teto impresso {br(ins.tetoUi, 0)} UI</> : PESO} />
        <LinhaManual nome="5. Emulsão lipídica" texto={b.emulsao.texto} pagina={b.emulsao.pagina} />
      </Bloco>
      <Bloco titulo="Bloqueador de canal de cálcio (p. 1318 e Figura 2, p. 1321)" descricao={BCC.gravidade}>
        <LinhaManual nome="Cálcio (texto)" texto={BCC.calcio.texto} pagina={BCC.calcio.pagina} errata={BCC.calcio.errata}
          conta={ca ? <>manutenção <strong>{faixa(ca)} mL/h</strong> de gluconato 10%</> : PESO} />
        <LinhaManual nome="Cálcio (figura)" texto={BCC.figura.calcio} pagina={BCC.figura.pagina} />
        <LinhaManual nome="Vasopressor (figura)" texto={BCC.figura.vasopressor} pagina={BCC.figura.pagina} />
        <LinhaManual nome="Glucagon (figura)" texto="3–10 mg (0,03–0,05 mg/kg); repetir a cada 10 min ou infusão EV 1–5 mg/h" pagina={BCC.figura.pagina}
          conta={fig ? <>0,03–0,05 mg/kg = <strong>{faixa(fig.glucagonPorPesoMg)} mg</strong></> : PESO} />
        <LinhaManual nome="Insulina (figura)" texto={`${BCC.figura.glicose}; insulina 0,5–1 U/kg + 0,5–1 U/kg/h`} pagina={BCC.figura.pagina}
          conta={fig ? <>bolus <strong>{faixa(fig.insulinaBolusUi, 0)} UI</strong> · <strong>{faixa(fig.insulinaInfusaoUiH, 0)} UI/h</strong></> : PESO} />
        <LinhaManual nome="Emulsão lipídica 20% (figura)" texto="1,5 mL/kg em bolus de 2–3 min, seguido de 0,5 mL/kg/min" pagina={BCC.figura.pagina}
          conta={fig ? <>bolus <strong>{br(fig.emulsaoBolusMl, 0)} mL</strong> · <strong>{br(fig.emulsaoMlMin)} mL/min</strong> ({br(fig.emulsaoMlH, 0)} mL/h)</> : PESO} />
        <p className="text-sm text-tinta-sussurro">{BCC.figura.depois} ({BCC.figura.pagina}).</p>
        <ul className="list-disc pl-5 text-sm text-atencao">
          {BCC.divergencias.map((d) => <li key={d}>{d}</li>)}
        </ul>
      </Bloco>
    </>
  )
}

function Digoxina({ peso }: { peso: number }) {
  const [mg, setMg] = useState(0)
  const [nivel, setNivel] = useState(0)
  const porDose = frascosPorDose(mg)
  const porNivel = frascosPorNivel(nivel, peso)
  return (
    <Bloco titulo="Digoxina — anticorpo antidigoxina (p. 1319–1322)" descricao={`Indicações: ${DIGOXINA.indicacoes}. Nível terapêutico ${DIGOXINA.nivelTerapeutico}.`}>
      <div className="grid gap-4 md:grid-cols-3">
        <NumberField id="intox-dig-mg" label="Digoxina ingerida" unit="mg" value={mg} onChange={setMg} min={0} step={0.25} />
        <NumberField id="intox-dig-nivel" label="Digoxinemia" unit="ng/mL" value={nivel} onChange={setNivel} min={0} step={0.1} />
      </div>
      <LinhaManual nome="Quantidade e nível desconhecidos" texto="10 frascos (cada frasco liga ≈ 0,5 mg de digoxina)" pagina="p. 1322" conta={<strong>{DIGOXINA.frascosEmpiricos} frascos</strong>} />
      <LinhaManual nome="Quantidade conhecida, sem nível" texto="nº de frascos = [dose (mg) × 0,8] / 0,5" pagina="p. 1322"
        conta={porDose !== null ? <strong>{br(porDose)} frascos</strong> : 'informe a dose ingerida'} />
      <LinhaManual nome="Quantidade e nível conhecidos" texto="nº de frascos = [digoxinemia (ng/mL) × peso] / 100" pagina="p. 1322"
        conta={porNivel !== null ? <strong>{br(porNivel)} frascos</strong> : 'informe digoxinemia e peso'} nota={DIGOXINA.nota} />
    </Bloco>
  )
}

function Bicarbonato({ peso }: { peso: number }) {
  return (
    <Bloco titulo="Bicarbonato de sódio 8,4%" descricao="1 mEq/mL (50 mEq/50 mL, cap. 69, p. 938).">
      {BICARBONATO_USOS.map((u) => {
        const r = bicarbonatoBolus(u, peso)
        return (
          <LinhaManual key={u.id} nome={u.nome} texto={`${faixa(u.mEqKg, 0)} mEq/kg; ${u.texto}`} pagina={u.pagina}
            conta={r ? <>bolus <strong>{faixa(r.mEq, 0)} mEq</strong> = {faixa(r.ml, 0)} mL</> : PESO} />
        )
      })}
      <LinhaManual nome="Lítio" texto={BICARBONATO_LITIO.texto} pagina={BICARBONATO_LITIO.pagina} errata={BICARBONATO_ERRATA} />
    </Bloco>
  )
}

function Alcoois({ peso }: { peso: number }) {
  const fo = fomepizol(peso)
  const et = etanolEV(peso)
  const af = acidoFolicoMg(peso)
  return (
    <Bloco titulo="Metanol e etilenoglicol (cap. 99, Tabela 2)" descricao={`Fomepizol ou etanol se: ${ALCOOIS.indicacaoInibicao} (p. 1327). ${ALCOOIS.gapOsmolar}`}>
      <LinhaManual nome="Fomepizol" texto={ALCOOIS.fomepizol.texto} pagina={ALCOOIS.fomepizol.pagina} errata={ALCOOIS.fomepizol.errata}
        conta={fo ? <>ataque <strong>{br(fo.ataqueMg, 0)} mg</strong> · <strong>{br(fo.manutencaoMg, 0)} mg</strong> 12/12 h ({fo.dosesEm48h} doses em 48 h) · depois {br(fo.depoisMg, 0)} mg</> : PESO} />
      <LinhaManual nome="Etanol 10% EV" texto={ALCOOIS.etanolEV.texto} pagina={ALCOOIS.etanolEV.pagina}
        conta={et ? <>ataque <strong>{br(et.ataqueMl, 0)} mL</strong> · <strong>{br(et.infusaoMlH)} mL/h</strong></> : PESO} />
      <LinhaManual nome="Etanol VO" texto={ALCOOIS.etanolVO.texto} pagina={ALCOOIS.etanolVO.pagina} errata={ALCOOIS.etanolVO.errata} />
      <LinhaManual nome="Ácido fólico (metanol)" texto={ALCOOIS.acidoFolico.texto} pagina={ALCOOIS.acidoFolico.pagina}
        conta={af !== null ? <strong>{br(af)} mg 4/4 h</strong> : PESO} />
      {ALCOOIS.outros.map((i) => <LinhaManual key={i.id} nome={i.nome} texto={i.texto} pagina={i.pagina} nota={i.nota} />)}
    </Bloco>
  )
}

function Organofosforado({ peso }: { peso: number }) {
  const [inicial, setInicial] = useState<'2' | '5'>('2')
  const seq = atropinaDobrando(Number(inicial), 5)
  const pr = pralidoxima(peso)
  const o = ORGANOFOSFORADO
  return (
    <Bloco titulo="Organofosforados e carbamatos (p. 1333–1334)" descricao={`Prova terapêutica: atropina ${o.provaAtropinaMg} mg IV.`}>
      <Escolha label="Atropina: dose inicial" value={inicial} onChange={setInicial} opcoes={[{ value: '2', label: '2 mg' }, { value: '5', label: '5 mg' }]} />
      <LinhaManual nome="Atropina" texto={`2–5 mg IV; ${o.alvo}`} pagina="p. 1333"
        conta={<>{seq.map((s, i) => <span key={i}>{i > 0 && ' → '}{br(s.dose)} mg</span>)} (acumulado {br(seq[seq.length - 1].acumulado)} mg)</>} />
      <LinhaManual nome="Pralidoxima" texto={o.pralidoxima.texto} pagina="p. 1334"
        conta={pr ? <>bolus <strong>{br(pr.bolusMg, 0)} mg</strong> em 30 min · <strong>{br(pr.infusaoMgH, 0)} mg/h</strong></> : PESO} />
    </Bloco>
  )
}

function Cianeto() {
  const [feito, setFeito] = useState(0)
  const h = hidroxocobalaminaProxima(feito)
  return (
    <Bloco titulo="Cianeto e monóxido de carbono (p. 1334–1337)" descricao={`Suspeita de cianeto: ${CIANETO.suspeita}.`}>
      <div className="grid gap-4 md:grid-cols-3">
        <NumberField id="intox-cn-feito" label="Hidroxocobalamina já feita (inclui pré-hospitalar)" unit="g" value={feito} onChange={setFeito} min={0} step={0.5} />
      </div>
      <LinhaManual nome="Hidroxocobalamina" texto="5 g em 15 min; repetir se necessário até 10 g no total" pagina={CIANETO.pagina}
        conta={h ? (h.doseG > 0 ? <>próxima até <strong>{br(h.doseG)} g</strong> (restam {br(h.restanteDepoisG)} g depois)</> : <strong>teto de 10 g atingido</strong>) : undefined} />
      <LinhaManual nome="Tiossulfato de sódio 25%" texto="adulto 12,5 g EV" pagina={CIANETO.tiossulfato.pagina} errata={CIANETO.tiossulfato.errata}
        conta={<><strong>12,5 g</strong> = {br(tiossulfatoAdultoMl(), 0)} mL a 25%</>} />
      <LinhaManual nome="Nitritos (sem hidroxocobalamina)" texto={`${CIANETO.nitritoAmila}; ${CIANETO.nitritoSodio.texto}; depois tiossulfato 12,5 g EV`} pagina={CIANETO.pagina}
        conta={<>nitrito de sódio <strong>{br(nitritoSodioMg(), 0)} mg</strong> (10 mL a 3%)</>} />
      <p className="text-sm text-tinta-sussurro">{CIANETO.sequencia}</p>
      <LinhaManual nome={MONOXIDO.nome} texto={MONOXIDO.texto} pagina={MONOXIDO.pagina} />
      <p className="text-sm text-tinta-sussurro">Valores pediátricos que o capítulo cita e esta ferramenta de adulto não usa: {PEDIATRICO_CITADO.join('; ')}.</p>
    </Bloco>
  )
}

/** Intoxicações e antídotos do adulto (caps. 97–99 do manual do HCFMUSP). */
export function IntoxicacoesAntidotosAdulto() {
  const [peso, setPeso] = useState(0)
  return (
    <ToolLayout
      title="Intoxicações e antídotos — adulto"
      description="Carvão ativado, NAC, antídotos, cardiotóxicos, digoxina, bicarbonato, álcoois tóxicos, organofosforados e cianeto pelo manual do HC, com contas por peso. Adulto (14 anos ou mais)."
      ficha={fichaIntoxicacoesAdulto}
    >
      <CampoPeso id="intox-peso" peso={peso} onChange={setPeso} />
      <Carvao peso={peso} />
      <Paracetamol peso={peso} />
      <AntidotosFixos />
      <Cardiotoxicos peso={peso} />
      <Digoxina peso={peso} />
      <Bicarbonato peso={peso} />
      <Alcoois peso={peso} />
      <Organofosforado peso={peso} />
      <Cianeto />
    </ToolLayout>
  )
}
