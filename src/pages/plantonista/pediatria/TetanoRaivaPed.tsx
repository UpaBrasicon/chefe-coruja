import { useState } from 'react'

import {
  FERIMENTO_GVS, HISTORICO_TETANO, PROTOCOLO_RAIVA_2022, SORO_RAIVA, TRATAMENTO_GVS_2024, doseSoroRaiva, profilaxiaTetanoGvs,
  type FerimentoGvs, type HistoricoGvs,
} from '@/clinico/adulto/profilaxiaPosExposicao'
import {
  ANTIBIOTICO_TETANO_PED, ERRATA_VOLUME_MUSCULO, IMUNOBIOLOGICOS_TETANO_PED, RAIVA_PED, SEDATIVOS_TETANO_PED, VACINA_TETANO_PED,
  VOLUME_MAXIMO_MUSCULO, fichaTetanoRaivaPed, penicilinaTetanoPed,
} from '@/clinico/pediatria/tetanoRaivaPed'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { numero } from '@/lib/formato'

import { Escolha } from '../manual/LoteAPecas'
import { Bloco, CampoPeso, LinhaManual } from '../manual/PecasLoteC'

const simNao = (b: boolean) => (b ? 'sim' : 'não')
const inteiro = (x: number) => numero(Math.round(x))

