import { useState } from 'react'

import {
  DOSES_ITU_ORAL, DOSES_ITU_PARENTERAL, ERRATA_ITU, FATORES_MENINA, FATORES_MENINO, LEUCOCITURIA, NOTA_TABELA2, QUADRO3, REFERENCIAS_ITU, fichaItuPed, lerUrocultura,
  testarUrinaAap, type Coleta, type Sexo,
} from '@/clinico/pediatria/ituPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, Nota, Opcoes, Pendencia } from './PecasIcr'
import { LinhaDoseLivro, Marcadores } from './PecasP4'

/** Infecção urinária na criança — cap. 57 do livro do ICr. */
export function InfeccaoUrinariaPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [sexo, setSexo] = useState<Sexo>('menina')
  const [circ, setCirc] = useState(false)
  const [fatores, setFatores] = useState<Set<string>>(new Set())
  const [coleta, setColeta] = useState<Coleta>('sondagem')
  const [ufc, setUfc] = useState(0)
  const [umGerme, setUmGerme] = useState(true)
  const lista = sexo === 'menina' ? FATORES_MENINA : FATORES_MENINO
  const nFatores = lista.filter((f) => fatores.has(f)).length
  const aap = testarUrinaAap(sexo, circ, nFatores)
  const uro = ufc > 0 || coleta === 'saco' ? lerUrocultura(coleta, ufc, umGerme) : null
  const calc = !p.rn && p.peso > 0 && idadePediatrica(p.anos, p.meses)

  return (
    <ToolLayout
      title="Infecção urinária — criança"
      description="Fatores de risco da AAP (Tabela 2), leitura da urocultura pelo método de coleta e antibióticos orais e parenterais por peso (Tabelas 3 e 4) — livro do ICr-HCFMUSP."
      ficha={fichaItuPed}
    >
      <CampoPaciente id="itu" p={p} onChange={setP} />

      <Bloco titulo="Testar a urina? Tabela 2 da AAP (p. 592)" descricao="Primeira ITU, 2 meses a 2 anos, febre sem sinais localizatórios, sem antibiótico imediato e sem doença urinária conhecida.">
        <Opcoes label="Sexo" valor={sexo} opcoes={[['menina', 'Menina'], ['menino', 'Menino']]} onChange={(s) => { setSexo(s); setFatores(new Set()) }} />
        {sexo === 'menino' && <Opcoes label="Circuncidado" valor={circ} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setCirc} />}
        <Marcadores itens={lista.map((f) => ({ id: f, texto: f }))} marcados={fatores} onChange={setFatores} />
        {aap && (
          <p>
            {nFatores} fator(es). Probabilidade de ITU &gt; 1%: <strong>{aap.limiar1 ? 'a tabela indica testar' : 'abaixo do limiar da tabela'}</strong>; &gt; 2%:{' '}
            <strong>{aap.limiar2 ? 'a tabela indica testar' : 'abaixo do limiar da tabela'}</strong>.
          </p>
        )}
        <Nota>{NOTA_TABELA2}</Nota>
      </Bloco>

      <Bloco titulo="Urocultura (p. 594–595)" descricao={`Leucocitúria: ≥ ${LEUCOCITURIA.centrifugadaCampo}/campo (centrifugada) ou ≥ ${LEUCOCITURIA.naoCentrifugadaMm3}/mm³ = 10.000/mL (não centrifugada) (p. 593).`}>
        <Opcoes label="Coleta" valor={coleta} opcoes={[['sondagem', 'Sondagem vesical'], ['psp', 'Punção suprapúbica'], ['jato', 'Jato médio'], ['saco', 'Saco coletor']]} onChange={setColeta} />
        <NumberField id="itu-ufc" label="Contagem" unit="UFC/mL" value={ufc} onChange={setUfc} min={0} step={1000} />
        <Opcoes label="Crescimento" valor={umGerme} opcoes={[[true, 'Um uropatógeno'], [false, 'Mais de um germe']]} onChange={setUmGerme} />
        {uro && <p>{uro}</p>}
      </Bloco>

      <Pendencia p={p} />
      {calc && (
        <>
          <Bloco titulo="Via oral (Tabela 3, p. 597)">
            {DOSES_ITU_ORAL.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} />)}
          </Bloco>
          <Bloco titulo="Via parenteral (Tabela 4, p. 597–598)">
            {DOSES_ITU_PARENTERAL.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} />)}
          </Bloco>
        </>
      )}
      {p.rn && <Nota>No recém-nascido o livro associa ampicilina à cefalosporina de 3ª geração ou aminoglicosídeo, sem dose neonatal (p. 596).</Nota>}

      <Bloco titulo="Tratamento parenteral e internação na pielonefrite (Quadro 3, p. 596–597)">
        <ul className="list-disc pl-5 text-tinta-sussurro">
          {QUADRO3.map((q) => <li key={q}>{q}</li>)}
        </ul>
      </Bloco>
      <Bloco titulo="Do capítulo">
        {REFERENCIAS_ITU.map((r) => (
          <Nota key={r.texto}>
            {r.texto} ({r.pagina})
          </Nota>
        ))}
        <Errata texto={ERRATA_ITU} />
      </Bloco>
    </ToolLayout>
  )
}
