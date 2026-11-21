import { useState } from 'react'

import { textoFontes } from '@/clinico/ficha'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { hollidaySegarMlDia } from '@/clinico/pediatria/manutencao'
import {
  CLORETO_CA_TABELA7, CORRECAO_ALBUMINA_TEXTO, ERRATA_CALCIO, ERRATA_TABELA11, FATOR_IR_MG, FOSFORO, HIPERCALCEMIA, HIPERCALEMIA, HIPERMAGNESEMIA, HIPOCALCEMIA, HIPOMAGNESEMIA,
  K_CONC_MAX, K_IV, K_POR_PH, K_VO, LIMIARES_K, LIMIARES_MG, LIMIARES_P, LIMIAR_HIPOCALCEMIA, calcularDose, fichaEletrolitosPed, fracaoExcrecaoMg, grauHipomagnesemia,
  mlFosforoOrganico, mlKcl191, ofertaHipercalcemia, volumeMinimoMlH, type Dose,
} from '@/clinico/pediatria/eletrolitosPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { EscolhaDaAmpola } from '@/components/plantonista/calc/EscolhaDaAmpola'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, br, faixaBr, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, LinhaLivro, Nota, Opcoes, Pendencia } from './PecasIcr'

/** Ampola só nos itens de ITENS_COM_AMPOLA ('eletrolitos:<id>'); os outros não mostram nada. */
function LinhaDose({ d, peso, extra }: { d: Dose; peso: number; extra?: (f: [number, number]) => string | null }) {
  const r = calcularDose(d, peso)
  const x = r && extra ? extra(r.faixa) : null
  return (
    <LinhaLivro
      nome={d.nome}
      texto={d.texto}
      conta={
        r && (
          <>
            <strong>
              {faixaBr(r.faixa, 2)} {d.unidade}
            </strong>
            {x && <span className="text-tinta-sussurro"> · {x}</span>}
            {r.noMaximo && <span className="text-atencao"> (máximo)</span>}
          </>
        )
      }
      pagina={d.pagina}
      errata={d.errata}
      nota={d.nota}
      depois={r && <EscolhaDaAmpola chave={`eletrolitos:${d.id}`} dose={r.faixa} unidade={d.unidade} />}
    />
  )
}

type Aba = 'k' | 'ca' | 'mg' | 'p'

const NOME_ABA: Record<Aba, string> = { k: 'Potássio', ca: 'Cálcio', mg: 'Magnésio', p: 'Fósforo' }

/** Linha do "Copiar": a mesma conta da LinhaDose acima. */
function doseTxt(d: Dose, peso: number, extra?: (f: [number, number]) => string | null): string[] {
  const r = calcularDose(d, peso)
  if (!r) return []
  const x = extra ? extra(r.faixa) : null
  return [`- ${d.nome}: ${faixaBr(r.faixa, 2)} ${d.unidade}${x ? ` · ${x}` : ''}${r.noMaximo ? ' (máximo)' : ''} (${d.pagina})`]
}

const extraKvo = (f: [number, number]) => `${faixaBr([f[0] / 4, f[1] / 2], 1)} mEq por tomada (2 a 4 tomadas)`
const extraCloretoCa = (f: [number, number]) => `${br(f[0] * 100, 0)} mg`
const extraGluconato = (f: [number, number]) => `${faixaBr([f[0] * 9, f[1] * 9], 0)} mg de Ca elementar`
const extraFosforo = (f: [number, number]) => `${faixaBr([mlFosforoOrganico(f[0])!, mlFosforoOrganico(f[1])!], 2)} mL de fósforo orgânico (1 mmol/mL; 2 mEq/mL de Na)`