/** Tétano e raiva na criança: profilaxia e doses do Ministério da Saúde (escores P2/P3, item P11). */
export function TetanoRaivaPed() {
  const [peso, setPeso] = useState(0)
  const [historico, setHistorico] = useState<HistoricoGvs>('incerta')
  const [ferimento, setFerimento] = useState<FerimentoGvs>('minimo')
  const [vulneravel, setVulneravel] = useState(false)
  const g = profilaxiaTetanoGvs(historico, ferimento, vulneravel)
  const pen = penicilinaTetanoPed(peso)
  const soro = doseSoroRaiva(peso)

  return (
    <ToolLayout
      title="Tétano e raiva — criança"
      description="Profilaxia e doses do Ministério da Saúde: Guia de Vigilância em Saúde 2024 (tétano) e Notas Técnicas 8/2022, 134/2022 e 35/2026 (raiva). Pediatria: de 1 dia de vida até antes dos 14 anos; tétano neonatal fora."
      ficha={fichaTetanoRaivaPed}
    >
      <CampoPeso id="tetano-raiva-ped-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Tétano — profilaxia no ferimento (GVS 2024, Quadro 4, p. 335)" descricao="O quadro do MS vale para todas as idades; a vacina é a da idade (abaixo).">
        <Escolha label="História de vacinação contra tétano" value={historico} onChange={setHistorico} opcoes={[...HISTORICO_TETANO, { value: 'mais10Especial' as const, label: '3 doses ou mais; última há 10 anos ou mais, em situações especiais' }]} />
        <Escolha label="Ferimento" value={ferimento} onChange={setFerimento} opcoes={FERIMENTO_GVS} />
        <label className="flex items-center gap-2 text-apoio"><input type="checkbox" className="size-4" checked={vulneravel} onChange={(e) => setVulneravel(e.target.checked)} /> Imunodeprimido ou desnutrido grave (nota d)</label>
        <LinhaManual
          nome="O que o Quadro 4 traz para essa combinação"
          texto={`vacina: ${simNao(g.vacina)}${g.reforco ? ' (um reforço)' : ''}; SAT ou IGHAT: ${simNao(g.imunoglobulina)}. ${g.notas.join(' ')}`}
          pagina={g.pagina}
          origem="O MS traz"
          conta={<><strong>Vacina: {simNao(g.vacina)}</strong> · <strong>SAT/IGHAT: {simNao(g.imunoglobulina)}</strong></>}
        />
        <LinhaManual nome="Qual vacina, pela idade" texto={`${VACINA_TETANO_PED.menor7} ${VACINA_TETANO_PED.aPartir7}`} pagina={VACINA_TETANO_PED.pagina} origem="O MS traz" />
        <p className="text-apoio text-tinta-sussurro">{TRATAMENTO_GVS_2024.desbridamento.texto} ({TRATAMENTO_GVS_2024.desbridamento.pagina}).</p>
      </Bloco>

      <Bloco titulo="Tétano acidental — tratamento na criança (GVS 2024, Quadros 1–3)">
        <LinhaManual nome="IGHAT" texto={IMUNOBIOLOGICOS_TETANO_PED.ighat} pagina={IMUNOBIOLOGICOS_TETANO_PED.pagina} origem="O MS traz" nota={IMUNOBIOLOGICOS_TETANO_PED.nota} />
        <LinhaManual nome="SAT" texto={IMUNOBIOLOGICOS_TETANO_PED.sat} pagina={IMUNOBIOLOGICOS_TETANO_PED.pagina} origem="O MS traz" />
        <LinhaManual nome="Penicilina G cristalina" texto={ANTIBIOTICO_TETANO_PED.texto} pagina={ANTIBIOTICO_TETANO_PED.pagina} origem="O MS traz" nota={ANTIBIOTICO_TETANO_PED.semMaximo}
          conta={pen ? <><strong>{inteiro(pen.uiDia[0])}–{inteiro(pen.uiDia[1])} UI/dia</strong> · {inteiro(pen.uiDose[0])}–{inteiro(pen.uiDose[1])} UI por dose de 4/4 h</> : 'informe o peso'} />
        <LinhaManual nome="Metronidazol" texto={ANTIBIOTICO_TETANO_PED.metronidazol} pagina={ANTIBIOTICO_TETANO_PED.pagina} origem="O MS traz" errata={ANTIBIOTICO_TETANO_PED.errataMetronidazol} />
        <LinhaManual nome="Sedativos (Quadro 1, como impresso)" texto={SEDATIVOS_TETANO_PED.texto} pagina={SEDATIVOS_TETANO_PED.pagina} origem="O MS traz" errata={SEDATIVOS_TETANO_PED.errata} />
      </Bloco>

      <Bloco titulo="Raiva — soro e vacina na criança (NTs 8/2022, 134/2022 e 35/2026)" descricao={RAIVA_PED.soroCasoACaso}>
        <LinhaManual
          nome="Soro antirrábico (SAR) 40 UI/kg"
          texto={`${SORO_RAIVA.texto} ${RAIVA_PED.soroIm}`}
          pagina={SORO_RAIVA.pagina}
          origem="O MS traz"
          conta={soro ? <><strong>{numero(soro.sarUi)} UI</strong> = {numero(soro.sarMlVinrab)} mL de VINRAB ({soro.frascosVinrab} frasco{soro.frascosVinrab > 1 ? 's' : ''})</> : 'informe o peso'}
        />
        <LinhaManual nome="Imunoglobulina humana (IGHAR) 20 UI/kg" texto="Mesma regra de infiltração do soro" pagina="NT 8/2022, item 2.2" origem="O MS traz" conta={soro ? <strong>{numero(soro.igharUi)} UI</strong> : 'informe o peso'} />
        <LinhaManual nome="Vacina IM" texto={RAIVA_PED.vacinaIm} pagina={RAIVA_PED.pagina} origem="O MS traz" />
        <LinhaManual nome="Vacina ID" texto={RAIVA_PED.vacinaId} pagina={RAIVA_PED.pagina} origem="O MS traz" />
        <div className="flex flex-col gap-1">
          <p className="text-apoio font-medium">Volume máximo por grupo muscular (NT 8/2022, Anexo 1)</p>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Idade</TableHead><TableHead>Deltoide</TableHead><TableHead>Ventroglúteo</TableHead><TableHead>Dorsoglúteo</TableHead><TableHead>Vasto lateral</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {VOLUME_MAXIMO_MUSCULO.map((v) => (
                <TableRow key={v.idade}><TableCell>{v.idade}</TableCell><TableCell>{v.deltoide}</TableCell><TableCell>{v.ventrogluteo}</TableCell><TableCell>{v.dorsogluteo}</TableCell><TableCell>{v.vastoLateral}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-apoio text-atencao">{ERRATA_VOLUME_MUSCULO}</p>
        </div>
        {PROTOCOLO_RAIVA_2022.map((i) => <LinhaManual key={i.tema} nome={i.tema} texto={i.ms} pagina={i.pagina} origem="O MS traz" />)}
      </Bloco>
    </ToolLayout>
  )
}
