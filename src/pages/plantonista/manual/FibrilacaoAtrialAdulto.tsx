import { useState } from 'react'

import {
  ANTICOAGULACAO_FA_2025, DIFERENCAS_FA_2024, DOSES_FA_2024, TEXTO_JANELA_2024, janelaFa2024, AMIODARONA_FA, ANTICOAGULACAO_FA, DDIMERO_FA, DIGOXINA_FA, DILTIAZEM_FA, DILUICOES_FA, ERRATA_FA, ESMOLOL_FA, MAGNESIO_FA, PROPAFENONA_FA, TEXTO_JANELA, VERAPAMIL_FA,
  amiodaronaFa, digoxinaFa, diltiazemFa, edoxabanaClcrAlto, esmololFa, fichaFibrilacaoAtrialAdulto, janelaFa, propafenonaFa, varfarinaInicialMg, verapamilFa,
} from '@/clinico/adulto/fibrilacaoAtrial'
import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { NumberField } from '@/components/plantonista/NumberField'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { BlocoComparacao } from '@/components/plantonista/calc/Evidencias'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { Trecho } from './LoteAPecas'
import { br, faixaBr } from './loteAFormato'
import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'


const pede = 'informe o peso'

/** Fibrilação atrial do adulto (cap. 17 do manual do HCFMUSP): doses por peso, diluições da Tabela 3 e janela de 48 h. */
export function FibrilacaoAtrialAdulto() {
  const [peso, setPeso] = useState(0)
  const [horas, setHoras] = useState(0)
  const [horasSabidas, setHorasSabidas] = useState(true)
  const [idoso, setIdoso] = useState(false)
  const [clcr, setClcr] = useState(0)
  const j24 = janelaFa2024(horasSabidas ? horas : null)

  const es = esmololFa(peso)
  const ve = verapamilFa(peso)
  const di = diltiazemFa(peso)
  const dg = digoxinaFa(peso)
  const am = amiodaronaFa()
  const pr = propafenonaFa(peso)
  const wf = varfarinaInicialMg(peso, idoso)
  const janela = janelaFa(horasSabidas && horas > 0 ? horas : null)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaFibrilacaoAtrialAdulto.id)
  const temPeso = Number.isFinite(peso) && peso > 0
  const duracaoInformada = !horasSabidas || horas > 0
  const edoxabanaAlerta = clcr > 0 && edoxabanaClcrAlto(clcr)

  // Texto do "Copiar" (C3 e C4 = A): o peso e a lista inteira, com a mesma conta e a página de cada linha.
  const copia = temPeso
    ? textoCopia({
        ferramenta: 'Fibrilação atrial — adulto',
        dados: [
          ['Peso', `${numeroBr(peso)} kg`],
          ['Duração da FA', !horasSabidas ? 'tempo indeterminado' : horas > 0 ? `${numeroBr(horas)} h` : ''],
          ['Idoso', idoso ? 'sim' : 'não'],
          ['Clearance de creatinina', clcr > 0 ? `${numeroBr(clcr)} mL/min` : ''],
        ],
        resultado: [
          'Controle de frequência:',
          `- Esmolol: ataque ${es ? `${br(es.ataqueMg)} mg` : '—'} · manutenção ${es ? `${faixaBr(es.manutMlH)} mL/h` : '—'} (${DILUICOES_FA.esmolol.preparo}) (${ESMOLOL_FA.pagina})`,
          `- Verapamil: bolus ${ve ? `${faixaBr(ve.bolusMg)} mg` : '—'} em ${VERAPAMIL_FA.bolusMin} min; manutenção ${VERAPAMIL_FA.manutMgH} mg/h (o livro não traz diluição) (${VERAPAMIL_FA.pagina})`,
          `- Diltiazem: bolus ${di ? `${br(di.bolusMg)} mg` : '—'} · manutenção ${di ? `${faixaBr(di.manutMlH, 0)} mL/h` : '—'} (${DILUICOES_FA.diltiazem.preparo}) (${DILTIAZEM_FA.pagina})`,
          `- Digoxina: bolus ${faixaBr(DIGOXINA_FA.bolusMg, 2)} mg até o máximo de ${DIGOXINA_FA.maximoMg} mg; máximo por peso ${dg ? `${faixaBr(dg.maximoPorPesoMg, 2)} mg${dg.maximoPorPesoMg[1] > dg.maximoAbsolutoMg ? ' (acima de 1 mg: vale o teto absoluto)' : ''}` : '—'} (${DIGOXINA_FA.pagina})`,
          `- Amiodarona: ataque ${AMIODARONA_FA.ataqueMg} mg em ${AMIODARONA_FA.ataqueMin} min (${br(am.ataqueMgMin, 0)} mg/min) · manutenção ${faixaBr(am.manutMlH)} mL/h · ${faixaBr(am.manut24hMg, 0)} mg em 24 h (${DILUICOES_FA.amiodarona.preparo}) (${AMIODARONA_FA.pagina})`,
          'Controle de ritmo:',
          `- Propafenona (cardioversão): ${pr ? `${pr} mg` : '—'}; não repetir por pelo menos ${PROPAFENONA_FA.naoRepetirH} h; no primeiro uso, monitorização por pelo menos ${PROPAFENONA_FA.monitorH} h (${PROPAFENONA_FA.pagina})`,
          `- Magnésio: considerar bolus de ${faixaBr(MAGNESIO_FA.g, 0)} g antes da cardioversão (${MAGNESIO_FA.pagina})`,
          ...(duracaoInformada ? [TEXTO_JANELA[janela]] : []),
          `Varfarina inicial: ${wf ? `${br(wf)} mg/d` : '—'}`,
          ...(edoxabanaAlerta ? ['ClCr ≥ 95 mL/min: o livro diz que a edoxabana não deve ser a preferência (p. 251).'] : []),
        ],
        fonte: textoFontes(fichaFibrilacaoAtrialAdulto),
        versao: fichaFibrilacaoAtrialAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Fibrilação atrial — adulto"
      description="Controle de frequência e de ritmo com doses por peso, mL/h nas diluições da Tabela 3, janela de 48 h e anticoagulação, como o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaFibrilacaoAtrialAdulto}
    >
      <CampoPeso id="fa-peso" peso={peso} onChange={setPeso} />

      <p className="text-apoio text-tinta-sussurro">
        O livro traz cardioversão elétrica na instabilidade causada pela FA ou na FA com pré-excitação (Figura 3, p. 255; p. 248) e, de emergência, na isquemia
        coronariana aguda, no edema agudo de pulmão ou na hipoperfusão (p. 247). O capítulo não traz carga em joules. Na FA com pré-excitação o livro diz para
        nunca usar digoxina, betabloqueador nem bloqueador de canal de cálcio (p. 248).
      </p>

      <Bloco titulo="Controle de frequência">
        <LinhaManual
          nome="Esmolol"
          texto={`ataque opcional ${ESMOLOL_FA.ataqueMgKg} mg/kg em ${ESMOLOL_FA.ataqueMin} min; manutenção ${faixaBr(ESMOLOL_FA.manutUgKgMin, 0)} µg/kg/min; meia-vida de ${ESMOLOL_FA.meiaVidaMin} min. Diluição: ${DILUICOES_FA.esmolol.preparo}`}
          conta={es ? <>ataque <strong>{br(es.ataqueMg)} mg</strong> · manutenção <strong>{faixaBr(es.manutMlH)} mL/h</strong></> : pede}
          pagina={ESMOLOL_FA.pagina}
        />
        <LinhaManual
          nome="Verapamil"
          texto={`bolus EV ${faixaBr(VERAPAMIL_FA.bolusMgKg, 3)} mg/kg (por volta de ${faixaBr(VERAPAMIL_FA.referenciaMg, 0)} mg) em ${VERAPAMIL_FA.bolusMin} min; manutenção ${VERAPAMIL_FA.manutMgH} mg/h; com fração de ejeção preservada`}
          conta={ve ? <>bolus <strong>{faixaBr(ve.bolusMg)} mg</strong></> : pede}
          pagina={VERAPAMIL_FA.pagina}
          nota="O livro não traz diluição do verapamil: a manutenção fica em mg/h."
        />
        <LinhaManual
          nome="Diltiazem"
          texto={`bolus EV ${DILTIAZEM_FA.bolusMgKg} mg/kg em ${DILTIAZEM_FA.bolusMin} min; manutenção ${faixaBr(DILTIAZEM_FA.manutMgH, 0)} mg/h; com fração de ejeção preservada. Diluição: ${DILUICOES_FA.diltiazem.preparo}`}
          conta={di ? <>bolus <strong>{br(di.bolusMg)} mg</strong> · manutenção <strong>{faixaBr(di.manutMlH, 0)} mL/h</strong></> : pede}
          pagina={DILTIAZEM_FA.pagina}
          errata={DILUICOES_FA.diltiazem.errata}
        />
        <LinhaManual
          nome="Digoxina"
          texto={`bolus EV ${faixaBr(DIGOXINA_FA.bolusMg, 2)} mg até o máximo de ${DIGOXINA_FA.maximoMg} mg (dose máxima por peso ${faixaBr(DIGOXINA_FA.maximoUgKg, 0)} µg/kg); sugerida com fração de ejeção reduzida`}
          conta={dg ? <>máximo por peso <strong>{faixaBr(dg.maximoPorPesoMg, 2)} mg</strong>{dg.maximoPorPesoMg[1] > dg.maximoAbsolutoMg && <span className="text-atencao"> (acima de 1 mg: vale o teto absoluto)</span>}</> : pede}
          pagina={DIGOXINA_FA.pagina}
        />
        <LinhaManual
          nome="Amiodarona"
          texto={`ataque ${AMIODARONA_FA.ataqueMg} mg EV em ${AMIODARONA_FA.ataqueMin} min; manutenção ${faixaBr(AMIODARONA_FA.manutMgMin)} mg/min; risco de conversão para sinusal e embolismo. Diluição: ${DILUICOES_FA.amiodarona.preparo}`}
          conta={<>ataque {br(am.ataqueMgMin, 0)} mg/min · manutenção <strong>{faixaBr(am.manutMlH)} mL/h</strong> · {faixaBr(am.manut24hMg, 0)} mg em 24 h</>}
          pagina={AMIODARONA_FA.pagina}
          errata={DILUICOES_FA.amiodarona.errata}
        />
      </Bloco>

      <Bloco titulo="Controle de ritmo">
        <LinhaManual
          nome="Propafenona (cardioversão)"
          texto={`${PROPAFENONA_FA.abaixo70Mg} mg (< ${PROPAFENONA_FA.corteKg} kg) e ${PROPAFENONA_FA.aPartir70Mg} mg (≥ ${PROPAFENONA_FA.corteKg} kg); não repetir por pelo menos ${PROPAFENONA_FA.naoRepetirH} h; no primeiro uso, monitorização por pelo menos ${PROPAFENONA_FA.monitorH} h (TV, FV, assistolia, torsades)`}
          conta={pr ? <strong>{pr} mg</strong> : pede}
          pagina={PROPAFENONA_FA.pagina}
        />
        <LinhaManual nome="Magnésio" texto={`considerar bolus de ${faixaBr(MAGNESIO_FA.g, 0)} g antes da cardioversão`} pagina={MAGNESIO_FA.pagina} />
        <Trecho texto="FA inédita: pelo menos uma tentativa de conversão; considerar não cardioverter muito idosos, assintomáticos, com múltiplas comorbidades" pagina="p. 249" />
      </Bloco>

      <Bloco titulo="Tempo de FA e anticoagulação">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField id="fa-horas" label="Duração da FA" unit="h" value={horas} onChange={setHoras} step={1} />
          <label className="flex items-center gap-2 self-end text-apoio">
            <input type="checkbox" checked={!horasSabidas} onChange={(e) => setHorasSabidas(!e.target.checked)} />
            Tempo indeterminado
          </label>
        </div>
        <p className={janela === 'menos-de-48h' ? '' : 'text-atencao'}>{TEXTO_JANELA[janela]}</p>
        {ANTICOAGULACAO_FA.map((a) => <LinhaManual key={a.id} nome={a.nome} texto={`${a.dose} — ${a.quando}`} pagina={a.pagina} />)}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex items-center gap-2 self-end text-apoio">
            <input type="checkbox" checked={idoso} onChange={(e) => setIdoso(e.target.checked)} />
            Idoso (o livro não define a idade)
          </label>
          <div className="flex flex-col text-apoio">
            <span className="text-tinta-sussurro">Varfarina inicial</span>
            <strong className="tabular-nums">{wf ? `${br(wf)} mg/d` : pede}</strong>
          </div>
          <NumberField id="fa-clcr" label="Clearance de creatinina" unit="mL/min" value={clcr} onChange={setClcr} step={1} />
        </div>
        {edoxabanaAlerta && <p className="text-atencao">ClCr ≥ 95 mL/min: o livro diz que a edoxabana não deve ser a preferência (p. 251).</p>}
        <p className="text-tinta-sussurro">CHA2DS2-VA e HAS-BLED têm telas próprias no pacote; o livro usa o CHA2DS2-VASc (Tabela 1, p. 250).</p>
        <Trecho texto={`D-dímero < ${DDIMERO_FA.corteNgMl} ng/mL com valor preditivo negativo de ${DDIMERO_FA.vpn} para trombo atrial. ${DDIMERO_FA.nota}`} pagina={DDIMERO_FA.pagina} />
      </Bloco>

      {/* Errata e lacunas do capítulo vão para "Armadilhas"; ESC 2024 e SBC 2025 vão para "Evidências" (C6 = A).
          As erratas da diluição do diltiazem e da amiodarona ficam no item: explicam a conta do mL/h. */}
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temPeso}
        armadilhas={[...ERRATA_FA.map((e) => `Errata e lacunas do capítulo — ${e}`), ...(guia?.armadilhas ?? [])]}
        ficha={fichaFibrilacaoAtrialAdulto}
        guia={guia}
        comparacao={
          <BlocoComparacao titulo="ESC 2024 e SBC 2025 — janela de 24 h, anticoagulação e doses IV" resumo="Diretrizes lidas no texto integral, ao lado do capítulo. A fronteira das duas diretrizes é 24 h (o manual usa 48 h).">
            <LinhaManual nome={j24 === 'ate-24h' ? 'Até 24 h' : 'Mais de 24 h ou indeterminada'} texto={TEXTO_JANELA_2024[j24]} pagina="ESC 2024 p. 3355–3356; SBC 2025 p. 37" />
            {ANTICOAGULACAO_FA_2025.map((a) => <LinhaManual key={a.tema} nome={a.tema} texto={a.texto} pagina={a.fonte} />)}
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[720px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Droga</TableHead><TableHead className="pr-3 pb-2">ESC 2024</TableHead><TableHead className="pr-3 pb-2">SBC 2025</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
                <TableBody>{DOSES_FA_2024.map((d) => <TableRow key={d.droga} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.droga}</TableCell><TableCell className="pr-3 py-2">{d.esc}</TableCell><TableCell className="pr-3 py-2">{d.sbc}</TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_FA_2024.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={temPeso ? `Adulto · ${numeroBr(peso)} kg` : 'Informe o peso'}
        detalhe={temPeso
          ? `${duracaoInformada ? (janela === 'menos-de-48h' ? 'FA < 48 h · ' : janela === 'exatamente-48h' ? 'FA de 48 h · ' : 'FA > 48 h ou indeterminada · ') : ''}Doses de frequência e ritmo nas listas acima; "Copiar" leva todas.`
          : undefined}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
