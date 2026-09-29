import { useState } from 'react'

import {
  BIOPSIA_GNPE, DIALISE_SHU, DIFERENCAS_NEFROTICA_2025, DOSES_NEFRITICA, DOSES_NEFROTICA, DOSES_SHU, INDICACOES_ALBUMINA, KDIGO_ITENS, NOTA_SAL, REFERENCIAS_GLOMERULOPATIAS,
  TRIADE_SHU, albumina20, chShu, fichaGlomerulopatiasPed, hipotensaoPostural, lerPrCr, plasmafereseShuMl, prednisolonaKdigo, proteinuriaNefrotica, restricaoHidricaGnpe,
  salNefroticaMeqDia, shuIndicaCH,
} from '@/clinico/pediatria/glomerulopatiasPed'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, faixaBr, idadePediatrica, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Nota, Pendencia } from './PecasIcr'
import { LinhaDoseLivro, TabelaLivro } from './PecasP4'
import { CampoSC, LinhaFaixa, ListaLivro, ListaQuadro } from './PecasP5'

const TEXTO_PRCR = {
  nefrotico: 'Pr/Cr ≥ 2: proteinúria em nível nefrótico (Tabela 1).',
  'remissao-completa': 'Pr/Cr ≤ 0,2: faixa da remissão completa (a Tabela 1 exige ≥ 3 medidas consecutivas).',
  'remissao-parcial': 'Pr/Cr entre 0,2 e 2 com albumina ≥ 3 g/dL: remissão parcial (Tabela 1).',
  intermediario: 'Pr/Cr entre 0,2 e 2: remissão parcial só com albumina ≥ 3 g/dL (Tabela 1).',
} as const

