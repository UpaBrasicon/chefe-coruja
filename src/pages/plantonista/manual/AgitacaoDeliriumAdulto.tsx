import { useState } from 'react'

import {
  ACEP_2024_RECOMENDACOES, COMBINACOES_AGITACAO, CONTENCAO_MECANICA, CONTENCAO_QUIMICA, CORTES_CAUSAS_ORGANICAS, DELIRIUM_TABELA7, DIFERENCAS_AGITACAO_2024, DOSES_ENSAIOS_ACEP,
  CONTENCAO_DOSES, ERRATA_AGITACAO, QUETAMINA_AGITACAO, SNM, TEMPOS_AGITACAO, TITULACAO_DELIRIUM, contaSnm, fichaAgitacaoAdulto, metadeDaDose, quetaminaAgitacao, restanteAteMaxima, shockIndex,
} from '@/clinico/adulto/agitacao'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { EscolhaDaAmpola } from '@/components/plantonista/calc/EscolhaDaAmpola'
import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { Erratas, Escolhas, ListaLivro } from './PecasLoteE7'
import { br, faixa, lerNumero } from './loteE7Formato'
import { numero } from '@/lib/formato'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

/** Paciente agitado, delirium e síndrome neuroléptica maligna (caps. 8 e 76 do manual do HCFMUSP). */
export function AgitacaoDeliriumAdulto() {
  const [peso, setPeso] = useState(0)
  const [idoso, setIdoso] = useState<'nao' | 'sim'>('nao')
  const [fc, setFc] = useState(0)
  const [pas, setPas] = useState(0)
  const [droga, setDroga] = useState(DELIRIUM_TABELA7[0].id)
  const [doses, setDoses] = useState('')

  const q = quetaminaAgitacao(peso)
  const si = shockIndex(fc, pas)
  const snm = contaSnm(peso)
  const antip = DELIRIUM_TABELA7.find((d) => d.id === droga)!
  const lista = doses.split(/[;\s]+/).filter(Boolean).map(lerNumero)
  const soma = lista.length ? restanteAteMaxima(antip.maximaMg, lista) : null
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaAgitacaoAdulto.id)
  const temDado = peso > 0 || si !== null || soma !== null

  // Texto do "Copiar" (C3/C4 = A): os dados usados e as listas de dose da tela (Tabelas 4 e 7 e SNM), com as contas.
  const copia = temDado
    ? textoCopia({
        ferramenta: 'Paciente agitado e delirium — adulto',
        dados: [
          ['Peso', peso > 0 ? `${numeroBr(peso)} kg` : ''],
          ['Idoso', idoso === 'sim' ? 'sim' : 'não'],
          ['FC', fc > 0 ? `${numeroBr(fc)} bpm` : ''],
          ['PAS', pas > 0 ? `${numeroBr(pas)} mmHg` : ''],
          ['Doses já feitas', soma ? `${antip.nome}: ${lista.map((x) => numeroBr(x)).join(' + ')} mg` : ''],
        ],
        resultado: [
          ...CONTENCAO_QUIMICA.map((c) => `- Agitação ${c.nivel}: escolha ${c.escolha}; segunda linha ${c.segundaLinha} (Tabela 4, p. 1011)`),
          ...(q ? [`- Quetamina por peso: IM tabela ${br(q.tabelaImMg, 0)} mg · IM texto ${faixa(q.imMg, 0)} mg · IV ${faixa(q.ivMg, 0)} mg; o livro não traz dose máxima (${QUETAMINA_AGITACAO.pagina})`] : []),
          ...COMBINACOES_AGITACAO.map((c) => `- ${c.nome}: ${c.dose} (${c.pagina})`),
          ...(idoso === 'sim' ? [`Idosos: iniciar com metade da dose inicial típica (p. 1014): haloperidol 5-10 mg → ${faixa(metadeDaDose([5, 10]))} mg; midazolam 2-5 mg → ${faixa(metadeDaDose([2, 5]))} mg`] : []),
          ...(si ? [`Shock index: ${br(si.valor, 2)}${si.acimaDoCorte ? ' — acima de 0,7' : ' — até 0,7'} (Tabela 5, p. 1012–1014)`] : []),
          ...DELIRIUM_TABELA7.map((d) => `- Delirium, ${d.nome}: inicial ${faixa(d.inicialMg, 2)} mg; máxima ${br(d.maximaMg, 1)} mg; ${d.vias} (Tabela 7, p. 136–137)`),
          ...(soma ? [`${antip.nome}: somadas ${br(soma.somaMg, 2)} mg · faltam ${br(soma.restanteMg, 2)} mg para a máxima da Tabela 7${soma.atingiu ? ' (soma igual ou acima da dose máxima)' : ''}`] : []),
          `- SNM, volume: 3-4 L/dia para evitar rabdomiólise = ${snm ? `${faixa(snm.volumeMlH, 0)} mL/h` : '125–167 mL/h'} (${SNM.pagina})`,
          `- SNM, dantroleno: 50 mg EV conforme a necessidade; dose máxima de 10 mg/kg ao dia${snm ? ` = teto ${br(snm.dantrolenoMaxMgDia, 0)} mg/dia (${snm.dosesDe50AteMax} doses de 50 mg)` : ''} (${SNM.pagina})`,
          `- SNM, bromocriptina: 2,5 a 10 mg 3 vezes ao dia; máximo de 40 mg ao dia (10 mg 6/6 h); por 10 dias, com redução gradual (${SNM.pagina})`,
        ],
        fonte: textoFontes(fichaAgitacaoAdulto),
        versao: fichaAgitacaoAdulto.versao,
        quando: new Date(),
      })
    : undefined

  return (
    <ToolLayout
      title="Paciente agitado e delirium — adulto"
      description="Contenção mecânica e química por nível de agitação, quetamina por peso, antipsicóticos da Tabela 7 no delirium e síndrome neuroléptica maligna, pelo manual do HC. Adulto (14 anos ou mais)."
      ficha={fichaAgitacaoAdulto}
    >
      <CampoPeso id="agi-peso" peso={peso} onChange={setPeso}>
        <div className="flex flex-col gap-1.5">
          <Label className="flex-1 items-end leading-snug">Idoso</Label>
          <Escolhas valor={idoso} opcoes={[['nao', 'Não'], ['sim', 'Sim']] as const} onChange={setIdoso} />
        </div>
      </CampoPeso>

      <Bloco titulo="Contenção química — Tabela 4 (p. 1011)" descricao="Agitação de causa desconhecida. Via oral sempre preferível; em pacientes muito agitados, priorizar IM (p. 1010).">
        {CONTENCAO_QUIMICA.map((c) => (
          <LinhaManual key={c.nivel} nome={`Agitação ${c.nivel}`} texto={`escolha: ${c.escolha}; segunda linha: ${c.segundaLinha}`} pagina="p. 1011"
            extra={CONTENCAO_DOSES.filter((d) => d.nivel === c.nivel).map((d) => (
              <EscolhaDaAmpola key={d.id} chave={`adulto-agitacao:${d.id}`} unidade="mg" doses={[{ rotulo: d.nome, dose: d.mg }]} />
            ))} />
        ))}
        <LinhaManual
          nome="Quetamina por peso"
          texto={`${QUETAMINA_AGITACAO.tabelaImMgKg} mg/kg IM na Tabela 4; no texto, 1-2 mg/kg IV (diluída para ${QUETAMINA_AGITACAO.diluicaoIvMl} mL, lenta) a 4-6 mg/kg IM; o livro não traz dose máxima`}
          conta={q ? <>IM tabela <strong>{br(q.tabelaImMg, 0)} mg</strong> · IM texto {faixa(q.imMg, 0)} mg · IV {faixa(q.ivMg, 0)} mg</> : 'informe o peso'}
          pagina={QUETAMINA_AGITACAO.pagina}
          extra={q ? <EscolhaDaAmpola chave="adulto-agitacao:quetamina" unidade="mg" doses={[
            { rotulo: 'IM (Tabela 4)', dose: [q.tabelaImMg, q.tabelaImMg] },
            { rotulo: 'IM (texto)', dose: q.imMg },
            { rotulo: 'IV', dose: q.ivMg },
          ]} /> : undefined}
        />
        {COMBINACOES_AGITACAO.map((c) => <LinhaManual key={c.nome} nome={c.nome} texto={`${c.dose}: ${c.nota}`} pagina={c.pagina} />)}
        {TEMPOS_AGITACAO.map((t) => <p key={t.droga} className="text-apoio text-tinta-sussurro">{t.droga}: {t.texto} ({t.pagina}).</p>)}
        {idoso === 'sim' && (
          <p className="text-apoio text-atencao">
            Idosos: o livro recomenda iniciar com metade da dose inicial típica e considera antipsicóticos de primeira linha (p. 1014). Exemplo: haloperidol 5-10 mg → {faixa(metadeDaDose([5, 10]))} mg; midazolam 2-5 mg → {faixa(metadeDaDose([2, 5]))} mg.
          </p>
        )}
      </Bloco>

      <Bloco titulo="Contenção mecânica — Tabela 3 (p. 1008–1010)">
        <ListaLivro itens={CONTENCAO_MECANICA} />
      </Bloco>

      <Bloco titulo="Causas orgânicas com corte numérico — Tabela 5 (p. 1012–1014)">
        <ul className="list-disc pl-5 text-apoio">{CORTES_CAUSAS_ORGANICAS.map((c) => <li key={c.causa}>{c.causa}: {c.corte} <span className="text-tinta-sussurro">({c.pagina})</span></li>)}</ul>
        <div className="grid gap-3 md:grid-cols-3">
          <NumberField id="agi-fc" label="FC" unit="bpm" value={fc} onChange={setFc} min={0} />
          <NumberField id="agi-pas" label="PAS" unit="mmHg" value={pas} onChange={setPas} min={0} />
          <p className="self-end text-apoio tabular-nums">
            {si ? <>Shock index <strong>{br(si.valor, 2)}</strong>{si.acimaDoCorte ? ' — acima de 0,7' : ' — até 0,7'}</> : 'informe FC e PAS'}
          </p>
        </div>
      </Bloco>

      <Bloco titulo="Agitação no delirium — Tabela 7 (p. 136–138)" descricao={`Dose inicial baixa; doses adicionais a cada ${faixa(TITULACAO_DELIRIUM.repetirMin, 0)} min até o efeito; delirium prolongado pode pedir manutenção ${faixa(TITULACAO_DELIRIUM.manutencaoVezesDia, 0)} vezes ao dia (p. 138). ECG antes e depois: todos os antipsicóticos alargam o QT (p. 136).`}>
        {DELIRIUM_TABELA7.map((d) => (
          <LinhaManual key={d.id} nome={d.nome} texto={`inicial ${faixa(d.inicialMg, 2)} mg; máxima ${br(d.maximaMg, 1)} mg; ${d.vias}`} pagina="p. 136–137" nota={d.nota}
            extra={<EscolhaDaAmpola chave={`adulto-agitacao:${d.id}-delirium`} unidade="mg" doses={[{ rotulo: 'Dose inicial', dose: d.inicialMg }]} />} />
        ))}
        <div className="grid gap-3 text-apoio md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="flex-1 items-end leading-snug">Droga</Label>
            <Escolhas valor={droga} opcoes={DELIRIUM_TABELA7.map((d) => [d.id, d.nome] as const)} onChange={setDroga} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agi-doses" className="flex-1 items-end leading-snug">Doses já feitas (mg, separadas por espaço)</Label>
            <Input id="agi-doses" inputMode="decimal" value={doses} onChange={(e) => setDoses(e.target.value)} />
            <p className="tabular-nums">
              {soma ? <>Somadas <strong>{br(soma.somaMg, 2)} mg</strong> · faltam {br(soma.restanteMg, 2)} mg para a máxima da Tabela 7</> : '—'}
            </p>
            {soma?.atingiu && <p className="text-atencao">Soma igual ou acima da dose máxima da Tabela 7.</p>}
          </div>
        </div>
      </Bloco>

      <Bloco titulo="Síndrome neuroléptica maligna (p. 1015–1016)" descricao={`CPK tipicamente > ${numero(SNM.cpkUiL)} UI/L; suspender o agente causador; reposição volêmica muitas vezes agressiva.`}>
        <LinhaManual nome="Volume" texto="3-4 L/dia para evitar rabdomiólise" conta={snm ? <strong>{faixa(snm.volumeMlH, 0)} mL/h</strong> : '125–167 mL/h'} pagina={SNM.pagina} />
        <LinhaManual
          nome="Dantroleno"
          texto="50 mg EV conforme a necessidade; dose máxima de 10 mg/kg ao dia"
          conta={snm ? <>teto <strong>{br(snm.dantrolenoMaxMgDia, 0)} mg/dia</strong> = {snm.dosesDe50AteMax} doses de 50 mg</> : 'informe o peso'}
          pagina={SNM.pagina}
        />
        <LinhaManual nome="Bromocriptina" texto="2,5 a 10 mg 3 vezes ao dia; máximo de 40 mg ao dia (10 mg 6/6 h); por 10 dias, com redução gradual" pagina={SNM.pagina} />
      </Bloco>

      <Bloco titulo="Errata e notas">
        <Erratas itens={ERRATA_AGITACAO} />
      </Bloco>

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temDado}
        armadilhas={[...ERRATA_AGITACAO, ...(guia?.armadilhas ?? [])]}
        ficha={fichaAgitacaoAdulto}
        guia={guia}
        comparacao={
          // A política da ACEP, ao lado do manual, vai para "Evidências" (C6 = A); nenhuma dose do manual muda.
          <BlocoComparacao titulo="ACEP 2024 — agitação grave no PS" resumo="Política clínica da ACEP (Ann Emerg Med 2024;83:e1–e30), lida no texto. As doses listadas são as dos ensaios que a política resume, não uma prescrição da ACEP.">
            {ACEP_2024_RECOMENDACOES.map((r) => <LinhaManual key={r.nivel} nome={`Nível ${r.nivel}`} texto={r.texto} pagina="p. e4" />)}
            <div className="overflow-x-auto">
              <Table variante="referencia" className="w-full min-w-[560px] text-left align-top text-apoio">
                <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Droga</TableHead><TableHead className="pr-3 pb-2">Dose nos ensaios</TableHead><TableHead className="pb-2">Ensaios</TableHead></TableRow></TableHeader>
                <TableBody>
                  {DOSES_ENSAIOS_ACEP.map((d) => (
                    <TableRow key={d.droga} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.droga}</TableCell><TableCell className="pr-3 py-2">{d.dose}</TableCell><TableCell className="py-2 text-tinta-sussurro">{d.fonte}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_AGITACAO_2024.map((d) => <li key={d}>{d}</li>)}</ul>
          </BlocoComparacao>
        }
      />
      <ResumoFlutuante
        principal={peso > 0 ? `Adulto · ${numeroBr(peso)} kg${idoso === 'sim' ? ' · idoso' : ''}` : 'Informe o peso'}
        detalhe={
          soma
            ? `${antip.nome}: somadas ${br(soma.somaMg, 2)} mg · faltam ${br(soma.restanteMg, 2)} mg para a máxima da Tabela 7`
            : q
              ? `Quetamina IM (Tabela 4) ${br(q.tabelaImMg, 0)} mg; "Copiar" leva todas as doses`
              : si
                ? `Shock index ${br(si.valor, 2)}${si.acimaDoCorte ? ' — acima de 0,7' : ' — até 0,7'}`
                : undefined
        }
        tom={soma?.atingiu ? 'atencao' : 'neutro'}
        textoCopia={copia}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
