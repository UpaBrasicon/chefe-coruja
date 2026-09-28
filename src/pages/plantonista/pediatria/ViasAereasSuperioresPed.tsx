import { useState } from 'react'

import {
  DOSES_CRUPE, DOSES_FARINGITE, DOSES_OMA, DOSES_SINUSITE, GRAVIDADE_CRUPE, REFERENCIAS_VAS, benzatinaFaringiteU, canulaReduzida, fichaViasAereasSuperiores,
} from '@/clinico/pediatria/viasAereasSuperiores'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, LinhaLivro, Opcoes, Pendencia } from './PecasIcr'
import { LinhaReferencia } from './PecasP2'
import { LinhaDoseLivro, TabelaLivro } from './PecasP4'

type Tema = 'oma' | 'faringite' | 'sinusite' | 'crupe'

/** OMA, faringite, sinusite e crupe na criança — cap. 28 do livro do ICr. */
export function ViasAereasSuperioresPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [tema, setTema] = useState<Tema>('crupe')
  const [di, setDi] = useState(0)
  const calc = !p.rn && p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const benz = calc ? benzatinaFaringiteU(p.peso) : null
  const canCrupe = canulaReduzida(di, 'crupe')
  const canSupra = canulaReduzida(di, 'supraglotite')
  const lista = { oma: DOSES_OMA, faringite: DOSES_FARINGITE, sinusite: DOSES_SINUSITE, crupe: DOSES_CRUPE }[tema]

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
              conta={<strong>{benz === 'indefinido' ? 'exatamente 27 kg: o livro não define' : `${benz.toLocaleString('pt-BR')} U`}</strong>}
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
    </ToolLayout>
  )
}
