import { useState } from 'react'

import {
  DIRETRIZ_SCA_2025, alteplaseIam2025, tenecteplase2025, ALTEPLASE_TEP, ESTREPTOQUINASE, alteplaseIam, alteplaseTepAlternativo, fichaFibrinoliticosAdulto, mgHDaFase, tenecteplase, uiPorHora,
} from '@/clinico/adulto/anticoagulacao'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const fmtE = (x: number, c = 1) => (Math.round(x * 10 ** c) / 10 ** c).toLocaleString('pt-BR')

const br = (x: number, casas = 1) => (Math.round(x * 10 ** casas) / 10 ** casas).toLocaleString('pt-BR')

/** Fibrinolíticos do adulto no IAM com supra e no TEP (caps. 14 e 32 do manual do HCFMUSP). */
export function FibrinoliticosAdulto() {
  const [peso, setPeso] = useState(0)
  const [idade, setIdade] = useState(0)
  const alt = alteplaseIam(peso)
  const tnk = tenecteplase(peso, idade > 0 ? idade : undefined)
  const altTep = alteplaseTepAlternativo(peso)
  const tnk25 = tenecteplase2025(peso, idade > 0 ? idade : undefined)
  const alt25 = alteplaseIam2025(peso)
  const skAlt = ESTREPTOQUINASE.tepAlternativo

  return (
    <ToolLayout
      title="Fibrinolíticos — adulto"
      description="Estreptoquinase, alteplase e tenecteplase no IAM com supra e no TEP, com dose por peso e velocidade. Adulto (14 anos ou mais)."
      ficha={fichaFibrinoliticosAdulto}
    >
      <CampoPeso id="fib-peso" peso={peso} onChange={setPeso}>
        <NumberField id="fib-idade" label="Idade" unit="anos" value={idade} onChange={setIdade} min={0} />
      </CampoPeso>
      <p className="text-sm text-tinta-sussurro">
        Contraindicações: Tabela 1 do cap. 14 (p. 219–220) e Tabela 9 do cap. 32 (p. 444). No IAM com supra, o manual traz porta-agulha menor que 10 minutos (p. 218).
      </p>

      <Bloco titulo="IAM com supra (cap. 14, p. 218–219)">
        <LinhaManual
          nome="Estreptoquinase"
          texto="1.500.000 U em 1 hora; pode provocar hipotensão significativa (reduzir o ritmo e suspender temporariamente)"
          conta={<strong>{br(uiPorHora(ESTREPTOQUINASE.iam), 0)} U/h</strong>}
          pagina={ESTREPTOQUINASE.iam.pagina}
        />
        <LinhaManual
          nome="Alteplase (acelerado)"
          texto="≥ 65 kg: 15 mg em bolus, 50 mg em 30 min, 35 mg em 60 min; < 65 kg: 15 mg em bolus, 0,75 mg/kg em 30 min, 0,5 mg/kg em 60 min"
          conta={alt ? (
            <>
              {alt.fases.map((f) => {
                const mgH = mgHDaFase(f)
                return <span key={f.fase}>{br(f.mg)} mg {f.fase}{mgH !== null ? ` (${br(mgH)} mg/h)` : ''} · </span>
              })}
              <strong>total {br(alt.totalMg)} mg</strong>
            </>
          ) : 'informe o peso'}
          pagina="p. 218"
        />
        <LinhaManual
          nome="Tenecteplase"
          texto="< 60 kg 30 mg; 60–70 kg 35 mg; 70–80 kg 40 mg; 80–90 kg 45 mg; > 90 kg 50 mg; metade da dose acima de 75 anos"
          conta={tnk ? <><strong>{tnk.mg[0] === tnk.mg[1] ? br(tnk.mg[0]) : `${br(tnk.mg[0])} ou ${br(tnk.mg[1])}`} mg</strong>{tnk.metadePorIdade && ' (metade por idade)'}</> : 'informe o peso'}
          pagina="p. 218–219"
          nota={tnk?.bordaAmbigua ? 'Com 70 ou 80 kg exatos o peso cabe em duas faixas do livro; as duas doses aparecem e a escolha é do médico.' : undefined}
        />
      </Bloco>

      <Bloco titulo="TEP (cap. 32, Tabela 8, p. 443)">
        <LinhaManual
          nome="Estreptoquinase — preferível"
          texto="1.500.000 UI IV em 2 horas"
          conta={<strong>{br(uiPorHora(ESTREPTOQUINASE.tepPreferivel), 0)} UI/h</strong>}
          pagina={ESTREPTOQUINASE.tepPreferivel.pagina}
        />
        <LinhaManual
          nome="Estreptoquinase — alternativa"
          texto={skAlt.texto}
          conta={<>ataque <strong>{br(skAlt.ataqueUI, 0)} UI</strong> em {skAlt.ataqueMinutos} min · manutenção não calculada</>}
          pagina={skAlt.pagina}
          errata={skAlt.errata}
        />
        <LinhaManual
          nome="rtPA (alteplase) — preferível"
          texto="100 mg IV em 2 horas"
          conta={<strong>{br((ALTEPLASE_TEP.preferivel.mg / ALTEPLASE_TEP.preferivel.minutos) * 60)} mg/h</strong>}
          pagina={ALTEPLASE_TEP.pagina}
        />
        <LinhaManual
          nome="rtPA (alteplase) — alternativa"
          texto="0,6 mg/kg IV em 15 min (dose máxima de 50 mg)"
          conta={altTep ? <><strong>{br(altTep.mg)} mg</strong> em 15 min{altTep.limitadoAoTeto && ' (no teto)'}</> : 'informe o peso'}
          pagina={ALTEPLASE_TEP.pagina}
        />
        <LinhaManual nome="Alteplase na PCR por TEP" texto={ALTEPLASE_TEP.pcr.texto} conta={<strong>{ALTEPLASE_TEP.pcr.mg} mg</strong>} pagina={ALTEPLASE_TEP.pagina} />
        <p className="text-sm text-tinta-sussurro">
          O manual traz que a HNF não deve ser infundida durante estreptoquinase e uroquinase, mas pode ser mantida com alteplase (p. 443).
        </p>
      </Bloco>
      <Bloco titulo="AHA/ACC 2025, ESC 2023 e SBC 2025 — IAM com supra, ao lado do manual" descricao="Diretrizes lidas no texto integral. As doses do manual acima continuam valendo; aqui ficam as da AHA 2025 para comparação.">
        <LinhaManual nome="Tenecteplase — faixas fechadas (AHA 2025, Tabela 13)" texto="< 60 kg 30 mg; 60–69 kg 35; 70–79 kg 40; 80–89 kg 45; ≥ 90 kg 50 mg; meia dose > 75 anos (ESC 2023, IIa B)" pagina="AHA 2025 e806; ESC 2023 p. 3762"
          conta={tnk25 ? <><strong>{fmtE(tnk25.mgFinal)} mg</strong> ({tnk25.faixa}{tnk25.metadePorIdade ? `; metade de ${tnk25.mg} mg por idade > 75` : ''})</> : 'informe o peso'} />
        <LinhaManual nome="Alteplase acelerada — corte em 67 kg (AHA 2025)" texto="≥ 67 kg: 15 + 50/30 min + 35/60 min; < 67 kg: 15 mg + 0,75 mg/kg (máx. 50) + 0,5 mg/kg (máx. 35)" pagina="AHA 2025 e806"
          conta={alt25 ? <>{alt25.fases.map((f) => `${fmtE(f.mg)} mg ${f.fase}`).join(' · ')} · <strong>total {fmtE(alt25.totalMg)} mg</strong></> : 'informe o peso'} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left align-top text-sm">
            <thead className="text-tinta-sussurro"><tr><th className="pr-3 pb-2">Tema</th><th className="pr-3 pb-2">Diretriz</th><th className="pr-3 pb-2">Fonte</th><th className="pr-3 pb-2">Manual do HC</th></tr></thead>
            <tbody>{DIRETRIZ_SCA_2025.map((d) => <tr key={d.tema} className="border-t"><td className="pr-3 py-2 font-medium">{d.tema}</td><td className="pr-3 py-2">{d.diretriz}</td><td className="pr-3 py-2">{d.fonte}</td><td className="pr-3 py-2 text-tinta-sussurro">{d.livro}</td></tr>)}</tbody>
          </table>
        </div>
      </Bloco>
    </ToolLayout>
  )
}
