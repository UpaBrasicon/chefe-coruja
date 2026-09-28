import { useState } from 'react'

import {
  ANTI_D_MCG_POR_UNIDADE, ERRATAS_HEMOTERAPIA, LIMIARES, LIMITE_INFUSAO_MIN, PESO_UNIDADE_FRACIONADA_KG, REACOES, UNIDADE_CH_ML, albumina, chAnemiaAgudaMl, chPadraoMl,
  chPorIncrementoMl, crioUnidades, fatorIXUI, fatorVIIIUI, fichaHemoterapiaPed, gluconatoMacicaMl, minutosA25, pfcMl, plaquetasVolumeMl, sfDiluicaoMaxMl,
} from '@/clinico/pediatria/hemoterapiaPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, LinhaLivro, Nota, Opcoes, Pendencia } from './PecasIcr'
import { TabelaLivro } from './PecasP4'

/** Hemocomponentes — volumes por peso (cap. 67 e cap. 62 do livro do ICr). */
export function HemocomponentesPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [incHb, setIncHb] = useState(0)
  const [volemia, setVolemia] = useState(0)
  const [deltaPlaq, setDeltaPlaq] = useState(0)
  const [produto, setProduto] = useState<'std' | 'af'>('std')
  const [fator, setFator] = useState(0)
  const [deltaAlb, setDeltaAlb] = useState(0)
  const [volCh, setVolCh] = useState(0)
  const calc = !p.rn && p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const peso = p.peso
  const ch = calc ? chPadraoMl(peso) : null
  const chInc = calc && incHb > 0 ? chPorIncrementoMl(peso, incHb) : null
  const chAg = calc ? chAnemiaAgudaMl(peso) : null
  const tempo = (v: number | null) => (v ? minutosA25(v) : null)
  const plaq = calc ? plaquetasVolumeMl(deltaPlaq, volemia, produto) : null
  const f8 = calc ? fatorVIIIUI(peso, fator) : null
  const crio = f8 ? crioUnidades(f8.dose) : null
  const f9 = calc ? fatorIXUI(peso, fator) : null
  const alb = calc ? albumina(peso, deltaAlb) : null
  const ca = calc ? gluconatoMacicaMl(volCh, volemia) : null

  return (
    <ToolLayout
      title="Hemocomponentes — volumes por peso"
      description="Concentrado de hemácias, plasma, plaquetas, fatores VIII e IX, crioprecipitado, albumina e cálcio na transfusão maciça — livro do ICr-HCFMUSP. A volemia não é estimada: o livro não dá mL/kg."
      ficha={fichaHemoterapiaPed}
    >
      <CampoPaciente id="hemo" p={p} onChange={setP} />
      <Pendencia p={p} />

      {calc && (
        <>
          <Bloco titulo="Concentrado de hemácias (p. 725; Tabela 1, p. 729; cap. 62, p. 659)">
            <NumberField id="hemo-inc" label="Aumento de Hb desejado (opcional)" unit="g/dL" value={incHb} onChange={setIncHb} min={0} step={0.5} />
            <LinhaLivro nome="Volume padrão" conta={<strong>{br(ch, 0)} mL</strong>} texto="10 mL/kg em infusão lenta, incremento aproximado de 3 g/dL de Hb" pagina="p. 725" nota={`A 2,5 mL/min: ≈ ${br(tempo(ch), 0)} min (limite de ${LIMITE_INFUSAO_MIN / 60} h). SF para diluir, se preciso: até ${br(sfDiluicaoMaxMl(ch!), 0)} mL.`} />
            {chInc !== null && <LinhaLivro nome="Pelo incremento" conta={<strong>{br(chInc, 0)} mL</strong>} texto="3 mL/kg para cada 1 g/dL de aumento desejado" pagina="p. 725" nota={`A 2,5 mL/min: ≈ ${br(tempo(chInc), 0)} min.`} />}
            {chAg && <LinhaLivro nome="Anemia aguda com repercussão (cap. 62)" conta={<strong>{faixaBr(chAg, 0)} mL</strong>} texto="10 a 15 mL/kg em até 3 a 4 h, em pelo menos 1 h" pagina="cap. 62, p. 659" nota="O cap. 67 dá 10 mL/kg (p. 725, 729)." />}
            <Nota>
              Unidade inteira ≈ {UNIDADE_CH_ML} mL; crianças com menos de {PESO_UNIDADE_FRACIONADA_KG} kg recebem unidades fracionadas (p. 725).
              {peso < PESO_UNIDADE_FRACIONADA_KG && ' Peso informado abaixo de 30 kg.'}
            </Nota>
          </Bloco>

          <Bloco titulo="Plasma fresco congelado (p. 728)">
            <LinhaLivro nome="PFC" conta={<strong>{faixaBr(pfcMl(peso)!, 0)} mL</strong>} texto="10 a 15 mL/kg; unidades de 200 a 250 mL; infusão rápida" pagina="p. 728–729" />
          </Bloco>

          <Bloco titulo="Plaquetas (p. 727)" descricao="V (mL) = Δplaq (/mm³) × 1.000 × volemia (mL) / (concentração × 0,80).">
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberField id="hemo-dplaq" label="Δ plaquetas desejado" unit="/mm³" value={deltaPlaq} onChange={setDeltaPlaq} min={0} step={1000} />
              <NumberField id="hemo-vol" label="Volemia (informada)" unit="mL" value={volemia} onChange={setVolemia} min={0} step={10} />
            </div>
            <Opcoes label="Produto" valor={produto} opcoes={[['std', 'Standard (9,1 × 10⁸/mL)'], ['af', 'Aférese (1,5 × 10⁹/mL)']]} onChange={setProduto} />
            {plaq !== null ? <p>Volume: <strong className="tabular-nums">{br(plaq, 0)} mL</strong> (rendimento 0,80; infusão rápida).</p> : <Nota>Informe o Δ de plaquetas e a volemia calculada pelo peso.</Nota>}
            <Nota>ABO incompatível com o plasma da criança: rendimento 20% menor. Rh+ em receptor Rh−: anti-D {ANTI_D_MCG_POR_UNIDADE} µg por unidade, IV, até 24 h (p. 727).</Nota>
          </Bloco>

          <Bloco titulo="Hemofilia — fatores e crioprecipitado (p. 728–729)">
            <NumberField id="hemo-fator" label="Fator desejado (Δ)" unit="%" value={fator} onChange={setFator} min={0} />
            {f8 && (
              <LinhaLivro
                nome="Fator VIII (ou crioprecipitado)"
                conta={<strong>{br(f8.dose, 0)} UI</strong>}
                texto="peso × 0,5 × fator desejado (%); um terço da dose a cada 8 h até parar o sangramento"
                pagina="p. 728–729"
                nota={`Repetição: ${br(f8.repeticao8h, 0)} UI a cada 8 h. Crioprecipitado (80 a 120 UI por unidade de 10 a 20 mL): ${crio ? faixaBr(crio, 1) : '—'} unidades.`}
              />
            )}
            {f9 !== null && <LinhaLivro nome="Fator IX" conta={<strong>{br(f9, 0)} UI</strong>} texto="peso × fator desejado (%)" pagina="p. 729" />}
          </Bloco>

          <Bloco titulo="Albumina (p. 730)">
            <NumberField id="hemo-alb" label="Δ albuminemia desejado" unit="g/dL" value={deltaAlb} onChange={setDeltaAlb} min={0} step={0.1} />
            {alb && (
              <LinhaLivro
                nome="Albumina humana"
                conta={<strong>{br(alb.g, 1)} g</strong>}
                texto="peso × 0,8 × Δalbuminemia; frasco 20% de 50 mL = 10 g; infusão lenta"
                pagina="p. 730"
                nota={`≈ ${br(alb.mL20, 0)} mL de albumina 20% (${br(alb.frascos20, 1)} frasco); acréscimo de ≈ ${br(alb.expansaoMl, 0)} mL na volemia (18 mL por grama).`}
              />
            )}
          </Bloco>

          <Bloco titulo="Transfusão maciça — cálcio (p. 725)">
            <NumberField id="hemo-volch" label="CH transfundido" unit="mL" value={volCh} onChange={setVolCh} min={0} step={10} />
            {ca !== null ? <p>Gluconato de cálcio 10%: <strong className="tabular-nums">{br(ca, 1)} mL</strong> (1 mL a cada 100 mL de CH além da volemia informada).</p> : <Nota>Informe o CH transfundido e a volemia (no bloco de plaquetas).</Nota>}
          </Bloco>
        </>
      )}

      <Bloco titulo="Limiares do capítulo">
        {LIMIARES.map((l) => (
          <p key={l.texto} className="text-muted-foreground">
            {l.texto} ({l.pagina})
          </p>
        ))}
      </Bloco>
      <Bloco titulo="Reações transfusionais (Tabela 2, p. 731)">
        <TabelaLivro cabecalho={['Reação', 'Clínica', 'Manejo']} linhas={REACOES.map((r) => [...r])} largura={600} />
      </Bloco>
      <Bloco titulo="Erratas conferidas no PDF">
        {ERRATAS_HEMOTERAPIA.map((e) => <Errata key={e} texto={e} />)}
      </Bloco>
    </ToolLayout>
  )
}