/** Potássio, cálcio, magnésio e fósforo na criança — cap. 54 do Pronto-Socorro ICr-HCFMUSP. */
export function EletrolitosPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [aba, setAba] = useState<Aba>('k')
  const [acesso, setAcesso] = useState<keyof typeof K_CONC_MAX>('periferico')
  const [mg, setMg] = useState(0)
  const [ir, setIr] = useState(false)
  const [femg, setFemg] = useState({ uMg: 0, pCr: 0, pMg: 0, uCr: 0 })
  const calc = podeCalcular(p)
  const kIv = calc ? calcularDose(K_IV, p.peso) : null
  const grauMg = mg > 0 ? grauHipomagnesemia(mg) : null
  const fe = fracaoExcrecaoMg(femg.uMg, femg.pCr, femg.pMg, femg.uCr)
  const basal = calc ? hollidaySegarMlDia(p.peso) : null
  const [abaRes, setAbaRes] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaEletrolitosPed.id)
  const extraKiv = (f: [number, number]) => `volume mínimo ${faixaBr([volumeMinimoMlH(f[0], acesso)!, volumeMinimoMlH(f[1], acesso)!], 0)} mL/h para ≤ ${K_CONC_MAX[acesso]} mEq/L`
  const grausMg = grauMg ? [grauMg] : (['grave', 'moderada', 'leve'] as const)
  const doseMg = (g: (typeof grausMg)[number]) => {
    const d = HIPOMAGNESEMIA[g]
    const r = calcularDose(d, p.peso)
    const f = r ? (ir ? ([r.faixa[0] * FATOR_IR_MG, r.faixa[1] * FATOR_IR_MG] as [number, number]) : r.faixa) : null
    return { d, r, f }
  }

  // Texto do "Copiar" (C3 e C4 = A): a lista do eletrólito que está na tela, com a página do livro.
  const resultadoCopia = (): string[] => {
    if (aba === 'k')
      return [
        ...doseTxt(K_IV, p.peso, extraKiv),
        ...(kIv ? [`- KCl 19,1% (2,5 mEq/mL, Tabela 11): ${faixaBr([mlKcl191(kIv.faixa[0])!, mlKcl191(kIv.faixa[1])!], 1)} mL por hora de infusão`] : []),
        ...doseTxt(K_VO, p.peso, extraKvo),
        ...HIPERCALEMIA.flatMap((d) => doseTxt(d, p.peso, d.id === 'cloreto-ca' ? extraCloretoCa : undefined)),
        ...doseTxt(CLORETO_CA_TABELA7, p.peso),
      ]
    if (aba === 'ca')
      return [
        ...HIPOCALCEMIA.flatMap((d) => doseTxt(d, p.peso, extraGluconato)),
        ...HIPERCALCEMIA.flatMap((d) => doseTxt(d, p.peso)),
        ...(basal !== null ? [`- Oferta hídrica 1,5 a 2 vezes a basal: ${faixaBr(ofertaHipercalcemia(basal), 0)} mL/dia (Holliday-Segar ${br(basal, 0)} mL/dia, cap. 77, p. 840)`] : []),
      ]
    if (aba === 'mg')
      return [
        ...grausMg.flatMap((g) => {
          const { d, r, f } = doseMg(g)
          if (!f) return []
          return [`- ${d.nome}${ir ? ' — com redução de 50%' : ''}: ${faixaBr(f, 2)} ${d.unidade}${r?.noMaximo ? ' (máximo)' : ''} (${d.pagina})`]
        }),
        ...(fe ? [`- FEMg ${br(fe.femg, 2)}% — ${fe.leitura} (p. 557)`] : []),
        ...HIPERMAGNESEMIA.flatMap((d) => doseTxt(d, p.peso)),
      ]
    return FOSFORO.flatMap((d) => doseTxt(d, p.peso, d.id === 'p-ev' ? extraFosforo : undefined))
  }
  const copia = () =>
    textoCopia({
      ferramenta: 'Potássio, cálcio, magnésio e fósforo — criança (PS Pediatria ICr-HCFMUSP)',
      dados: [
        ['Peso', `${numeroBr(p.peso)} kg`],
        ['Eletrólito', NOME_ABA[aba]],
        ['Acesso', aba === 'k' ? (acesso === 'central' ? 'central' : 'periférico') : ''],
        ['Magnésio sérico', aba === 'mg' && mg > 0 ? `${numeroBr(mg)} mg/dL` : ''],
        ['Insuficiência renal', aba === 'mg' && ir ? 'sim (doses −50%)' : ''],
      ],
      resultado: [`${NOME_ABA[aba]}:`, ...resultadoCopia()],
      fonte: textoFontes(fichaEletrolitosPed),
      versao: fichaEletrolitosPed.versao,
      quando: new Date(),
    })

  return (
    <ToolLayout
      title="Potássio, cálcio, magnésio e fósforo — criança"
      description="Doses por peso, máximos e fórmulas do capítulo de distúrbios hidroeletrolíticos do livro do ICr-HCFMUSP. A indicação é do profissional."
      ficha={fichaEletrolitosPed}
    >
      <CampoPaciente id="ele" p={p} onChange={setP} semIdade />
      <Opcoes label="Eletrólito" valor={aba} opcoes={[['k', 'Potássio'], ['ca', 'Cálcio'], ['mg', 'Magnésio'], ['p', 'Fósforo']]} onChange={setAba} />
      <Pendencia p={p} />

      {aba === 'k' && (
        <>
          <Bloco
            titulo="Hipocalemia (p. 544–546)"
            descricao={`Hipocalemia < ${LIMIARES_K.hipocalemia} mEq/L; grave < ${LIMIARES_K.hipocalemiaGrave}. Cada 0,1 no pH muda o K em ~${br(K_POR_PH)} mEq/L (p. 543).`}
          >
            {calc && (
              <>
                <Opcoes label="Acesso" valor={acesso} opcoes={[['periferico', 'Periférico (máx. 40 mEq/L)'], ['central', 'Central (máx. 80 mEq/L)']]} onChange={setAcesso} />
                <LinhaDose
                  d={K_IV}
                  peso={p.peso}
                  extra={extraKiv}
                />
                {kIv && (
                  <Nota>
                    KCl 19,1% (2,5 mEq/mL, Tabela 11): {faixaBr([mlKcl191(kIv.faixa[0])!, mlKcl191(kIv.faixa[1])!], 1)} mL por hora de infusão.
                  </Nota>
                )}
                <LinhaDose d={K_VO} peso={p.peso} extra={extraKvo} />
              </>
            )}
          </Bloco>
          <Bloco
            titulo="Hipercalemia (p. 546–549; Tabela 7)"
            descricao={`> ${LIMIARES_K.hipercalemia} mEq/L (até ${LIMIARES_K.hipercalemiaRN} em recém-nascidos e lactentes jovens). ECG se > ${LIMIARES_K.ecgAcimaDe}; risco: ≥ ${LIMIARES_K.hipercalemiaGrave}, sintomática, ou 6–7 em elevação rápida (p. 548).`}
          >
            {calc && (
              <>
                {HIPERCALEMIA.map((d) => (
                  <LinhaDose key={d.id} d={d} peso={p.peso} extra={d.id === 'cloreto-ca' ? extraCloretoCa : undefined} />
                ))}
                <LinhaDose d={CLORETO_CA_TABELA7} peso={p.peso} />
                <Nota>O livro inclui ainda agonista beta-adrenérgico inalatório ou EV (sem dose no capítulo) e diálise como último recurso (p. 549).</Nota>
              </>
            )}
          </Bloco>
        </>
      )}

      {aba === 'ca' && (
        <>
          <Bloco
            titulo="Hipocalcemia (p. 550–552)"
            descricao={`Cálcio sérico < ${LIMIAR_HIPOCALCEMIA.prematuro} mg/dL no prematuro, < ${LIMIAR_HIPOCALCEMIA.rnTermo} no RN a termo, < ${LIMIAR_HIPOCALCEMIA.crianca} em crianças e adolescentes (p. 550).`}
          >
            {calc && HIPOCALCEMIA.map((d) => <LinhaDose key={d.id} d={d} peso={p.peso} extra={extraGluconato} />)}
            <Nota>{CORRECAO_ALBUMINA_TEXTO}</Nota>
            <Nota>1 mL de gluconato de cálcio 10% = 9 mg de cálcio elementar; 1 mL de cloreto de cálcio 10% = 27 mg (p. 552).</Nota>
          </Bloco>
          <Bloco titulo="Hipercalcemia (p. 552–553)" descricao="Definida por cálcio acima de 2 desvios-padrões do normal para a idade (p. 552).">
            {calc && HIPERCALCEMIA.map((d) => <LinhaDose key={d.id} d={d} peso={p.peso} />)}
            {basal !== null && (
              <Nota>
                Oferta hídrica 1,5 a 2 vezes a basal: {faixaBr(ofertaHipercalcemia(basal), 0)} mL/dia sobre a basal de Holliday-Segar ({br(basal, 0)} mL/dia, cap. 77, p. 840).
              </Nota>
            )}
          </Bloco>
        </>
      )}

      {aba === 'mg' && (
        <>
          <Bloco
            titulo="Hipomagnesemia (p. 556–557)"
            descricao={`Normal ${LIMIARES_MG.normal.join(' a ')} mg/dL; sintomas em geral abaixo de ${br(LIMIARES_MG.sintomasAbaixoDe)} mg/dL. Grave < 0,7; moderada 0,7–1; leve > 1 mg/dL.`}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField id="ele-mg" label="Magnésio sérico" unit="mg/dL" value={mg} onChange={setMg} step={0.1} />
              <Opcoes label="Insuficiência renal?" valor={ir} opcoes={[[false, 'Não'], [true, 'Sim (doses −50%)']]} onChange={setIr} />
            </div>
            {mg > 0 && !grauMg && <p className="text-tinta-sussurro">Sem hipomagnesemia pelo corte do livro.</p>}
            {calc &&
              grausMg.map((g) => {
                const { d, r, f } = doseMg(g)
                return (
                  <LinhaLivro
                    key={g}
                    nome={`${d.nome}${ir ? ' — com redução de 50%' : ''}`}
                    texto={d.texto}
                    conta={
                      f && (
                        <>
                          <strong>
                            {faixaBr(f, 2)} {d.unidade}
                          </strong>
                          {r?.noMaximo && <span className="text-atencao"> (máximo)</span>}
                        </>
                      )
                    }
                    pagina={d.pagina}
                    nota={d.nota}
                    depois={f && <EscolhaDaAmpola chave={`eletrolitos:${d.id}`} dose={f} unidade={d.unidade} />}
                  />
                )
              })}
          </Bloco>
          <Bloco titulo="Fração de excreção do magnésio (p. 557)" descricao="FEMg = [(UMg × PCr)/(0,7 × PMg × UCr)] × 100 — mesmas unidades para Mg e para creatinina.">
            <div className="grid gap-4 sm:grid-cols-4">
              <NumberField id="fe-umg" label="Mg urinário" value={femg.uMg} onChange={(v) => setFemg({ ...femg, uMg: v })} step={0.1} />
              <NumberField id="fe-pcr" label="Creatinina plasmática" value={femg.pCr} onChange={(v) => setFemg({ ...femg, pCr: v })} step={0.01} />
              <NumberField id="fe-pmg" label="Mg plasmático" value={femg.pMg} onChange={(v) => setFemg({ ...femg, pMg: v })} step={0.1} />
              <NumberField id="fe-ucr" label="Creatinina urinária" value={femg.uCr} onChange={(v) => setFemg({ ...femg, uCr: v })} step={0.1} />
            </div>
            {fe && (
              <p className="tabular-nums">
                FEMg <strong>{br(fe.femg, 2)}%</strong> — {fe.leitura}
              </p>
            )}
          </Bloco>
          <Bloco titulo="Hipermagnesemia (p. 557–558)" descricao={`Sintomas em geral acima de ${LIMIARES_MG.hiperSintomasAcimaDe} mg/dL; > ${LIMIARES_MG.hiperExtrema} mg/dL: BAV total e parada. Cálcio EV em quadro ameaçador, repetível a cada 10 min.`}>
            {calc && HIPERMAGNESEMIA.map((d) => <LinhaDose key={d.id} d={d} peso={p.peso} />)}
          </Bloco>
        </>
      )}

      {aba === 'p' && (
        <Bloco titulo="Hipofosfatemia (p. 553–554)" descricao={`Normal em crianças, de modo geral, ${LIMIARES_P.normal.join(' a ')} mg/dL (conferir a referência do laboratório); sintomas abaixo de ${LIMIARES_P.sintomas.join(' a ')} mg/dL.`}>
          {calc &&
            FOSFORO.map((d) => (
              <LinhaDose key={d.id} d={d} peso={p.peso} extra={d.id === 'p-ev' ? extraFosforo : undefined} />
            ))}
          <Nota>Hiperfosfatemia: o livro traz hidratação, restrição dietética, quelantes e diálise, sem dose por peso (p. 555).</Nota>
        </Bloco>
      )}

      <AbasResultado
        aba={abaRes}
        onAba={setAbaRes}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!calc}
        // Erratas do livro sem efeito na dose vão para "Armadilhas" (C6 = A); as erratas e notas de cada dose ficam no item.
        armadilhas={[ERRATA_TABELA11, ...ERRATA_CALCIO, ...(guia?.armadilhas ?? [])]}
        ficha={fichaEletrolitosPed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? `Criança · ${numeroBr(p.peso)} kg · ${NOME_ABA[aba]}` : 'Informe o peso'}
        detalhe={calc ? 'Doses do peso nas listas acima; "Copiar" leva a lista do eletrólito na tela.' : undefined}
        textoCopia={calc ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAbaRes('proximos')}
      />
    </ToolLayout>
  )
}
