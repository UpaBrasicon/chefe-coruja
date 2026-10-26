import { useState } from 'react'

import {
  CRITERIOS_MENINO, DIFERENCAS_ICR_AAP, DOSES_FSSL, ELEGIBILIDADE_AAP, ERRATA_AAP_LIQUOR, EXCLUSOES, FATORES_MENINA, KAS_AAP_2021, NOTA_LEUCOGRAMA, PECARN_DESEMPENHO,
  REFERENCIAS_FSSL, TEXTO_FAIXA, coletaUrina, faixaAap2021, faixaFssl, fichaFebreSemSinais, leucogramaAlterado, marcadoresAap2021, pcrAlterada, pecarn2019,
} from '@/clinico/pediatria/febreSemSinaisPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { Pergunta } from '../manual/PecasLoteC'

import { PACIENTE_VAZIO, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Nota, Opcoes } from './PecasIcr'
import { Aviso, LinhaDoseLivro, Marcadores } from './PecasP4'
import { ListaLivro, ListaQuadro } from './PecasP5'

const TEXTO_URINA = { coletar: 'O texto do livro indica coletar urina.', 'nao-indicada': 'Pelo texto do livro, a coleta não está indicada por estes critérios.', indefinido: 'Informe a idade. Aos 6 meses exatos o texto não define a regra do menino ("abaixo" x "mais que 6 meses").' } as const

