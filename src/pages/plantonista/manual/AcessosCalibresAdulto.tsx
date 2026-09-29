import { useState } from 'react'

import {
  AGULHADOS, ERRATA_PROCEDIMENTOS, FLEXIVEIS, LIDOCAINA_IO, MM_POR_FRENCH, PERMANENCIA_IO_MAX_H, SITIOS_IO_ADULTO, agulhaIoMotor, fichaAcessosAdulto,
  frenchDoCalibre, frenchParaMm, lidocainaIo, mmParaFrench, type Calibre,
} from '@/clinico/adulto/procedimentos'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Label } from '@/components/ui/label'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { Erratas, Escolhas } from './PecasLoteE7'
import { br } from './loteE7Formato'

function TabelaCalibres({ itens, comFrench }: { itens: Calibre[]; comFrench?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead><tr className="text-left text-tinta-sussurro"><th className="pr-3">Calibre</th><th className="pr-3">Cor</th><th className="pr-3">Diâmetro</th>{comFrench && <th>≈ French</th>}</tr></thead>
        <tbody>
          {itens.map((c) => (
            <tr key={c.gauge} className="border-t">
              <td className="pr-3">{c.gauge} G</td><td className="pr-3">{c.cor}</td><td className="pr-3">{br(c.mm, 2)} mm</td>{comFrench && <td>{br(frenchDoCalibre(c))} Fr</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Acessos: calibres, French e intraósseo no adulto (cap. 105 do manual do HCFMUSP). */
export function AcessosCalibresAdulto() {
  const [fr, setFr] = useState(0)
  const [mm, setMm] = useState(0)
  const [peso, setPeso] = useState(0)
  const [subcut, setSubcut] = useState<'normal' | 'excesso'>('normal')
  const conv = frenchParaMm(fr)
  const deMm = mmParaFrench(mm)
  const agulha = agulhaIoMotor(peso, subcut === 'excesso')
  const lido = lidocainaIo(peso)

  return (
    <ToolLayout
      title="Acessos: calibres, French e intraósseo (adulto)"
      description="Conversão French ↔ mm, tabelas de calibre dos dispositivos periféricos, agulha intraóssea pelo peso, sítios e lidocaína IO, pelo manual do HC. Adulto (14 anos ou mais); as profundidades pediátricas do livro não entram."
      ficha={fichaAcessosAdulto}
    >
      <Bloco titulo="French (p. 1401)" descricao={`O diâmetro externo do cateter venoso central é medido em French: 1 Fr = ${br(MM_POR_FRENCH, 2)} mm, ou seja, 3 Fr = 1 mm.`}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <NumberField id="ace-fr" label="French" unit="Fr" value={fr} onChange={setFr} min={0} step={0.5} />
            <p className="text-sm tabular-nums">{conv ? <><strong>{br(conv.mm, 2)} mm</strong> (× 0,33) · {br(conv.mmPorTerco, 2)} mm (÷ 3)</> : '—'}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <NumberField id="ace-mm" label="Diâmetro" unit="mm" value={mm} onChange={setMm} min={0} step={0.1} />
            <p className="text-sm tabular-nums">{deMm !== null ? <strong>{br(deMm)} Fr</strong> : '—'}</p>
          </div>
        </div>
      </Bloco>

      <Bloco titulo="Dispositivos periféricos — Tabelas 1 e 2 (p. 1396–1397)">
        <p className="text-sm font-medium">Flexíveis (16 a 24 G no texto; a tabela inclui 14 G)</p>
        <TabelaCalibres itens={FLEXIVEIS} comFrench />
        <p className="text-sm font-medium">Agulhados (19 a 27 G)</p>
        <TabelaCalibres itens={AGULHADOS} />
      </Bloco>

      <CampoPeso id="ace-peso" peso={peso} onChange={setPeso}>
        <div className="flex flex-col gap-1.5">
          <Label>Tecido subcutâneo</Label>
          <Escolhas valor={subcut} opcoes={[['normal', 'Normal'], ['excesso', 'Em excesso']] as const} onChange={setSubcut} />
        </div>
      </CampoPeso>

      <Bloco titulo="Intraósseo (p. 1410–1414)" descricao={`Acesso de emergência, mantido por no máximo ${PERMANENCIA_IO_MAX_H} h.`}>
        <LinhaManual
          nome="Agulha do dispositivo com motor"
          texto="rosa de 15 mm para 3 a 39 kg; azul de 25 mm para > 40 kg com subcutâneo normal; amarela de 45 mm para > 40 kg com subcutâneo em excesso"
          conta={agulha ? (agulha.agulha ? <strong>{agulha.agulha.cor} {agulha.agulha.mm} mm</strong> : agulha.nota) : 'informe o peso'}
          pagina="p. 1413"
        />
        <LinhaManual
          nome="Lidocaína sem vasopressor (paciente acordado)"
          texto={`${br(LIDOCAINA_IO.ataqueMgKg, 2)} mg/kg em 1-2 min + flush de ${LIDOCAINA_IO.flushMl} mL de SF; se necessário, ${br(LIDOCAINA_IO.repeticaoMgKg, 2)} mg/kg em 1-2 min + flush`}
          conta={lido ? <><strong>{br(lido.ataqueMg)} mg</strong> · repetição {br(lido.repeticaoMg)} mg</> : 'informe o peso'}
          pagina={LIDOCAINA_IO.pagina}
        />
        {SITIOS_IO_ADULTO.map((s) => <LinhaManual key={s.sitio} nome={s.sitio} texto={s.local} pagina={s.pagina} />)}
      </Bloco>

      <Bloco titulo="Errata e notas">
        <Erratas itens={ERRATA_PROCEDIMENTOS.filter((e) => e.startsWith('p. 14') && !e.startsWith('p. 145'))} />
      </Bloco>
    </ToolLayout>
  )
}