/** Síndromes nefrítica e nefrótica e SHU — caps. 58–60 do livro do ICr. */
export function GlomerulopatiasShuPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [scInformada, setSc] = useState(0)
  const [u, setU] = useState({ prCr: 0, albumina: 0, prot24: 0 })
  const [pa, setPa] = useState({ pasD: 0, padD: 0, pasS: 0, padS: 0 })
  const [hem, setHem] = useState({ hb: 0, ht: 0 })
  const pediatrico = idadePediatrica(p.anos, p.meses)
  const sc = pediatrico ? scInformada : 0
  const calc = podeCalcular(p)
  const prcr = u.prCr > 0 ? lerPrCr(u.prCr, u.albumina || undefined) : null
  const prot = proteinuriaNefrotica(u.prot24, p.peso, sc)
  const postural = hipotensaoPostural(pa.pasD, pa.padD, pa.pasS, pa.padS)
  const ch = shuIndicaCH(hem.hb, hem.ht)
  const alb = calc ? albumina20(p.peso) : null
  const chv = calc ? chShu(p.peso) : null
  const campo = <T extends Record<string, number>>(obj: T, set: (o: T) => void, k: keyof T & string, label: string, unit: string, step = 1) => (
    <NumberField id={`glo-${k}`} label={label} unit={unit} value={obj[k]} onChange={(x) => set({ ...obj, [k]: x })} min={0} step={step} />
  )

  return (
    <ToolLayout
      title="Síndromes nefrítica e nefrótica e SHU — criança"
      description="Definições da síndrome nefrótica (Tabela 1), hipotensão postural, albumina 20% e diuréticos, restrição hídrica da GNPE, pulsos de metilprednisolona e limiares da SHU — livro do ICr-HCFMUSP. A decisão é do médico."
      ficha={fichaGlomerulopatiasPed}
    >
      <CampoPaciente id="glo" p={p} onChange={setP} />
      <CampoSC id="glo-sc" valor={scInformada} onChange={setSc} />

      <Bloco titulo="Síndrome nefrótica — definições (Tabela 1, p. 620; p. 606)">
        <div className="grid gap-3 sm:grid-cols-3">
          {campo(u, setU, 'prCr', 'Pr/Cr (1ª urina da manhã)', 'razão', 0.01)}
          {campo(u, setU, 'albumina', 'Albumina sérica', 'g/dL', 0.1)}
          {campo(u, setU, 'prot24', 'Proteinúria de 24 h', 'mg/dia')}
        </div>
        {prcr && <p>{TEXTO_PRCR[prcr]}</p>}
        {prot && (
          <p>
            {prot.porKg !== null && <>{br(prot.porKg, 1)} mg/kg/dia ({prot.nefroticaKg ? '> 50: nefrótica pelo cap. 58' : '≤ 50'}). </>}
            {prot.porM2 !== null && <>{br(prot.porM2, 0)} mg/m²/dia ({prot.nefroticaM2 ? '≥ 1.000: nefrótica pelo cap. 59' : '< 1.000'}).</>}
          </p>
        )}
        <Nota>Síndrome nefrótica: proteinúria nefrótica + albumina &lt; 3,0 g/dL + edema (ou proteinúria nefrótica + edema sem albumina disponível). Corticorresistente: sem remissão em 4 semanas de prednisona (p. 620).</Nota>
      </Bloco>

      <Bloco titulo="Hipotensão postural (p. 624)" descricao="Queda ≥ 20 mmHg da sistólica ou ≥ 10 mmHg da diastólica do deitado para o sentado indica hipovolemia.">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {campo(pa, setPa, 'pasD', 'PAS deitado', 'mmHg')}
          {campo(pa, setPa, 'padD', 'PAD deitado', 'mmHg')}
          {campo(pa, setPa, 'pasS', 'PAS sentado', 'mmHg')}
          {campo(pa, setPa, 'padS', 'PAD sentado', 'mmHg')}
        </div>
        {postural !== null && <p>{postural ? <strong>Critério de hipotensão postural presente.</strong> : 'Sem o critério de hipotensão postural.'}</p>}
      </Bloco>

      {!calc ? (
        <Pendencia p={p} />
      ) : (
        <Bloco titulo="Síndrome nefrótica — volume e diuréticos (p. 624–626)">
          {alb && (
            <LinhaFaixa nome="Albumina 20%" faixa={alb.gramas} unidade="g" casas={1} texto="0,5 a 1 g/kg em 4 horas (Figura 1: 1 g/kg), com sinais vitais e PA" pagina="p. 624; Figura 1, p. 626" extra={<span className="text-tinta-sussurro"> · {faixaBr(alb.mL, 0)} mL de albumina 20%</span>} />
          )}
          <ListaQuadro itens={INDICACOES_ALBUMINA} pagina="p. 624" />
          {DOSES_NEFROTICA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
          <LinhaFaixa nome="Sal na dieta" faixa={salNefroticaMeqDia(p.peso)} unidade="mEq/dia" casas={0} texto="2 a 3 mEq/kg/dia; dieta normoproteica, sem restrição de líquidos VO com função renal preservada" pagina="p. 624" nota={NOTA_SAL} />
        </Bloco>
      )}

      <Bloco titulo="Síndrome nefrítica / GNPE (cap. 58)">
        <LinhaFaixa nome="Restrição hídrica — base" faixa={restricaoHidricaGnpe(sc)} unidade="mL/dia" casas={0} texto="perdas insensíveis subtraídas da água endógena (400 mL/m²/dia), + reposição parcial da diurese; balanço negativo enquanto houver edema" pagina="p. 608" />
        {calc && DOSES_NEFRITICA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
        <p className="font-medium">Indicações de biópsia na apresentação da GNPE</p>
        <ListaQuadro itens={BIOPSIA_GNPE} pagina="p. 607" />
      </Bloco>

      <Bloco titulo="Síndrome hemolítico-urêmica (cap. 60)">
        <TabelaLivro cabecalho={['Tríade (Tabela 2, p. 633)', 'O livro traz']} linhas={TRIADE_SHU} largura={480} />
        <div className="grid gap-3 sm:grid-cols-2">
          {campo(hem, setHem, 'hb', 'Hemoglobina', 'g/dL', 0.1)}
          {campo(hem, setHem, 'ht', 'Hematócrito', '%', 0.1)}
        </div>
        {ch !== null && <p>{ch ? <strong>Hb &lt; 6 g/dL ou Ht &lt; 18%: limiar de transfusão de CH do livro (p. 634).</strong> : 'Acima do limiar de transfusão do livro (Hb < 6 ou Ht < 18%).'}</p>}
        {chv && (
          <LinhaFaixa nome="Concentrado de hemácias" faixa={[chv.mL, chv.mL]} unidade="mL" casas={0} texto="10 mL/kg em 3 a 4 horas (costuma elevar a Hb em 1 g/dL); meta pós-transfusional 8 a 9 g/dL; lento, com sinais vitais e potássio" pagina="p. 635" extra={<span className="text-tinta-sussurro"> · {faixaBr(chv.mlH, 0)} mL/h</span>} />
        )}
        {calc && DOSES_SHU.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
        {calc && <LinhaFaixa nome="Plasmaférese — volume de troca" faixa={plasmafereseShuMl(p.peso)} unidade="mL" casas={0} texto="40 a 60 mL/kg, com plasma fresco congelado como reposição (SHUa ou SNC grave até o eculizumabe)" pagina="p. 636" />}
        <p className="font-medium">Diálise na SHU</p>
        <ListaQuadro itens={DIALISE_SHU} pagina="p. 636" />
      </Bloco>

      <Bloco titulo="Síndrome nefrótica — KDIGO 2025 e IPNA 2023, ao lado do livro" descricao="Prednisona/prednisolona pela KDIGO 2025 (Practice Point 1.3.1.1, p. S257) com o peso e a superfície corpórea informados; textos lidos no PDF/artigo.">
        {(() => { const k = pediatrico ? prednisolonaKdigo(p.peso, sc) : null; return k ? (
          <div className="rounded-lg border px-3 py-2 text-sm">
            <p>Fase diária (4 ou 6 semanas): <strong className="tabular-nums">{k.diariaPorPeso !== null ? `${br(k.diariaPorPeso, 0)} mg/dia (2 mg/kg)` : ''}{k.diariaPorPeso !== null && k.diariaPorSc !== null ? ' · ' : ''}{k.diariaPorSc !== null ? `${br(k.diariaPorSc, 0)} mg/dia (60 mg/m²)` : ''}</strong>{k.noTetoDiaria && ' — no teto de 60 mg'}</p>
            <p>Dias alternados (mais 4 ou 6 semanas): <strong className="tabular-nums">{k.alternadaPorPeso !== null ? `${br(k.alternadaPorPeso, 0)} mg (1,5 mg/kg)` : ''}{k.alternadaPorPeso !== null && k.alternadaPorSc !== null ? ' · ' : ''}{k.alternadaPorSc !== null ? `${br(k.alternadaPorSc, 0)} mg (40 mg/m²)` : ''}</strong>{k.noTetoAlternada && ' — no teto de 40 mg'}</p>
            <p className="text-tinta-sussurro">Recaída: mesma dose diária até 3 dias de remissão, depois alternada por 4 semanas (Practice Points 1.3.3.1–1.3.3.2).</p>
          </div>
        ) : <Nota>Informe idade pediátrica e peso ou superfície corpórea.</Nota> })()}
        {KDIGO_ITENS.map((i) => <p key={i.tema} className="text-tinta-sussurro"><span className="font-medium text-tinta">{i.tema}:</span> {i.texto} ({i.forca}; {i.pagina})</p>)}
        <ul className="list-disc pl-5 text-tinta-sussurro">{DIFERENCAS_NEFROTICA_2025.map((d) => <li key={d}>{d}</li>)}</ul>
      </Bloco>

      <Bloco titulo="Dos capítulos">
        <ListaLivro itens={REFERENCIAS_GLOMERULOPATIAS} />
      </Bloco>
    </ToolLayout>
  )
}
