import { useState } from 'react'

import {
  BOLUS_NACL3, DENSIDADE_OSM_URINARIA, EFEITO_POTASSIO, FATORES_RISCO_DESMIELINIZACAO, LIMIARES, LIMITES_CORRECAO_HIPO, NOTA_FORMULAS, QUEDA_MAX_HIPER_MEQ_H, SG5_RAPIDO,
  SOLUCOES_NA, bolusNaCl3Ml, deficitAguaLivrePed, diferencaOsmolar, fichaSodioPed, horasMinimasHiper, litrosParaVariacao, osmEfetiva, sg5RapidoMl, sodioCorrigidoPed,
  tonicidadePed, variacaoNaPorLitro,
} from '@/clinico/pediatria/sodioPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, LinhaLivro, Nota, Pendencia } from './PecasIcr'

const TONICIDADE = { hipertonica: 'hipertônica (> 290 mOsm/kg)', isotonica: 'isotônica (275–290 mOsm/kg)', hipotonica: 'hipotônica (< 275 mOsm/kg)' }

/** Hipo e hipernatremia na criança — cap. 54 do Pronto-Socorro ICr-HCFMUSP. */
export function DisturbiosSodioPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [na, setNa] = useState(0)
  const [glic, setGlic] = useState(0)
  const [osmMedida, setOsmMedida] = useState(0)
  const [variacao, setVariacao] = useState(0)
  const [naDesejado, setNaDesejado] = useState(0)

  const naRef = na > 0 ? (glic > 0 ? sodioCorrigidoPed(na, glic) : na) : null
  const osmEf = na > 0 && glic > 0 ? osmEfetiva(na, glic) : null
  const dif = osmMedida > 0 && osmEf !== null ? diferencaOsmolar(osmMedida, osmEf) : null
  const ton = osmMedida > 0 ? tonicidadePed(osmMedida) : null
  const calc = podeCalcular(p)
  const bolus = calc ? bolusNaCl3Ml(p.peso) : null
  const hiper = naRef !== null && naRef > LIMIARES.hipernatremia
  const hipo = naRef !== null && naRef < LIMIARES.hiponatremia
  const deficit = calc && naRef !== null && naDesejado > 0 ? deficitAguaLivrePed(p.peso, naRef, naDesejado) : null
  const horas = naRef !== null && naDesejado > 0 ? horasMinimasHiper(naRef, naDesejado) : null

  return (
    <ToolLayout
      title="Hipo e hipernatremia — criança"
      description="Sódio corrigido, osmolalidade efetiva, NaCl 3% por peso, variação estimada por litro (Tabela 3) e déficit de água livre (Tabela 6) do livro do ICr-HCFMUSP. A correção é guiada pela dosagem seriada do sódio."
      ficha={fichaSodioPed}
    >
      <CampoPaciente id="na" p={p} onChange={setP} />

      <Bloco titulo="Sódio e osmolalidade (p. 533–537)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="na-na" label="Sódio medido" unit="mEq/L" value={na} onChange={setNa} />
          <NumberField id="na-glic" label="Glicemia (opcional)" unit="mg/dL" value={glic} onChange={setGlic} />
          <NumberField id="na-osm" label="Osmolalidade medida (opcional)" unit="mOsm/kg" value={osmMedida} onChange={setOsmMedida} />
        </div>
        {glic > 100 && naRef !== null && (
          <p className="tabular-nums">
            Sódio corrigido pela glicemia (+2 mEq/L a cada 100 mg/dL acima de 100, p. 534): <strong>{br(naRef)} mEq/L</strong>
          </p>
        )}
        {osmEf !== null && (
          <p className="tabular-nums">
            Osmolalidade efetiva (2 × Na + glicose/18, p. 537): <strong>{br(osmEf, 0)} mOsm/kg</strong>
            {dif && <> · diferença medida − efetiva {br(dif.diferenca, 0)}{dif.acimaDe50 && ' — acima de 50 a 60 sugere outros osmóis (p. 537)'}</>}
          </p>
        )}
        {ton && <p>Pela osmolalidade medida: hiponatremia {TONICIDADE[ton]} (p. 534).</p>}
        {naRef !== null && (
          <p>
            {hipo ? `Hiponatremia (< ${LIMIARES.hiponatremia} mEq/L, p. 533); "grave" varia na literatura: < 120 ou < 125.` : hiper ? `Hipernatremia (> ${LIMIARES.hipernatremia} mEq/L, p. 540).` : 'Sódio entre 135 e 145 mEq/L.'}
          </p>
        )}
        <Nota>
          Densidade urinária x osmolalidade urinária (Tabela 2, p. 537–538): {DENSIDADE_OSM_URINARIA.map((d) => `${d.densidade} ≈ ${d.osm}`).join(' · ')} mOsm/L.
        </Nota>
      </Bloco>

      <Pendencia p={p} />

      {calc && (
        <Bloco
          titulo="Hiponatremia — NaCl 3% (p. 538–539; Figura 4)"
          descricao="Correção direta só na hiponatremia sintomática, ou hipovolêmica com Na < 120 mEq/L. Após otimizar a volemia, o livro pede reavaliação antes de repor mais sódio."
        >
          <LinhaLivro
            nome="Coma ou crise convulsiva"
            texto={`NaCl 3% ${BOLUS_NACL3.mlKg} mL/kg (máx. ${BOLUS_NACL3.maxMl} mL) em 10 a 20 min; até 3 vezes, 10 min entre doses, com dosagem do sódio entre cada uma`}
            conta={bolus && <strong>{br(bolus.ml, 0)} mL{bolus.noMaximo && ' (máximo)'} ≈ +{br(bolus.ml / p.peso)} mEq/L</strong>}
            pagina="p. 538; Figura 4, p. 539"
          />
          <LinhaLivro nome="Estimativa" texto="sem perda urinária de água livre, 1 mL/kg de NaCl 3% eleva o sódio em ~1 mEq/L" pagina="p. 538" />
          <LinhaLivro
            nome="Velocidade máxima de correção"
            texto={`baixo risco de desmielinização: ${LIMITES_CORRECAO_HIPO.baixoRisco24h.join(' a ')} mEq/L em 24 h e ${LIMITES_CORRECAO_HIPO.baixoRisco48h} mEq/L em 48 h; alto risco: ${LIMITES_CORRECAO_HIPO.altoRisco24h.join(' a ')} mEq/L em 24 h; sódio a cada 4 a 6 h nas primeiras 24 h`}
            pagina="p. 538–539"
            nota={`Fatores de risco (p. 538): ${FATORES_RISCO_DESMIELINIZACAO.join('; ')}.`}
          />
          <Nota>
            Potássio junto: retenção de {EFEITO_POTASSIO.kMeqKg} mEq/kg de K pode elevar o Na em ~{EFEITO_POTASSIO.naMeqL} mEq/L (p. 539).
          </Nota>
        </Bloco>
      )}

      {calc && naRef !== null && (
        <Bloco titulo="Variação estimada por litro (Tabela 3, p. 540)" descricao="Δ Na após 1 L = (Na da solução − Na do paciente) / (0,6 × peso + 1). Estimativa linear; não conta perdas que continuam.">
          <NumberField id="na-var" label="Variação desejada (+ sobe, − desce)" unit="mEq/L" value={variacao} onChange={setVariacao} step={0.5} min={-30} />
          {SOLUCOES_NA.map((s) => {
            const porL = variacaoNaPorLitro(naRef, s.naMeqL, p.peso)
            const litros = porL !== null && variacao !== 0 ? litrosParaVariacao(variacao, porL) : null
            return (
              <div key={s.id} className="rounded-lg border px-3 py-2 tabular-nums">
                <span className="font-medium">{s.nome}</span> <span className="text-xs text-tinta-sussurro">(Na {s.naMeqL} mEq/L — {s.pagina})</span>
                <div>
                  1 L muda o Na em <strong>{porL === null ? '—' : `${porL > 0 ? '+' : ''}${br(porL)} mEq/L`}</strong>
                  {litros !== null && <> · para {variacao > 0 ? '+' : ''}{br(variacao)} mEq/L: <strong>{br(litros * 1000, 0)} mL</strong></>}
                  {variacao !== 0 && porL !== null && litros === null && <span className="text-tinta-sussurro"> · esta solução muda o Na no sentido oposto</span>}
                </div>
              </div>
            )
          })}
          <Nota>{NOTA_FORMULAS}</Nota>
        </Bloco>
      )}

      {calc && (
        <Bloco titulo="Hipernatremia (p. 542–543)" descricao={`Queda de até ${QUEDA_MAX_HIPER_MEQ_H} mEq/L/h (risco de edema cerebral maior na criança). Correção rápida só na hipernatremia aguda com sintoma neurológico grave. Via enteral quando possível.`}>
          <LinhaLivro
            nome="Aguda com convulsão, coma, hemorragia intracraniana ou trombose de seios venosos"
            texto={`SG 5% ${SG5_RAPIDO.mlKg} mL/kg em 10 a 20 min (≈ −${SG5_RAPIDO.quedaMeqL} mEq/L sem perda urinária de água); ponderar hemodiálise`}
            conta={<strong>{br(sg5RapidoMl(p.peso), 0)} mL</strong>}
            pagina="p. 542"
          />
          <NumberField id="na-desej" label="Sódio desejado (Tabela 6)" unit="mEq/L" value={naDesejado} onChange={setNaDesejado} />
          {naRef !== null && naDesejado > 0 && (
            <div className="tabular-nums">
              {deficit !== null && deficit > 0 ? (
                <p>
                  Déficit de água livre = peso × 0,6 × [(Na/Na desejado) − 1]: <strong>{br(deficit, 2)} L</strong> (Tabela 6, p. 543)
                </p>
              ) : (
                <p className="text-tinta-sussurro">Sem déficit de água livre para esse alvo.</p>
              )}
              {horas !== null && (
                <p>
                  A {QUEDA_MAX_HIPER_MEQ_H} mEq/L/h, de {br(naRef)} a {br(naDesejado)} mEq/L levaria no mínimo <strong>{br(horas)} h</strong>.
                </p>
              )}
            </div>
          )}
          <Nota>Na via parenteral o livro usa SG 5% com o volume estimado pela Tabela 3 (bloco acima) e acrescenta a reposição das perdas que continuam (p. 542).</Nota>
        </Bloco>
      )}
    </ToolLayout>
  )
}
