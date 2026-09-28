import { useState } from 'react'

import {
  CLASSE_TEXTO, ESCALA_CLINICA, GRAU_PESO_TEXTO, NOTA_ESCALA, NOTA_PLANO_A_IDADE, NOTA_PLANO_C, NOTA_ZINCO, classificarEscore, fichaDesidratacaoPed, grauPorPeso, ondansetronaMg,
  planoA, planoB, planoC, racecadotrilaMgDose, zincoMgDia,
} from '@/clinico/pediatria/diarreia'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, faixaBr, idadeAnos, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, LinhaLivro, Nota, Opcoes, Pendencia } from './PecasIcr'

/** Diarreia aguda: escala de desidratação e planos A, B e C — cap. 32 do Pronto-Socorro ICr-HCFMUSP. */
export function DesidratacaoDiarreiaPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [pontos, setPontos] = useState<number[]>(ESCALA_CLINICA.map(() => 0))
  const [pesoAnterior, setPesoAnterior] = useState(0)
  const idade = idadeAnos(p.anos, p.meses)
  const escore = classificarEscore(pontos)
  const grau = pesoAnterior > 0 && p.peso > 0 ? grauPorPeso(pesoAnterior, p.peso) : null
  const calc = podeCalcular(p)
  const a = p.rn ? null : planoA(idade)
  const b = calc ? planoB(p.peso) : null
  const c = calc ? planoC(p.peso) : null
  const zinco = zincoMgDia(idade * 12)

  return (
    <ToolLayout
      title="Diarreia aguda — desidratação e planos de hidratação"
      description="Escala clínica de desidratação, grau pelo peso perdido e volumes dos planos A, B e C pelo livro do ICr-HCFMUSP. Pediatria: até antes dos 14 anos."
      ficha={fichaDesidratacaoPed}
    >
      <CampoPaciente id="diar" p={p} onChange={setP}>
        <NumberField id="diar-peso-ant" label="Peso antes da doença (opcional)" unit="kg" value={pesoAnterior} onChange={setPesoAnterior} step={0.1} />
      </CampoPaciente>

      <Bloco titulo="Escala de desidratação clínica (Tabela 1, p. 329)" descricao={NOTA_ESCALA}>
        {ESCALA_CLINICA.map((item, i) => (
          <Opcoes
            key={item.id}
            label={item.nome}
            valor={pontos[i]}
            opcoes={item.opcoes.map((t, v) => [v, `${v} — ${t}`] as [number, string])}
            onChange={(v) => setPontos(pontos.map((x, j) => (j === i ? v : x)))}
          />
        ))}
        {escore && (
          <p className="mt-2 tabular-nums">
            Escore <strong>{escore.escore}</strong>: {CLASSE_TEXTO[escore.classe]}
          </p>
        )}
        {grau && (
          <p className="tabular-nums">
            Peso perdido: <strong>{br(grau.perdaPct)}%</strong>
            {grau.grau && <> — {GRAU_PESO_TEXTO[grau.grau]} (p. 328)</>}
          </p>
        )}
        <Nota>O livro lembra que o peso anterior raramente é preciso, por isso a avaliação clínica é mais prática (p. 328).</Nota>
      </Bloco>

      <Pendencia p={p} />

      <Bloco titulo="Planos (p. 330; Figura 2, p. 333)">
        <LinhaLivro
          nome="Plano A — sem desidratação"
          texto="tratamento domiciliar; líquidos após cada evacuação diarreica por idade; manter alimentação; sinais de alarme"
          conta={a ? <strong>{a.faixaMl ? `${faixaBr(a.faixaMl, 0)} mL por evacuação` : 'volume livre'}</strong> : undefined}
          pagina="p. 330"
          nota={NOTA_PLANO_A_IDADE}
        />
        {b && (
          <LinhaLivro
            nome="Plano B — alguma desidratação"
            texto="SRO 75 mL/kg em 4 horas, em observação até terminar a reidratação; sonda nasogástrica se não aceitar"
            conta={<strong>{br(b.totalMl, 0)} mL em 4 h (≈ {br(b.mlH, 0)} mL/h)</strong>}
            pagina="p. 330"
          />
        )}
        {c && (
          <>
            <LinhaLivro
              nome="Plano C — desidratação grave (ESPGHAN)"
              texto="via parenteral com solução isotônica (SF 0,9% ou Ringer lactato); 20 mL/kg/h por 2 a 4 horas"
              conta={<strong>{br(c.espghan.mlH, 0)} mL/h ({faixaBr(c.espghan.totalMl, 0)} mL)</strong>}
              pagina="p. 330"
            />
            <LinhaLivro
              nome="Plano C — desidratação grave (OMS)"
              texto="100 mL/kg em 3 a 6 horas, a depender da idade"
              conta={<strong>{br(c.oms.totalMl, 0)} mL ({faixaBr(c.oms.mlH, 0)} mL/h)</strong>}
              pagina="p. 330"
              nota={NOTA_PLANO_C}
            />
          </>
        )}
      </Bloco>

      {calc && (
        <Bloco titulo="Medicações citadas no capítulo (p. 331)">
          <LinhaLivro nome="Ondansetrona" texto="0,1 mg/kg (o livro não traz dose máxima)" conta={<strong>{br(ondansetronaMg(p.peso), 2)} mg</strong>} pagina="p. 331" />
          <LinhaLivro
            nome="Zinco"
            texto="10 mg/dia < 6 meses; 20 mg/dia > 6 meses, por 10 a 14 dias, em grupos de risco"
            conta={<strong>{zinco === null ? '—' : `${zinco} mg/dia`}</strong>}
            pagina="p. 331"
            nota={zinco === null ? NOTA_ZINCO : undefined}
          />
          <LinhaLivro nome="Racecadotrila" texto="1,5 mg/kg três vezes ao dia enquanto houver diarreia" conta={<strong>{br(racecadotrilaMgDose(p.peso), 1)} mg/dose</strong>} pagina="p. 331" />
        </Bloco>
      )}
    </ToolLayout>
  )
}
