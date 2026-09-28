import { useState } from 'react'

import {
  DOSES_IMUNODEPRIMIDO, ERRATA_TEICOPLANINA, NOTA_CORTICOIDE, PADROES_IMUNIDADE, PROFILAXIA, REFERENCIAS_IMUNO, corticoideImunossupressor, fichaImunodeprimidoPed,
} from '@/clinico/pediatria/imunodeprimidoPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, Nota } from './PecasIcr'
import { Aviso, LinhaDoseLivro, TabelaLivro } from './PecasP4'
import { ListaLivro } from './PecasP5'

/** Febre no imunodeprimido não oncológico — cap. 47 do livro do ICr. */
export function FebreImunodeprimidoPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [cort, setCort] = useState({ mgKgDia: 0, dias: 0 })
  const calc = p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const imuno = corticoideImunossupressor(cort.mgKgDia, cort.dias)

  return (
    <ToolLayout
      title="Febre no imunodeprimido não oncológico — criança"
      description="Terapia antimicrobiana empírica da Tabela 7 por peso com os máximos do Apêndice, corticoide em dose imunossupressora, padrões por tipo de imunodeficiência e profilaxias — livro do ICr-HCFMUSP. A escolha é do médico."
      ficha={fichaImunodeprimidoPed}
    >
      <CampoPaciente id="imu" p={p} onChange={setP} />

      {!calc ? (
        <Aviso>Informe o peso (idade até 13 anos e 11 meses) para calcular as doses.</Aviso>
      ) : (
        <Bloco titulo="Terapia empírica (Tabela 7, p. 482)" descricao={p.rn ? 'Recém-nascido: a tabela não traz valor neonatal; nenhuma linha calcula.' : 'Escolha pelo agente provável (Tabela 2) e pela epidemiologia local.'}>
          {DOSES_IMUNODEPRIMIDO.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
          <Errata texto={ERRATA_TEICOPLANINA} />
        </Bloco>
      )}

      <Bloco titulo="Corticoide em dose imunossupressora (p. 484)" descricao="Equivalente de prednisona.">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="imu-mg" label="Dose" unit="mg/kg/dia" value={cort.mgKgDia} onChange={(mgKgDia) => setCort({ ...cort, mgKgDia })} min={0} step={0.1} />
          <NumberField id="imu-dias" label="Tempo de uso" unit="dias" value={cort.dias} onChange={(dias) => setCort({ ...cort, dias })} min={0} />
        </div>
        {imuno !== null && (
          <p>{imuno ? <strong>Atinge a dose/tempo que o livro associa a risco infeccioso (2 mg/kg/dia por 1 semana ou 1 mg/kg/dia por 15–30 dias).</strong> : 'Abaixo da dose/tempo citados pelo livro.'}</p>
        )}
        <Nota>{NOTA_CORTICOIDE}</Nota>
      </Bloco>

      <Bloco titulo="Padrões por tipo de erro inato (Tabela 2, p. 479–480)">
        <TabelaLivro cabecalho={['Deficiência', 'Início', 'Patógenos', 'Acometimentos / características']} linhas={PADROES_IMUNIDADE} largura={680} />
      </Bloco>
      <Bloco titulo="Profilaxia, imunomodulação e vacinação (Tabela 5, p. 481)">
        <TabelaLivro cabecalho={['Imunodeficiência', 'Profilaxia', 'Imunomodulação', 'Vacinação']} linhas={PROFILAXIA} largura={640} />
      </Bloco>
      <Bloco titulo="Do capítulo">
        <ListaLivro itens={REFERENCIAS_IMUNO} />
      </Bloco>
    </ToolLayout>
  )
}
