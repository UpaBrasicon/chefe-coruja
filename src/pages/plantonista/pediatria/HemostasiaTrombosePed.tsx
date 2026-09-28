import { useState } from 'react'

import {
  DOSES_HEMOSTASIA, DOSES_PTI, ERRATA_HNF, HNF_PROFILATICA_UI_KG_H, NOTA_HEPARINA_ONCO, NOTA_VARFARINA, QUADRO2, QUADRO5_DVW, REFERENCIAS_HEMOSTASIA, ajusteHnf, ajusteVarfarina,
  enoxaparinaPorIdade, fichaHemostasiaTromboPed, hnfAtaqueUI, hnfManutencaoUIkgH, reposicaoQuadro2, rtpaMgH, varfarinaDia1Mg,
} from '@/clinico/pediatria/hemostasiaTromboPed'
import { fatorIXUI, fatorVIIIUI } from '@/clinico/pediatria/hemoterapiaPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, faixaBr, idadePediatrica, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Nota, Opcoes, Pendencia } from './PecasIcr'
import { LinhaDoseLivro, TabelaLivro } from './PecasP4'
import { LinhaFaixa, ListaLivro } from './PecasP5'

/** Hemofilia, von Willebrand, PTI e anticoagulação — caps. 64 e 65 do livro do ICr. */
export function HemostasiaTrombosePed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [linha, setLinha] = useState(QUADRO2[0].id)
  const [fator, setFator] = useState<'f8' | 'f9'>('f8')
  const [delta, setDelta] = useState(0)
  const [ttpa, setTtpa] = useState(0)
  const [inr, setInr] = useState(0)
  const [dia, setDia] = useState<'d2-4' | 'd5+'>('d2-4')
  const meses = p.anos * 12 + p.meses
  const temIdade = p.anos > 0 || p.meses > 0 || p.rn
  const pediatrico = idadePediatrica(p.anos, p.meses)
  const calc = podeCalcular(p)
  // "< 2 meses" e "< 1 ano": valores que incluem o RN (convenção do lote P4)
  const calcIdade = p.peso > 0 && pediatrico && temIdade
  const l = QUADRO2.find((x) => x.id === linha)!
  const rep = calc ? reposicaoQuadro2(l, fator, p.peso) : null
  const formula = calc && delta > 0 ? (fator === 'f8' ? fatorVIIIUI(p.peso, delta)?.dose ?? null : fatorIXUI(p.peso, delta)) : null
  const man = calcIdade ? hnfManutencaoUIkgH(p.rn ? 0 : meses) : null
  const enox = calcIdade ? enoxaparinaPorIdade(p.rn ? 0 : meses) : null
  const aj = ajusteHnf(ttpa)
  const av = ajusteVarfarina(inr, dia)

  return (
    <ToolLayout
      title="Hemofilia, von Willebrand, PTI e anticoagulação — criança"
      description="Reposição de fator por tipo de sangramento, DDAVP, antifibrinolítico, inibidores, von Willebrand, PTI, heparina com nomograma do TTPa, enoxaparina, varfarina e rt-PA — livro do ICr-HCFMUSP. A decisão é do médico e do hematologista."
      ficha={fichaHemostasiaTromboPed}
    >
      <CampoPaciente id="hem" p={p} onChange={setP} />

      <Bloco titulo="Hemofilia — reposição de fator (Quadro 2, p. 679–680)">
        <Opcoes label="Fator" valor={fator} opcoes={[['f8', 'Fator VIII (hemofilia A)'], ['f9', 'Fator IX (hemofilia B)']]} onChange={setFator} />
        <Opcoes label="Tipo de hemorragia" valor={linha} opcoes={QUADRO2.map((x) => [x.id, x.tipo] as [string, string])} onChange={setLinha} />
        {!calc ? (
          <Pendencia p={p} />
        ) : (
          rep && (
            <LinhaFaixa
              nome={`${l.tipo} — ${fator === 'f8' ? 'fator VIII' : 'fator IX'}`}
              faixa={rep.inicial}
              unidade="UI"
              casas={0}
              texto={`${faixaBr(l[fator].inicial, 0)} UI/kg${l[fator].manutencao ? ` inicial; manutenção ${faixaBr(l[fator].manutencao!, 0)} UI/kg` : ''}; duração (dias): ${l.dias}`}
              pagina="p. 680"
              extra={rep.manutencao && <span className="text-muted-foreground"> · manutenção {faixaBr(rep.manutencao, 0)} UI</span>}
            />
          )
        )}
        <NumberField id="hem-delta" label="Δ fator (% desejado − % basal), pela fórmula" unit="%" value={delta} onChange={setDelta} min={0} />
        {formula !== null && <p>Pela fórmula ({fator === 'f8' ? 'Δ × peso ÷ 2' : 'Δ × peso'}, p. 679): <strong className="tabular-nums">{br(formula, 0)} UI</strong></p>}
      </Bloco>

      {calc && (
        <Bloco titulo="Desmopressina, antifibrinolítico e inibidores (p. 679–682)">
          {DOSES_HEMOSTASIA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
          <TabelaLivro
            cabecalho={['DVW — Quadro 5 (p. 682–683)', 'UI/kg', 'Para o peso', 'Frequência', 'Objetivo']}
            linhas={QUADRO5_DVW.map((q) => [q.tipo, faixaBr(q.uiKg, 0), `${faixaBr([q.uiKg[0] * p.peso, q.uiKg[1] * p.peso], 0)} UI`, q.frequencia, q.objetivo])}
            largura={640}
          />
        </Bloco>
      )}

      {calc && (
        <Bloco titulo="Trombocitopenia imune — Quadro 6 (p. 684)" descricao="Indicação de tratamento pelos consensos citados no capítulo; a decisão é do médico.">
          {DOSES_PTI.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
        </Bloco>
      )}

      <Bloco titulo="Heparina não fracionada (Quadro 3, p. 690)" descricao="Alvo: TTPa 60–85 s (anti-Xa 0,35–0,70).">
        {!calcIdade ? (
          <Nota>Informe peso e idade (ou marque RN) para as doses de heparina e enoxaparina: dependem da faixa etária.</Nota>
        ) : (
          <>
            <LinhaFaixa nome="Ataque" faixa={hnfAtaqueUI(p.peso)} unidade="UI" casas={0} texto="75 UI/kg EV em 10 minutos" pagina="p. 690" />
            {man === 'indefinido' ? (
              <p className="text-muted-foreground">Com 12 meses exatos o quadro não define ("menores de 1 ano" x "acima de 1 ano"): 28 ou 20 UI/kg/h.</p>
            ) : (
              man !== null && <LinhaFaixa nome="Manutenção inicial" faixa={[man * p.peso, man * p.peso]} unidade="UI/h" casas={0} texto={`${man} UI/kg/h (${man === 28 ? '< 1 ano' : '> 1 ano'})`} pagina="p. 690" />
            )}
            <LinhaFaixa nome="Dose profilática" faixa={[HNF_PROFILATICA_UI_KG_H * p.peso, HNF_PROFILATICA_UI_KG_H * p.peso]} unidade="UI/h" casas={0} texto="10 U/kg/h" pagina="p. 690" errata={ERRATA_HNF} />
          </>
        )}
        <NumberField id="hem-ttpa" label="TTPa" unit="s" value={ttpa} onChange={setTtpa} min={0} />
        {aj && (
          <p>
            Nomograma: bolus {aj.bolusUIkg} UI/kg{calcIdade && aj.bolusUIkg > 0 ? ` (${br(aj.bolusUIkg * p.peso, 0)} UI)` : ''} · pausa {aj.pausaMin} min · ajuste {aj.ajustePct > 0 ? '+' : ''}{aj.ajustePct}% · repetir TTPa em {aj.repetirTtpa}.
          </p>
        )}
        <Nota>{NOTA_HEPARINA_ONCO}</Nota>
      </Bloco>

      {calcIdade && (
        <Bloco titulo="Enoxaparina (Quadro 4, p. 690)" descricao="SC; anti-Xa 4–6 h após a dose: terapêutico 0,5–1,0 U/mL, profilático 0,1–0,3 U/mL.">
          {enox === 'indefinido' ? (
            <p className="text-muted-foreground">Com 2 meses exatos o quadro não define ("&lt; 2 m" x "&gt; 2 m").</p>
          ) : (
            enox && (
              <>
                <LinhaFaixa nome="Terapêutica — 12/12 h" faixa={[enox.terapeutica12h[0] * p.peso, enox.terapeutica12h[1] * p.peso]} unidade="mg/dose" casas={1} texto={`${faixaBr(enox.terapeutica12h, 2)} mg/kg/dose SC 12/12 h`} pagina="p. 690" />
                <LinhaFaixa nome="Profilática — 12/12 h" faixa={[enox.profilatica12h * p.peso, enox.profilatica12h * p.peso]} unidade="mg/dose" casas={1} texto={`${br(enox.profilatica12h, 2)} mg/kg/dose SC 12/12 h`} pagina="p. 690" />
                <LinhaFaixa nome="Profilática — 1x/dia" faixa={[enox.profilatica24h * p.peso, enox.profilatica24h * p.peso]} unidade="mg/dose" casas={1} texto={`${br(enox.profilatica24h, 2)} mg/kg/dose SC 1x/dia`} pagina="p. 690" />
              </>
            )
          )}
        </Bloco>
      )}

      <Bloco titulo="Varfarina (Quadro 5, p. 690–691) e rt-PA">
        {calc && <LinhaFaixa nome="Dia 1 (INR basal 1,0–1,3)" faixa={varfarinaDia1Mg(p.peso) !== null ? [varfarinaDia1Mg(p.peso)!, varfarinaDia1Mg(p.peso)!] : null} unidade="mg" casas={2} texto="0,2 mg/kg VO (máximo 5 mg)" pagina="p. 690" />}
        <div className="flex flex-wrap items-end gap-4">
          <NumberField id="hem-inr" label="INR" value={inr} onChange={setInr} min={0} step={0.1} />
          <Opcoes label="Fase" valor={dia} opcoes={[['d2-4', 'Dias 2 a 4'], ['d5+', 'Dia 5 em diante']]} onChange={setDia} />
        </div>
        {av && <p>Quadro 5: <strong>{av}</strong></p>}
        <Nota>{NOTA_VARFARINA}</Nota>
        {calc && <LinhaFaixa nome="rt-PA — trombólise sistêmica (CHEST)" faixa={rtpaMgH(p.peso)} unidade="mg/h" casas={2} texto="0,1 a 0,6 mg/kg/h por 6 horas; discutir com quem tem experiência em trombólise pediátrica" pagina="p. 691" />}
      </Bloco>

      <Bloco titulo="Dos capítulos">
        <ListaLivro itens={REFERENCIAS_HEMOSTASIA} />
      </Bloco>
    </ToolLayout>
  )
}
