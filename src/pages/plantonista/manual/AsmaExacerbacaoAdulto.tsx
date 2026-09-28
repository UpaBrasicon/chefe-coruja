import { useState } from 'react'

import {
  DROGAS_ASMA, ERRATA_ASMA, EXAMES_ASMA, FIGURA1_ASMA, GINA_ITENS, GINA_TRATAMENTO, MGSO4_ASMA, NOME_COLUNA, PREDITORES_ASMA_GRAVE, TABELA1_CLINICA, TABELA1_NUMERICA, VM_ASMA,
  fichaAsmaAdulto, gravidadeGina, infusaoMgAsma, percentualPredito, posicionarAsma, type Coluna, type ParametroAsma,
} from '@/clinico/adulto/asmaDpoc'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr } from './loteAFormato'
import { LinhaManual } from './PecasLoteC'

const COLUNAS: Coluna[] = ['leve', 'moderada', 'grave', 'iminencia']
const PARAMETROS = Object.keys(TABELA1_NUMERICA) as ParametroAsma[]

/** Exacerbação de asma no adulto (cap. 30 do manual do HCFMUSP). */
export function AsmaExacerbacaoAdulto() {
  const [valores, setValores] = useState<Record<ParametroAsma, number>>({ fr: 0, fc: 0, pulsoParadoxal: 0, vef1: 0, sao2: 0, pao2: 0, paco2: 0 })
  const [medido, setMedido] = useState(0)
  const [predito, setPredito] = useState(0)
  const [gramas, setGramas] = useState(2)
  const [diluente, setDiluente] = useState(100)

  const informados = Object.fromEntries(PARAMETROS.filter((p) => valores[p] > 0).map((p) => [p, valores[p]])) as Partial<Record<ParametroAsma, number>>
  const pos = posicionarAsma(informados)
  const pct = percentualPredito(medido, predito)
  const mg = infusaoMgAsma(gramas, diluente)
  const [gina, setGina] = useState({ incapaz: false, silente: false, sonolento: false, frases: false })
  const g = gravidadeGina({ fr: valores.fr || undefined, spo2: valores.sao2 || undefined, pefPct: pct ?? (valores.vef1 || undefined), incapazFalarBeberDeitar: gina.incapaz, toraxSilente: gina.silente, sonolentoConfusoCianotico: gina.sonolento, falaEmFrases: gina.frases || undefined })

  return (
    <ToolLayout
      title="Exacerbação de asma — adulto"
      description="Onde cada parâmetro cai na Tabela 1 do manual do HCFMUSP, doses de β2, ipratrópio, corticoide e sulfato de magnésio com o preparo. Adulto (14 anos ou mais)."
      ficha={fichaAsmaAdulto}
    >
      <Bloco titulo="Tabela 1 — parâmetros numéricos" descricao="Cada valor é posicionado na coluna do livro (p. 407–408). O livro não traz regra para combinar parâmetros discordantes: a classificação é do médico.">
        <div className="grid gap-4 sm:grid-cols-3">
          {PARAMETROS.map((p) => (
            <NumberField key={p} id={`as-${p}`} label={TABELA1_NUMERICA[p].rotulo} unit={TABELA1_NUMERICA[p].unidade} value={valores[p]} onChange={(v) => setValores((s) => ({ ...s, [p]: v }))} />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="as-medido" label="VEF1/PFE medido" value={medido} onChange={setMedido} step={10} />
          <NumberField id="as-predito" label="VEF1/PFE predito" value={predito} onChange={setPredito} step={10} />
          <Resultado rotulo="% do predito" valor={pct ? `${br(pct, 0)}%` : '—'} />
        </div>
        {pos.itens.length > 0 && (
          <div className="flex flex-col gap-1">
            {pos.itens.map((i) => (
              <div key={i.parametro} className="rounded-md border px-3 py-1.5">
                <span className="font-medium">{TABELA1_NUMERICA[i.parametro].rotulo} {br(i.valor)} {TABELA1_NUMERICA[i.parametro].unidade}</span>:{' '}
                {i.posicao.colunas.length ? i.posicao.colunas.map((c) => `${NOME_COLUNA[c]} (${TABELA1_NUMERICA[i.parametro].texto[c]})`).join(' ou ') : 'sem coluna na tabela'}
                {i.posicao.nota && <span className="block text-muted-foreground">{i.posicao.nota}</span>}
              </div>
            ))}
            {pos.maisGrave && <p>Coluna mais à direita atingida por um parâmetro: <strong>{NOME_COLUNA[pos.maisGrave]}</strong>.</p>}
          </div>
        )}
      </Bloco>

      <Bloco titulo="Tabela 1 — achados clínicos" descricao="p. 407–408">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-muted-foreground">
              <tr><th className="pr-3">Sintoma</th>{COLUNAS.map((c) => <th key={c} className="pr-3">{NOME_COLUNA[c]}</th>)}</tr>
            </thead>
            <tbody>
              {TABELA1_CLINICA.map((l) => (
                <tr key={l.rotulo} className="border-t align-top">
                  <td className="pr-3 font-medium">{l.rotulo}</td>
                  {COLUNAS.map((c) => <td key={c} className="pr-3">{l.colunas[c] ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Trecho texto={`Leve/moderada: ${FIGURA1_ASMA.leveModerada}. Grave: ${FIGURA1_ASMA.grave}. ${FIGURA1_ASMA.imediato}. Reavaliação: ${FIGURA1_ASMA.reavaliacao}`} pagina={FIGURA1_ASMA.pagina} errata="O fluxograma usa 50% de VEF1/peak flow e SaO2 90–95%; a Tabela 1 usa 60% e 91–95%." />
      </Bloco>

      <Bloco titulo="Preditores de exacerbação grave e exames" descricao="Tabela 2, p. 409; p. 410–411.">
        <ul className="list-disc pl-5">{PREDITORES_ASMA_GRAVE.map((p) => <li key={p}>{p}</li>)}</ul>
        {EXAMES_ASMA.map((e) => <Trecho key={e.texto} texto={e.texto} pagina={e.pagina} />)}
      </Bloco>

      <Bloco titulo="Medicações">
        {DROGAS_ASMA.map((d) => <LinhaManual key={d.id} nome={d.nome} texto={d.texto} pagina={d.pagina} nota={d.nota} />)}
      </Bloco>

      <Bloco titulo="Sulfato de magnésio EV" descricao={`${MGSO4_ASMA.indicacao}: ${faixaBr(MGSO4_ASMA.gramas)} g em SF ${faixaBr(MGSO4_ASMA.diluenteMl, 0)} mL, em ${MGSO4_ASMA.minutos} minutos (${MGSO4_ASMA.pagina}). Conversão: MgSO4 10% 1 g = 10 mL = 8 mEq (Anexo 5, p. 1501).`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="as-mg" label="Dose de MgSO4" unit="g" value={gramas} onChange={setGramas} step={0.1} />
          <NumberField id="as-dil" label="SF" unit="mL" value={diluente} onChange={setDiluente} step={50} />
        </div>
        {mg && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Resultado rotulo="MgSO4 10%" valor={`${br(mg.mlMgSO4_10)} mL (${br(mg.mEq)} mEq)`} />
            <Resultado rotulo="Volume final" valor={`${br(mg.volumeTotalMl, 0)} mL`} />
            <Resultado rotulo={`Vazão em ${MGSO4_ASMA.minutos} min`} valor={`${br(mg.mlH, 0)} mL/h`} />
          </div>
        )}
        {mg?.foraDaFaixa && <p className="text-atencao">Fora da faixa de 1,2–2,0 g que o capítulo traz.</p>}
      </Bloco>

      <Bloco titulo="Ventilação mecânica na asma">
        <Trecho texto={VM_ASMA.texto} pagina={VM_ASMA.pagina} />
        <p className="text-muted-foreground">O capítulo não traz números de VC, PEEP nem de relação I:E para a asma; os parâmetros iniciais de VM do obstrutivo com número estão na ferramenta de DPOC (p. 425).</p>
      </Bloco>

      <Bloco titulo="GINA 2026 — gravidade e tratamento (Figura 9, p. 36)" descricao="Usa a FR, a SaO2 e o VEF1/PFE informados acima. Marque os achados clínicos. A classificação segue a Figura 9; a decisão é do médico.">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={gina.frases} onChange={(e) => setGina({ ...gina, frases: e.target.checked })} /> Fala em frases (não em sentenças)</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={gina.incapaz} onChange={(e) => setGina({ ...gina, incapaz: e.target.checked })} /> Incapaz de falar, beber ou deitar</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={gina.silente} onChange={(e) => setGina({ ...gina, silente: e.target.checked })} /> Tórax silente</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={gina.sonolento} onChange={(e) => setGina({ ...gina, sonolento: e.target.checked })} /> Sonolento, confuso ou cianótico</label>
        </div>
        {g.gravidade ? (
          <>
            <Resultado rotulo="Gravidade pela GINA 2026" valor={<>{g.gravidade}{g.motivos.length ? ` — ${g.motivos.join('; ')}` : ''}</>} />
            <p className="text-sm">{GINA_TRATAMENTO[g.gravidade]}</p>
          </>
        ) : <p className="text-muted-foreground">Informe SaO2, VEF1/PFE ou marque os achados.</p>}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left align-top text-sm">
            <thead className="text-muted-foreground"><tr><th className="pr-3 pb-2">Tema</th><th className="pr-3 pb-2">GINA 2026</th><th className="pr-3 pb-2">p.</th><th className="pb-2">Manual do HC</th></tr></thead>
            <tbody>
              {GINA_ITENS.map((d) => (
                <tr key={d.tema} className="border-t">
                  <td className="pr-3 py-2 font-medium">{d.tema}</td>
                  <td className="pr-3 py-2">{d.gina}</td>
                  <td className="pr-3 py-2 whitespace-nowrap text-muted-foreground">{d.pagina}</td>
                  <td className="py-2 text-muted-foreground">{d.livro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>

      <Bloco titulo="Errata e divergências do livro" descricao="As metas de SatO2 de crianças e gestantes do capítulo não entram nesta ferramenta.">
        <ul className="list-disc pl-5 text-muted-foreground">{ERRATA_ASMA.map((e) => <li key={e}>{e}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
