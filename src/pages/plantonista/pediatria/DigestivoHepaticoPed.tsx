import { useState } from 'react'

import { BOLUS, calcularBolus, type Bolus } from '@/clinico/pediatria/bolus'
import { calcularDoseLivro, textoDoseLivro, type DoseLivro } from '@/clinico/pediatria/fonteP4'
import { textoFontes } from '@/clinico/ficha'
import {
  DOSES_HDA, ENCEFALOPATIA, NOTA_VASOATIVOS, REFERENCIAS_HDA, REFERENCIAS_IHA, TRATAMENTO_ESPECIFICO, criterioCoagulacaoPalf,
  fichaDigestivoHepaticoPed, glicoseIhaMgMin, leituraAmonia, leituraParacetamol, octreotidaInfusaoUgH, ofertaRestritaIha, somatostatinaUgH,
} from '@/clinico/pediatria/digestivoHepaticoPed'
import { manutencao } from '@/clinico/pediatria/manutencao'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { AbasResultado } from '@/components/plantonista/calc/AbasResultado'
import { ResumoFlutuante } from '@/components/plantonista/calc/ResumoFlutuante'
import { ID_ABAS_RESULTADO, type IdAba } from '@/components/plantonista/calc/contexto'
import { passosDaFaixa } from '@/clinico/guia'
import { guiaDa } from '@/clinico/guias'
import { numeroBr, textoCopia } from '@/domain/copiaCalculo'

import { PACIENTE_VAZIO, br, faixaBr, podeCalcular } from './formatoIcr'
import { Bloco, CampoPaciente, Nota, Opcoes, Pendencia } from './PecasIcr'
import { LinhaBolusApendice, LinhaDoseLivro, TabelaLivro } from './PecasP4'
import { LinhaFaixa, ListaLivro } from './PecasP5'

const VITAMINA_K = BOLUS.find((b) => b.id === 'vitamina-k')
const TEXTO_AMONIA = { acima: 'acima de 200 µmol/L', faixa: 'na faixa de 150 a 200 µmol/L', abaixo: 'abaixo de 150 µmol/L' } as const

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

