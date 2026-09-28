import { useState } from 'react'

import {
  DIRETRIZ_SSC_PED_2026, ERRATA_CHOQUE, METAS_CHOQUE, PAM_PHOENIX, PHOENIX_TEXTO, VASOATIVAS, diureseAlvo, fichaChoquePediatrico, phoenix, volumesChoque,
} from '@/clinico/pediatria/choque'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { faixaTxt, num, pesoValido } from './formatoP2'
import { AvisoRn, Bloco, CampoPesoRn, Errata, LinhaDose, LinhaReferencia, PesoInvalido } from './PecasP2'

const opc = (x: number) => (x > 0 ? x : undefined)

/** Choque séptico na criança: volume em mL/kg e vasoativas (livro do ICr, cap. 5), critérios de Phoenix 2024 e SSC pediátrica 2026. */
export function ChoquePediatrico() {
  const [peso, setPeso] = useState(0)
  const [rn, setRn] = useState(false)
  const v = pesoValido(peso) ? volumesChoque(peso) : null
  const [idadeMeses, setIdadeMeses] = useState(0)
  const [pf, setPf] = useState(0)
  const [sf, setSf] = useState(0)
  const [suporte, setSuporte] = useState(false)
  const [vmi, setVmi] = useState(false)
  const [vasos, setVasos] = useState(0)
  const [lac, setLac] = useState(0)
  const [pam, setPam] = useState(0)
  const [plaq, setPlaq] = useState(0)
  const [inr, setInr] = useState(0)
  const [dd, setDd] = useState(0)
  const [fib, setFib] = useState(0)
  const [gcs, setGcs] = useState(0)
  const [pupilas, setPupilas] = useState(false)
  const ph = idadeMeses > 0 || rn
    ? phoenix({ idadeMeses: rn ? 0 : idadeMeses, pf: opc(pf), sf: opc(sf), suporteRespiratorio: suporte, vmInvasiva: vmi, vasoativos: vasos, lactato: opc(lac), pam: opc(pam), plaquetas: opc(plaq), inr: opc(inr), dDimero: opc(dd), fibrinogenio: opc(fib), glasgow: opc(gcs), pupilasFixasBilaterais: pupilas })
    : null

  return (
    <ToolLayout
      title="Choque séptico — criança"
      description="Expansão volêmica em mL/kg e vasoativas (livro do ICr-HCFMUSP), critérios de Phoenix 2024 para sepse e choque séptico e o que a Surviving Sepsis Campaign pediátrica 2026 escreve, fonte a fonte."
      ficha={fichaChoquePediatrico}
    >
      <CampoPesoRn id="choque-peso" peso={peso} setPeso={setPeso} rn={rn} setRn={setRn} />
      {rn ? <AvisoRn /> : !v ? <PesoInvalido /> : (
        <>
          <Bloco titulo="Volume (p. 85)">
            <dl className="grid gap-x-4 gap-y-1 tabular-nums sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Bolus de solução isotônica (10 a 20 mL/kg)</dt><dd><strong>{faixaTxt(v.bolus, 0)} mL</strong></dd>
              <dt className="text-muted-foreground">Primeira hora, classicamente (40 a 60 mL/kg)</dt><dd><strong>{faixaTxt(v.primeiraHora, 0)} mL</strong></dd>
              <dt className="text-muted-foreground">Sem suporte ventilatório/vasoativo: só no hipotenso, até 40 mL/kg</dt><dd><strong>{num(v.semSuporte, 0)} mL</strong></dd>
              <dt className="text-muted-foreground">Diurese-alvo (&gt; 1 mL/kg/h)</dt><dd><strong>&gt; {num(diureseAlvo(peso)!, 1)} mL/h</strong></dd>
            </dl>
            <p className="text-muted-foreground">Reavaliar sinais de congestão (crepitações, hepatomegalia) a cada bolus; normotensos sem esses recursos recebem só manutenção.</p>
            <p className="text-rotulo text-tinta-sussurro">Livro ICr, cap. 5, p. 82–85.</p>
          </Bloco>
          <Bloco titulo="Drogas vasoativas (Tabela 2, p. 87)">
            {VASOATIVAS.map((d) => <LinhaDose key={d.id} d={d} peso={peso} />)}
          </Bloco>
        </>
      )}
      <Bloco titulo="Metas e tempos">
        {METAS_CHOQUE.map((m) => <LinhaReferencia key={m.texto} texto={m.texto} pagina={`cap. 5, ${m.pagina}`} />)}
        {ERRATA_CHOQUE.map((e) => <Errata key={e}>{e}</Errata>)}
      </Bloco>

      <Bloco titulo="Critérios de Phoenix 2024 — sepse e choque séptico (JAMA 2024)">
        <p className="text-muted-foreground">{PHOENIX_TEXTO.criterios} {PHOENIX_TEXTO.naoVale} ({PHOENIX_TEXTO.pagina})</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField id="phx-idade" label="Idade" unit="meses" value={idadeMeses} onChange={setIdadeMeses} min={0} max={215} />
          <NumberField id="phx-pf" label="PaO₂/FiO₂" value={pf} onChange={setPf} min={0} />
          <NumberField id="phx-sf" label="SpO₂/FiO₂ (só com SpO₂ ≤ 97%)" value={sf} onChange={setSf} min={0} />
          <NumberField id="phx-vasos" label="Vasoativos em uso" unit="n" value={vasos} onChange={setVasos} min={0} max={5} />
          <NumberField id="phx-lac" label="Lactato" unit="mmol/L" value={lac} onChange={setLac} min={0} step={0.1} />
          <NumberField id="phx-pam" label="PAM" unit="mmHg" value={pam} onChange={setPam} min={0} />
          <NumberField id="phx-plaq" label="Plaquetas" unit="×10³/µL" value={plaq} onChange={setPlaq} min={0} />
          <NumberField id="phx-inr" label="INR" value={inr} onChange={setInr} min={0} step={0.1} />
          <NumberField id="phx-dd" label="D-dímero" unit="mg/L FEU" value={dd} onChange={setDd} min={0} step={0.1} />
          <NumberField id="phx-fib" label="Fibrinogênio" unit="mg/dL" value={fib} onChange={setFib} min={0} />
          <NumberField id="phx-gcs" label="Glasgow" value={gcs} onChange={setGcs} min={0} max={15} />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={suporte} onChange={(e) => setSuporte(e.target.checked)} /> Algum suporte respiratório</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={vmi} onChange={(e) => setVmi(e.target.checked)} /> Ventilação mecânica invasiva</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={pupilas} onChange={(e) => setPupilas(e.target.checked)} /> Pupilas fixas bilaterais</label>
        </div>
        {ph ? (
          <div className="rounded-lg border px-3 py-2 text-sm">
            <p>
              Phoenix <strong className="tabular-nums">{ph.total}</strong> (respiratório {ph.respiratorio} · cardiovascular {ph.cardiovascular} · coagulação {ph.coagulacao} · neurológico {ph.neurologico}) —{' '}
              <strong>{ph.choqueSeptico ? 'choque séptico' : ph.sepse ? 'sepse' : 'abaixo de 2 pontos'}</strong>, se houver infecção suspeita.
            </p>
            <p className="text-muted-foreground">PAM da faixa {PAM_PHOENIX[ph.faixa].rotulo}: 1 ponto entre {PAM_PHOENIX[ph.faixa].umPonto[0]} e {PAM_PHOENIX[ph.faixa].umPonto[1]} mmHg, 2 pontos abaixo de {PAM_PHOENIX[ph.faixa].doisPontos}. {PHOENIX_TEXTO.mortalidade}</p>
            {ph.avisos.map((a) => <p key={a} className="text-atencao">{a}</p>)}
          </div>
        ) : <p className="text-muted-foreground">Informe a idade em meses (o Phoenix vale de 37 semanas pós-concepcionais até 17 anos).</p>}
      </Bloco>

      <Bloco titulo="SSC pediátrica 2026 × livro do ICr">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left align-top text-sm">
            <thead className="text-muted-foreground"><tr><th className="pr-3 pb-2">Tema</th><th className="pr-3 pb-2">SSC pediátrica 2026</th><th className="pb-2">Livro do ICr</th></tr></thead>
            <tbody>
              {DIRETRIZ_SSC_PED_2026.map((d) => (
                <tr key={d.tema} className="border-t">
                  <td className="pr-3 py-2 font-medium">{d.tema}</td>
                  <td className="pr-3 py-2">{d.ssc.texto} <span className="text-muted-foreground">({d.ssc.pagina})</span></td>
                  <td className="py-2 text-muted-foreground">{d.livro ? `${d.livro.texto} (${d.livro.pagina})` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
    </ToolLayout>
  )
}
