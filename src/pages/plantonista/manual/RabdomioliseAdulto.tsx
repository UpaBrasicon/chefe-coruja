import { useState } from 'react'

import {
  BICARBONATO_RABDO, FLUIDO_RABDO, FORA_RENAL, MANITOL_RABDO, NOTA_ALVO_DU, NOTA_ENMC_RABDO, OUTROS_RABDO, RABDO_DIAGNOSTICO, alvoDiureseRabdo, cpkVezesLsn, fichaRabdomiolise,
  manitolRabdo, solucaoBicarbonatoRabdo,
} from '@/clinico/adulto/renal'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { Bloco, Resultado } from './LoteAPecas'
import { br, faixaBr } from './loteAFormato'
import { CampoPeso, LinhaManual } from './PecasLoteC'
import { Fora, ListaRef } from './PecasLoteE6'

const mil = (x: number) => br(x, 0)

/** Rabdomiólise (cap. 63 do manual do HCFMUSP). */
export function RabdomioliseAdulto() {
  const [peso, setPeso] = useState(0)
  const [cpk, setCpk] = useState(0)
  const [lsn, setLsn] = useState(0)

  const v = cpkVezesLsn(cpk, lsn)
  const alvo = alvoDiureseRabdo(peso)
  const bic = solucaoBicarbonatoRabdo()
  const man = manitolRabdo(peso)
  const F = FLUIDO_RABDO
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaRabdomiolise.id)
  const temDado = peso > 0 || cpk > 0

  // Texto do "Copiar" (C3/C4 = A): os dados usados e a lista inteira da Tabela 3, com as contas da tela.
  const copia = temDado
    ? textoCopia({
        ferramenta: 'Rabdomiólise — adulto',
        dados: [
          ['Peso', peso > 0 ? `${numeroBr(peso)} kg` : ''],
          ['CPK', cpk > 0 ? `${mil(cpk)} UI/L` : ''],
          ['LSN do laboratório', lsn > 0 ? `${mil(lsn)} UI/L` : ''],
        ],
        resultado: [
          ...(v ? [`CPK/LSN: ${br(v.vezes, 1)} × — ${v.texto}`] : []),
          ...(cpk > 0
            ? [`CPK ${mil(cpk)} UI/L: ${cpk > F.cpkIndicacao ? `acima de ${mil(F.cpkIndicacao)} (faixa da Tabela 3 para hidratação e bicarbonato)` : `até ${mil(F.cpkIndicacao)}`}${cpk > MANITOL_RABDO.cpk ? `; acima de ${mil(MANITOL_RABDO.cpk)} (faixa em que o livro considera manitol)` : ''}`]
            : []),
          `SF 0,9%: ${faixaBr(F.inicialMlH, 0)} mL/h inicial; ${faixaBr(F.manutencaoMlH, 0)} mL/h depois (${F.pagina})`,
          `Alvo de diurese: ${faixaBr(F.alvoDuMlH, 0)} mL/h${alvo ? `; pelo peso (1–3 mL/kg/h) ${faixaBr(alvo.porPesoMlH, 0)} mL/h${alvo.discordante ? ' — não cruza com 200–300' : ''}` : ''} (${F.pagina})`,
          `Solução de bicarbonato: NaHCO3 8,4% ${BICARBONATO_RABDO.mlNaHCO3} mL + ${BICARBONATO_RABDO.diluente} ${mil(BICARBONATO_RABDO.diluenteMl)} mL a ${BICARBONATO_RABDO.velocidadeMlH} mL/h = ${bic.meq} mEq em ${mil(bic.volumeMl)} mL · ${br(bic.meqPorHora, 1)} mEq/h · bolsa em ${br(bic.horasPorBolsa, 2)} h (${BICARBONATO_RABDO.pagina})`,
          `Bicarbonato — alvo: ${BICARBONATO_RABDO.alvo}; cuidado: ${BICARBONATO_RABDO.cuidado}; interromper: ${BICARBONATO_RABDO.parar}`,
          `Manitol 20%: ${man.gPorLitro} g por litro de salina${man.gDia ? `; ${faixaBr(man.gDia, 0)} g/dia` : ''} (${MANITOL_RABDO.pagina})`,
        ],
        fonte: textoFontes(fichaRabdomiolise),
        versao: fichaRabdomiolise.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Rabdomiólise — adulto"
      description="CPK em múltiplos do LSN, hidratação, solução de bicarbonato e manitol da Tabela 3, como o manual do HCFMUSP traz. Escore de McMahon em ferramenta própria. Adulto (14 anos ou mais)."
      ficha={fichaRabdomiolise}
    >
      <CampoPeso id="rb-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Diagnóstico e risco">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="rb-cpk" label="CPK" unit="UI/L" value={cpk} onChange={setCpk} step={100} />
          <NumberField id="rb-lsn" label="LSN do laboratório" unit="UI/L" value={lsn} onChange={setLsn} step={10} />
          <Resultado rotulo="CPK / LSN" valor={v ? `${br(v.vezes, 1)} × — ${v.texto}` : 'informe CPK e LSN'} />
        </div>
        {cpk > 0 && (
          <p>
            CPK {mil(cpk)} UI/L: {cpk > F.cpkIndicacao ? `acima de ${mil(F.cpkIndicacao)} (faixa da Tabela 3 para hidratação e bicarbonato)` : `até ${mil(F.cpkIndicacao)}`}
            {cpk > MANITOL_RABDO.cpk ? `; acima de ${mil(MANITOL_RABDO.cpk)} (faixa em que o livro considera manitol)` : ''}.
          </p>
        )}
        <ListaRef itens={RABDO_DIAGNOSTICO} />
        <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">{NOTA_ENMC_RABDO}</p>
      </Bloco>

      <Bloco titulo="Hidratação" descricao={F.nota}>
        <LinhaManual nome="SF 0,9%" texto={F.texto} pagina={F.pagina}
          conta={<strong>{faixaBr(F.inicialMlH, 0)} mL/h inicial; {faixaBr(F.manutencaoMlH, 0)} mL/h depois</strong>} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Resultado rotulo="Alvo de diurese (fixo)" valor={`${faixaBr(F.alvoDuMlH, 0)} mL/h`} />
          <Resultado rotulo="Alvo de diurese (1–3 mL/kg/h)" valor={alvo ? `${faixaBr(alvo.porPesoMlH, 0)} mL/h${alvo.discordante ? ' — não cruza com 200–300' : ''}` : 'informe o peso'} />
        </div>
        <p className="text-tinta-sussurro">{NOTA_ALVO_DU}</p>
      </Bloco>

      <Bloco titulo="Solução de bicarbonato" descricao={`Para ${BICARBONATO_RABDO.indicacao}. Alvo: ${BICARBONATO_RABDO.alvo}. Cuidado: ${BICARBONATO_RABDO.cuidado}.`}>
        <LinhaManual nome={`NaHCO3 8,4% ${BICARBONATO_RABDO.mlNaHCO3} mL + ${BICARBONATO_RABDO.diluente} ${mil(BICARBONATO_RABDO.diluenteMl)} mL`} texto={`infundir a ${BICARBONATO_RABDO.velocidadeMlH} mL/h`} pagina={BICARBONATO_RABDO.pagina}
          conta={<strong>{bic.meq} mEq em {mil(bic.volumeMl)} mL = {br(bic.meqPorMl, 3)} mEq/mL · {br(bic.meqPorHora, 1)} mEq/h · bolsa em {br(bic.horasPorBolsa, 2)} h</strong>}
          nota="NaHCO3 8,4% = 1 mEq/mL (cap. 69, p. 938)." />
        <p>Interromper: {BICARBONATO_RABDO.parar} ({BICARBONATO_RABDO.pagina}).</p>
      </Bloco>

      <Bloco titulo="Manitol">
        <LinhaManual nome="Manitol 20%" texto={MANITOL_RABDO.texto} pagina={MANITOL_RABDO.pagina}
          conta={<strong>{man.gPorLitro} g por litro de salina{man.gDia ? `; ${faixaBr(man.gDia, 0)} g/dia` : ''}</strong>}
          nota="50 mL de manitol 20% (20 g/100 mL) = 10 g." />
      </Bloco>

      <Bloco titulo="Outras medidas">
        <ListaRef itens={OUTROS_RABDO} />
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <Fora itens={FORA_RENAL} />
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temDado}
        armadilhas={guia?.armadilhas ?? []}
        ficha={fichaRabdomiolise}
        guia={guia}
      />
      <ResumoFlutuante
        principal={v ? `CPK ${br(v.vezes, 1)} × LSN` : cpk > 0 ? `CPK ${mil(cpk)} UI/L` : peso > 0 ? `Adulto · ${numeroBr(peso)} kg` : 'Informe peso e CPK'}
        detalhe={temDado ? `${v || cpk > 0 ? (peso > 0 ? `Adulto · ${numeroBr(peso)} kg · ` : '') : ''}SF 0,9% ${faixaBr(F.inicialMlH, 0)} mL/h inicial${alvo ? ` · alvo de diurese ${faixaBr(alvo.porPesoMlH, 0)} mL/h` : ''}; "Copiar" leva a lista inteira` : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
