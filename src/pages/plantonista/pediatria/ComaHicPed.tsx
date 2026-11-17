import { useState } from 'react'

import { DOSES_COMA, ERRATAS_COMA_HIC, METAS_COMA, METAS_HIC, PIC_NORMAL_MMHG, bainhaOpticaCorte, fichaComaHicPed, gcsPupilas, ppc, ppcAlvo } from '@/clinico/pediatria/comaHicPed'
import { calcularDoseLivro, textoDoseLivro, type DoseLivro } from '@/clinico/pediatria/fonteP4'
import { textoFontes } from '@/clinico/ficha'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, br, faixaBr, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Opcoes, Pendencia } from './PecasIcr'
import { LinhaDoseLivro } from './PecasP4'
import { ListaLivro } from './PecasP5'

const casasLivro = (u: string, x: number) => (u === 'UI' ? 0 : x >= 100 ? 0 : x >= 10 ? 1 : 2)

/** Linha do "Copiar": a mesma conta da LinhaDoseLivro (PecasP4). */
function doseLivroTxt(d: DoseLivro, peso: number, rn = false): string[] {
  if (rn && !d.neonatal) return []
  const r = calcularDoseLivro(d, peso)
  if (!r) return []
  const fmt = (f: [number, number]) => faixaBr(f, casasLivro(d.unidade, f[1]))
  const conta = [r.porDose && `${fmt(r.porDose)} ${d.unidade}/dose`, r.dia && `${fmt(r.dia)} ${d.unidade}/dia`].filter(Boolean).join(' · ')
  return [`- ${d.nome}: ${conta || textoDoseLivro(d)}${r.noMaximo ? ` (limitado ao máximo${d.fonteMaximo ? `, ${d.fonteMaximo}` : ''})` : ''} · ${d.via} (${d.pagina})`]
}

