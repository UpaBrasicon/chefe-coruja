import { useState } from 'react'

import {
  COMBINACOES_AGITACAO, CONTENCAO_MECANICA, CONTENCAO_QUIMICA, CORTES_CAUSAS_ORGANICAS, DELIRIUM_TABELA7, ERRATA_AGITACAO, QUETAMINA_AGITACAO, SNM,
  TEMPOS_AGITACAO, TITULACAO_DELIRIUM, contaSnm, fichaAgitacaoAdulto, metadeDaDose, quetaminaAgitacao, restanteAteMaxima, shockIndex,
} from '@/clinico/adulto/agitacao'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { Erratas, Escolhas, ListaLivro } from './PecasLoteE7'
import { br, faixa, lerNumero } from './loteE7Formato'

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

  return (
    <ToolLayout
      title="Paciente agitado e delirium — adulto"
      description="Contenção mecânica e química por nível de agitação, quetamina por peso, antipsicóticos da Tabela 7 no delirium e síndrome neuroléptica maligna, pelo manual do HC. Adulto (14 anos ou mais)."
      ficha={fichaAgitacaoAdulto}
    >
      <CampoPeso id="agi-peso" peso={peso} onChange={setPeso}>
        <div className="flex flex-col gap-1.5">
          <Label>Idoso</Label>
          <Escolhas valor={idoso} opcoes={[['nao', 'Não'], ['sim', 'Sim']] as const} onChange={setIdoso} />
        </div>
      </CampoPeso>

      <Bloco titulo="Contenção química — Tabela 4 (p. 1011)" descricao="Agitação de causa desconhecida. Via oral sempre preferível; em pacientes muito agitados, priorizar IM (p. 1010).">
        {CONTENCAO_QUIMICA.map((c) => (
          <LinhaManual key={c.nivel} nome={`Agitação ${c.nivel}`} texto={`escolha: ${c.escolha}; segunda linha: ${c.segundaLinha}`} pagina="p. 1011" />
        ))}
        <LinhaManual
          nome="Quetamina por peso"
          texto={`${QUETAMINA_AGITACAO.tabelaImMgKg} mg/kg IM na Tabela 4; no texto, 1-2 mg/kg IV (diluída para ${QUETAMINA_AGITACAO.diluicaoIvMl} mL, lenta) a 4-6 mg/kg IM; o livro não traz dose máxima`}
          conta={q ? <>IM tabela <strong>{br(q.tabelaImMg, 0)} mg</strong> · IM texto {faixa(q.imMg, 0)} mg · IV {faixa(q.ivMg, 0)} mg</> : 'informe o peso'}
          pagina={QUETAMINA_AGITACAO.pagina}
        />
        {COMBINACOES_AGITACAO.map((c) => <LinhaManual key={c.nome} nome={c.nome} texto={`${c.dose}: ${c.nota}`} pagina={c.pagina} />)}
        {TEMPOS_AGITACAO.map((t) => <p key={t.droga} className="text-sm text-muted-foreground">{t.droga}: {t.texto} ({t.pagina}).</p>)}
        {idoso === 'sim' && (
          <p className="text-sm text-atencao">
            Idosos: o livro recomenda iniciar com metade da dose inicial típica e considera antipsicóticos de primeira linha (p. 1014). Exemplo: haloperidol 5-10 mg → {faixa(metadeDaDose([5, 10]))} mg; midazolam 2-5 mg → {faixa(metadeDaDose([2, 5]))} mg.
          </p>
        )}
      </Bloco>

      <Bloco titulo="Contenção mecânica — Tabela 3 (p. 1008–1010)">
        <ListaLivro itens={CONTENCAO_MECANICA} />
      </Bloco>

      <Bloco titulo="Causas orgânicas com corte numérico — Tabela 5 (p. 1012–1014)">
        <ul className="list-disc pl-5 text-sm">{CORTES_CAUSAS_ORGANICAS.map((c) => <li key={c.causa}>{c.causa}: {c.corte} <span className="text-muted-foreground">({c.pagina})</span></li>)}</ul>
        <div className="grid gap-3 md:grid-cols-3">
          <NumberField id="agi-fc" label="FC" unit="bpm" value={fc} onChange={setFc} min={0} />
          <NumberField id="agi-pas" label="PAS" unit="mmHg" value={pas} onChange={setPas} min={0} />
          <p className="self-end text-sm tabular-nums">
            {si ? <>Shock index <strong>{br(si.valor, 2)}</strong>{si.acimaDoCorte ? ' — acima de 0,7' : ' — até 0,7'}</> : 'informe FC e PAS'}
          </p>
        </div>
      </Bloco>

      <Bloco titulo="Agitação no delirium — Tabela 7 (p. 136–138)" descricao={`Dose inicial baixa; doses adicionais a cada ${faixa(TITULACAO_DELIRIUM.repetirMin, 0)} min até o efeito; delirium prolongado pode pedir manutenção ${faixa(TITULACAO_DELIRIUM.manutencaoVezesDia, 0)} vezes ao dia (p. 138). ECG antes e depois: todos os antipsicóticos alargam o QT (p. 136).`}>
        {DELIRIUM_TABELA7.map((d) => (
          <LinhaManual key={d.id} nome={d.nome} texto={`inicial ${faixa(d.inicialMg, 2)} mg; máxima ${br(d.maximaMg, 1)} mg; ${d.vias}`} pagina="p. 136–137" nota={d.nota} />
        ))}
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Droga</Label>
            <Escolhas valor={droga} opcoes={DELIRIUM_TABELA7.map((d) => [d.id, d.nome] as const)} onChange={setDroga} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agi-doses">Doses já feitas (mg, separadas por espaço)</Label>
            <Input id="agi-doses" inputMode="decimal" value={doses} onChange={(e) => setDoses(e.target.value)} />
            <p className="tabular-nums">
              {soma ? <>Somadas <strong>{br(soma.somaMg, 2)} mg</strong> · faltam {br(soma.restanteMg, 2)} mg para a máxima da Tabela 7</> : '—'}
            </p>
            {soma?.atingiu && <p className="text-atencao">Soma igual ou acima da dose máxima da Tabela 7.</p>}
          </div>
        </div>
      </Bloco>

      <Bloco titulo="Síndrome neuroléptica maligna (p. 1015–1016)" descricao={`CPK tipicamente > ${SNM.cpkUiL.toLocaleString('pt-BR')} UI/L; suspender o agente causador; reposição volêmica muitas vezes agressiva.`}>
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
    </ToolLayout>
  )
}
