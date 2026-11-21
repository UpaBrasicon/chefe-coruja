import { useState } from 'react'

import {
  CLINICOS_ESTAFILO, DOSES_PELE, DOSES_SCT, ORGAOS_ESTREPTO, REFERENCIAS_SCT, SISTEMAS_ESTAFILO, TABELA1_PELE, fichaChoqueToxicoPartesMoles, sctEstafilococica,
  sctEstreptococica,
} from '@/clinico/pediatria/choqueToxicoPartesMolesPed'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { calcularDoseLivro, textoDoseLivro, type DoseLivro } from '@/clinico/pediatria/fonteP4'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, faixaBr, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, Nota, Opcoes } from './PecasIcr'
import { Aviso, LinhaDoseLivro, Marcadores, TabelaLivro } from './PecasP4'
import { ListaLivro } from './PecasP5'

type Isolamento = 'nenhum' | 'nao-esteril' | 'esteril'

const casasDose = (u: DoseLivro['unidade'], x: number) => (u === 'UI' ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2)

/** Linha do "Copiar" com a mesma conta da LinhaDoseLivro (PecasP4); no RN, só as linhas com valor neonatal. */
function linhaDoseLivro(d: DoseLivro, peso: number, rn = false): string[] {
  if (rn && !d.neonatal) return []
  const r = calcularDoseLivro(d, peso)
  if (!r) return []
  const fmt = (f: [number, number]) => faixaBr(f, casasDose(d.unidade, f[1]))
  const conta = [r.porDose && `${fmt(r.porDose)} ${d.unidade}/dose`, r.dia && `${fmt(r.dia)} ${d.unidade}/dia`].filter(Boolean).join(' · ')
  return [`- ${d.nome}: ${conta}${r.noMaximo ? ` (limitado ao máximo${d.fonteMaximo ? `, ${d.fonteMaximo}` : ' do livro'})` : ''} · o livro traz ${textoDoseLivro(d)} · ${d.via} (Livro ICr, ${d.pagina})`]
}

const TEICOPLANINA = 'Teicoplanina: o Apêndice (p. 909) escreve "10 mg/kg/dia a cada 12 h nas 3 primeiras doses" — ambíguo entre dose e total diário; não calculada.'

