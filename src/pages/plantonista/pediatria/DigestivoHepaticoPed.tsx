import { useState } from 'react'

import { BOLUS } from '@/clinico/pediatria/bolus'
import {
  DOSES_HDA, ENCEFALOPATIA, NOTA_VASOATIVOS, REFERENCIAS_HDA, REFERENCIAS_IHA, SOMATOSTATINA_ADOLESCENTE_UG_H, TRATAMENTO_ESPECIFICO, criterioCoagulacaoPalf,
  fichaDigestivoHepaticoPed, glicoseIhaMgMin, leituraAmonia, leituraParacetamol, octreotidaInfusaoUgH, ofertaRestritaIha, somatostatinaUgH,
} from '@/clinico/pediatria/digestivoHepaticoPed'
import { manutencao } from '@/clinico/pediatria/manutencao'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { PACIENTE_VAZIO, br, faixaBr, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Nota, Opcoes, Pendencia } from './PecasIcr'
import { LinhaBolusApendice, LinhaDoseLivro, TabelaLivro } from './PecasP4'
import { LinhaFaixa, ListaLivro } from './PecasP5'

const VITAMINA_K = BOLUS.find((b) => b.id === 'vitamina-k')
const TEXTO_AMONIA = { acima: 'acima de 200 µmol/L', faixa: 'na faixa de 150 a 200 µmol/L', abaixo: 'abaixo de 150 µmol/L' } as const

