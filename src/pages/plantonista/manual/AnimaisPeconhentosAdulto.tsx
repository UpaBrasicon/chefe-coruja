import { useState } from 'react'

import {
  ACIDENTES, MS_2026_PECONHENTOS, NEOSTIGMINA, PEDIATRICO_CITADO, PRE_MEDICACAO, SORO_ADMINISTRACAO, fichaPeconhentosAdulto, neostigmina, preMedicacao,
  soroPorGravidade, type Faixa, type Gravidade,
} from '@/clinico/adulto/peconhentos'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Escolha } from './LoteAPecas'
import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)
const ampolas = (f: Faixa) => `${faixa(f, 0)} ampola${f[1] > 1 ? 's' : ''}`

/** Acidentes por animais peçonhentos no adulto (cap. 101 do manual do HCFMUSP). */
export function AnimaisPeconhentosAdulto() {
  const [peso, setPeso] = useState(0)
  const [acidenteId, setAcidenteId] = useState(ACIDENTES[0].id)
  const acidente = ACIDENTES.find((a) => a.id === acidenteId)!
  const gravidades = acidente.classes.map((c) => c.gravidade)
  const [gravidadeEscolhida, setGravidade] = useState<Gravidade>('leve')
  const gravidade = gravidades.includes(gravidadeEscolhida) ? gravidadeEscolhida : gravidades[0]
  const r = soroPorGravidade(acidenteId, gravidade)!
  const neo = neostigmina(peso)

  return (
    <ToolLayout
      title="Acidentes por animais peçonhentos — adulto"
      description="Número de ampolas de soro pela gravidade (serpentes, escorpião e aranhas), pré-medicação por peso e neostigmina no elapídico, pelo manual do HC. Adulto (14 anos ou mais)."
      ficha={fichaPeconhentosAdulto}
    >
      <CampoPeso id="pec-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Soro pela gravidade" descricao="A gravidade é escolhida por quem atende, pelas manifestações de cada tabela do manual.">
        <Escolha label="Acidente" value={acidenteId} onChange={setAcidenteId} opcoes={ACIDENTES.map((a) => ({ value: a.id, label: a.nome }))} />
        <Escolha label="Gravidade" value={gravidade} onChange={setGravidade}
          opcoes={acidente.classes.map((c) => ({ value: c.gravidade, label: c.gravidade[0].toUpperCase() + c.gravidade.slice(1) }))} />
        <LinhaManual
          nome={`${acidente.nome} — ${gravidade}`}
          texto={`${r.classe.manifestacoes}; soro ${acidente.soro} ${acidente.via}`}
          pagina={acidente.pagina}
          conta={r.classe.ampolas
            ? <><strong>{ampolas(r.classe.ampolas)} ({acidente.via})</strong>{r.classe.ampolasAlternativa && <> · {r.classe.ampolasAlternativa.rotulo}: <strong>{ampolas(r.classe.ampolasAlternativa.ampolas)}</strong></>}</>
            : <strong>o manual não indica soro nesta gravidade (adulto)</strong>}
          nota={acidente.nota}
          errata={acidente.errata}
        />
        <ul className="grid gap-1 text-sm md:grid-cols-3">
          {acidente.classes.map((c) => (
            <li key={c.gravidade} className="rounded-lg border px-3 py-2">
              <span className="font-medium capitalize">{c.gravidade}</span>: {c.ampolas ? ampolas(c.ampolas) : 'sem soro'}
              {c.ampolasAlternativa && ` (${c.ampolasAlternativa.rotulo}: ${ampolas(c.ampolasAlternativa.ampolas)})`}
            </li>
          ))}
        </ul>
        <p className="text-sm text-tinta-sussurro">{SORO_ADMINISTRACAO.texto} ({SORO_ADMINISTRACAO.pagina})</p>
      </Bloco>

      <Bloco titulo="Ministério da Saúde — PCDT dos acidentes escorpiônicos (2026) e portal das aranhas" descricao="Decisão do responsável técnico (28/09/2026): os PCDTs do MS são a fonte dos peçonhentos. As serpentes seguem o manual até o PCDT completo dos acidentes ofídicos ser lido (o resumo não traz ampolas).">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left align-top text-sm">
            <thead className="text-tinta-sussurro"><tr><th className="pr-3 pb-2">Tema</th><th className="pr-3 pb-2">MS</th><th className="pb-2">Manual do HC</th></tr></thead>
            <tbody>
              {MS_2026_PECONHENTOS.map((d) => (
                <tr key={d.tema} className="border-t">
                  <td className="pr-3 py-2 font-medium">{d.tema}</td>
                  <td className="pr-3 py-2">{d.ms} <span className="text-tinta-sussurro">({d.pagina})</span></td>
                  <td className="py-2 text-tinta-sussurro">{d.livro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>

      <Bloco titulo="Pré-medicação antes do soro (p. 1350)" descricao={`${PRE_MEDICACAO.adrenalinaTexto}. Demais: ${PRE_MEDICACAO.momento}.`}>
        <LinhaManual nome="Adrenalina SC" texto="0,25 mg SC no braço, imediatamente antes do soro" pagina={PRE_MEDICACAO.pagina} conta={<strong>0,25 mg</strong>} />
        {PRE_MEDICACAO.drogas.map((d) => {
          const c = preMedicacao(d, peso)
          return (
            <LinhaManual key={d.id} nome={d.nome} texto={`${br(d.mgKg, 2)} mg/kg até o máximo de ${br(d.maxMg, 0)} mg`} pagina={PRE_MEDICACAO.pagina}
              conta={c ? <><strong>{br(c.mg, 2)} mg</strong>{c.limitadoAoTeto && ' (no teto)'}</> : 'informe o peso'} />
          )
        })}
      </Bloco>

      <Bloco titulo="Neostigmina no acidente elapídico (p. 1352–1353)">
        <LinhaManual nome="Neostigmina (1 mL = 0,5 mg)" texto={NEOSTIGMINA.texto} pagina={NEOSTIGMINA.pagina} nota={NEOSTIGMINA.nota}
          conta={<>bolus <strong>{faixa(neo.bolusMg, 0)} mg</strong> = {faixa(neo.bolusMl, 0)} mL{neo.infusaoUgH !== null && <> · infusão inicial <strong>{br(neo.infusaoUgH, 0)} µg/h</strong></>}</>} />
        <p className="text-sm text-tinta-sussurro">Valores pediátricos que o capítulo cita e esta ferramenta de adulto não usa: {PEDIATRICO_CITADO.join('; ')}.</p>
      </Bloco>
    </ToolLayout>
  )
}
