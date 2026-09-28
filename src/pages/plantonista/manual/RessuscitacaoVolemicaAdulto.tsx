import { useState } from 'react'

import {
  CHOQUE_ALIQUOTA, CHOQUE_FIGURA2, CORTES_LACTATO, CORTICOIDE_SEPSE, ERRATA_RESSUSCITACAO, HEMORRAGICO, METAS, OUTROS_SEPSE, SEPSE_VOLUME, SOLUCOES_TABELA5, SOLUCOES_TABELA7,
  diureseMinimaMlH, diureseMlKgH, fichaRessuscitacaoAdulto, gatilhoVasopressina, lactatoMmol, reducaoLactato, vazaoAliquota, vcSepse, volumeSepse,
} from '@/clinico/adulto/ressuscitacaoVolemica'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, Escolha, Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'
import { CampoPeso } from './PecasLoteC'

const traco = (x: number | null | undefined, sufixo: string, casas = 0) => (x === null || x === undefined ? '—' : `${br(x, casas)} ${sufixo}`)

/** Ressuscitação volêmica no choque e na sepse do adulto (caps. 4 e 7 do manual do HCFMUSP). */
export function RessuscitacaoVolemicaAdulto() {
  const [peso, setPeso] = useState(0)
  const [aliqMl, setAliqMl] = useState(500)
  const [aliqMin, setAliqMin] = useState(10)
  const [diurMl, setDiurMl] = useState(0)
  const [diurH, setDiurH] = useState(0)
  const [lac0, setLac0] = useState(0)
  const [lac1, setLac1] = useState(0)
  const [nora, setNora] = useState(0)
  const [unid, setUnid] = useState<'ug/min' | 'ug/kg/min'>('ug/min')
  const [horas, setHoras] = useState(0)

  const vol = volumeSepse(peso)
  const vazao = vazaoAliquota(aliqMl, aliqMin)
  const diurese = diureseMlKgH(diurMl, diurH, peso)
  const lac = lac0 > 0 && lac1 > 0 ? reducaoLactato(lac0, lac1) : null
  const vaso = nora > 0 && horas > 0 ? gatilhoVasopressina(nora, unid, horas, informado(peso)) : null
  const vc = vcSepse(peso)

  return (
    <ToolLayout
      title="Ressuscitação volêmica no choque e na sepse — adulto"
      description="30 mL/kg e alíquotas, metas de PAM, diurese e lactato, gatilho de vasopressina e corticoide, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaRessuscitacaoAdulto}
    >
      <CampoPeso id="rv-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Sepse: 30 mL/kg na primeira hora" descricao={`${SEPSE_VOLUME.gatilho}. ${SEPSE_VOLUME.preferencia} (${SEPSE_VOLUME.pagina}).`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="Volume total (30 mL/kg)" valor={vol ? `${br(vol.totalMl, 0)} mL` : 'informe o peso'} />
          <Resultado rotulo="Se corrido em 1 h" valor={vol ? `${br(vol.mlH, 0)} mL/h` : '—'} />
          <Resultado rotulo="Alíquotas de 250–500 mL (p. 122)" valor={vol ? `${faixaBr(vol.aliquotas, 0)} alíquotas` : '—'} />
          <Resultado rotulo="Alíquotas de 200 mL (p. 74)" valor={vol ? `${vol.aliquotasDe200} alíquotas` : '—'} />
        </div>
        <Trecho texto={`Alíquotas de ${faixaBr(SEPSE_VOLUME.aliquotaMl, 0)} mL em ${SEPSE_VOLUME.aliquotaMin} minutos, com fluidorresponsividade e fluidotolerância monitoradas (clínica e POCUS) após cada infusão`} pagina={SEPSE_VOLUME.pagina} />
        <Trecho texto={`Choque em geral: alíquotas de ${CHOQUE_ALIQUOTA.ml} mL a cada ${CHOQUE_ALIQUOTA.aCadaMin} minutos, reavaliando TEC, PA, FC, diurese e SatO2`} pagina={CHOQUE_ALIQUOTA.pagina} />
        <Trecho texto={`Figura 2: ${faixaBr(CHOQUE_FIGURA2.ml, 0)} mL a cada ${CHOQUE_FIGURA2.aCadaMin} min (basal, 10, 20 e 30 min)`} pagina={CHOQUE_FIGURA2.pagina} errata="Diverge do texto da p. 74 (200 mL)." />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="rv-aliq" label="Alíquota" unit="mL" value={aliqMl} onChange={setAliqMl} step={50} />
          <NumberField id="rv-aliqmin" label="Em" unit="min" value={aliqMin} onChange={setAliqMin} step={1} />
          <Resultado rotulo="Vazão equivalente na bomba" valor={traco(vazao, 'mL/h')} />
        </div>
      </Bloco>

      <Bloco titulo="Choque hemorrágico">
        {HEMORRAGICO.itens.map((t) => <Trecho key={t.texto} texto={t.texto} pagina={t.pagina} />)}
      </Bloco>

      <Bloco titulo="Metas" descricao="Tabela 4 do cap. 4 (p. 72) e texto do cap. 7.">
        {METAS.map((m) => <Trecho key={m.id} texto={`${m.parametro}: ${m.meta}`} pagina={m.pagina} />)}
        <div className="grid gap-4 sm:grid-cols-3">
          <Resultado rotulo="Diurese mínima (0,5 mL/kg/h)" valor={traco(diureseMinimaMlH(peso), 'mL/h')} />
          <NumberField id="rv-diur" label="Diurese medida" unit="mL" value={diurMl} onChange={setDiurMl} step={10} />
          <NumberField id="rv-diurh" label="Em" unit="h" value={diurH} onChange={setDiurH} step={1} />
        </div>
        {diurese && <p className="tabular-nums">{br(diurese.mlKgH, 2)} mL/kg/h {diurese.abaixoDe05 ? '— abaixo de 0,5 mL/kg/h (oligúria pela definição da p. 67)' : '— 0,5 mL/kg/h ou mais'}</p>}
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="rv-lac0" label="Lactato inicial" unit="mmol/L" value={lac0} onChange={setLac0} step={0.1} />
          <NumberField id="rv-lac1" label="Lactato após 2 h" unit="mmol/L" value={lac1} onChange={setLac1} step={0.1} />
          <Resultado rotulo="Queda" valor={lac ? `${br(lac.reducaoPct, 0)}% ${lac.atingiuMeta20 ? '(≥ 20%)' : '(< 20%)'}` : '—'} />
        </div>
        {lac0 > 0 && <p className="tabular-nums">Queda de 20% a partir de {br(lac0)} mmol/L = até {br(lac0 * 0.8, 2)} mmol/L.</p>}
        <p className="text-muted-foreground">Equivalência do livro: 18 mg/dL = 2 mmol/L (cap. 7, p. 120) — 36 mg/dL = {br(lactatoMmol(36), 0)} mmol/L.</p>
        {CORTES_LACTATO.map((c) => <Trecho key={c.texto} texto={`${c.texto} (${br(c.mmol)} mmol/L = ${br(c.mgDl)} mg/dL)`} pagina={c.pagina} />)}
      </Bloco>

      <Bloco titulo="Vasopressina: gatilho do livro" descricao="Diluição e mL/h das drogas vasoativas estão na ferramenta de infusões contínuas (Anexo 1).">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="rv-nora" label="Noradrenalina" unit={unid === 'ug/min' ? 'µg/min' : 'µg/kg/min'} value={nora} onChange={setNora} step={unid === 'ug/min' ? 1 : 0.01} />
          <NumberField id="rv-horas" label="Há quanto tempo nessa dose" unit="h" value={horas} onChange={setHoras} step={1} />
          <Escolha label="Unidade" value={unid} onChange={setUnid} opcoes={[{ value: 'ug/min', label: 'µg/min' }, { value: 'ug/kg/min', label: 'µg/kg/min' }]} />
        </div>
        {unid === 'ug/kg/min' && nora > 0 && peso <= 0 && <p className="text-atencao">Informe o peso para converter µg/kg/min em µg/min.</p>}
        {vaso && (
          <ul className="flex flex-col gap-1">
            <li>Dose: <strong className="tabular-nums">{br(vaso.ugMin)} µg/min</strong></li>
            <li>Cap. 4 (p. 76) — &gt; 5 µg/min após 6 horas: {vaso.cap4Seis ? 'atingido' : 'não atingido'}</li>
            <li>Cap. 4 (p. 76) — &gt; 15 µg/min nas últimas 3 horas: {vaso.cap4Tres ? 'atingido' : 'não atingido'}</li>
            <li>Cap. 7 (p. 122) — &gt; 5 µg/min por mais de 6 horas: {vaso.cap7 ? 'atingido' : 'não atingido'}</li>
          </ul>
        )}
        <p className="text-muted-foreground">Cap. 4: em choque séptico que mantém hipotensão arterial. Cap. 7: "pode-se considerar associação".</p>
      </Bloco>

      <Bloco titulo="Corticoide e outros cuidados na sepse">
        {CORTICOIDE_SEPSE.map((t) => <Trecho key={t.texto} texto={t.texto} pagina={t.pagina} />)}
        {OUTROS_SEPSE.map((t) => <Trecho key={t.texto} texto={t.texto} pagina={t.pagina} />)}
        <Resultado rotulo="VC 4–6 mL/kg (peso informado; o livro não diz se é peso predito)" valor={vc ? `${faixaBr(vc, 0)} mL` : '—'} />
      </Bloco>

      <Bloco titulo="Soluções cristaloides" descricao="Tabela 5 do cap. 4 (p. 74), em mmol/L; osmolaridade em mOsm/L.">
        <div className="overflow-x-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-muted-foreground">
              <tr><th className="pr-3">Solução</th><th className="pr-3">Osm</th><th className="pr-3">Na</th><th className="pr-3">Cl</th><th className="pr-3">K</th><th className="pr-3">Ca</th><th>Lactato</th></tr>
            </thead>
            <tbody>
              {SOLUCOES_TABELA5.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="pr-3">{s.nome}</td>
                  {[s.osm, s.na, s.cl, s.k, s.ca, s.lactato].map((x, i) => <td key={i} className="pr-3">{x === null ? '–' : br(x)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {SOLUCOES_TABELA5.filter((s) => s.nota).map((s) => <p key={s.id} className="text-atencao">{s.nome}: {s.nota}</p>)}
        <p className="text-muted-foreground">Tabela 7 do cap. 7 (p. 122): {SOLUCOES_TABELA7.map((s) => `${s.nome} — ${s.texto}`).join('; ')}.</p>
      </Bloco>

      <Bloco titulo="Errata e divergências do livro" descricao="Os valores pediátricos destes capítulos não entram nesta ferramenta.">
        <ul className="list-disc pl-5 text-muted-foreground">
          {ERRATA_RESSUSCITACAO.map((e) => <li key={e}>{e}</li>)}
        </ul>
      </Bloco>
    </ToolLayout>
  )
}
