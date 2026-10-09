import { useState } from 'react'

import {
  AMIODARONA_TEMPESTADE, METAS_ERC_2025, METAS_POS_PCR, MILRINONA_ATAQUE, MONITORIZACAO, PROGNOSTICO_TEXTO, REAQUECIMENTO, RESFRIAMENTO_EXTERNO_C_H, SF_FRIO,
  amiodaronaTempestade, fichaPosPcrAdulto, horasResfriamentoExterno, janelasAtingidas, lerMetas, milrinonaAtaque, reaquecimento, sfFrio,
} from '@/clinico/adulto/posPcr'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Resultado, Trecho } from './LoteAPecas'
import { br, faixaBr, informado } from './loteAFormato'
import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const pede = 'informe o peso'

/** Cuidados pós-PCR do adulto (cap. 6 do manual do HCFMUSP). */
export function PosPcrAdulto() {
  const [peso, setPeso] = useState(0)
  const [paco2, setPaco2] = useState(0)
  const [sato2, setSato2] = useState(0)
  const [pao2, setPao2] = useState(0)
  const [pam, setPam] = useState(0)
  const [glic, setGlic] = useState(0)
  const [tAtual, setTAtual] = useState(0)
  const [tAlvo, setTAlvo] = useState(0)
  const [tFinal, setTFinal] = useState(0)
  const [acumulado, setAcumulado] = useState(0)
  const [horas, setHoras] = useState(0)

  const leituras = lerMetas({ paco2: informado(paco2), sato2: informado(sato2), pao2: informado(pao2), pam: informado(pam), glicemia: informado(glic) })
  const sf = sfFrio(peso)
  const ext = horasResfriamentoExterno(tAtual, tAlvo)
  const reaq = reaquecimento(tAtual, tFinal)
  const mil = milrinonaAtaque(peso)
  const amio = amiodaronaTempestade(informado(acumulado))
  const janelas = horas > 0 ? janelasAtingidas(horas) : null

  return (
    <ToolLayout
      title="Cuidados pós-PCR — adulto"
      description="Metas pela diretriz ERC-ESICM 2025 (prevenção de febre, PAM > 60–65, SpO2 94–98%), com os números do manual do HCFMUSP (2022) como referência; tempos de resfriamento e reaquecimento, amiodarona na tempestade elétrica e janelas do neuroprognóstico. Adulto (14 anos ou mais)."
      ficha={fichaPosPcrAdulto}
    >
      <CampoPeso id="ppcr-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Metas — ERC-ESICM 2025" descricao="Diretriz posterior ao livro: os valores digitados abaixo são lidos por ela.">
        {METAS_ERC_2025.map((m) => <Trecho key={m.id} texto={`${m.parametro}: ${m.meta}`} pagina={m.pagina} />)}
      </Bloco>

      <Bloco titulo="Seus valores">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ppcr-paco2" label="PaCO2" unit="mmHg" value={paco2} onChange={setPaco2} step={1} />
          <NumberField id="ppcr-sat" label="SatO2" unit="%" value={sato2} onChange={setSato2} step={1} />
          <NumberField id="ppcr-pao2" label="PaO2" unit="mmHg" value={pao2} onChange={setPao2} step={1} />
          <NumberField id="ppcr-pam" label="PAM" unit="mmHg" value={pam} onChange={setPam} step={1} />
          <NumberField id="ppcr-glic" label="Glicemia" unit="mg/dL" value={glic} onChange={setGlic} step={1} />
        </div>
        {leituras.map((l) => <p key={l.id} className={l.fora ? 'text-atencao' : ''}>{l.texto}</p>)}
      </Bloco>

      <Bloco titulo="Metas do livro, 2022 (referência, p. 105–111)" descricao="Superadas pela diretriz de 2025 em temperatura (32–36 °C deu lugar à prevenção de febre) e na preferência de PAM 80–100.">
        {METAS_POS_PCR.map((m) => <Trecho key={m.id} texto={`${m.parametro}: ${m.meta}`} pagina={m.pagina} />)}
      </Bloco>

      <Bloco titulo="Controle de temperatura" descricao="ERC-ESICM 2025: prevenir febre (≤ 37,5 °C) por 36–72 h; não reaquecer ativamente quem já está com hipotermia leve; contra o fluido frio pré-hospitalar de rotina. O livro (p. 106–110) ainda traz hipotermia-alvo de 32–36 °C e SF a 4 °C: as contas abaixo ficam só para quando o médico decidir resfriar.">
        <LinhaManual
          nome={`SF 0,9% a ${SF_FRIO.temperaturaC} °C`}
          texto={`Livro (2022): ${faixaBr(SF_FRIO.mlKg, 0)} mL/kg em ${SF_FRIO.minutos} min; ${SF_FRIO.referencia}. Pode causar edema pulmonar; evitar em ICC, disfunção renal ou congestos. A ERC-ESICM 2025 recomenda contra o resfriamento pré-hospitalar de rotina com fluido frio`}
          conta={sf ? <><strong>{faixaBr(sf.volumeMl, 0)} mL</strong> · {faixaBr(sf.mlH, 0)} mL/h em 30 min</> : pede}
          pagina={SF_FRIO.pagina}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ppcr-tat" label="Temperatura central atual" unit="°C" value={tAtual} onChange={setTAtual} step={0.1} />
          <NumberField id="ppcr-talvo" label="Alvo do resfriamento" unit="°C" value={tAlvo} onChange={setTAlvo} step={0.1} />
          <Resultado rotulo={`Resfriamento externo (${faixaBr(RESFRIAMENTO_EXTERNO_C_H)} °C/h)`} valor={ext ? `${faixaBr(ext)} h` : '—'} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ppcr-tfin" label="Temperatura final do reaquecimento" unit="°C" value={tFinal} onChange={setTFinal} step={0.1} />
          <Resultado rotulo={`No alvo de ${br(REAQUECIMENTO.alvoCh, 2)} °C/h`} valor={reaq ? `${br(reaq.horasNoAlvo)} h` : '—'} />
          <Resultado rotulo={`Mínimo sem passar de ${br(REAQUECIMENTO.maximoCh)} °C/h`} valor={reaq ? `${br(reaq.horasMinimas)} h` : '—'} />
        </div>
        <p className="text-sm text-tinta-sussurro">
          Reaquecimento após {REAQUECIMENTO.aposHorasHT} h de HT ({REAQUECIMENTO.pagina}). O livro não fixa a temperatura final no texto; 36 °C aparece na Tabela 3 (sangramento maior, p. 111).
          Livro: CT por pelo menos 24 h, idealmente 48 h após o RCE (p. 109). ERC-ESICM 2025: prevenção de febre por 36–72 h.
        </p>
      </Bloco>

      <Bloco titulo="Hemodinâmica e arritmia (p. 106–107)">
        <LinhaManual
          nome="Milrinona — ataque"
          texto={`${MILRINONA_ATAQUE.ugKg} µg/kg em ${MILRINONA_ATAQUE.minutos} min, seguido de ${faixaBr(MILRINONA_ATAQUE.manutUgKgMin, 3)} µg/kg/min; dobutamina ${faixaBr(MILRINONA_ATAQUE.dobutaminaUgKgMin, 0)} µg/kg/min`}
          conta={mil ? <><strong>{br(mil.ug, 0)} µg</strong> = {br(mil.ml)} mL · {br(mil.mlH10min, 0)} mL/h por 10 min</> : pede}
          pagina={MILRINONA_ATAQUE.pagina}
          nota="Volume no preparo do Anexo 1 (200 µg/mL, p. 1489); o capítulo não traz preparo. Manutenção em mL/h: tela de infusões."
        />
        <LinhaManual
          nome="Amiodarona — tempestade elétrica ou TV incessante"
          texto={`150 mg EV em bolus, 1 mg/min por 6 h e 0,5 mg/min por 18 h; impregnação acumulada de até ${faixaBr(AMIODARONA_TEMPESTADE.impregnacaoG, 0)} g; depois ${faixaBr(AMIODARONA_TEMPESTADE.voMgDia, 0)} mg/dia VO`}
          conta={<>{amio.esquema.fases.map((f) => `${f.mg} mg`).join(' + ')} = <strong>{br(amio.esquema.total24hMg, 0)} mg em 24 h</strong></>}
          pagina={AMIODARONA_TEMPESTADE.pagina}
          nota="O cap. 6 escreve o bolus sem tempo; o tempo de 10 min é do cap. 18 (p. 265)."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ppcr-amio" label="Amiodarona acumulada" unit="mg" value={acumulado} onChange={setAcumulado} step={50} />
          <Resultado rotulo="Saldo até 10–15 g" valor={amio.saldoAteImpregnacaoMg ? `${faixaBr(amio.saldoAteImpregnacaoMg, 0)} mg` : '—'} />
        </div>
      </Bloco>

      <Bloco titulo="Neuroprognóstico e exames (p. 101–112)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="ppcr-h" label="Horas desde o RCE (ou do reaquecimento, para o PESS)" unit="h" value={horas} onChange={setHoras} step={1} />
        </div>
        {janelas?.map((j) => (
          <p key={j.janela.id} className={j.atingida ? '' : 'text-tinta-sussurro'}>
            {j.atingida ? 'Na janela' : 'Fora da janela'}: {j.janela.texto} ({j.janela.pagina})
          </p>
        ))}
        {PROGNOSTICO_TEXTO.map((t) => <p key={t} className="text-sm">{t}</p>)}
        {MONITORIZACAO.map((m) => <Trecho key={m.texto} texto={m.texto} pagina={m.pagina} />)}
      </Bloco>
    </ToolLayout>
  )
}
