import { useState } from 'react'

import {
  DOSES_IC_ORAIS, ERRATA_ICT, INOTROPICOS_IC, ISHLT, REFERENCIAS_IC, ROSS, fichaInsuficienciaCardiacaPed, indiceCardiotoracico, levosimendana,
} from '@/clinico/pediatria/insuficienciaCardiacaPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, LinhaLivro, Pendencia } from './PecasIcr'
import { LinhaDoseLivro, TabelaLivro } from './PecasP4'

/** Insuficiência cardíaca na criança — cap. 22 do livro do ICr. */
export function InsuficienciaCardiacaPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [a, setA] = useState(0)
  const [b, setB] = useState(0)
  const [c, setC] = useState(0)
  const pediatrico = idadePediatrica(p.anos, p.meses)
  const calc = !p.rn && p.peso > 0 && pediatrico
  const ict = indiceCardiotoracico(a, b, c, p.rn)
  const levo = calc ? levosimendana(p.peso) : null

  return (
    <ToolLayout
      title="Insuficiência cardíaca — criança"
      description="Diuréticos, iECA, betabloqueadores e digoxina por peso (Tabela 6), levosimendana, índice cardiotorácico, Ross e ISHLT — livro do ICr-HCFMUSP."
      ficha={fichaInsuficienciaCardiacaPed}
    >
      <CampoPaciente id="ic" p={p} onChange={setP} />

      <Bloco titulo="Índice cardiotorácico (Figura 3, p. 237)" descricao="A e B: maior distância da linha média às bordas cardíacas direita e esquerda; C: entre as bordas internas das costelas na altura do diafragma direito.">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField id="ic-a" label="A" unit="mm" value={a} onChange={setA} min={0} step={0.1} />
          <NumberField id="ic-b" label="B" unit="mm" value={b} onChange={setB} min={0} step={0.1} />
          <NumberField id="ic-c" label="C" unit="mm" value={c} onChange={setC} min={0} step={0.1} />
        </div>
        {ict && (
          <p>
            (A + B) / C = <strong className="tabular-nums">{br(ict.ict, 2)}</strong> — {ict.acima ? 'acima' : 'não acima'} de {br(ict.limite, 2)}, corte que o livro usa
            para sugerir cardiomegalia {p.rn ? 'no neonato' : 'na criança'} (p. 237).
          </p>
        )}
        <Errata texto={ERRATA_ICT} />
      </Bloco>

      <Pendencia p={p} />
      {calc && (
        <Bloco titulo="Medicações orais (Tabela 6, p. 239–240)">
          {DOSES_IC_ORAIS.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} />)}
        </Bloco>
      )}
      {levo && (
        <Bloco titulo="Levosimendana (Tabela 6, p. 240)">
          <LinhaLivro
            nome="Levosimendana"
            conta={
              <span>
                <strong>{faixaBr(levo.ataqueMcg, 0)} µg</strong> ataque · {faixaBr(levo.manutencaoMcgMin, 2)} µg/min
              </span>
            }
            texto="ataque de 8 a 12 mcg/kg; manutenção de 0,1 a 0,2 mcg/kg/min; metabólito ativo com meia-vida de 70 a 80 h"
            pagina="p. 240–241"
          />
        </Bloco>
      )}

      <Bloco titulo="Inotrópicos e vasodilatadores (Tabela 6, p. 240) — referência" descricao="mL/h pela concentração do preparo na ferramenta de infusões.">
        <TabelaLivro cabecalho={['Droga', 'Faixa do livro']} linhas={INOTROPICOS_IC.map(([x, y]) => [x, y])} largura={360} />
      </Bloco>

      <Bloco titulo="Classificação funcional de Ross (Tabela 2, p. 232)">
        <TabelaLivro cabecalho={['Classe', 'Descrição']} linhas={ROSS.map(([x, y]) => [x, y])} largura={360} />
        <p className="text-muted-foreground">Sem correlação clara com o prognóstico (p. 232).</p>
      </Bloco>
      <Bloco titulo="Estadiamento ISHLT (Tabela 3, p. 232)">
        <TabelaLivro cabecalho={['Estágio', 'Interpretação']} linhas={ISHLT.map(([x, y]) => [x, y])} largura={360} />
      </Bloco>
      <Bloco titulo="Do capítulo">
        {REFERENCIAS_IC.map((r) => (
          <p key={r.texto} className="text-muted-foreground">
            {r.texto} ({r.pagina})
          </p>
        ))}
      </Bloco>
    </ToolLayout>
  )
}