/** Choque tóxico e infecções de pele e partes moles — caps. 46 e 48 do livro do ICr. */
export function ChoqueToxicoPartesMolesPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [clin, setClin] = useState<Set<string>>(new Set())
  const [sist, setSist] = useState<Set<string>>(new Set())
  const [lab, setLab] = useState(false)
  const [hipo, setHipo] = useState(false)
  const [orgaos, setOrgaos] = useState<Set<string>>(new Set())
  const [iso, setIso] = useState<Isolamento>('nenhum')
  const estafilo = sctEstafilococica(clin, sist.size, lab)
  const estrepto = sctEstreptococica(hipo, orgaos.size, iso)
  const calc = p.peso > 0 && idadePediatrica(p.anos, p.meses)
  const clinicos = CLINICOS_ESTAFILO.filter((c) => c.id !== 'multissistemico')
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaChoqueToxicoPartesMoles.id)
  const textoEstafilo = `${estafilo.nClinicos} de 5 critérios clínicos (${sist.size} sistema(s)) — ${estafilo.caso === 'não preenche' ? 'não preenche a definição de caso' : `caso ${estafilo.caso}`}`
  const textoEstrepto = estrepto === 'não preenche' ? 'Não preenche os critérios clínicos' : estrepto === 'critério clínico sem isolamento' ? 'Critério clínico preenchido, sem isolamento' : `Caso ${estrepto}`
  const dadosTxt = `${p.rn ? 'Recém-nascido' : 'Criança'} · ${numeroBr(p.peso)} kg${p.anos > 0 || p.meses > 0 ? ` · ${p.anos} a ${p.meses} m` : ''}`

  // Texto do "Copiar" (C3 e C4 = A): dados, leitura dos critérios do CDC e as listas de doses da tela, com a página.
  const copia = calc
    ? textoCopia({
        ferramenta: 'Choque tóxico e infecções de pele e partes moles — criança',
        dados: [
          ['Peso', `${numeroBr(p.peso)} kg`],
          ['Idade', `${p.anos} anos e ${p.meses} meses`],
          ['Recém-nascido', p.rn ? 'sim' : ''],
        ],
        resultado: [
          `SCT estafilocócica (Tabela 2, p. 473–474): ${textoEstafilo}`,
          `SCT estreptocócica (Tabela 3, p. 473–474): ${textoEstrepto}`,
          'Choque tóxico — Figura 1 (p. 476):',
          ...DOSES_SCT.flatMap((d) => linhaDoseLivro(d, p.peso, p.rn)),
          'Pele e partes moles — antibióticos citados no cap. 48 (doses do Apêndice):',
          ...DOSES_PELE.flatMap((d) => linhaDoseLivro(d, p.peso, p.rn)),
          `- ${TEICOPLANINA}`,
        ],
        fonte: textoFontes(fichaChoqueToxicoPartesMoles),
        versao: fichaChoqueToxicoPartesMoles.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Choque tóxico e infecções de pele e partes moles — criança"
      description="Critérios do CDC para SCT estafilocócica e estreptocócica, penicilina cristalina, clindamicina e imunoglobulina; antibióticos das infecções de pele com doses do Apêndice — livro do ICr-HCFMUSP. O diagnóstico é do médico."
      ficha={fichaChoqueToxicoPartesMoles}
    >
      <CampoPaciente id="sct" p={p} onChange={setP} />

      <Bloco titulo="SCT estafilocócica (Tabela 2, p. 473–474)" descricao="Provável: laboratorial + 4 dos 5 clínicos. Confirmado: laboratorial + 5 clínicos, incluindo descamação.">
        <Marcadores itens={clinicos} marcados={clin} onChange={setClin} />
        <p className="font-medium">Envolvimento multissistêmico (3 ou mais)</p>
        <Marcadores itens={SISTEMAS_ESTAFILO} marcados={sist} onChange={setSist} />
        <Opcoes label="Critério laboratorial (hemocultura/liquor e sorologias negativos, se obtidos)?" valor={lab} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setLab} />
        <p>
          {estafilo.nClinicos} de 5 critérios clínicos ({sist.size} sistema(s)) — <strong>{estafilo.caso === 'não preenche' ? 'não preenche a definição de caso' : `caso ${estafilo.caso}`}</strong>
        </p>
      </Bloco>

      <Bloco titulo="SCT estreptocócica (Tabela 3, p. 473–474)" descricao="Hipotensão + 2 ou mais órgãos; provável com isolamento de sítio não estéril, confirmado de sítio estéril.">
        <Opcoes label="Hipotensão (PAS < p5 para a idade)?" valor={hipo} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setHipo} />
        <Marcadores itens={ORGAOS_ESTREPTO} marcados={orgaos} onChange={setOrgaos} />
        <Opcoes<Isolamento> label="Estreptococo do grupo A" valor={iso} opcoes={[['nenhum', 'Sem isolamento'], ['nao-esteril', 'Sítio não estéril'], ['esteril', 'Sítio estéril']]} onChange={setIso} />
        <p>
          <strong>{estrepto === 'não preenche' ? 'Não preenche os critérios clínicos' : estrepto === 'critério clínico sem isolamento' ? 'Critério clínico preenchido, sem isolamento' : `Caso ${estrepto}`}</strong>
        </p>
      </Bloco>

      {!calc ? (
        <Aviso>Informe o peso (idade até 13 anos e 11 meses) para calcular as doses.</Aviso>
      ) : (
        <>
          <Bloco titulo="Choque tóxico — Figura 1 (p. 476)" descricao={p.rn ? 'Recém-nascido: o capítulo não traz valor neonatal; nenhuma linha calcula.' : 'Iniciar na primeira hora; associação obrigatória de penicilina e clindamicina.'}>
            {DOSES_SCT.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} ampola={`pele:${d.id}`} />)}
          </Bloco>
          <Bloco titulo="Pele e partes moles — antibióticos citados no cap. 48 (doses do Apêndice)">
            {DOSES_PELE.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} ampola={`pele:${d.id}`} />)}
            <Nota>{TEICOPLANINA}</Nota>
          </Bloco>
        </>
      )}

      <Bloco titulo="Pele e partes moles — Tabela 1 (p. 492–493)">
        <TabelaLivro cabecalho={['Quadro', 'Etiologia', 'Tratamento citado']} linhas={TABELA1_PELE} largura={640} />
      </Bloco>
      <Bloco titulo="Do capítulo">
        <ListaLivro itens={REFERENCIAS_SCT} />
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc}
        armadilhas={[
          ...[...DOSES_SCT, ...DOSES_PELE].filter((d) => d.errata).map((d) => `${d.nome} — errata do livro (${d.pagina}): ${d.errata}`),
          TEICOPLANINA,
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaChoqueToxicoPartesMoles}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? dadosTxt : idadePediatrica(p.anos, p.meses) ? 'Informe o peso' : 'A partir de 14 anos é adulto: ferramenta pediátrica'}
        detalhe={`Estafilocócica: ${estafilo.caso === 'não preenche' ? 'não preenche' : `caso ${estafilo.caso}`} · Estreptocócica: ${estrepto}`}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