/** Linha do "Copiar": a mesma conta da LinhaBolusApendice (PecasP4). */
function bolusTxt(b: Bolus, peso: number, idadeMeses?: number): string[] {
  const r = calcularBolus(b, peso, idadeMeses)
  if (!r || r.aplica === 'nao') return []
  return [`- ${b.nome}: ${faixaBr(r.faixa, r.faixa[1] >= 10 ? 1 : 2)} ${b.unidade}${r.volumeMl ? ` · ${faixaBr(r.volumeMl, 2)} mL` : ''}${r.noMaximo ? ' (limitado ao máximo do livro)' : ''}${r.aplica === 'indefinido' ? ' (depende da idade)' : ''} · ${b.via} (Apêndice, ${b.pagina})`]
}

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
  const [aba, setAba] = useState<IdAba>('proximos')
  const guia = guiaDa(fichaDigestivoHepaticoPed.id)
  const temConta = calc || palf !== null || para !== null || nh3 !== null

  // Texto do "Copiar" (C3 e C4 = A): doses e leituras que estão na tela, com a página do livro.
  const copia = () =>
    textoCopia({
      ferramenta: 'Hemorragia digestiva e insuficiência hepática aguda — criança (PS Pediatria ICr-HCFMUSP)',
      dados: [
        ['Peso', p.peso > 0 ? `${numeroBr(p.peso)} kg` : ''],
        ['Idade', p.anos > 0 || p.meses > 0 ? `${p.anos} anos e ${p.meses} meses` : ''],
        ['INR', coag.inr > 0 ? numeroBr(coag.inr) : ''],
        ['TP', coag.tp > 0 ? `${numeroBr(coag.tp)} s` : ''],
        ['Encefalopatia clínica', palf !== null ? (eh ? 'sim' : 'não') : ''],
        ['Paracetamol ingerido', mg > 0 ? `${numeroBr(mg)} mg` : ''],
        ['Amônia', amonia > 0 ? `${numeroBr(amonia)} µmol/L` : ''],
        ['Necessidade hídrica basal considerada', calc && base > 0 ? `${numeroBr(base)} mL/dia` : ''],
      ],
      resultado: [
        ...(calc
          ? [
              'Hemorragia digestiva alta:',
              ...DOSES_HDA.flatMap((d) => doseLivroTxt(d, p.peso, p.rn)),
              `- Octreotida — infusão contínua: ${faixaBr(octreotidaInfusaoUgH(p.peso), 1)} µg/h (p. 349)`,
              `- Somatostatina — infusão: ${faixaBr(somatostatinaUgH(p.peso), 1)} µg/h (p. 349)`,
            ]
          : []),
        ...(palf !== null ? [`PALF: ${palf ? 'preenche' : 'não preenche'} o critério de coagulação (${eh ? 'com encefalopatia: INR > 1,5 ou TP ≥ 15 s' : 'sem encefalopatia: INR > 2 ou TP ≥ 20 s'}) (p. 357)`] : []),
        ...(para && para.mgKg !== null ? [`Paracetamol: ${br(para.mgKg, 0)} mg/kg — ${para.toxicaUnica === 'sim' ? 'acima de 200 mg/kg' : para.toxicaUnica === 'faixa' ? 'na faixa tóxica de 150 a 200 mg/kg' : 'até 150 mg/kg'} (p. 358)`] : []),
        ...(nh3 ? [`Amônia ${TEXTO_AMONIA[nh3]} (p. 364)`] : []),
        ...(calc
          ? [
              'IHA — suporte:',
              `- Glicose em altas taxas: ${faixaBr(glicoseIhaMgMin(p.peso), 0)} mg/min (p. 364)`,
              ...(oferta ? [`- Oferta hídrica EV restrita: ${faixaBr(oferta, 0)} mL/dia · ${faixaBr([oferta[0] / 24, oferta[1] / 24], 0)} mL/h (p. 361)`] : []),
              ...(VITAMINA_K ? bolusTxt(VITAMINA_K, p.peso, p.anos * 12 + p.meses) : []),
            ]
          : []),
      ],
      fonte: textoFontes(fichaDigestivoHepaticoPed),
      versao: fichaDigestivoHepaticoPed.versao,
      quando: new Date(),
    })

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
          {DOSES_HDA.map((d) => <LinhaDoseLivro key={d.id} d={d} peso={p.peso} rn={p.rn} ampola={`hda:${d.id}`} />)}
          <LinhaFaixa nome="Octreotida — infusão contínua" faixa={octreotidaInfusaoUgH(p.peso)} unidade="µg/h" casas={1} texto="1 µg/kg/h, podendo ser aumentada até 4 µg/kg/h; 48 a 72 h" pagina="p. 349" />
          <LinhaFaixa nome="Somatostatina — infusão" faixa={somatostatinaUgH(p.peso)} unidade="µg/h" casas={1} texto="1 a 20 µg/kg/h" pagina="p. 349" />
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
            extra={oferta && <span className="text-tinta-sussurro"> · {faixaBr([oferta[0] / 24, oferta[1] / 24], 0)} mL/h</span>}
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

      <AbasResultado
        aba={aba}
        onAba={setAba}
        passos={passosDaFaixa(guia, undefined)}
        semResultado={!temConta}
        armadilhas={[...(guia?.armadilhas ?? [])]}
        ficha={fichaDigestivoHepaticoPed}
        guia={guia}
      />
      <ResumoFlutuante
        principal={calc ? `Criança · ${numeroBr(p.peso)} kg` : temConta ? 'Leituras nos blocos acima' : 'Informe peso e idade'}
        detalhe={temConta ? 'Doses e leituras nas listas acima; "Copiar" leva todas.' : undefined}
        textoCopia={temConta ? copia() : undefined}
        alvoDetalhes={ID_ABAS_RESULTADO}
        rotuloDetalhes="Próximos passos"
        aoIrDetalhes={() => setAba('proximos')}
      />
    </ToolLayout>
  )
}
