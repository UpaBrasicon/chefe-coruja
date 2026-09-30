import { useState } from 'react'

import {
  ADJUVANTES_SAP, ALTA_SAP, ASA_SAP, DROGAS_SAP, FLUMAZENIL, JEJUM_SAP, KETOFOL, NALOXONA, NIVEIS_SEDACAO, RISCO_AUMENTADO_SAP,
  calcularAdjuvante, calcularSap, fichaSedacaoProcedimentoAdulto, type DrogaSap, type Faixa,
} from '@/clinico/adulto/sedacaoProcedimento'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

function Droga({ d, peso, virgemOpioide }: { d: DrogaSap; peso: number; virgemOpioide: boolean }) {
  const r = calcularSap(d, peso, { virgemOpioide })
  const conta = !r ? 'informe o peso' : (
    <>
      inicial <strong>{faixa(r.inicial)} {d.unidade}</strong>
      {r.limitadoAoTeto && ' (no teto)'}
      {r.inicialMl.map((m) => <span key={m.concentracao}> · {faixa(m.ml, 2)} mL a {br(m.concentracao)} {d.unidade}/mL</span>)}
      {r.repique && <> · repique {faixa(r.repique)} {d.unidade}</>}
    </>
  )
  const texto = [d.inicialTexto, d.repiqueTexto && `repique: ${d.repiqueTexto}`, d.teto?.texto, d.apresentacao, d.acao].filter(Boolean).join('; ')
  return <LinhaManual nome={d.nome} texto={texto} conta={conta} pagina={d.pagina} errata={d.errata} nota={d.notas.join(' ') || undefined} />
}

/** Sedação e analgesia para procedimentos do adulto (cap. 10 do manual do HCFMUSP). */
export function SedacaoProcedimentoAdulto() {
  const [peso, setPeso] = useState(0)
  const [virgem, setVirgem] = useState(true)

  return (
    <ToolLayout
      title="Sedação e analgesia para procedimentos — adulto"
      description="Doses por peso do manual do HC (etomidato, midazolam, propofol, quetamina, fentanil, morfina), reversores, níveis de sedação, ASA, jejum e alta. Adulto (14 anos ou mais)."
      ficha={fichaSedacaoProcedimentoAdulto}
    >
      <CampoPeso id="sap-peso" peso={peso} onChange={setPeso}>
        <label className="flex items-center gap-2 self-end text-sm">
          <input type="checkbox" className="size-4" checked={virgem} onChange={(e) => setVirgem(e.target.checked)} />
          Virgem de opioide (teto de 4 mg da morfina)
        </label>
      </CampoPeso>
      <p className="text-sm text-tinta-sussurro">{RISCO_AUMENTADO_SAP} Em obesos, o livro manda usar o peso ideal no bolus de propofol e quetamina, sem dar a fórmula: informe o peso que será usado.</p>

      <Bloco titulo="Drogas (Tabela 2, p. 161–166)" descricao="Doses do livro; o volume sai da concentração da apresentação citada.">
        {DROGAS_SAP.map((d) => <Droga key={d.id} d={d} peso={peso} virgemOpioide={virgem} />)}
        <LinhaManual nome="Ketofol" texto={KETOFOL.texto} pagina={KETOFOL.pagina} errata={KETOFOL.errata} />
      </Bloco>

      <Bloco titulo="Adjuvantes citados na Tabela 2">
        {ADJUVANTES_SAP.map((a) => {
          const r = calcularAdjuvante(a, peso)
          return <LinhaManual key={a.id} nome={a.nome} texto={a.texto} conta={r ? <strong>{faixa(r)} {a.unidade}</strong> : 'informe o peso'} pagina={a.pagina} />
        })}
      </Bloco>

      <Bloco titulo="Reversores">
        <LinhaManual nome="Flumazenil (benzodiazepínico)" texto={FLUMAZENIL.texto} conta={<>até <strong>{br(FLUMAZENIL.maxCicloMg)} mg</strong> por ciclo · <strong>{br(FLUMAZENIL.maxHoraMg)} mg/h</strong></>} pagina={FLUMAZENIL.pagina} />
        <LinhaManual nome="Naloxona (opioide)" texto={NALOXONA.texto} conta={<>inicial <strong>{faixa(NALOXONA.inicialMg)} mg</strong></>} pagina={NALOXONA.pagina} />
      </Bloco>

      <Bloco titulo="Níveis de sedoanalgesia (Tabela 1, p. 156–158)" descricao="A sedação é contínua, sem marcos definitivos entre os níveis.">
        <ul className="grid gap-1 text-sm md:grid-cols-2">
          {NIVEIS_SEDACAO.map((n) => (
            <li key={n.nivel} className="rounded-lg border px-3 py-2"><span className="font-medium">{n.nivel}</span><br />{n.clinica}<br /><span className="text-tinta-sussurro">{n.via}</span></li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="ASA, jejum e alta">
        <ul className="flex flex-col gap-1 text-sm">
          {ASA_SAP.map((a) => <li key={a.classe}><span className="font-medium">{a.classe}:</span> {a.texto} <span className="text-tinta-sussurro">({a.pagina})</span></li>)}
          <li><span className="font-medium">Jejum:</span> {JEJUM_SAP.texto} <span className="text-tinta-sussurro">({JEJUM_SAP.pagina})</span></li>
        </ul>
        <p className="text-sm font-medium">Critérios de alta ({ALTA_SAP.pagina})</p>
        <ul className="list-disc pl-5 text-sm">
          {ALTA_SAP.criterios.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </Bloco>
    </ToolLayout>
  )
}
