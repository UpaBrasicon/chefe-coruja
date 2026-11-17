import { useState } from 'react'

import {
  DOSES_CRISE_HA, ERRATAS_CRISE_HA, HIDRALAZINA_IV, INFUSOES_CRISE_HA, REFERENCIAS_CRISE_HA, ROTULO_ESTAGIO, acimaDoP95, classificar13ouMais, classificarMenor13,
  fichaCriseHipertensivaPed, pamMinima8h, percentisAap2017, type SexoPa,
} from '@/clinico/pediatria/criseHipertensivaPed'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { calcularBolus } from '@/clinico/pediatria/bolus'
import { calcularDoseLivro, textoDoseLivro, type DoseLivro } from '@/clinico/pediatria/fonteP4'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, br, faixaBr, idadeAnos, idadePediatrica } from './formatoIcr'
import { Bloco, CampoPaciente, LinhaLivro, Pendencia } from './PecasIcr'
import { LinhaBolusApendice, LinhaDoseLivro } from './PecasP4'
import { Pergunta } from '../manual/PecasLoteC'

const casasDose = (u: DoseLivro['unidade'], x: number) => (u === 'UI' ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2)

/** Linha do "Copiar" com a mesma conta da LinhaDoseLivro (PecasP4). */
function linhaDoseLivro(d: DoseLivro, peso: number): string[] {
  const r = calcularDoseLivro(d, peso)
  if (!r) return []
  const fmt = (f: [number, number]) => faixaBr(f, casasDose(d.unidade, f[1]))
  const conta = [r.porDose && `${fmt(r.porDose)} ${d.unidade}/dose`, r.dia && `${fmt(r.dia)} ${d.unidade}/dia`].filter(Boolean).join(' · ')
  return [`- ${d.nome}: ${conta}${r.noMaximo ? ` (limitado ao máximo${d.fonteMaximo ? `, ${d.fonteMaximo}` : ' do livro'})` : ''} · o livro traz ${textoDoseLivro(d)} · ${d.via} (Livro ICr, ${d.pagina})`]
}

