import { useState } from 'react'

import {
  DOSES_IC_ORAIS, ERRATA_ICT, INOTROPICOS_IC, ISHLT, REFERENCIAS_IC, ROSS, fichaInsuficienciaCardiacaPed, indiceCardiotoracico, levosimendana,
} from '@/clinico/pediatria/insuficienciaCardiacaPed'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { calcularDoseLivro, type DoseLivro } from '@/clinico/pediatria/fonteP4'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, br, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, LinhaLivro, Pendencia } from './PecasIcr'
import { LinhaDoseLivro, TabelaLivro } from './PecasP4'

const casas = (u: DoseLivro['unidade'], x: number) => (u === 'UI' ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2)

/** Linha do "Copiar" com a mesma conta da LinhaDoseLivro. */
function linhaCopia(d: DoseLivro, peso: number): string[] {
  const r = calcularDoseLivro(d, peso)
  if (!r || (!r.porDose && !r.dia)) return []
  const fmt = (f: [number, number]) => faixaBr(f, casas(d.unidade, f[1]))
  const conta = [r.porDose && `${fmt(r.porDose)} ${d.unidade}/dose`, r.dia && `${fmt(r.dia)} ${d.unidade}/dia`].filter(Boolean).join(' · ')
  return [`- ${d.nome}: ${conta}${r.noMaximo ? ` — limitado ao máximo${d.fonteMaximo ? ` (${d.fonteMaximo})` : ' do livro'}` : ''} · ${d.via} (Livro ICr, ${d.pagina})`]
}

/** Insuficiência cardíaca na criança — cap. 22 do livro do ICr. */
export function InsuficienciaCardiacaPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [a, setA] = useState(0)
  const [b, setB] = useState(0)
  const [c, setC] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaInsuficienciaCardiacaPed.id)
  const pediatrico = idadePediatrica(p.anos, p.meses)
  const calc = !p.rn && p.peso > 0 && pediatrico
  const ict = indiceCardiotoracico(a, b, c, p.rn)
  const levo = calc ? levosimendana(p.peso) : null
  const textoIct = ict ? `(A + B) / C = ${br(ict.ict, 2)} — ${ict.acima ? 'acima' : 'não acima'} de ${br(ict.limite, 2)}, corte que o livro usa para sugerir cardiomegalia ${p.rn ? 'no neonato' : 'na criança'} (p. 237)` : null

  // Texto do "Copiar" (C3 e C4 = A): índice cardiotorácico, medicações orais e levosimendana do peso, com a página.
  const copia = () =>
    textoCopia({
      ferramenta: 'Insuficiência cardíaca — criança',
      dados: [
        ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
        ['Idade', p.anos > 0 || p.meses > 0 ? `${p.anos} anos e ${p.meses} meses` : ''],
        ['Recém-nascido', p.rn ? 'sim' : ''],
        ['A, B e C', ict ? `${numeroBr(a)}, ${numeroBr(b)} e ${numeroBr(c)} mm` : ''],
      ],
      resultado: [
        ...(textoIct ? [`Índice cardiotorácico: ${textoIct}`] : []),
        ...(calc ? ['Medicações orais (Tabela 6, p. 239–240):', ...DOSES_IC_ORAIS.flatMap((d) => linhaCopia(d, p.peso))] : []),
        ...(levo ? [`Levosimendana: ${faixaBr(levo.ataqueMcg, 0)} µg ataque · ${faixaBr(levo.manutencaoMcgMin, 2)} µg/min (Livro ICr, p. 240–241)`] : []),
      ],
      fonte: textoFontes(fichaInsuficienciaCardiacaPed),
      versao: fichaInsuficienciaCardiacaPed.versao,
      quando: new Date(),
    })

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
        {/* Piloto das calculadoras (C6 = A): a errata da legenda da Figura 3 foi para a aba Armadilhas. */}
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
        <p className="text-tinta-sussurro">Sem correlação clara com o prognóstico (p. 232).</p>
      </Bloco>
      <Bloco titulo="Estadiamento ISHLT (Tabela 3, p. 232)">
        <TabelaLivro cabecalho={['Estágio', 'Interpretação']} linhas={ISHLT.map(([x, y]) => [x, y])} largura={360} />
      </Bloco>
      <Bloco titulo="Do capítulo">
        {REFERENCIAS_IC.map((r) => (
          <p key={r.texto} className="text-tinta-sussurro">
            {r.texto} ({r.pagina})
          </p>
        ))}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc && !ict}
        armadilhas={[`Índice cardiotorácico — errata do livro: ${ERRATA_ICT}`, ...(guia?.armadilhas ?? [])]}
        ficha={fichaInsuficienciaCardiacaPed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? `Criança · ${numeroBr(p.peso)} kg${p.anos > 0 || p.meses > 0 ? ` · ${p.anos} a ${p.meses} m` : ''}` : ict ? `ICT ${br(ict.ict, 2)}` : p.rn ? 'Recém-nascido: a ferramenta não calcula dose' : 'Informe o peso'}
        detalhe={calc && ict ? `ICT ${br(ict.ict, 2)} — ${ict.acima ? 'acima' : 'não acima'} de ${br(ict.limite, 2)}` : calc ? 'Doses do peso nas listas acima; "Copiar" leva todas.' : ict ? `${ict.acima ? 'Acima' : 'Não acima'} de ${br(ict.limite, 2)} (p. 237)` : undefined}
        textoCopia={calc || ict ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
