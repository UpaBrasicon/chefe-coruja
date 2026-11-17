import { useState } from 'react'

import {
  DIFERENCAS_LRA, DIRETRIZ_LRA, FORA_RENAL, FUROSEMIDA_ESTRESSE, INDICACOES_TSR, NOTAS_FRACOES, OUTROS_LRA, fena, feur, fichaLesaoRenalAguda, furosemidaEstresse, indicesUrinarios, kdigo,
} from '@/clinico/adulto/renal'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { Alertas, Bloco, Resultado } from './LoteAPecas'
import { br, informado } from './loteAFormato'
import { CampoPeso, LinhaManual } from './PecasLoteC'
import { Fora, ListaRef, Marca } from './PecasLoteE6'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const est = (e: number | null) => (e === null ? '—' : e === 0 ? 'sem estágio' : `estágio ${['', 'I', 'II', 'III'][e]}`)

/** Lesão renal aguda (cap. 61 do manual do HCFMUSP). */
export function LesaoRenalAgudaAdulto() {
  const [peso, setPeso] = useState(0)
  const [crB, setCrB] = useState(0)
  const [crA, setCrA] = useState(0)
  const [d48, setD48] = useState(0)
  const [du, setDu] = useState(0)
  const [horas, setHoras] = useState(0)
  const [anuria, setAnuria] = useState(0)
  const [tsr, setTsr] = useState(false)
  const [naU, setNaU] = useState(0)
  const [naP, setNaP] = useState(0)
  const [crU, setCrU] = useState(0)
  const [crP, setCrP] = useState(0)
  const [urU, setUrU] = useState(0)
  const [urP, setUrP] = useState(0)
  const [osmU, setOsmU] = useState(0)
  const [previa, setPrevia] = useState(false)

  const k = kdigo({ crBasal: informado(crB), crAtual: informado(crA), aumento48h: informado(d48), pesoKg: informado(peso), diureseMl: du > 0 || horas > 0 ? du : undefined, periodoH: informado(horas), anuriaH: informado(anuria), tsr })
  const fn = fena(naU, crP, naP, crU)
  const fu = feur(urU, crP, urP, crU)
  const ind = indicesUrinarios({ ureiaP: informado(urP), crP: informado(crP), naU: informado(naU), osmU: informado(osmU) })
  const furo = furosemidaEstresse(peso, previa)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaLesaoRenalAguda.id)
  const temResultado = k.estadio !== null || fn !== null || fu !== null || ind.length > 0 || furo !== null

  // Texto do "Copiar" (C4 = A): dados informados, estágio KDIGO, frações, índices e o teste de furosemida.
  const copia = temResultado
    ? textoCopia({
        ferramenta: 'Lesão renal aguda — adulto',
        dados: [
          ['Peso', peso > 0 ? `${numeroBr(peso)} kg` : ''],
          ['Creatinina basal', crB > 0 ? `${numeroBr(crB)} mg/dL` : ''],
          ['Creatinina atual', crA > 0 ? `${numeroBr(crA)} mg/dL` : ''],
          ['Aumento em 48 h', d48 > 0 ? `${numeroBr(d48)} mg/dL` : ''],
          ['Diurese', du > 0 || horas > 0 ? `${numeroBr(du)} mL em ${numeroBr(horas)} h` : ''],
          ['Anúria', anuria > 0 ? `${numeroBr(anuria)} h` : ''],
          ['Início de TSR', tsr ? 'sim' : ''],
          ['Na urinário', naU > 0 ? `${numeroBr(naU)} mEq/L` : ''],
          ['Na plasmático', naP > 0 ? `${numeroBr(naP)} mEq/L` : ''],
          ['Cr urinária', crU > 0 ? `${numeroBr(crU)} mg/dL` : ''],
          ['Cr plasmática', crP > 0 ? `${numeroBr(crP)} mg/dL` : ''],
          ['Ureia urinária', urU > 0 ? `${numeroBr(urU)} mg/dL` : ''],
          ['Ureia plasmática', urP > 0 ? `${numeroBr(urP)} mg/dL` : ''],
          ['Osmolaridade urinária', osmU > 0 ? `${numeroBr(osmU)} mOsm/kg` : ''],
        ],
        resultado: [
          ...(k.estadio !== null
            ? [
                `Estágio KDIGO (Tabela 1, p. 825): ${est(k.estadio)} — pela creatinina ${est(k.estadioCreatinina)}, pela diurese ${est(k.estadioDiurese)}`,
                ...(k.razao ? [`Razão atual/basal: ${br(k.razao, 2)} ×`] : []),
                ...(k.mlKgH !== null ? [`Diurese: ${br(k.mlKgH, 2)} mL/kg/h`] : []),
                ...(k.motivos.length ? [`Motivo: ${k.motivos.join('; ')}`] : []),
                ...k.avisos,
              ]
            : []),
          ...(fn ? [`FENa: ${br(fn.valor, 2)}% — ${fn.texto}`] : []),
          ...(fu ? [`FEUr: ${br(fu.valor, 1)}% — ${fu.texto}`] : []),
          ...ind.map((i) => `${i.indice}: ${i.valor} — ${i.leitura} (Tabela 2, p. 826–827)`),
          ...(furo ? [`Teste de estresse com furosemida: ${br(furo, 0)} mg EV${previa ? ' (uso prévio)' : ''}; corte < ${FUROSEMIDA_ESTRESSE.corteMl} mL em ${FUROSEMIDA_ESTRESSE.horas} h (${FUROSEMIDA_ESTRESSE.pagina})`] : []),
        ],
        fonte: textoFontes(fichaLesaoRenalAguda),
        versao: fichaLesaoRenalAguda.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Lesão renal aguda — adulto"
      description="Estágio KDIGO por creatinina e diurese, FENa, FEUr, índices urinários, teste de furosemida e indicações de diálise, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaLesaoRenalAguda}
    >
      <CampoPeso id="lra-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="KDIGO — definição e estadiamento" descricao="Tabela 1, p. 825. O estágio final é o maior entre creatinina e diurese.">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="lra-crb" label="Creatinina basal" unit="mg/dL" value={crB} onChange={setCrB} step={0.1} />
          <NumberField id="lra-cra" label="Creatinina atual" unit="mg/dL" value={crA} onChange={setCrA} step={0.1} />
          <NumberField id="lra-d48" label="Aumento em 48 h (opcional)" unit="mg/dL" value={d48} onChange={setD48} step={0.1} />
          <NumberField id="lra-du" label="Diurese no período" unit="mL" value={du} onChange={setDu} step={10} />
          <NumberField id="lra-h" label="Período" unit="h" value={horas} onChange={setHoras} step={1} />
          <NumberField id="lra-an" label="Anúria (opcional)" unit="h" value={anuria} onChange={setAnuria} step={1} />
        </div>
        <Marca rotulo="Início de terapia de substituição renal" marcado={tsr} onChange={setTsr} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Resultado rotulo="Razão atual/basal" valor={k.razao ? `${br(k.razao, 2)} ×` : '—'} />
          <Resultado rotulo="Diurese" valor={k.mlKgH !== null ? `${br(k.mlKgH, 2)} mL/kg/h` : peso > 0 ? '—' : 'informe o peso'} />
          <Resultado rotulo="Pela creatinina / pela diurese" valor={`${est(k.estadioCreatinina)} / ${est(k.estadioDiurese)}`} />
          <Resultado rotulo="Estágio KDIGO" valor={est(k.estadio)} />
        </div>
        {k.motivos.length > 0 && <p className="text-tinta-sussurro">{k.motivos.join('; ')}.</p>}
        <Alertas itens={k.avisos} />
      </Bloco>

      <Bloco titulo="Frações excretórias e índices" descricao="Fórmulas da Tabela 3 (p. 832); índices da Tabela 2 (p. 826–827).">
        <div className="grid gap-4 sm:grid-cols-4">
          <NumberField id="lra-nau" label="Na urinário" unit="mEq/L" value={naU} onChange={setNaU} />
          <NumberField id="lra-nap" label="Na plasmático" unit="mEq/L" value={naP} onChange={setNaP} />
          <NumberField id="lra-cru" label="Cr urinária" unit="mg/dL" value={crU} onChange={setCrU} step={0.1} />
          <NumberField id="lra-crp" label="Cr plasmática" unit="mg/dL" value={crP} onChange={setCrP} step={0.1} />
          <NumberField id="lra-uru" label="Ureia urinária" unit="mg/dL" value={urU} onChange={setUrU} />
          <NumberField id="lra-urp" label="Ureia plasmática" unit="mg/dL" value={urP} onChange={setUrP} />
          <NumberField id="lra-osm" label="Osmolaridade urinária" unit="mOsm/kg" value={osmU} onChange={setOsmU} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Resultado rotulo="FENa = (NaU × CrP) / (NaP × CrU)" valor={fn ? `${br(fn.valor, 2)}% — ${fn.texto}` : 'informe Na e Cr de urina e plasma'} />
          <Resultado rotulo="FEUr = (UrU × CrP) / (UrP × CrU)" valor={fu ? `${br(fu.valor, 1)}% — ${fu.texto}` : 'informe ureia e Cr de urina e plasma'} />
        </div>
        {ind.map((i) => <Resultado key={i.indice} rotulo={i.indice} valor={`${i.valor} — ${i.leitura}`} />)}
        <ListaRef itens={NOTAS_FRACOES} />
      </Bloco>

      <Bloco titulo="Teste de estresse com furosemida">
        <Marca rotulo="Uso prévio de furosemida" marcado={previa} onChange={setPrevia} />
        <LinhaManual nome="Furosemida EV" texto={FUROSEMIDA_ESTRESSE.texto} pagina={FUROSEMIDA_ESTRESSE.pagina}
          conta={furo ? <strong>{br(furo, 0)} mg; corte &lt; {FUROSEMIDA_ESTRESSE.corteMl} mL em {FUROSEMIDA_ESTRESSE.horas} h</strong> : 'informe o peso'} />
      </Bloco>

      <Bloco titulo="Indicações convencionais de terapia de substituição renal" descricao="Tabela 5, p. 837–838. A decisão de TSR precoce é individualizada (p. 839).">
        <ListaRef itens={INDICACOES_TSR} />
        <ListaRef itens={OUTROS_LRA} />
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <Fora itens={FORA_RENAL} />
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={guia?.armadilhas ?? []}
        ficha={fichaLesaoRenalAguda}
        guia={guia}
        comparacao={
          // Tabela de comparação com a KDIGO 2012 vai para "Evidências" (C6 = A); nenhuma conta do manual muda.
          <BlocoComparacao titulo="KDIGO 2012 — ao lado do manual" resumo="Lesão renal aguda pela KDIGO 2012 (GRADE); a KDIGO 2026 ainda era rascunho em consulta pública em 14/11/2026. As contas do manual acima continuam valendo.">
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Diretriz</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DIRETRIZ_LRA.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.diretriz} <span className="text-tinta-sussurro">({d.fonte}; {d.grau})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_LRA.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={k.estadio !== null ? `KDIGO: ${est(k.estadio)}` : fn ? `FENa ${br(fn.valor, 2)}%` : fu ? `FEUr ${br(fu.valor, 1)}%` : 'Informe creatinina ou diurese'}
        detalhe={[
          ...(k.estadio !== null ? [`creatinina ${est(k.estadioCreatinina)} · diurese ${est(k.estadioDiurese)}`] : []),
          ...(k.estadio !== null && fn ? [`FENa ${br(fn.valor, 2)}%`] : []),
          ...(furo ? [`furosemida ${br(furo, 0)} mg EV`] : []),
        ].join(' · ') || undefined}
        tom={k.avisos.length > 0 ? 'atencao' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
