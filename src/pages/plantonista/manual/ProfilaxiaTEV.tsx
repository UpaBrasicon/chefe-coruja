import { useState } from 'react'

import {
  CONTEXTO_DAS_DOSES, DOSES_PROFILAXIA_TEV, FORA_DO_LIVRO, MENCOES_PROFILAXIA_TEV, PROTAMINA,
  doseDiaria, fichaProfilaxiaTev, protaminaHnfSc, volumeDoseMl, type DoseProfilaxia,
} from '@/clinico/adulto/profilaxiaTev'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { textoCopia } from '@/domain/copiaCalculo'

import { Bloco, LinhaManual } from './PecasLoteC'
import { numero } from '@/lib/formato'

const br = (x: number, casas = 2) => numero(Math.round(x * 10 ** casas) / 10 ** casas)
const faixa = (f: [number, number], casas = 2) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

const unidadeDe = (d: DoseProfilaxia) => (d.unidade === 'UI' ? 'UI' : 'mg')
const textoDoseManual = (d: DoseProfilaxia) => `${br(d.dose, 0)} ${unidadeDe(d)} ${d.via} ${d.vezesDia} vez${d.vezesDia > 1 ? 'es' : ''}/dia`

/** Profilaxia de TEV: doses e menções do manual do HCFMUSP, sem escore de risco. */
export function ProfilaxiaTEV() {
  const [ui, setUi] = useState(5000)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaProfilaxiaTev.id)
  const prot = protaminaHnfSc(ui)
  const textoProtamina = prot ? `Protamina ${faixa(prot.mg, 1)} mg = ${faixa(prot.ampolas)} ampola(s)${prot.limitadoAoTeto ? ' (no teto de 50 mg)' : ''}` : null

  // Texto do "Copiar" (C3 e C4 = A): as doses do manual (lista inteira) e a protamina pela heparina informada.
  const copia = prot
    ? textoCopia({
        ferramenta: 'Profilaxia de TEV — doses pelo manual (adulto)',
        dados: [['Heparina SC recebida', `${br(ui, 0)} UI`]],
        resultado: [
          'Doses do manual:',
          ...DOSES_PROFILAXIA_TEV.map((d) => {
            const ml = volumeDoseMl(d)
            return `- ${d.nome}: ${textoDoseManual(d)}${ml !== null ? ` · ${br(ml)} mL por dose (1 mL = ${br(d.porMl!, 0)} U)` : ''} · ${br(doseDiaria(d), 0)} ${unidadeDe(d)}/dia (${d.pagina})`
          }),
          CONTEXTO_DAS_DOSES,
          `Reversão da HNF SC: ${textoProtamina} (${PROTAMINA.pagina})`,
        ],
        fonte: textoFontes(fichaProfilaxiaTev),
        versao: fichaProfilaxiaTev.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Profilaxia de TEV — doses pelo manual (adulto)"
      description="Doses de enoxaparina e HNF, onde o manual do HC cita profilaxia e a reversão da HNF SC. O livro não traz escore de risco. Adulto (14 anos ou mais)."
      ficha={fichaProfilaxiaTev}
    >
      <Bloco titulo="Doses do manual" descricao={CONTEXTO_DAS_DOSES}>
        {DOSES_PROFILAXIA_TEV.map((d) => {
          const ml = volumeDoseMl(d)
          const un = unidadeDe(d)
          // A errata do livro vai para a aba "Armadilhas" (C6 = A).
          return (
            <LinhaManual
              key={d.id}
              nome={d.nome}
              texto={textoDoseManual(d)}
              conta={<>{ml !== null && <>{br(ml)} mL por dose (1 mL = {br(d.porMl!, 0)} U) · </>}<strong>{br(doseDiaria(d), 0)} {un}/dia</strong></>}
              pagina={d.pagina}
            />
          )
        })}
      </Bloco>

      <Bloco titulo="Onde o manual cita profilaxia de TEV" descricao="Texto de cada capítulo; em AVC, HIP e HSA o livro fala em compressão pneumática.">
        <ul className="flex flex-col gap-1.5 text-apoio">
          {MENCOES_PROFILAXIA_TEV.map((m) => (
            <li key={m.contexto} className="rounded-controle border px-3 py-2">
              <span className="font-medium">{m.contexto}</span>
              {m.mecanica && <Badge variant="secondary" className="ml-2">mecânica</Badge>}
              <br />
              <span className="text-tinta-sussurro">{m.texto} ({m.pagina})</span>
            </li>
          ))}
        </ul>
      </Bloco>

      <Bloco titulo="Reversão da HNF SC por protamina" descricao={`${faixa(PROTAMINA.mgPor100UiSc, 1)} mg por 100 U de heparina SC; dose máxima ${PROTAMINA.maxMg} mg; ampola de ${PROTAMINA.mgPorAmpola} mg (${PROTAMINA.pagina}).`}>
        <div className="max-w-xs">
          <NumberField id="tev-ui" label="Heparina SC recebida" unit="UI" value={ui} onChange={setUi} min={0} step={500} />
        </div>
        <p className="text-apoio tabular-nums">
          {!prot ? 'Informe as unidades de heparina.' : (
            <>Protamina <strong>{faixa(prot.mg, 1)} mg</strong> = {faixa(prot.ampolas)} ampola(s){prot.limitadoAoTeto && ' (no teto de 50 mg)'}</>
          )}
        </p>
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">
          {FORA_DO_LIVRO.map((x) => <li key={x}>{x}</li>)}
        </ul>
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!prot}
        armadilhas={[
          ...DOSES_PROFILAXIA_TEV.flatMap((d) => (d.errata ? [`${d.nome} — errata do livro: ${d.errata}`] : [])),
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaProfilaxiaTev}
        guia={guia}
      />
      <ResumoFlutuante
        principal={prot ? `Adulto · heparina SC ${br(ui, 0)} UI` : 'Informe a heparina SC recebida'}
        detalhe={prot ? `${textoProtamina}; doses do manual na lista acima, "Copiar" leva todas.` : 'Doses do manual na lista acima.'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
