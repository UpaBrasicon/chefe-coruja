import { useState } from 'react'

import {
  CLASSE_TEXTO, ESCALA_CLINICA, GRAU_PESO_TEXTO, NOTA_ESCALA, NOTA_ONDANSETRONA, NOTA_PLANO_A_IDADE, NOTA_PLANO_C, NOTA_ZINCO, classificarEscore, fichaDesidratacaoPed, grauPorPeso, ondansetronaMg,
  ondansetronaVoMg, planoA, planoB, planoC, racecadotrilaMgDose, zincoMgDia,
} from '@/clinico/pediatria/diarreia'
import { textoFontes } from '@/clinico/ficha'
import { CampoNumero } from '@/components/plantonista/calc/CampoNumero'
import { CamposPacientePed } from '@/components/plantonista/calc/CamposPacientePed'
import { useInicioPedDaCentral } from '@/components/plantonista/calc/pacienteNaFerramenta'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { Card, CardContent } from '@/components/ui/card'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { br, faixaBr, idadeAnos, idadePediatrica, podeCalcular, type Paciente } from './formatoIcr'
import { Bloco, LinhaLivro, Nota, Opcoes, Pendencia } from './PecasIcr'

/** Diarreia aguda: escala de desidratação e planos A, B e C — cap. 32 do Pronto-Socorro ICr-HCFMUSP. Piloto das calculadoras. */
export function DesidratacaoDiarreiaPed() {
  const inicio = useInicioPedDaCentral()
  const [p, setP] = useState<Paciente>({ peso: inicio.peso, anos: inicio.anos, meses: inicio.meses, rn: false })
  const [pontos, setPontos] = useState<number[]>(ESCALA_CLINICA.map(() => 0))
  const [pesoAnterior, setPesoAnterior] = useState(0)
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaDesidratacaoPed.id)
  const idade = idadeAnos(p.anos, p.meses)
  const escore = classificarEscore(pontos)
  const grau = pesoAnterior > 0 && p.peso > 0 ? grauPorPeso(pesoAnterior, p.peso) : null
  const calc = podeCalcular(p)
  const a = p.rn ? null : planoA(idade)
  const b = calc ? planoB(p.peso) : null
  const c = calc ? planoC(p.peso) : null
  const zinco = zincoMgDia(idade * 12)
  const vo = ondansetronaVoMg(p.peso)
  const voOndansetrona = vo ? `${faixaBr(vo, 0)} mg` : '— (abaixo de 8 kg a fonte não dá dose)'

  // Texto do "Copiar" (C4 = A): dados, escala, planos e medicações com a página do livro.
  const copia = () =>
    textoCopia({
      ferramenta: 'Diarreia aguda — desidratação e planos de hidratação',
      dados: [
        ['Peso', `${numeroBr(p.peso)} kg`],
        ['Idade', `${p.anos} anos e ${p.meses} meses`],
        ['Peso antes da doença', pesoAnterior > 0 ? `${numeroBr(pesoAnterior)} kg` : ''],
      ],
      resultado: [
        ...(escore ? [`Escala clínica: ${escore.escore} — ${CLASSE_TEXTO[escore.classe]}`] : []),
        ...(grau ? [`Peso perdido: ${br(grau.perdaPct)}%${grau.grau ? ` — ${GRAU_PESO_TEXTO[grau.grau]}` : ''}`] : []),
        ...(a ? [`Plano A: ${a.faixaMl ? `${faixaBr(a.faixaMl, 0)} mL por evacuação` : 'volume livre'} (p. 330)`] : []),
        ...(b ? [`Plano B: SRO ${br(b.totalMl, 0)} mL em 4 h (≈ ${br(b.mlH, 0)} mL/h) (p. 330)`] : []),
        ...(c
          ? [
              `Plano C (ESPGHAN): ${br(c.espghan.mlH, 0)} mL/h (${faixaBr(c.espghan.totalMl, 0)} mL) (p. 330)`,
              `Plano C (OMS): ${br(c.oms.totalMl, 0)} mL (${faixaBr(c.oms.mlH, 0)} mL/h) (p. 330)`,
            ]
          : []),
        `Ondansetrona: IV ${br(ondansetronaMg(p.peso), 2)} mg (Rerksuppaphol 2010); VO ${voOndansetrona} (Sociedade Canadense de Pediatria 2011); o livro dá 0,1 mg/kg (p. 331)`,
        `Zinco: ${zinco === null ? '— (6 meses exatos: o livro não escolhe dose)' : `${zinco} mg/dia`} (p. 331)`,
        `Racecadotrila: ${br(racecadotrilaMgDose(p.peso), 1)} mg/dose (p. 331)`,
      ],
      fonte: textoFontes(fichaDesidratacaoPed),
      versao: fichaDesidratacaoPed.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Diarreia aguda — desidratação e planos de hidratação"
      description="Escala clínica de desidratação, grau pelo peso perdido e volumes dos planos A, B e C pelo livro do ICr-HCFMUSP. Pediatria: até antes dos 14 anos."
      ficha={fichaDesidratacaoPed}
    >
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6">
          <CamposPacientePed
            idBase="diar"
            peso={p.peso}
            anos={p.anos}
            meses={p.meses}
            onPeso={(peso) => setP({ ...p, peso })}
            onAnos={(anos) => setP({ ...p, anos })}
            onMeses={(meses) => setP({ ...p, meses })}
            daCentral={inicio.daCentral}
            rn={p.rn}
            onRn={(rn) => setP({ ...p, rn })}
          >
            <CampoNumero id="diar-peso-ant" rotulo="Peso antes da doença (opcional)" unidade="kg" valor={pesoAnterior} onChange={setPesoAnterior} />
          </CamposPacientePed>
          {!idadePediatrica(p.anos, p.meses) && <p className="text-apoio text-atencao">A partir dos 14 anos completos é adulto: esta ferramenta é pediátrica.</p>}
        </CardContent>
      </Card>

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
          <LinhaLivro
            nome="Ondansetrona"
            texto="0,1 mg/kg (o livro não traz dose máxima)"
            conta={<><strong>IV {br(ondansetronaMg(p.peso), 2)} mg</strong> · VO {voOndansetrona}</>}
            pagina="p. 331"
            nota={NOTA_ONDANSETRONA}
          />
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
      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc && !escore}
        armadilhas={[NOTA_PLANO_A_IDADE, 'O livro lembra que o peso anterior raramente é preciso; por isso a avaliação clínica é mais prática (p. 328).', ...(guia?.armadilhas ?? [])]}
        ficha={fichaDesidratacaoPed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={escore ? `Escore ${escore.escore}: ${CLASSE_TEXTO[escore.classe]}` : calc ? `Criança · ${numeroBr(p.peso)} kg` : 'Informe peso e idade'}
        detalhe={calc ? 'Volumes dos planos e doses nas listas acima; "Copiar" leva todos.' : undefined}
        textoCopia={calc ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
