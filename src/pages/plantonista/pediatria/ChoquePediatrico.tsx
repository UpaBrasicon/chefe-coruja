import { useState } from 'react'

import {
  DIRETRIZ_SSC_PED_2026, ERRATA_CHOQUE, METAS_CHOQUE, VASOATIVAS, diureseAlvo, fichaChoquePediatrico, volumesChoque,
} from '@/clinico/pediatria/choque'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { faixaTxt, num, pesoValido } from './formatoP2'
import { AvisoRn, Bloco, CampoPesoRn, Errata, LinhaDose, LinhaReferencia, PesoInvalido } from './PecasP2'
import { PhoenixCalculo } from './PhoenixPed'

/** Choque séptico na criança: volume em mL/kg e vasoativas (livro do ICr, cap. 5), critérios de Phoenix 2024 e SSC pediátrica 2026. */
export function ChoquePediatrico() {
  const [peso, setPeso] = useState(0)
  const [rn, setRn] = useState(false)
  const v = pesoValido(peso) ? volumesChoque(peso) : null

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
              <dt className="text-tinta-sussurro">Bolus de solução isotônica (10 a 20 mL/kg)</dt><dd><strong>{faixaTxt(v.bolus, 0)} mL</strong></dd>
              <dt className="text-tinta-sussurro">Primeira hora, classicamente (40 a 60 mL/kg)</dt><dd><strong>{faixaTxt(v.primeiraHora, 0)} mL</strong></dd>
              <dt className="text-tinta-sussurro">Sem suporte ventilatório/vasoativo: só no hipotenso, até 40 mL/kg</dt><dd><strong>{num(v.semSuporte, 0)} mL</strong></dd>
              <dt className="text-tinta-sussurro">Diurese-alvo (&gt; 1 mL/kg/h)</dt><dd><strong>&gt; {num(diureseAlvo(peso)!, 1)} mL/h</strong></dd>
            </dl>
            <p className="text-tinta-sussurro">Reavaliar sinais de congestão (crepitações, hepatomegalia) a cada bolus; normotensos sem esses recursos recebem só manutenção.</p>
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

      <PhoenixCalculo />

      <Bloco titulo="SSC pediátrica 2026 × livro do ICr">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left align-top text-sm">
            <thead className="text-tinta-sussurro"><tr><th className="pr-3 pb-2">Tema</th><th className="pr-3 pb-2">SSC pediátrica 2026</th><th className="pb-2">Livro do ICr</th></tr></thead>
            <tbody>
              {DIRETRIZ_SSC_PED_2026.map((d) => (
                <tr key={d.tema} className="border-t">
                  <td className="pr-3 py-2 font-medium">{d.tema}</td>
                  <td className="pr-3 py-2">{d.ssc.texto} <span className="text-tinta-sussurro">({d.ssc.pagina})</span></td>
                  <td className="py-2 text-tinta-sussurro">{d.livro ? `${d.livro.texto} (${d.livro.pagina})` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
    </ToolLayout>
  )
}
