import { useState } from 'react'

import {
  CRITERIOS_MENINO, DOSES_FSSL, EXCLUSOES, FATORES_MENINA, NOTA_LEUCOGRAMA, REFERENCIAS_FSSL, TEXTO_FAIXA, coletaUrina, faixaFssl, fichaFebreSemSinais, leucogramaAlterado, pcrAlterada,
} from '@/clinico/pediatria/febreSemSinaisPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

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
  const meses = p.anos * 12 + p.meses
  const faixa = faixaFssl(dias, meses)
  const menor90 = dias > 0 && dias <= 90
  const leuco = leucogramaAlterado(lab, menor90)
  const pcr = pcrAlterada(lab.pcr)
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
        {faixa ? <p>{TEXTO_FAIXA[faixa]}</p> : <p className="text-muted-foreground">Informe a idade em dias (até 90) ou em meses.</p>}
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
