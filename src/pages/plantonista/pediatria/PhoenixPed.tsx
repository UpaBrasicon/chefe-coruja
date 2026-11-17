import { useState, type ReactNode } from 'react'

import { IDADE_MAX_MESES_PHOENIX, NOTA_PHOENIX_FAIXA, NOTA_PHOENIX_VALIDACAO, PAM_PHOENIX, PHOENIX_TEXTO, fichaPhoenixPed, phoenix } from '@/clinico/pediatria/choque'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { textoFontes } from '@/clinico/ficha'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { Bloco } from './PecasP2'

const opc = (x: number) => (x > 0 ? x : undefined)

type ResultadoPhoenix = NonNullable<ReturnType<typeof phoenix>>

const classePhoenix = (ph: ResultadoPhoenix) => (ph.choqueSeptico ? 'choque séptico' : ph.sepse ? 'sepse' : 'abaixo de 2 pontos')

/**
 * Cálculo do escore de Phoenix (JAMA 2024): usado aqui e no Choque séptico — criança.
 * A `nota` aparece abaixo do "não vale"; só a ferramenta própria a passa, porque
 * as fontes dela estão na ficha ped-phoenix.
 * `depois` (só a ferramenta própria) recebe o resultado e os dados usados,
 * para as abas e o resumo flutuante do modelo das calculadoras.
 */
