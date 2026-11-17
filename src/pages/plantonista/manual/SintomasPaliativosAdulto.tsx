import { useState } from 'react'

import {
  DISPNEIA_PALIATIVO, DOR_NAO_VERBAL_PALIATIVO, DOR_PALIATIVO_PAGINA, DOR_PALIATIVO_SEM_OPIOIDE, EXTUBACAO_PALIATIVA, NOTA_EAPC_SEDACAO,
  QUETAMINA_ANALGESICA, SEDACAO_PALIATIVA, escalonarBolus, fichaPaliativoAdulto, furosemidaDispneia, quetaminaAnalgesica,
  resgateOpioide, sedacaoPaliativa, type Faixa,
} from '@/clinico/adulto/dorAnalgesia'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { numero } from '@/lib/formato'

const br = (x: number, casas = 1) => numero(Math.round(x * 10 ** casas) / 10 ** casas)
const faixa = (f: Faixa, casas = 1) => (f[0] === f[1] ? br(f[0], casas) : `${br(f[0], casas)}–${br(f[1], casas)}`)

/** Dor, dispneia e sedação paliativa do adulto (cap. 104 do manual do HCFMUSP). */
export function SintomasPaliativosAdulto() {
  const [peso, setPeso] = useState(0)
  const [totalDia, setTotalDia] = useState(0)
  const [bolusMorfina, setBolusMorfina] = useState(2)
  const [bolusMidaz, setBolusMidaz] = useState(0)
  const [mgHAtual, setMgHAtual] = useState(0)

  const resgate = resgateOpioide(totalDia)
  const morf = escalonarBolus(bolusMorfina)
  const furo = furosemidaDispneia(peso)
  const q = quetaminaAnalgesica(peso)
  const sed = sedacaoPaliativa(bolusMidaz, mgHAtual > 0 ? mgHAtual : undefined)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaPaliativoAdulto.id)
  const temPeso = Number.isFinite(peso) && peso > 0

  // As frases que a tela mostra, para o resumo e o "Copiar".
  const textoResgate = resgate ? `Resgate ${br(resgate.resgateMg)} mg · nova dose total ${faixa(resgate.novaTotalMg)} mg/dia` : null
  const alertaSed = sed?.acimaDoLimite === true ? 'acima de 20 mg/h: o livro diz considerar associação' : sed?.acimaDoLimite === 'faixa' ? 'entre 15 e 20 mg/h: faixa em que o livro diz considerar associação' : null
  const textoSed = sed ? `Manutenção pelo bolus: ${br(sed.manutencaoPeloBolusMgH, 2)} mg/h = ${br(sed.mlH, 2)} mL/h (1 mg/mL) · faixa do livro ${faixa(SEDACAO_PALIATIVA.manutencaoMgH)} mg/h${alertaSed ? ` · ${alertaSed}` : ''}` : null
  const dadosUsados = [
    temPeso ? `${numeroBr(peso)} kg` : '',
    resgate ? `morfina ${numeroBr(totalDia)} mg/dia` : '',
    sed ? `midazolam bolus ${numeroBr(bolusMidaz)} mg` : '',
  ].filter(Boolean)

  // Texto do "Copiar" (C3 e C4 = A): os dados usados e a lista inteira do capítulo, com a página.
  const copia = dadosUsados.length
    ? textoCopia({
        ferramenta: 'Dor, dispneia e sedação em cuidados paliativos — adulto',
        dados: [
          ['Peso', temPeso ? `${numeroBr(peso)} kg` : ''],
          ['Dose total diária de morfina', resgate ? `${numeroBr(totalDia)} mg/dia` : ''],
          ['Bolus de morfina atual (dispneia)', morf ? `${numeroBr(bolusMorfina)} mg` : ''],
          ['Bolus inicial de midazolam (sedação)', sed ? `${numeroBr(bolusMidaz)} mg` : ''],
          ['Infusão atual de midazolam', sed && mgHAtual > 0 ? `${numeroBr(mgHAtual)} mg/h` : ''],
        ],
        resultado: [
          `Dor intensa (7–10) sem uso prévio de opioide (${DOR_PALIATIVO_PAGINA}):`,
          ...DOR_PALIATIVO_SEM_OPIOIDE.map((d) => `- ${d.droga}: ${d.texto}`),
          ...(textoResgate ? [`Dor intensa em usuário de opioide (p. 1384): ${textoResgate}`] : []),
          ...(q ? [`Quetamina (p. 1384): bolus ${faixa(q.bolusMg)} mg · infusão ${faixa(q.infusaoMgH, 2)} mg/h = ${faixa(q.infusaoMlH)} mL/h (${br(q.mgMl)} mg/mL) (${QUETAMINA_ANALGESICA.cap104.pagina})`] : []),
          `Dispneia (${DISPNEIA_PALIATIVO.pagina}):`,
          ...(furo ? [`- Furosemida: considerar 0,5–1 mg/kg EV = ${faixa(furo)} mg, se compatível com o objetivo de cuidado`] : []),
          ...(morf ? [`- Morfina: próximo bolus ${faixa(morf.proximoMg)} mg · infusão ${br(morf.infusaoMgH)} mg/h`] : []),
          `- Midazolam (refratária a opioide): ${DISPNEIA_PALIATIVO.midazolamTexto}`,
          ...(textoSed ? [`Sedação paliativa — midazolam (${SEDACAO_PALIATIVA.pagina}): ${textoSed}`] : []),
        ],
        fonte: textoFontes(fichaPaliativoAdulto),
        versao: fichaPaliativoAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Dor, dispneia e sedação em cuidados paliativos — adulto"
      description="Resgate de 1/6 da dose diária, morfina e midazolam na dispneia, quetamina analgésica e sedação paliativa com midazolam, pelo manual do HC. Adulto (14 anos ou mais)."
      ficha={fichaPaliativoAdulto}
    >
      <CampoPeso id="pal-peso" peso={peso} onChange={setPeso} />
      <p className="text-apoio text-tinta-sussurro">{DOR_NAO_VERBAL_PALIATIVO}</p>

      <Bloco titulo="Dor intensa (7–10) sem uso prévio de opioide" descricao={DOR_PALIATIVO_PAGINA}>
        <ul className="flex flex-col gap-1 text-apoio">
          {DOR_PALIATIVO_SEM_OPIOIDE.map((d) => <li key={d.droga}><span className="font-medium">{d.droga}:</span> {d.texto}</li>)}
        </ul>
      </Bloco>

      <Bloco titulo="Dor intensa em usuário de opioide (p. 1384)" descricao="Resgate com morfina (ou equivalente) = 1/6 da dose total diária; aumentar a dose total em 50–100%. O livro não traz tabela de equivalência: informe a dose diária já em morfina.">
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField id="pal-total" label="Dose total diária de morfina" unit="mg/dia" value={totalDia} onChange={setTotalDia} min={0} step={0.5} />
        </div>
        {resgate && (
          <p className="text-apoio">Resgate <strong>{br(resgate.resgateMg)} mg</strong> · nova dose total <strong>{faixa(resgate.novaTotalMg)} mg/dia</strong></p>
        )}
      </Bloco>

      <Bloco titulo="Contraindicação a opioide ou refratariedade — quetamina (p. 1384)">
        <LinhaManual
          nome="Quetamina"
          texto={QUETAMINA_ANALGESICA.cap104.texto}
          conta={q ? <>bolus <strong>{faixa(q.bolusMg)} mg</strong> · infusão <strong>{faixa(q.infusaoMgH, 2)} mg/h</strong> = {faixa(q.infusaoMlH)} mL/h ({br(q.mgMl)} mg/mL)</> : 'informe o peso'}
          pagina={QUETAMINA_ANALGESICA.cap104.pagina}
          nota="O livro registra que a quetamina ainda não foi adequadamente estudada em cuidados paliativos."
        />
      </Bloco>

      <Bloco titulo={`Dispneia (${DISPNEIA_PALIATIVO.pagina})`}>
        <LinhaManual nome="Furosemida" texto="considerar 0,5–1 mg/kg EV, se compatível com o objetivo de cuidado" conta={furo ? <strong>{faixa(furo)} mg</strong> : 'informe o peso'} pagina={DISPNEIA_PALIATIVO.pagina} />
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField id="pal-morf" label="Bolus de morfina atual" unit="mg" value={bolusMorfina} onChange={setBolusMorfina} min={0} step={0.5} />
        </div>
        <LinhaManual nome="Morfina" texto={DISPNEIA_PALIATIVO.morfinaTexto}
          conta={morf ? <>próximo bolus <strong>{faixa(morf.proximoMg)} mg</strong> · infusão <strong>{br(morf.infusaoMgH)} mg/h</strong></> : 'informe o bolus'} pagina={DISPNEIA_PALIATIVO.pagina} />
        <LinhaManual nome="Midazolam (refratária a opioide)" texto={DISPNEIA_PALIATIVO.midazolamTexto} pagina={DISPNEIA_PALIATIVO.pagina} />
      </Bloco>

      <Bloco titulo={`Sedação paliativa — midazolam (${SEDACAO_PALIATIVA.pagina})`} descricao={SEDACAO_PALIATIVA.texto}>
        <div className="grid gap-4 md:grid-cols-3">
          <NumberField id="pal-midaz" label="Bolus inicial usado" unit="mg" value={bolusMidaz} onChange={setBolusMidaz} min={0} step={0.5} />
          <NumberField id="pal-mgh" label="Infusão atual (opcional)" unit="mg/h" value={mgHAtual} onChange={setMgHAtual} min={0} step={0.5} />
        </div>
        {sed && (
          <p className="text-apoio">
            Manutenção pelo bolus: <strong>{br(sed.manutencaoPeloBolusMgH, 2)} mg/h</strong> = {br(sed.mlH, 2)} mL/h (1 mg/mL) · faixa do livro {faixa(SEDACAO_PALIATIVA.manutencaoMgH)} mg/h
            {sed.acimaDoLimite === true && <span className="text-atencao"> · acima de 20 mg/h: o livro diz considerar associação</span>}
            {sed.acimaDoLimite === 'faixa' && <span className="text-atencao"> · entre 15 e 20 mg/h: faixa em que o livro diz considerar associação</span>}
          </p>
        )}
        <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">{NOTA_EAPC_SEDACAO}</p>
      </Bloco>

      <Bloco titulo={`Extubação paliativa (${EXTUBACAO_PALIATIVA.pagina})`}>
        <ul className="list-disc pl-5 text-apoio">
          {EXTUBACAO_PALIATIVA.itens.map((i) => <li key={i}>{i}</li>)}
        </ul>
        <p className="text-apoio text-atencao">{EXTUBACAO_PALIATIVA.errata}</p>
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={dadosUsados.length === 0}
        armadilhas={[`Extubação paliativa — errata do livro: ${EXTUBACAO_PALIATIVA.errata}`, ...(guia?.armadilhas ?? [])]}
        ficha={fichaPaliativoAdulto}
        guia={guia}
      />
      <ResumoFlutuante
        principal={dadosUsados.length ? `Adulto · ${dadosUsados.join(' · ')}` : 'Informe o peso, a dose diária de morfina ou o bolus de midazolam'}
        detalhe={alertaSed ? `Midazolam ${alertaSed}` : textoResgate ?? (sed ? `Midazolam: manutenção ${br(sed.manutencaoPeloBolusMgH, 2)} mg/h` : undefined)}
        tom={alertaSed ? 'atencao' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