/** Coma e hipertensão intracraniana — caps. 37 e 41 do livro do ICr. */
export function ComaHicPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [glasgow, setGlasgow] = useState(0)
  const [pupilas, setPupilas] = useState<0 | 1 | 2>(0)
  const [pr, setPr] = useState({ pam: 0, pic: 0, bainha: 0 })
  const [fontanela, setFontanela] = useState(false)
  const gp = glasgow > 0 ? gcsPupilas(glasgow, pupilas) : null
  const vPpc = pr.pam > 0 ? ppc(pr.pam, pr.pic) : null
  const temIdade = p.anos > 0 || p.meses > 0
  const alvo = temIdade ? ppcAlvo(p.anos) : null
  const onsd = temIdade ? bainhaOpticaCorte(p.anos * 12 + p.meses, fontanela) : null
  const calc = podeCalcular(p)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaComaHicPed.id)
  const leituras = [gp !== null ? `GCS-P ${gp}` : '', vPpc !== null ? `PPC ${br(vPpc, 0)} mmHg` : ''].filter(Boolean).join(' · ')
  const temConta = calc || gp !== null || vPpc !== null || (onsd !== null && onsd !== 'indefinido' && pr.bainha > 0)

  // Texto do "Copiar" (C3 e C4 = A): as leituras e as doses que estão na tela, com a página do livro.
  const copia = () =>
    textoCopia({
      ferramenta: 'Coma e hipertensão intracraniana — criança (PS Pediatria ICr-HCFMUSP)',
      dados: [
        ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
        ['Idade', temIdade ? `${p.anos} anos e ${p.meses} meses` : ''],
        ['Glasgow', glasgow > 0 ? String(glasgow) : ''],
        ['Pupilas não reativas', glasgow > 0 ? String(pupilas) : ''],
        ['PAM', pr.pam > 0 ? `${numeroBr(pr.pam)} mmHg` : ''],
        ['PIC', pr.pam > 0 ? `${numeroBr(pr.pic)} mmHg` : ''],
        ['Bainha do nervo óptico', pr.bainha > 0 ? `${numeroBr(pr.bainha)} mm` : ''],
        ['Fontanela aberta', onsd !== null && pr.bainha > 0 ? (fontanela ? 'sim' : 'não') : ''],
      ],
      resultado: [
        ...(gp !== null ? [`GCS-P: ${gp} (p. 374)`] : []),
        ...(vPpc !== null ? [`PPC = PAM − PIC = ${br(vPpc, 0)} mmHg${alvo ? ` · adequada para a idade (Tabela 9): ${faixaBr(alvo, 0)} mmHg` : ''} (p. 416)`] : []),
        ...(onsd && onsd !== 'indefinido' && pr.bainha > 0
          ? [`Bainha do nervo óptico: corte para a idade ${br(onsd.corteMm, 1)} mm; medida ${pr.bainha >= onsd.corteMm ? 'no corte ou acima' : 'abaixo do corte'} (Tabela 7, p. 419–420)`]
          : []),
        ...(calc ? ['Doses (caps. 37 e 41):', ...DOSES_COMA.flatMap((d) => doseLivroTxt(d, p.peso, p.rn))] : []),
      ],
      fonte: textoFontes(fichaComaHicPed),
      versao: fichaComaHicPed.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Coma e hipertensão intracraniana — criança"
      description="GCS-Pupilas, pressão de perfusão cerebral e metas por idade, PIC normal, bainha do nervo óptico, glicose e midazolam do algoritmo do coma e dexametasona — livro do ICr-HCFMUSP. Glasgow pediátrica e doses hiperosmolares estão na ferramenta de TCE."
      ficha={fichaComaHicPed}
    >
      <CampoPaciente id="coma" p={p} onChange={setP} />

      <Bloco titulo="GCS-Pupilas (p. 374)" descricao="Glasgow (ou a versão pediátrica, Tabela 5) menos o escore de pupilas não reativas à luz.">
        <NumberField id="coma-gcs" label="Glasgow" value={glasgow} onChange={setGlasgow} min={3} max={15} />
        <Opcoes<0 | 1 | 2> label="Pupilas não reativas à luz" valor={pupilas} opcoes={[[0, 'Nenhuma (0)'], [1, 'Uma (1)'], [2, 'Ambas (2)']]} onChange={setPupilas} />
        {gp !== null && <p>GCS-P: <strong className="tabular-nums">{gp}</strong></p>}
      </Bloco>

      <Bloco titulo="Pressão de perfusão cerebral (p. 416, Tabela 9)" descricao={`PIC normal na criança: ${PIC_NORMAL_MMHG[0]} a ${PIC_NORMAL_MMHG[1]} mmHg (12 a 28 cmH2O).`}>
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="coma-pam" label="PAM" unit="mmHg" value={pr.pam} onChange={(pam) => setPr({ ...pr, pam })} min={0} />
          <NumberField id="coma-pic" label="PIC" unit="mmHg" value={pr.pic} onChange={(pic) => setPr({ ...pr, pic })} min={0} />
        </div>
        {vPpc !== null && (
          <p>
            PPC = PAM − PIC = <strong className="tabular-nums">{br(vPpc, 0)} mmHg</strong>
            {alvo && <> · adequada para a idade (Tabela 9): {faixaBr(alvo, 0)} mmHg</>}
          </p>
        )}
      </Bloco>

      <Bloco titulo="Bainha do nervo óptico (Tabela 7, p. 419–420)">
        <div className="flex flex-wrap items-end gap-4">
          <NumberField id="coma-onsd" label="Diâmetro medido" unit="mm" value={pr.bainha} onChange={(bainha) => setPr({ ...pr, bainha })} min={0} step={0.1} />
          <Opcoes label="Fontanela aberta?" valor={fontanela} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setFontanela} />
        </div>
        {onsd === 'indefinido' && <p className="text-tinta-sussurro">Aos 12 meses exatos a tabela não define ("&lt; 1 ano" x "&gt; 1 ano").</p>}
        {onsd && onsd !== 'indefinido' && (
          <p>
            Corte para a idade: {br(onsd.corteMm, 1)} mm (sensibilidade/especificidade {onsd.sensEsp}).
            {pr.bainha > 0 && <strong> {pr.bainha >= onsd.corteMm ? ' Medida no corte ou acima.' : ' Medida abaixo do corte.'}</strong>}
          </p>
        )}
      </Bloco>

      {!calc ? <Pendencia p={p} /> : (
        <Bloco titulo="Doses (caps. 37 e 41)">
          {DOSES_COMA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
        </Bloco>
      )}

      <Bloco titulo="Coma — do capítulo">
        <ListaLivro itens={METAS_COMA} />
      </Bloco>
      <Bloco titulo="Hipertensão intracraniana — do capítulo">
        <ListaLivro itens={METAS_HIC} />
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temConta}
        // Erratas e a divergência de PaCO2 entre os caps. 37 e 41 vão para "Armadilhas" (C6 = A); as metas com a página ficam nos blocos.
        armadilhas={[...ERRATAS_COMA_HIC, ...(guia?.armadilhas ?? [])]}
        ficha={fichaComaHicPed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={leituras || (calc ? `Criança · ${numeroBr(p.peso)} kg` : 'Informe os dados')}
        detalhe={temConta ? [leituras && calc ? `Criança · ${numeroBr(p.peso)} kg` : '', calc ? 'doses acima; "Copiar" leva todas.' : ''].filter(Boolean).join(' · ') || undefined : undefined}
        textoCopia={temConta ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