export function PhoenixCalculo({ nota, depois }: { nota?: string; depois?: (ph: ResultadoPhoenix | null, dados: [string, string][]) => ReactNode } = {}) {
  const [idadeMeses, setIdadeMeses] = useState(0)
  const [rn, setRn] = useState(false)
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
  const dados: [string, string][] = [
    ['Idade', rn ? 'menos de 1 mês de vida' : idadeMeses > 0 ? `${idadeMeses} meses` : ''],
    ['PaO₂/FiO₂', pf > 0 ? numeroBr(pf) : ''],
    ['SpO₂/FiO₂', sf > 0 ? numeroBr(sf) : ''],
    ['Suporte respiratório', suporte ? 'sim' : ''],
    ['Ventilação mecânica invasiva', vmi ? 'sim' : ''],
    ['Vasoativos em uso', vasos > 0 ? String(vasos) : ''],
    ['Lactato', lac > 0 ? `${numeroBr(lac)} mmol/L` : ''],
    ['PAM', pam > 0 ? `${numeroBr(pam)} mmHg` : ''],
    ['Plaquetas', plaq > 0 ? `${numeroBr(plaq)} ×10³/µL` : ''],
    ['INR', inr > 0 ? numeroBr(inr) : ''],
    ['D-dímero', dd > 0 ? `${numeroBr(dd)} mg/L FEU` : ''],
    ['Fibrinogênio', fib > 0 ? `${numeroBr(fib)} mg/dL` : ''],
    ['Glasgow', gcs > 0 ? String(gcs) : ''],
    ['Pupilas fixas bilaterais', pupilas ? 'sim' : ''],
  ]

  return (
    <>
    <Bloco titulo="Critérios de Phoenix 2024 — sepse e choque séptico (JAMA 2024)">
      <p className="text-tinta-sussurro">{PHOENIX_TEXTO.criterios} {PHOENIX_TEXTO.naoVale} ({PHOENIX_TEXTO.pagina})</p>
      <p className="text-tinta-sussurro">{NOTA_PHOENIX_FAIXA}</p>
      {nota && <p role="note" className="mt-2 rounded-controle border border-atencao/40 bg-alerta-atencao px-2 py-1 text-rotulo text-atencao">{nota}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField id="phx-idade" label="Idade" unit="meses" value={idadeMeses} onChange={setIdadeMeses} min={0} max={IDADE_MAX_MESES_PHOENIX - 1} />
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
      <div className="flex flex-wrap gap-4 text-apoio">
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={rn} onChange={(e) => setRn(e.target.checked)} /> Menos de 1 mês de vida</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={suporte} onChange={(e) => setSuporte(e.target.checked)} /> Algum suporte respiratório</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={vmi} onChange={(e) => setVmi(e.target.checked)} /> Ventilação mecânica invasiva</label>
        <label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={pupilas} onChange={(e) => setPupilas(e.target.checked)} /> Pupilas fixas bilaterais</label>
      </div>
      {ph ? (
        <div className="rounded-controle border px-3 py-2 text-apoio">
          <p>
            Phoenix <strong className="tabular-nums">{ph.total}</strong> (respiratório {ph.respiratorio} · cardiovascular {ph.cardiovascular} · coagulação {ph.coagulacao} · neurológico {ph.neurologico}) —{' '}
            <strong>{classePhoenix(ph)}</strong>, se houver infecção suspeita.
          </p>
          <p className="text-tinta-sussurro">PAM da faixa {PAM_PHOENIX[ph.faixa].rotulo}: 1 ponto entre {PAM_PHOENIX[ph.faixa].umPonto[0]} e {PAM_PHOENIX[ph.faixa].umPonto[1]} mmHg, 2 pontos abaixo de {PAM_PHOENIX[ph.faixa].doisPontos}. {PHOENIX_TEXTO.mortalidade}</p>
          {ph.avisos.map((a) => <p key={a} className="text-atencao">{a}</p>)}
        </div>
      ) : idadeMeses >= IDADE_MAX_MESES_PHOENIX
        ? <p className="text-atencao">Idade de 14 anos ou mais: fora da pediatria desta tela (até 13 anos 11 meses e 29 dias, ou seja, até {IDADE_MAX_MESES_PHOENIX - 1} meses).</p>
        : <p className="text-tinta-sussurro">Informe a idade em meses (nesta tela, de 37 semanas pós-concepcionais até 13 anos 11 meses e 29 dias).</p>}
    </Bloco>
    {depois?.(ph, dados)}
    </>
  )
}

/** Phoenix como ferramenta própria da Central (onda 9). */
export function PhoenixPed() {
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaPhoenixPed.id)

  // Texto do "Copiar" (C4 = A): dados usados, o escore com os quatro sistemas, os avisos e as fontes.
  const copia = (ph: ResultadoPhoenix, dados: [string, string][]) =>
    textoCopia({
      ferramenta: 'Escore de Phoenix — sepse e choque séptico (criança)',
      dados,
      resultado: [
        `Phoenix ${ph.total} (respiratório ${ph.respiratorio} · cardiovascular ${ph.cardiovascular} · coagulação ${ph.coagulacao} · neurológico ${ph.neurologico}) — ${classePhoenix(ph)}, se houver infecção suspeita (${PHOENIX_TEXTO.pagina})`,
        ...ph.avisos,
      ],
      fonte: textoFontes(fichaPhoenixPed),
      versao: fichaPhoenixPed.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Escore de Phoenix — sepse e choque séptico (criança)"
      description="Critérios internacionais de 2024 para sepse e choque séptico pediátricos: respiratório, cardiovascular, coagulação e neurológico. Não é ferramenta de triagem precoce. Mesmo cálculo do leito e do Choque séptico — criança."
      ficha={fichaPhoenixPed}
    >
      <PhoenixCalculo
        nota={NOTA_PHOENIX_VALIDACAO}
        depois={(ph, dados) => (
          <>
            <AbasResultado
              aba={aba}
              onAba={setAba}
              passos={passosDaFaixa(guia, undefined)}
              semResultado={!ph}
              armadilhas={[...(guia?.armadilhas ?? [])]}
              ficha={fichaPhoenixPed}
              guia={guia}
            />
            <ResumoFlutuante
              principal={ph ? `Phoenix ${ph.total} — ${classePhoenix(ph)}` : 'Informe a idade em meses'}
              detalhe={ph ? `Respiratório ${ph.respiratorio} · cardiovascular ${ph.cardiovascular} · coagulação ${ph.coagulacao} · neurológico ${ph.neurologico}` : undefined}
              textoCopia={ph ? copia(ph, dados) : undefined}
              alvoDetalhes={ID_ABAS_RESULTADO}
              rotuloDetalhes="Próximos passos"
              aoIrDetalhes={() => setAba('proximos')}
            />
          </>
        )}
      />
    </ToolLayout>
  )
}
