import { useState } from 'react'

import {
  CLASSIFICACAO_ASMA, DOSES_ASMA, FIXOS_ASMA, MAGNESIO_PADRAO_MG_KG, fichaAsmaPediatrica, ipratropioNebulizacao,
} from '@/clinico/pediatria/asma'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { num, pesoValido } from './formatoP2'
import { AvisoRn, Bloco, CampoPesoRn, LinhaDose, LinhaReferencia, PesoInvalido } from './PecasP2'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Crise asmática na criança (livro do ICr, cap. 8). */
export function AsmaPediatrica() {
  const [peso, setPeso] = useState(0)
  const [rn, setRn] = useState(false)
  const ipra = ipratropioNebulizacao(peso)

  return (
    <ToolLayout
      title="Crise asmática — criança"
      description="Corticoide, ipratrópio, magnésio e salbutamol contínuo por peso, e a classificação da crise como referência — livro do ICr-HCFMUSP."
      ficha={fichaAsmaPediatrica}
    >
      <CampoPesoRn id="asma-peso" peso={peso} setPeso={setPeso} rn={rn} setRn={setRn} />
      {rn ? <AvisoRn /> : !pesoValido(peso) ? <PesoInvalido /> : (
        <Bloco titulo="Doses pelo peso (Tabela 3, p. 119, e texto)">
          {DOSES_ASMA.map((d) => (
            <LinhaDose
              key={d.id}
              d={d}
              peso={peso}
              extra={d.id === 'magnesio-tabela' ? <p>Dose padrão (50 mg/kg): <strong className="tabular-nums">{num(MAGNESIO_PADRAO_MG_KG * peso, 0)} mg</strong></p> : undefined}
            />
          ))}
          {ipra && (
            <div className="rounded-controle border px-3 py-2 text-apoio">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">Ipratrópio em nebulização (250 µg/mL)</span>
                <strong className="tabular-nums">{ipra.mcg} µg · {ipra.gotas} gotas</strong>
              </div>
              <p className="text-tinta-sussurro">Menos de 20 kg: 250 µg (20 gotas); 20 kg ou mais: 500 µg (40 gotas). A cada 20 min, geralmente na primeira hora, intercalado ao salbutamol.</p>
              <p className="text-rotulo text-tinta-sussurro">Livro ICr, p. 119 (Tabela 3).</p>
            </div>
          )}
        </Bloco>
      )}

      <Bloco titulo="Sem cálculo por peso">
        {FIXOS_ASMA.map((f) => <LinhaReferencia key={f.nome} rotulo={f.nome} texto={f.dose} pagina={`cap. 8, ${f.pagina}`} />)}
      </Bloco>

      <Bloco titulo="Classificação da crise (Tabela 1, p. 114) — referência">
        <p className="text-tinta-sussurro">A presença de vários parâmetros, mas não necessariamente todos, indica a classificação geral. A tela não classifica.</p>
        <div className="overflow-x-auto">
          <Table variante="referencia" className="w-full min-w-[560px] text-left text-rotulo">
            <TableHeader className="text-tinta-sussurro">
              <TableRow>{['Parâmetro', 'Leve a moderada', 'Grave', 'Muito grave (insuficiência respiratória)'].map((h) => <TableHead key={h} className="px-1.5 py-1 font-medium">{h}</TableHead>)}</TableRow>
            </TableHeader>
            <TableBody>
              {CLASSIFICACAO_ASMA.map((l) => (
                <TableRow key={l.parametro} className="border-t">
                  <TableCell className="px-1.5 py-1 font-medium">{l.parametro}</TableCell>
                  <TableCell className="px-1.5 py-1">{l.leveModerada}</TableCell>
                  <TableCell className="px-1.5 py-1">{l.grave}</TableCell>
                  <TableCell className="px-1.5 py-1">{l.muitoGrave}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-tinta-sussurro">FR normal: &lt; 2 meses, &lt; 60; 2 a 11 meses, &lt; 50; 1 a 5 anos, &lt; 40; 6 a 8 anos, &lt; 30; acima de 8 anos, igual ao adulto.</p>
        <p className="text-rotulo text-tinta-sussurro">Livro ICr, cap. 8, p. 114.</p>
      </Bloco>
    </ToolLayout>
  )
}