/** Crise hipertensiva na criança — cap. 26 do livro do ICr. */
export function CriseHipertensivaPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [pas, setPas] = useState(0)
  const [pad, setPad] = useState(0)
  const [pc, setPc] = useState({ p90s: 0, p95s: 0, p90d: 0, p95d: 0 })
  const [pam, setPam] = useState(0)
  const [sexo, setSexo] = useState<SexoPa>()
  const [estatura, setEstatura] = useState(0)
  const idade = idadeAnos(p.anos, p.meses)
  const pediatrico = idadePediatrica(p.anos, p.meses)
  const faixa = idade < 1 || p.rn ? 'lactente' : idade < 13 ? 'crianca' : 'adolescente'
  const aap = faixa === 'crianca' && sexo && estatura > 0 ? percentisAap2017(sexo, idade, estatura) : null
  const pcUsado = aap ? { p90s: aap.p90s, p95s: aap.p95s, p90d: aap.p90d, p95d: aap.p95d } : pc
  const estagio = !pediatrico ? null : faixa === 'crianca' ? classificarMenor13(pas, pad, pcUsado) : faixa === 'adolescente' ? classificar13ouMais(pas, pad) : null
  const acima = faixa === 'crianca' ? acimaDoP95(pas, pcUsado.p95s) : null
  const pamMin = pamMinima8h(pam)
  const calc = !p.rn && p.peso > 0 && pediatrico
  const idadeMeses = p.anos * 12 + p.meses
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaCriseHipertensivaPed.id)
  const preocupa = acima !== null && acima > 30
  const hidralazina = calc && HIDRALAZINA_IV ? calcularBolus(HIDRALAZINA_IV, p.peso, idadeMeses) : null
  const temResultado = calc || estagio !== null || pamMin !== null

  // Texto do "Copiar" (C3 e C4 = A): dados, classificação, meta da PAM e as drogas por peso da tela, com a página.
  const copia = temResultado
    ? textoCopia({
        ferramenta: 'Crise hipertensiva — criança',
        dados: [
          ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
          ['Idade', `${p.anos} anos e ${p.meses} meses`],
          ['PA', pas > 0 || pad > 0 ? `${numeroBr(pas)} × ${numeroBr(pad)} mmHg` : ''],
          ['Sexo', faixa === 'crianca' && sexo ? (sexo === 'M' ? 'masculino' : 'feminino') : ''],
          ['Estatura', faixa === 'crianca' && estatura > 0 ? `${numeroBr(estatura)} cm` : ''],
          ['PAM atual', pam > 0 ? `${numeroBr(pam)} mmHg` : ''],
        ],
        resultado: [
          ...(aap ? [`AAP 2017, Tabela ${sexo === 'M' ? '4 (meninos)' : '5 (meninas)'}, ${aap.idade} ${aap.idade === 1 ? 'ano' : 'anos'}, coluna de estatura p${aap.percentilEstatura} (${br(aap.cmColuna, 1)} cm): sistólica p90 ${aap.p90s}, p95 ${aap.p95s}, p95 + 12 ${aap.p95s + 12}; diastólica p90 ${aap.p90d}, p95 ${aap.p95d}, p95 + 12 ${aap.p95d + 12} mmHg`] : []),
          ...(!aap && faixa === 'crianca' && pc.p95s > 0 ? [`Percentis informados: sistólica p90 ${pc.p90s}, p95 ${pc.p95s}; diastólica p90 ${pc.p90d}, p95 ${pc.p95d} mmHg`] : []),
          ...(estagio ? [`Pela Tabela 1 (p. 272): ${ROTULO_ESTAGIO[estagio]} (sistólica e diastólica avaliadas em separado; vale a mais alta)`] : []),
          ...(preocupa ? [`PAS ${br(acima, 0)} mmHg acima do p95: o livro diz que aumento > 30 mmHg acima do p95 deve preocupar para lesão de órgão-alvo (p. 272)`] : []),
          ...(pamMin !== null ? [`Meta na emergência hipertensiva: redução de no máximo 25% nas primeiras 8 h — PAM não abaixo de ${br(pamMin, 0)} mmHg; depois, PA em torno do p95 em 12 a 24/48 h (p. 275)`] : []),
          ...(calc
            ? [
                'Sintomas ameaçadores à vida (Tabela 3, p. 276):',
                ...(HIDRALAZINA_IV && hidralazina && hidralazina.aplica !== 'nao'
                  ? [`- ${HIDRALAZINA_IV.nome}: ${faixaBr(hidralazina.faixa, hidralazina.faixa[1] >= 10 ? 1 : 2)} ${HIDRALAZINA_IV.unidade}${hidralazina.volumeMl ? ` · ${faixaBr(hidralazina.volumeMl, 2)} mL` : ''}${hidralazina.noMaximo ? ' (limitado ao máximo do livro)' : ''} · ${HIDRALAZINA_IV.via} (Livro ICr, Apêndice, ${HIDRALAZINA_IV.pagina})`]
                  : []),
                ...INFUSOES_CRISE_HA.map((f) => `- ${f.nome}: ${faixaBr([f.faixa[0] * p.peso, f.faixa[1] * p.peso], 1)} µg/min — ${faixaBr(f.faixa, 2)} µg/kg/min${f.maximo ? ` até ${br(f.maximo, 2)} µg/kg/min (${br(f.maximo * p.peso, 1)} µg/min)` : ''}. ${f.nota} (${f.pagina})`),
                'Sintomas menos significativos — VO (Tabela 3, p. 276):',
                ...DOSES_CRISE_HA.flatMap((d) => linhaDoseLivro(d, p.peso)),
              ]
            : []),
        ],
        fonte: textoFontes(fichaCriseHipertensivaPed),
        versao: fichaCriseHipertensivaPed.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Crise hipertensiva — criança"
      description="Classificação da PA (Tabela 1), meta de redução da PAM e drogas por peso (Tabela 3) — livro do ICr-HCFMUSP. O livro remete às tabelas da AAP (2017): com sexo e estatura, a ferramenta busca o p90 e o p95 nas Tabelas 4 e 5."
      ficha={fichaCriseHipertensivaPed}
    >
      <CampoPaciente id="ha" p={p} onChange={setP} />

      <Bloco titulo="Classificação (Tabela 1, p. 272)">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="ha-pas" label="PA sistólica" unit="mmHg" value={pas} onChange={setPas} min={0} />
          <NumberField id="ha-pad" label="PA diastólica" unit="mmHg" value={pad} onChange={setPad} min={0} />
        </div>
        {faixa === 'crianca' && (
          <>
            <p className="text-tinta-sussurro">1 a &lt; 13 anos: percentis para sexo, idade e altura nas tabelas da AAP (p. 272).</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Pergunta rotulo="Sexo" valor={sexo} opcoes={[['M', 'Masculino'], ['F', 'Feminino']]} onChange={setSexo} />
              <NumberField id="ha-estatura" label="Estatura medida" unit="cm" value={estatura} onChange={setEstatura} min={0} step={0.1} />
            </div>
            {aap ? (
              <div className="rounded-cartao border border-fio px-4 py-3 text-apoio">
                <p>
                  AAP 2017, Tabela {sexo === 'M' ? '4 (meninos)' : '5 (meninas)'}, {aap.idade} {aap.idade === 1 ? 'ano' : 'anos'}, coluna de estatura p{aap.percentilEstatura} ({br(aap.cmColuna, 1)} cm):
                  {' '}sistólica p90 <strong>{aap.p90s}</strong>, p95 <strong>{aap.p95s}</strong>, p95 + 12 <strong>{aap.p95s + 12}</strong>; diastólica p90 <strong>{aap.p90d}</strong>, p95 <strong>{aap.p95d}</strong>, p95 + 12 <strong>{aap.p95d + 12}</strong> mmHg.
                </p>
                <p className="text-tinta-sussurro">A tabela dá a estatura em cm de cada coluna; a ferramenta usa a coluna mais próxima da estatura medida.{aap.foraDasColunas && ' A estatura informada fica fora das colunas da tabela (abaixo do p5 ou acima do p95) e foi usada a coluna da ponta.'} Os percentis vêm de crianças com IMC abaixo do p85.</p>
              </div>
            ) : (
              <p className="text-tinta-sussurro">Sem sexo e estatura, informe os percentis lidos na tabela:</p>
            )}
            {!aap && <div className="grid gap-3 sm:grid-cols-4">
              <NumberField id="ha-p90s" label="p90 sistólica" unit="mmHg" value={pc.p90s} onChange={(x) => setPc({ ...pc, p90s: x })} min={0} />
              <NumberField id="ha-p95s" label="p95 sistólica" unit="mmHg" value={pc.p95s} onChange={(x) => setPc({ ...pc, p95s: x })} min={0} />
              <NumberField id="ha-p90d" label="p90 diastólica" unit="mmHg" value={pc.p90d} onChange={(x) => setPc({ ...pc, p90d: x })} min={0} />
              <NumberField id="ha-p95d" label="p95 diastólica" unit="mmHg" value={pc.p95d} onChange={(x) => setPc({ ...pc, p95d: x })} min={0} />
            </div>}
          </>
        )}
        {faixa === 'lactente' && <p className="text-tinta-sussurro">A Tabela 1 começa em 1 ano: para menores de 1 ano (e RN) o livro não classifica.</p>}
        {faixa === 'adolescente' && <p className="text-tinta-sussurro">≥ 13 anos: cortes fixos (normal &lt; 120 × 80; elevada 120–129 × &lt; 80; estágio 1 130–139 × 80–89; estágio 2 ≥ 140 × 90).</p>}
        {estagio && (
          <p>
            Pela Tabela 1: <strong>{ROTULO_ESTAGIO[estagio]}</strong> (sistólica e diastólica avaliadas em separado; vale a mais alta).
          </p>
        )}
        {acima !== null && acima > 30 && <p className="text-atencao">PAS {br(acima, 0)} mmHg acima do p95: o livro diz que aumento &gt; 30 mmHg acima do p95 deve preocupar para lesão de órgão-alvo (p. 272).</p>}
      </Bloco>

      <Bloco titulo="Meta na emergência hipertensiva (p. 275)" descricao="O livro não traz fórmula de PAM: informe a PAM medida.">
        <NumberField id="ha-pam" label="PAM atual" unit="mmHg" value={pam} onChange={setPam} min={0} />
        {pamMin !== null && (
          <p>
            Redução de no máximo 25% nas primeiras 8 h: PAM não abaixo de <strong className="tabular-nums">{br(pamMin, 0)} mmHg</strong>; depois, PA em torno do p95 em 12 a 24/48 h.
          </p>
        )}
      </Bloco>

      <Pendencia p={p} />
      {calc && (
        <>
          <Bloco titulo="Sintomas ameaçadores à vida (Tabela 3, p. 276)">
            {HIDRALAZINA_IV && <LinhaBolusApendice b={HIDRALAZINA_IV} peso={p.peso} idadeMeses={idadeMeses} />}
            {INFUSOES_CRISE_HA.map((f) => (
              <LinhaLivro
                key={f.id}
                nome={f.nome}
                conta={<strong>{faixaBr([f.faixa[0] * p.peso, f.faixa[1] * p.peso], 1)} µg/min</strong>}
                texto={`${faixaBr(f.faixa, 2)} µg/kg/min${f.maximo ? ` até ${br(f.maximo, 2)} µg/kg/min (${br(f.maximo * p.peso, 1)} µg/min)` : ''}. ${f.nota}`}
                pagina={f.pagina}
              />
            ))}
          </Bloco>
          <Bloco titulo="Sintomas menos significativos — VO (Tabela 3, p. 276)">
            {DOSES_CRISE_HA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} />)}
          </Bloco>
        </>
      )}

      <Bloco titulo="Do capítulo">
        {REFERENCIAS_CRISE_HA.map((r) => (
          <p key={r.texto} className="text-tinta-sussurro">
            {r.texto} ({r.pagina})
          </p>
        ))}
      </Bloco>
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temResultado}
        armadilhas={[
          ...ERRATAS_CRISE_HA.map((e) => `Errata ou divergência conferida no PDF: ${e}`),
          ...DOSES_CRISE_HA.filter((d) => d.errata).map((d) => `${d.nome} — errata do livro (${d.pagina}): ${d.errata}`),
          ...(guia?.armadilhas ?? []),
        ]}
        ficha={fichaCriseHipertensivaPed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={estagio ? ROTULO_ESTAGIO[estagio] : calc ? `Criança · ${numeroBr(p.peso)} kg${p.anos > 0 || p.meses > 0 ? ` · ${p.anos} a ${p.meses} m` : ''}` : pediatrico ? 'Informe peso e PA' : 'A partir de 14 anos é adulto: ferramenta pediátrica'}
        tom={preocupa ? 'atencao' : 'neutro'}
        detalhe={[
          estagio && calc ? `Criança · ${numeroBr(p.peso)} kg` : '',
          preocupa ? `PAS ${br(acima, 0)} mmHg acima do p95` : '',
          pamMin !== null ? `PAM não abaixo de ${br(pamMin, 0)} mmHg nas primeiras 8 h` : '',
        ].filter(Boolean).join(' · ') || undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
