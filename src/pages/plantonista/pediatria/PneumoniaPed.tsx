import { useState } from 'react'

import {
  DOMICILIAR, DURACAO_DERRAME, ERRATA_PAC, ESPECIAIS, GRAVIDADE_PAC, HOSPITALAR, INTERNACAO_PAC, NOTA_ERITRO_RN, NOTA_MAIOR5, ROTULO_FAIXA, TEXTO_PLEURAL, faixaPac,
  fichaPneumoniaPed, lerLiquidoPleural,
} from '@/clinico/pediatria/pneumoniaPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, Nota, Opcoes } from './PecasIcr'
import { Aviso, LinhaDoseLivro, TabelaLivro } from './PecasP4'

/** Pneumonia adquirida na comunidade — cap. 30 do livro do ICr. */
export function PneumoniaPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [regime, setRegime] = useState<'domiciliar' | 'hospitalar'>('domiciliar')
  const [pl, setPl] = useState({ ph: 0, glicose: 0, dhl: 0 })
  const pediatrico = idadePediatrica(p.anos, p.meses)
  const faixa = p.rn ? 'menor2m' : faixaPac(p.anos * 12 + p.meses)
  const calc = p.peso > 0 && pediatrico && faixa !== null
  const pleural = lerLiquidoPleural(pl.ph, pl.glicose, pl.dhl)
  const tabela = faixa === null ? null : regime === 'hospitalar' ? HOSPITALAR[faixa] : faixa === 'menor2m' ? null : DOMICILIAR[faixa]

  return (
    <ToolLayout
      title="Pneumonia adquirida na comunidade — criança"
      description="Antibiótico empírico domiciliar e hospitalar por faixa etária e peso (Tabelas 3 e 4), situações especiais, sinais de gravidade e líquido pleural — livro do ICr-HCFMUSP."
      ficha={fichaPneumoniaPed}
    >
      <CampoPaciente id="pac" p={p} onChange={setP} />
      <Bloco titulo="Regime">
        <Opcoes label="Tratamento" valor={regime} opcoes={[['domiciliar', 'Domiciliar (Tabela 3)'], ['hospitalar', 'Hospitalar (Tabela 4)']]} onChange={setRegime} />
        {faixa && <p className="text-muted-foreground">Faixa etária da tabela: {ROTULO_FAIXA[faixa]}{p.rn ? ' (RN)' : ''}.</p>}
        <Nota>{INTERNACAO_PAC}</Nota>
      </Bloco>

      {!calc ? (
        <Aviso>Informe o peso para calcular as doses.</Aviso>
      ) : !tabela ? (
        <Aviso>A Tabela 3 (domiciliar) começa em 2 meses; menores de 2 meses estão entre os critérios de internação (p. 312).</Aviso>
      ) : (
        <>
          <Bloco titulo={`Escolha inicial — ${ROTULO_FAIXA[faixa!]}`}>
            {tabela.inicial.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
          </Bloco>
          <Bloco titulo="Escolha opcional (falha terapêutica)">
            {tabela.falha.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
            {faixa === 'maior5a' && regime === 'domiciliar' && <Nota>{NOTA_MAIOR5}</Nota>}
          </Bloco>
          {!p.rn && (
            <Bloco titulo="Situações especiais (p. 312–313)">
              {ESPECIAIS.map((s) => (
                <div key={s.titulo} className="flex flex-col gap-2">
                  <p className="font-medium">{s.titulo}</p>
                  {s.doses.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} />)}
                </div>
              ))}
              <Nota>{NOTA_ERITRO_RN}</Nota>
            </Bloco>
          )}
        </>
      )}

      <Bloco titulo="Sinais de gravidade (p. 309)">
        <TabelaLivro cabecalho={['Idade', 'Sinais']} linhas={GRAVIDADE_PAC.map((g) => [g.faixa, g.sinais])} largura={360} />
      </Bloco>

      <Bloco titulo="Líquido pleural seroso (p. 314)">
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField id="pac-ph" label="pH" value={pl.ph} onChange={(x) => setPl({ ...pl, ph: x })} min={0} step={0.01} />
          <NumberField id="pac-gli" label="Glicose" unit="mg/dL" value={pl.glicose} onChange={(x) => setPl({ ...pl, glicose: x })} min={0} />
          <NumberField id="pac-dhl" label="DHL" unit="UI/L" value={pl.dhl} onChange={(x) => setPl({ ...pl, dhl: x })} min={0} />
        </div>
        {pleural && <p>{TEXTO_PLEURAL[pleural]}</p>}
        <Nota>Líquido purulento é empiema: só análise microbiológica (p. 314). {DURACAO_DERRAME}</Nota>
      </Bloco>
      <Bloco titulo="Errata">
        <Errata texto={ERRATA_PAC} />
      </Bloco>
    </ToolLayout>
  )
}
