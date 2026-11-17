import { useState } from 'react'

import {
  DOSES_IMUNODEPRIMIDO, ERRATA_TEICOPLANINA, NOTA_CORTICOIDE, PADROES_IMUNIDADE, PROFILAXIA, REFERENCIAS_IMUNO, corticoideImunossupressor, fichaImunodeprimidoPed,
} from '@/clinico/pediatria/imunodeprimidoPed'
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

import { PACIENTE_VAZIO, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Errata, Nota } from './PecasIcr'
import { Aviso, LinhaDoseLivro, TabelaLivro } from './PecasP4'
import { ListaLivro } from './PecasP5'

const casas = (u: DoseLivro['unidade'], x: number) => (u === 'UI' ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2)

/** Linha do "Copiar" com a mesma conta da LinhaDoseLivro; RN sem valor neonatal fica de fora. */
function linhaCopia(d: DoseLivro, peso: number, rn: boolean): string[] {
  if (rn && !d.neonatal) return []
  const r = calcularDoseLivro(d, peso)
  if (!r || (!r.porDose && !r.dia)) return []
  const fmt = (f: [number, number]) => faixaBr(f, casas(d.unidade, f[1]))
  const conta = [r.porDose && `${fmt(r.porDose)} ${d.unidade}/dose`, r.dia && `${fmt(r.dia)} ${d.unidade}/dia`].filter(Boolean).join(' · ')
  return [`- ${d.nome}: ${conta}${r.noMaximo ? ` — limitado ao máximo${d.fonteMaximo ? ` (${d.fonteMaximo})` : ' do livro'}` : ''} · ${d.via} (Livro ICr, ${d.pagina})`]
}

/** Febre no imunodeprimido não oncológico — cap. 47 do livro do ICr. */
export function FebreImunodeprimidoPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [cort, setCort] = useState({ mgKgDia: 0, dias: 0 })
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaImunodeprimidoPed.id)
  const calc = p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const imuno = corticoideImunossupressor(cort.mgKgDia, cort.dias)
  const textoImuno = imuno === null ? null : imuno ? 'Atinge a dose/tempo que o livro associa a risco infeccioso (2 mg/kg/dia por 1 semana ou 1 mg/kg/dia por 15–30 dias).' : 'Abaixo da dose/tempo citados pelo livro.'
  const temResultado = calc || imuno !== null

  // Texto do "Copiar" (C3 e C4 = A): a lista de doses do peso e a leitura do corticoide, com a página.
  const copia = () =>
    textoCopia({
      ferramenta: 'Febre no imunodeprimido não oncológico — criança',
      dados: [
        ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
        ['Idade', p.anos > 0 || p.meses > 0 ? `${p.anos} anos e ${p.meses} meses` : ''],
        ['Recém-nascido', p.rn ? 'sim' : ''],
        ['Corticoide', cort.mgKgDia > 0 ? `${numeroBr(cort.mgKgDia)} mg/kg/dia de prednisona` : ''],
        ['Tempo de uso', cort.dias > 0 ? `${numeroBr(cort.dias)} dias` : ''],
      ],
      resultado: [
        ...(calc ? ['Terapia empírica (Tabela 7, p. 482):', ...DOSES_IMUNODEPRIMIDO.flatMap((d) => linhaCopia(d, p.peso, p.rn))] : []),
        ...(textoImuno ? [`Corticoide (p. 484): ${textoImuno}`] : []),
      ],
      fonte: textoFontes(fichaImunodeprimidoPed),
      versao: fichaImunodeprimidoPed.versao,
      quando: new Date(),
    })

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
          <p>{imuno ? <strong>{textoImuno}</strong> : textoImuno}</p>
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
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={[`Teicoplanina — errata do livro: ${ERRATA_TEICOPLANINA}`, ...(guia?.armadilhas ?? [])]}
        ficha={fichaImunodeprimidoPed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? `${p.rn ? 'Recém-nascido' : 'Criança'} · ${numeroBr(p.peso)} kg${p.anos > 0 || p.meses > 0 ? ` · ${p.anos} a ${p.meses} m` : ''}` : 'Informe o peso'}
        detalhe={imuno !== null ? (imuno ? 'Corticoide: atinge a dose/tempo de risco infeccioso do livro.' : 'Corticoide abaixo da dose/tempo citados pelo livro.') : calc ? 'Doses do peso na lista acima; "Copiar" leva todas.' : undefined}
        textoCopia={temResultado ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
