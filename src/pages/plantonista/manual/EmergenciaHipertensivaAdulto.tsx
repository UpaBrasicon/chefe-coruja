import { useState } from 'react'

import {
  DBHA_2025_ALVOS, DIFERENCAS_EH_2025, INDISPONIVEIS_BRASIL_DBHA, METOPROLOL_EH_2025, QUADRO_11_4, esmololDbha2025, CAPTOPRIL_SEM_DOMH, DOMH, ERRATA_EH, ESMOLOL_EH, HIDRALAZINA_EH, METAS_EH, NITROGLICERINA_EH, NITROPRUSSIATO_EH,
  esmololEH, fichaEmergenciaHipertensivaAdulto, hidralazinaSaldo, nitroglicerinaMlH, nitroprussiatoMlH, pamAlvo, regraGeralEH,
} from '@/clinico/adulto/emergenciaHipertensiva'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Escolha, Resultado } from './LoteAPecas'
import { br, faixaBr } from './loteAFormato'
import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'

const fmtE = (x: number, c = 1) => (Math.round(x * 10 ** c) / 10 ** c).toLocaleString('pt-BR')

const pede = 'informe o peso'

/** Emergência hipertensiva do adulto (cap. 19 do manual do HCFMUSP): Tabela 4 com tempo e Tabela 3 com mL/h. */
export function EmergenciaHipertensivaAdulto() {
  const [peso, setPeso] = useState(0)
  const [metaId, setMetaId] = useState(METAS_EH[0].id)
  const [pas, setPas] = useState(0)
  const [pam, setPam] = useState(0)
  const [npDose, setNpDose] = useState(0.25)
  const [ntgDose, setNtgDose] = useState(5)
  const [hidraFeito, setHidraFeito] = useState(0)
  const esm25 = esmololDbha2025(peso)

  const meta = METAS_EH.find((m) => m.id === metaId)!
  const geral = regraGeralEH(pas)
  const alvoPam = meta.reducaoPam ? pamAlvo(pam, meta.reducaoPam) : null
  const es = esmololEH(peso)
  const np = nitroprussiatoMlH(peso, npDose)
  const ntg = nitroglicerinaMlH(ntgDose)

  return (
    <ToolLayout
      title="Emergência hipertensiva — adulto"
      description="Alvos de PA e FC com tempo por condição (Tabela 4) e drogas EV com mL/h no preparo do livro (Tabela 3). Adulto (14 anos ou mais)."
      ficha={fichaEmergenciaHipertensivaAdulto}
    >
      <Bloco titulo="Doenças orgânicas modificadas pela hipertensão (Tabela 1, p. 270–271)" descricao="Emergência hipertensiva é PA elevada com DOMH.">
        <ul className="list-disc pl-5 text-sm">{DOMH.map((d) => <li key={d}>{d}</li>)}</ul>
        <LinhaManual nome="Sem DOMH" texto={`captopril ${faixaBr(CAPTOPRIL_SEM_DOMH.mg, 2)} mg VO. ${CAPTOPRIL_SEM_DOMH.nota}`} pagina={CAPTOPRIL_SEM_DOMH.pagina} />
      </Bloco>

      <Bloco titulo="Alvo por condição (Tabela 4, p. 274–275)">
        <Escolha label="Condição" value={metaId} onChange={setMetaId} opcoes={METAS_EH.map((m) => ({ value: m.id, label: m.condicao }))} />
        <LinhaManual nome={meta.condicao} texto={<>alvo: {meta.alvo}. Tempo e redução inicial: {meta.tempo}</>} pagina="Tabela 4, p. 274–275" errata={meta.errata} />
        {meta.reducaoPam && (
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField id="eh-pam" label="PAM atual" unit="mmHg" value={pam} onChange={setPam} step={1} />
            <Resultado rotulo={`PAM após redução de ${faixaBr(meta.reducaoPam, 0)}%`} valor={alvoPam ? `${faixaBr(alvoPam, 0)} mmHg` : 'informe a PAM'} />
            <p className="text-xs text-muted-foreground sm:col-span-1">O capítulo não traz fórmula da PAM: use a PAM do monitor ou calculada.</p>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Nos demais casos (rodapé da Tabela 4, p. 275)">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="eh-pas" label="PAS atual" unit="mmHg" value={pas} onChange={setPas} step={1} />
          <Resultado rotulo="Minutos a 1 h (−20 a 25%)" valor={geral ? `PAS ${faixaBr(geral.pasEmAte1h, 0)} mmHg` : 'informe a PAS'} />
          <Resultado rotulo="Próximas 2 a 6 h" valor="160/100 mmHg" />
        </div>
        <p className="text-sm text-muted-foreground">Nas 24 a 48 h seguintes, níveis normais.</p>
      </Bloco>

      <CampoPeso id="eh-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Drogas EV (Tabela 3, p. 273)">
        <LinhaManual
          nome="Esmolol — dissecção de aorta"
          texto={`ataque ${faixaBr(ESMOLOL_EH.ataqueMgKg)} mg/kg em 1 min; ${faixaBr(ESMOLOL_EH.manutUgKgMin, 0)} µg/kg/min. Diluição: ${ESMOLOL_EH.preparo}`}
          conta={es ? <>ataque <strong>{faixaBr(es.ataqueMg, 0)} mg</strong> · <strong>{faixaBr(es.manutMlH)} mL/h</strong></> : pede}
          pagina={ESMOLOL_EH.pagina}
          errata={ESMOLOL_EH.errata}
        />
        <LinhaManual
          nome="Nitroprussiato de sódio — EAP, AVC, dissecção de aorta"
          texto={`${faixaBr(NITROPRUSSIATO_EH.ugKgMin, 2)} µg/kg/min. Diluição: ${NITROPRUSSIATO_EH.preparo}`}
          conta={np !== null ? <><strong>{br(np)} mL/h</strong> para {br(npDose, 2)} µg/kg/min</> : pede}
          pagina={NITROPRUSSIATO_EH.pagina}
          nota={NITROPRUSSIATO_EH.nota}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="eh-np" label="Dose do nitroprussiato" unit="µg/kg/min" value={npDose} onChange={setNpDose} step={0.05} />
          <NumberField id="eh-ntg" label="Dose da nitroglicerina" unit="µg/min" value={ntgDose} onChange={setNtgDose} step={1} />
        </div>
        {npDose > NITROPRUSSIATO_EH.ugKgMin[1] && <p className="text-atencao">Acima de {NITROPRUSSIATO_EH.ugKgMin[1]} µg/kg/min, o teto do livro.</p>}
        <LinhaManual
          nome="Nitroglicerina — IAM"
          texto={`${faixaBr(NITROGLICERINA_EH.ugMin, 0)} µg/min. Diluição: ${NITROGLICERINA_EH.preparo}`}
          conta={ntg !== null ? <><strong>{br(ntg)} mL/h</strong> para {br(ntgDose, 0)} µg/min</> : '—'}
          pagina={NITROGLICERINA_EH.pagina}
          nota={NITROGLICERINA_EH.nota}
        />
        <LinhaManual
          nome="Hidralazina — pré-eclâmpsia ou eclâmpsia"
          texto={`${HIDRALAZINA_EH.inicialMg} mg IV, repetir ${faixaBr(HIDRALAZINA_EH.repeticaoMg, 0)} mg a cada ${HIDRALAZINA_EH.intervaloMin} min; máximo de ${HIDRALAZINA_EH.maximo24hMg} mg em 24 h`}
          conta={<>saldo até o teto: <strong>{br(hidralazinaSaldo(hidraFeito), 0)} mg</strong></>}
          pagina={HIDRALAZINA_EH.pagina}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="eh-hidra" label="Hidralazina já feita em 24 h" unit="mg" value={hidraFeito} onChange={setHidraFeito} step={5} />
        </div>
        <p className="text-sm text-muted-foreground">
          Labetalol, nicardipina e clevidipina não estão na Tabela 3; o livro registra que labetalol e nicardipina EV não estão disponíveis no Brasil (cap. 38, p. 519).
        </p>
      </Bloco>

      <Bloco titulo="Errata">
        <ul className="list-disc pl-5 text-sm text-muted-foreground">{ERRATA_EH.map((e) => <li key={e}>{e}</li>)}</ul>
      </Bloco>
      <Bloco titulo="Diretriz Brasileira de Hipertensão 2025 (cap. 11) — ao lado do manual" descricao={`PDF lido. Não disponíveis no Brasil segundo a própria diretriz: ${INDISPONIVEIS_BRASIL_DBHA.join(', ')} — nenhum entra na ferramenta.`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left align-top text-sm">
            <thead className="text-muted-foreground"><tr><th className="pr-3 pb-2">Situação</th><th className="pr-3 pb-2">DBHA 2025</th><th className="pr-3 pb-2">Força</th><th className="pr-3 pb-2">Manual do HC</th></tr></thead>
            <tbody>{DBHA_2025_ALVOS.map((d) => <tr key={d.tema} className="border-t"><td className="pr-3 py-2 font-medium">{d.tema}</td><td className="pr-3 py-2">{d.dbha}</td><td className="pr-3 py-2">{d.forca}</td><td className="pr-3 py-2 text-muted-foreground">{d.livro}</td></tr>)}</tbody>
          </table>
        </div>
        {QUADRO_11_4.map((q) => <LinhaManual key={q.droga} nome={`${q.droga} (Quadro 11.4)`} texto={`${q.dose} — ${q.indicacao}`} pagina="DBHA 2025, p. 101–102" errata={q.errata} />)}
        <LinhaManual nome="Esmolol pela DBHA 2025" texto="ataque 500 µg/kg; 25–50 µg/kg/min, +25 a cada 10–20 min, máx. 300 µg/kg/min" pagina="DBHA 2025, Quadro 11.4"
          conta={esm25 ? <>ataque <strong>{fmtE(esm25.ataqueMg)} mg</strong> · início {fmtE(esm25.manutInicialUgMin[0], 0)}–{fmtE(esm25.manutInicialUgMin[1], 0)} µg/min · máx. {fmtE(esm25.maximoUgMin, 0)} µg/min</> : 'informe o peso'} />
        <LinhaManual nome="Metoprolol IV" texto={`${METOPROLOL_EH_2025.doseMg} mg a cada ${METOPROLOL_EH_2025.intervaloMin} min até ${METOPROLOL_EH_2025.maximoMg} mg (${METOPROLOL_EH_2025.doses} doses)`} pagina={METOPROLOL_EH_2025.pagina} />
        <ul className="list-disc pl-5 text-sm text-muted-foreground">{DIFERENCAS_EH_2025.map((d) => <li key={d}>{d}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