/** Hemorragia digestiva e insuficiência hepática aguda — caps. 34 e 36 do livro do ICr. */
export function DigestivoHepaticoPed() {
  const [p, setP] = useState(PACIENTE_VAZIO)
  const [coag, setCoag] = useState({ inr: 0, tp: 0 })
  const [eh, setEh] = useState(false)
  const [mg, setMg] = useState(0)
  const [amonia, setAmonia] = useState(0)
  const [base, setBase] = useState(0)
  const calc = podeCalcular(p)
  const palf = criterioCoagulacaoPalf({ inr: coag.inr, tpSeg: coag.tp, encefalopatia: eh })
  const para = leituraParacetamol(mg, p.peso)
  const nh3 = leituraAmonia(amonia)
  const hs = calc ? manutencao(p.peso) : null
  const oferta = calc ? ofertaRestritaIha(base) : null

  return (
    <ToolLayout
      title="Hemorragia digestiva e insuficiência hepática aguda — criança"
      description="Octreotida, somatostatina e omeprazol por peso, limiares transfusionais da HDA; critérios do PALF, dose tóxica de paracetamol, amônia, glicose e oferta hídrica da IHA — livro do ICr-HCFMUSP."
      ficha={fichaDigestivoHepaticoPed}
    >
      <CampoPaciente id="dig" p={p} onChange={setP} />

      {!calc ? (
        <Pendencia p={p} />
      ) : (
        <Bloco titulo="Hemorragia digestiva alta — drogas (p. 349–350)">
          {DOSES_HDA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} />)}
          <LinhaFaixa nome="Octreotida — infusão contínua" faixa={octreotidaInfusaoUgH(p.peso)} unidade="µg/h" casas={1} texto="1 µg/kg/h, podendo ser aumentada até 4 µg/kg/h; 48 a 72 h" pagina="p. 349" />
          <LinhaFaixa nome="Somatostatina — infusão" faixa={somatostatinaUgH(p.peso)} unidade="µg/h" casas={1} texto={`1 a 20 µg/kg/h; adolescentes e adultos ${SOMATOSTATINA_ADOLESCENTE_UG_H[0]} a ${SOMATOSTATINA_ADOLESCENTE_UG_H[1]} µg/h`} pagina="p. 349" />
          <Nota>{NOTA_VASOATIVOS}</Nota>
        </Bloco>
      )}
      <Bloco titulo="Hemorragia digestiva — do capítulo">
        <ListaLivro itens={REFERENCIAS_HDA} />
      </Bloco>

      <Bloco titulo="IHA — critério de coagulação do PALF (p. 357)" descricao="Também exigidos: sem hepatopatia crônica conhecida, lesão hepática bioquímica e coagulopatia que não corrige com vitamina K.">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="dig-inr" label="INR" value={coag.inr} onChange={(inr) => setCoag({ ...coag, inr })} min={0} step={0.1} />
          <NumberField id="dig-tp" label="TP" unit="s" value={coag.tp} onChange={(tp) => setCoag({ ...coag, tp })} min={0} step={0.1} />
        </div>
        <Opcoes label="Encefalopatia clínica?" valor={eh} opcoes={[[false, 'Não'], [true, 'Sim']]} onChange={setEh} />
        {palf !== null && (
          <p>
            {palf ? <strong>Preenche o critério de coagulação do PALF</strong> : 'Não preenche o critério de coagulação do PALF'} ({eh ? 'com encefalopatia: INR > 1,5 ou TP ≥ 15 s' : 'sem encefalopatia: INR > 2 ou TP ≥ 20 s'}).
          </p>
        )}
      </Bloco>

      <Bloco titulo="Paracetamol e amônia (p. 358, 364)">
        <div className="grid gap-3 sm:grid-cols-2">
          <NumberField id="dig-para" label="Paracetamol ingerido (dose única)" unit="mg" value={mg} onChange={setMg} min={0} />
          <NumberField id="dig-nh3" label="Amônia" unit="µmol/L" value={amonia} onChange={setAmonia} min={0} />
        </div>
        {para && (
          <p>
            {para.mgKg !== null && <>{br(para.mgKg, 0)} mg/kg — {para.toxicaUnica === 'sim' ? <strong>acima de 200 mg/kg</strong> : para.toxicaUnica === 'faixa' ? <strong>na faixa tóxica de 150 a 200 mg/kg</strong> : 'até 150 mg/kg'} (dose tóxica da criança: &gt; 150 a 200 mg/kg). </>}
            {para.adolescenteAcima75g && <strong>Acima de 7,5 g (limiar do adolescente).</strong>}
          </p>
        )}
        <Nota>Dose repetida: intoxicação com mais de 75 mg/kg/dia em menores de 6 anos (p. 358). Antídoto e nomograma: ferramenta de intoxicações.</Nota>
        {nh3 && <p>Amônia {TEXTO_AMONIA[nh3]}{nh3 !== 'abaixo' ? ' — fator de risco conhecido para hipertensão intracraniana na IHA (p. 364).' : '.'}</p>}
      </Bloco>

      {calc && (
        <Bloco titulo="IHA — suporte (p. 361–364)">
          <LinhaFaixa nome="Glicose em altas taxas (hipoglicemia)" faixa={glicoseIhaMgMin(p.peso)} unidade="mg/min" casas={0} texto="infusão contínua até 10 a 15 mg/kg/min; às vezes exige acesso central" pagina="p. 364" />
          <NumberField id="dig-base" label="Necessidade hídrica basal considerada" unit="mL/dia" value={base} onChange={setBase} min={0} />
          {hs && <Nota>Referência: Holliday-Segar do cap. 77 do mesmo livro = {br(hs.mlDia, 0)} mL/dia. O capítulo 36 diz "85 a 95%" sem nomear a base; a base é escolhida pelo médico.</Nota>}
          <LinhaFaixa
            nome="Oferta hídrica EV restrita"
            faixa={oferta}
            unidade="mL/dia"
            casas={0}
            texto="restrita a 85 a 95%"
            pagina="p. 361"
            extra={oferta && <span className="text-muted-foreground"> · {faixaBr([oferta[0] / 24, oferta[1] / 24], 0)} mL/h</span>}
          />
          {VITAMINA_K && <LinhaBolusApendice b={VITAMINA_K} peso={p.peso} idadeMeses={p.anos * 12 + p.meses} />}
          <Nota>Vitamina K precoce na coagulopatia da IHA (p. 363); dose do Apêndice (falência hepática, p. 910).</Nota>
        </Bloco>
      )}

      <Bloco titulo="Encefalopatia hepática (Tabela 2, p. 360)">
        <TabelaLivro cabecalho={['Grau', 'Lactentes e crianças pequenas', 'Crianças maiores', 'Sinais neurológicos', 'EEG']} linhas={ENCEFALOPATIA} largura={720} />
      </Bloco>
      <Bloco titulo="Tratamento específico (Tabela 3, p. 361–362)">
        <TabelaLivro cabecalho={['Etiologia', 'Intervenção']} linhas={TRATAMENTO_ESPECIFICO} largura={360} />
      </Bloco>
      <Bloco titulo="IHA — do capítulo">
        <ListaLivro itens={REFERENCIAS_IHA} />
      </Bloco>
    </ToolLayout>
  )
}
