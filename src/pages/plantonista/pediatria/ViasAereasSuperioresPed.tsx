import { useState } from 'react'

import {
  DOSES_CRUPE, DOSES_FARINGITE, DOSES_OMA, DOSES_SINUSITE, GRAVIDADE_CRUPE, REFERENCIAS_VAS, benzatinaFaringiteU, canulaReduzida, fichaViasAereasSuperiores,
} from '@/clinico/pediatria/viasAereasSuperiores'
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
import { Bloco, CampoPaciente, LinhaLivro, Opcoes, Pendencia } from './PecasIcr'
import { LinhaReferencia } from './PecasP2'
import { LinhaDoseLivro, TabelaLivro } from './PecasP4'
import { numero } from '@/lib/formato'

type Tema = 'oma' | 'faringite' | 'sinusite' | 'crupe'

const NOME_TEMA: Record<Tema, string> = { crupe: 'Crupe viral', oma: 'Otite média aguda', faringite: 'Faringite estreptocócica', sinusite: 'Sinusite bacteriana' }

const casas = (u: DoseLivro['unidade'], x: number) => (u === 'UI' ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2)

/** Linha do "Copiar" com a mesma conta da LinhaDoseLivro. */
function linhaCopia(d: DoseLivro, peso: number): string[] {
  const r = calcularDoseLivro(d, peso)
  if (!r || (!r.porDose && !r.dia)) return []
  const fmt = (f: [number, number]) => faixaBr(f, casas(d.unidade, f[1]))
  const conta = [r.porDose && `${fmt(r.porDose)} ${d.unidade}/dose`, r.dia && `${fmt(r.dia)} ${d.unidade}/dia`].filter(Boolean).join(' · ')
  return [`- ${d.nome}: ${conta}${r.noMaximo ? ` — limitado ao máximo${d.fonteMaximo ? ` (${d.fonteMaximo})` : ' do livro'}` : ''} · ${d.via} (Livro ICr, ${d.pagina})`]
}

/** OMA, faringite, sinusite e crupe na criança — cap. 28 do livro do ICr. */
export function ViasAereasSuperioresPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [tema, setTema] = useState<Tema>('crupe')
  const [di, setDi] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaViasAereasSuperiores.id)
  const calc = !p.rn && p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const benz = calc ? benzatinaFaringiteU(p.peso) : null
  const canCrupe = canulaReduzida(di, 'crupe')
  const canSupra = canulaReduzida(di, 'supraglotite')
  const lista = { oma: DOSES_OMA, faringite: DOSES_FARINGITE, sinusite: DOSES_SINUSITE, crupe: DOSES_CRUPE }[tema]
  const temCanula = tema === 'crupe' && !!canCrupe && !!canSupra

  // Texto do "Copiar" (C3 e C4 = A): as doses do tema escolhido para o peso e a cânula do crupe, com a página.
  const copia = () =>
    textoCopia({
      ferramenta: `OMA, faringite, sinusite e crupe — criança (${NOME_TEMA[tema]})`,
      dados: [
        ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
        ['Idade', p.anos > 0 || p.meses > 0 ? `${p.anos} anos e ${p.meses} meses` : ''],
        ['Tema', NOME_TEMA[tema]],
        ['DI calculado para a idade', temCanula ? `${numeroBr(di)} mm` : ''],
      ],
      resultado: [
        ...(calc ? ['Doses pelo peso:', ...lista.flatMap((d) => linhaCopia(d, p.peso))] : []),
        ...(calc && tema === 'faringite' && benz !== null
          ? [`- Penicilina G benzatina IM: ${benz === 'indefinido' ? 'exatamente 27 kg: o livro não define' : `${numero(benz)} U`}, dose única (Livro ICr, p. 289, Tabela 3)`]
          : []),
        ...(temCanula ? [`Cânula traqueal: crupe (0,5 mm menor) ${br(canCrupe![0], 1)} mm · supraglotite (0,5 a 1,0 mm menor, lâmina curva) ${faixaBr(canSupra, 1)} mm (Livro ICr, p. 295–296)`] : []),
      ],
      fonte: textoFontes(fichaViasAereasSuperiores),
      versao: fichaViasAereasSuperiores.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="OMA, faringite, sinusite e crupe — criança"
      description="Antibióticos e corticoide por peso, com os máximos do capítulo ou do Apêndice, e a gravidade do crupe (Tabela 6) — livro do ICr-HCFMUSP. O livro não traz o escore de Westley."
      ficha={fichaViasAereasSuperiores}
    >
      <CampoPaciente id="vas" p={p} onChange={setP} />
      <Bloco titulo="Quadro">
        <Opcoes label="Tema" valor={tema} opcoes={[['crupe', 'Crupe viral'], ['oma', 'Otite média aguda'], ['faringite', 'Faringite estreptocócica'], ['sinusite', 'Sinusite bacteriana']]} onChange={setTema} />
      </Bloco>

      <Pendencia p={p} />
      {calc && (
        <Bloco titulo="Doses pelo peso">
          {lista.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} />)}
          {tema === 'faringite' && benz !== null && (
            <LinhaLivro
              nome="Penicilina G benzatina IM"
              conta={<strong>{benz === 'indefinido' ? 'exatamente 27 kg: o livro não define' : `${numero(benz)} U`}</strong>}
              texto="< 27 kg: 600.000 U; > 27 kg: 1.200.000 U, dose única"
              pagina="p. 289 (Tabela 3)"
            />
          )}
        </Bloco>
      )}

      {tema === 'crupe' && (
        <>
          <Bloco titulo="Gravidade do crupe (Tabela 6, p. 294) — referência" descricao="A gravidade do desconforto guia o manejo; a tabela não tem pontuação e a tela não classifica.">
            <TabelaLivro
              cabecalho={['Sinal', 'Leve', 'Moderado', 'Grave', 'Falência iminente']}
              linhas={GRAVIDADE_CRUPE.map((g) => [g.sinal, g.leve, g.moderado, g.grave, g.falencia])}
              largura={620}
            />
          </Bloco>
          <Bloco titulo="Cânula traqueal (p. 295–296)">
            <NumberField id="vas-di" label="DI calculado para a idade" unit="mm" value={di} onChange={setDi} min={0} step={0.5} />
            {canCrupe && canSupra && (
              <p>
                Crupe (0,5 mm menor): <strong>{br(canCrupe[0], 1)} mm</strong> · supraglotite (0,5 a 1,0 mm menor, lâmina curva): <strong>{faixaBr(canSupra, 1)} mm</strong>
              </p>
            )}
          </Bloco>
        </>
      )}

      <Bloco titulo="Critérios e condutas do capítulo">
        {REFERENCIAS_VAS.map((r) => <LinhaReferencia key={r.rotulo} rotulo={r.rotulo} texto={r.texto} pagina={`cap. 28, ${r.pagina}`} />)}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc && !temCanula}
        armadilhas={guia?.armadilhas ?? []}
        ficha={fichaViasAereasSuperiores}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? `Criança · ${numeroBr(p.peso)} kg${p.anos > 0 || p.meses > 0 ? ` · ${p.anos} a ${p.meses} m` : ''} · ${NOME_TEMA[tema]}` : p.rn ? 'Recém-nascido: a ferramenta não calcula dose' : 'Informe o peso'}
        detalhe={calc ? 'Doses do tema na lista acima; "Copiar" leva todas.' : temCanula ? `Cânula no crupe: ${br(canCrupe![0], 1)} mm` : undefined}
        textoCopia={calc || temCanula ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
