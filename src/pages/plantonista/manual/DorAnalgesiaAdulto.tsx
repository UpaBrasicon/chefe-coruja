import { useState } from 'react'

import {
  ADJUVANTES_TEXTO, DOR_NEUROPATICA, ESCADA_ANALGESICA, ESCADA_PAGINA, OCTREOTIDE, OPIOIDES, QUETAMINA_ANALGESICA,
  esquemasOpioide, fichaDorAnalgesiaAdulto, intensidadeNumerica, meperidinaMaximos, morfinaEvMl, opioidePorPeso,
  quetaminaAnalgesica, type Faixa, type Opioide,
} from '@/clinico/adulto/dorAnalgesia'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

function contaOpioide(o: Opioide, peso: number) {
  const esquemas = esquemasOpioide(o)
  const porPeso = opioidePorPeso(o, peso)
  const partes = []
  if (o.porKg) {
    partes.push(porPeso
      ? <span key="kg">{o.porKg.rotulo} <strong>{faixa(porPeso)} {o.porKg.unidade}</strong>{o.id === 'morfina' && ` = ${faixa(morfinaEvMl(peso)!)} mL a 1 mg/mL`}</span>
      : <span key="kg">informe o peso</span>)
  }
  if (o.id === 'meperidina') {
    const m = meperidinaMaximos(peso)
    if (m) partes.push(<span key="max"> · máximo diário 1.000 mg ou {br(m.porPesoMg, 0)} mg (20 mg/kg)</span>)
  }
  if (esquemas.length) {
    partes.push(<span key="dia">{esquemas.map((e) => `${br(e.doseMg, 0)} mg ${e.intervaloH}/${e.intervaloH} h = ${br(e.diaMg, 0)} mg/dia${e.acimaDoMaximo ? ' (acima do máximo)' : ''}`).join(' · ')}</span>)
  }
  return partes.length ? <>{partes}</> : undefined
}

/** Dor e analgesia do adulto (cap. 9 do manual do HCFMUSP). */
export function DorAnalgesiaAdulto() {
  const [peso, setPeso] = useState(0)
  const [nota, setNota] = useState(0)
  const intensidade = intensidadeNumerica(nota)
  const q = quetaminaAnalgesica(peso)

  return (
    <ToolLayout
      title="Dor e analgesia — adulto"
      description="Escala numérica e escada analgésica, opioides da Tabela 3 com a conta por peso e por dia, e quetamina em dose analgésica, pelo manual do HC. Adulto (14 anos ou mais)."
      ficha={fichaDorAnalgesiaAdulto}
    >
      <CampoPeso id="dor-peso" peso={peso} onChange={setPeso}>
        <NumberField id="dor-nota" label="Escala numérica (0–10)" value={nota} onChange={setNota} min={0} max={10} />
      </CampoPeso>
      {intensidade && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          Nota {nota}: <Badge variant={intensidade === 'intensa' ? 'destructive' : intensidade === 'moderada' ? 'warning' : 'success'}>{intensidade}</Badge>
          <span className="text-muted-foreground">faixas da Figura 2 (p. 147). Para quem não se comunica: PAINAD e BPS (Tabelas 1 e 2).</span>
        </p>
      )}

      <Bloco titulo={`Escada analgésica (${ESCADA_PAGINA})`} descricao={ADJUVANTES_TEXTO}>
        <ul className="grid gap-1 text-sm md:grid-cols-2">
          {ESCADA_ANALGESICA.map((e) => (
            <li key={e.degrau} className="rounded-lg border px-3 py-2"><span className="font-medium">{e.degrau}º — {e.dor}</span><br />{e.classe}</li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">Dor neuropática, sequência do livro ({DOR_NEUROPATICA.pagina}): {DOR_NEUROPATICA.sequencia.map((s, i) => `${i + 1}. ${s}`).join('; ')}.</p>
        <p className="text-sm text-muted-foreground">Octreotide: {OCTREOTIDE.texto} ({OCTREOTIDE.pagina}).</p>
      </Bloco>

      <Bloco titulo="Opioides (Tabela 3, p. 147–149)" descricao="O livro não traz tabela de equianalgesia: não há conversão entre opioides nesta tela.">
        {OPIOIDES.map((o) => (
          <LinhaManual key={o.id} nome={`${o.nome} (${o.forca}; ${o.vias})`} texto={o.texto} conta={contaOpioide(o, peso)} pagina={o.pagina} errata={o.errata} nota={o.nota} />
        ))}
      </Bloco>

      <Bloco titulo="Quetamina em dose analgésica">
        <LinhaManual nome="Cap. 9" texto={QUETAMINA_ANALGESICA.cap9.texto} conta={q ? <strong>{faixa(q.bolusCap9Mg)} mg</strong> : 'informe o peso'} pagina={QUETAMINA_ANALGESICA.cap9.pagina} />
        <LinhaManual
          nome="Cap. 104 (paliativo)"
          texto={QUETAMINA_ANALGESICA.cap104.texto}
          conta={q ? <>bolus <strong>{faixa(q.bolusMg)} mg</strong> em 15–30 min · infusão <strong>{faixa(q.infusaoMgH, 2)} mg/h</strong> = {faixa(q.infusaoMlH)} mL/h ({br(q.mgMl)} mg/mL, Anexo 1)</> : 'informe o peso'}
          pagina={QUETAMINA_ANALGESICA.cap104.pagina}
          errata={QUETAMINA_ANALGESICA.errata}
        />
      </Bloco>
    </ToolLayout>
  )
}