/** Febre sem sinais localizatórios — cap. 45 do livro do ICr. */
export function FebreSemSinaisPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [dias, setDias] = useState(0)
  const [lab, setLab] = useState({ leucocitos: 0, neutrofilos: 0, bastoesSobreNeutrofilos: 0, pcr: 0 })
  const [sexo, setSexo] = useState<'menina' | 'menino'>('menina')
  const [circ, setCirc] = useState(false)
  const [fatores, setFatores] = useState<Set<string>>(new Set())
  const [temp, setTemp] = useState(0)
  const [pct, setPct] = useState(0)
  const [urinaNeg, setUrinaNeg] = useState<boolean>()
  const meses = p.anos * 12 + p.meses
  const faixa = faixaFssl(dias, meses)
  const menor90 = dias > 0 && dias <= 90
  const leuco = leucogramaAlterado(lab, menor90)
  const pcr = pcrAlterada(lab.pcr)
  const faixaAap = faixaAap2021(dias)
  const aap = faixaAap ? marcadoresAap2021(faixaAap, { temperatura: temp, procalcitonina: pct, pcrMgL: lab.pcr, neutrofilos: lab.neutrofilos }) : null
  const pecarn = faixaAap && pct > 0 && lab.neutrofilos > 0 ? pecarn2019({ urinaNegativa: urinaNeg, neutrofilos: lab.neutrofilos, procalcitonina: pct }) : null
  const urina = coletaUrina(sexo, fatores, dias > 0 ? dias / 30.4375 : meses > 0 ? meses : NaN, circ)
  const calc = p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const campo = (k: keyof typeof lab, label: string, unit: string, step = 1) => (
    <NumberField id={`fssl-${k}`} label={label} unit={unit} value={lab[k]} onChange={(x) => setLab({ ...lab, [k]: x })} min={0} step={step} />
  )

  return (
    <ToolLayout
      title="Febre sem sinais localizatórios — criança"
      description="Faixa etária dos fluxogramas, leucograma e PCR de risco, coleta de urina por fatores e antibióticos orais por peso — livro do ICr-HCFMUSP. A decisão é do médico."
      ficha={fichaFebreSemSinais}
    >
      <CampoPaciente id="fssl" p={p} onChange={setP}>
        <NumberField id="fssl-dias" label="Idade em dias (até 90)" unit="dias" value={dias} onChange={setDias} min={0} max={90} />
      </CampoPaciente>

      <Bloco titulo="Fluxograma pela idade (p. 464–468)">
        {faixa ? <p>{TEXTO_FAIXA[faixa]}</p> : <p className="text-tinta-sussurro">Informe a idade em dias (até 90) ou em meses.</p>}
      </Bloco>

      <Bloco titulo="Não aplicar o protocolo se (p. 463)">
        <ListaQuadro itens={EXCLUSOES} pagina="p. 463" />
      </Bloco>

      <Bloco titulo="Leucograma e PCR (p. 463–467)">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {campo('leucocitos', 'Leucócitos', '/mm³')}
          {campo('neutrofilos', 'Neutrófilos', '/mm³')}
          {campo('bastoesSobreNeutrofilos', 'Bastões ÷ neutrófilos', 'razão', 0.01)}
          {campo('pcr', 'PCR', 'mg/L', 0.1)}
        </div>
        {leuco && <p>{leuco.alterado ? <strong>Leucograma de maior risco para DBG: {leuco.motivos.join('; ')}.</strong> : 'Leucograma fora dos cortes de risco do livro.'}</p>}
        {pcr !== null && <p>{pcr ? <strong>PCR &gt; 20 mg/L.</strong> : 'PCR ≤ 20 mg/L.'}</p>}
        <Nota>{NOTA_LEUCOGRAMA}</Nota>
      </Bloco>

      {faixaAap && (
        <Bloco titulo={`AAP 2021 e PECARN 2019 — lactente de ${faixaAap.replace('-', ' a ')} dias, ao lado do livro`} descricao="Doses continuam só as do livro do ICr. Usa os neutrófilos e a PCR informados acima.">
          <p className="text-apoio text-tinta-sussurro">{ELEGIBILIDADE_AAP}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField id="fssl-temp" label="Temperatura máxima" unit="°C" value={temp} onChange={setTemp} min={0} step={0.1} />
            <NumberField id="fssl-pct" label="Procalcitonina" unit="ng/mL" value={pct} onChange={setPct} min={0} step={0.01} />
          </div>
          <Pergunta rotulo="Exame de urina" valor={urinaNeg} opcoes={[[true, 'Negativo'], [false, 'Positivo']]} onChange={setUrinaNeg} />
          {aap?.algumInformado && (
            <p>
              {aap.alterados.length ? <strong>Marcadores alterados pela AAP: {aap.alterados.join('; ')}.</strong> : 'Nenhum marcador informado acima do corte da AAP.'}
              {aap.neutrofilosNaFaixa && ' Neutrófilos entre 4.000 e 5.200: dentro da faixa de corte que a AAP escreve ("> 4.000 a 5.200").'}
            </p>
          )}
          {pecarn && <p>PECARN: <strong>{pecarn === 'baixo-risco' ? 'baixo risco' : 'não é baixo risco'}</strong> (urina negativa, neutrófilos ≤ 4.090 e procalcitonina ≤ 1,71). <span className="text-tinta-sussurro">{PECARN_DESEMPENHO}</span></p>}
          <ul className="grid gap-1 text-apoio">
            {KAS_AAP_2021[faixaAap].map((k) => <li key={k.kas}><span className="font-medium">KAS {k.kas}:</span> {k.texto} <span className="text-tinta-sussurro">({k.grau})</span></li>)}
          </ul>
          {faixaAap === '22-28' && <Nota>{ERRATA_AAP_LIQUOR}</Nota>}
          <div className="overflow-x-auto">
            <Table variante="referencia" className="w-full min-w-[560px] text-left align-top text-apoio">
              <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">Livro do ICr</TableHead><TableHead className="pb-2">AAP 2021</TableHead></TableRow></TableHeader>
              <TableBody>
                {DIFERENCAS_ICR_AAP.map((d) => (
                  <TableRow key={d.tema} className="border-t">
                    <TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell>
                    <TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell>
                    <TableCell className="py-2">{d.aap}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Bloco>
      )}

      <Bloco titulo="Coleta de urina (p. 462)">
        <div className="flex flex-wrap gap-4">
          <Opcoes label="Sexo" valor={sexo} opcoes={[['menina', 'Menina'], ['menino', 'Menino']]} onChange={(s) => { setSexo(s); setFatores(new Set()) }} />
          {sexo === 'menino' && <Opcoes label="Circuncidado?" valor={circ} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setCirc} />}
        </div>
        <Marcadores itens={sexo === 'menina' ? FATORES_MENINA : CRITERIOS_MENINO} marcados={fatores} onChange={setFatores} />
        <p>
          <strong>{TEXTO_URINA[urina]}</strong>
        </p>
        <Nota>Menina: 2 ou mais fatores. Menino &lt; 6 meses: temperatura &gt; 39 °C. Menino &gt; 6 meses: 3 dos 4 critérios (circuncidado) ou 2 ou mais (não circuncidado).</Nota>
      </Bloco>

      {!calc ? (
        <Aviso>Informe o peso (idade até 13 anos e 11 meses) para calcular as doses.</Aviso>
      ) : (
        <Bloco titulo="Antibióticos (p. 466–468; Apêndice)" descricao={p.rn ? 'Recém-nascido: o livro não traz dose de FSSL para o período neonatal; nenhuma linha calcula.' : undefined}>
          {DOSES_FSSL.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
        </Bloco>
      )}

      <Bloco titulo="Do capítulo">
        <ListaLivro itens={REFERENCIAS_FSSL} />
      </Bloco>
    </ToolLayout>
  )
}
