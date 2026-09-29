import { useState } from 'react'

import {
  ALTA, AMINAS_CARDIOPATA, ANALGESICOS_ADULTO, ANTITROMBOTICOS, BICARBONATO_SEM_GASOMETRIA, CARDIOPATA_PARAMETROS, CASO_SUSPEITO, CONDICOES_ESPECIAIS, CONSIDERACOES_C_D,
  DIAGNOSTICO_LAB, DIFERENCAS_2024, DIFERENCIAL, ERRATA_PARACETAMOL, EXAMES, GESTANTE, HIPERIDRATACAO, HIPERTENSOS, HIPOTENSAO, IDOSOS_ALERTA, INOTROPICOS, INTERNACAO,
  INTERROMPER_INFUSAO, PLAQUETAS_GRUPO_D, PROVA_LACO, QUADRO2_PRIORIDADE, REAVALIACAO, SANGRAMENTO_ANTITROMBOTICO, SINAIS_ALARME, SINAIS_GRAVIDADE, TABELA_HEMODINAMICA,
  antitromboticoDengue, bicarbonatoDengue, cardiopataDengue, fichaDengue, grupoDPorPeso, grupoDengue, hidratacaoAdulto, hipocalemiaDengue, hiponatremiaDengue, provaDoLaco,
  type Antitrombotico, type ClasseNyha,
} from '@/clinico/dengue'
import { NumberField } from '@/components/plantonista/NumberField'
import { SemReferenciaPediatrica } from '@/components/plantonista/SemReferenciaPediatrica'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

import { Bloco, LinhaManual } from '../manual/PecasLoteC'

const n = (x: number, c = 0) => (Math.round(x * 10 ** c) / 10 ** c).toLocaleString('pt-BR')
const faixa = (f: [number, number], c = 0) => `${n(f[0], c)}–${n(f[1], c)}`

const DESCRICAO_GRUPO = {
  A: 'Sem sinais de alarme, sem condição especial, sem risco social e sem comorbidade (p. 28).',
  B: 'Sem sinais de alarme, com sangramento de pele espontâneo ou induzido, ou com condição especial, risco social ou comorbidade (p. 27, 31).',
  C: 'Algum sinal de alarme, sem sinais de gravidade (p. 32).',
  D: 'Sinais de choque, sangramento grave ou disfunção grave de órgãos (p. 35–36).',
} as const

function Marca({ texto, marcado, onChange }: { texto: string; marcado: boolean; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm hover:bg-trilha/50">
      <input type="checkbox" checked={marcado} onChange={onChange} className="size-4" />
      <span>{texto}</span>
    </label>
  )
}

function Lista({ itens }: { itens: string[] }) {
  return <ul className="list-disc pl-5 text-sm">{itens.map((i) => <li key={i}>{i}</li>)}</ul>
}

/** Dengue no adulto pelo manual do MS (6ª ed., 2024). */
export function ClassificacaoDengue() {
  const [paciente, setPaciente] = useState<'adulto' | 'crianca'>('adulto')
  const [peso, setPeso] = useState(70)
  const [sangramentoPele, setSangramentoPele] = useState(false)
  const [especial, setEspecial] = useState(false)
  const [alarme, setAlarme] = useState<Set<string>>(new Set())
  const [grave, setGrave] = useState<Set<string>>(new Set())
  const [el, setEl] = useState({ na: 0, k: 0, hco3: 0, ph: 0 })
  const [nyha, setNyha] = useState<ClasseNyha>(1)
  const [droga, setDroga] = useState<Antitrombotico>('aas')
  const [plaq, setPlaq] = useState(0)
  const [pa, setPa] = useState({ pas: 0, pad: 0 })

  const alternar = (set: Set<string>, setSet: (s: Set<string>) => void, s: string) => {
    const novo = new Set(set)
    if (novo.has(s)) novo.delete(s)
    else novo.add(s)
    setSet(novo)
  }

  const grupo = grupoDengue({ sangramentoPele, sangramentoMucosa: false, sinaisAlarme: alarme.size, sinaisChoque: grave.size, condicaoEspecial: especial })
  const fases = hidratacaoAdulto(grupo, peso)
  const crianca = paciente === 'crianca'
  const d = grupoDPorPeso(peso)
  const hipoNa = el.na > 0 ? hiponatremiaDengue(el.na, peso) : null
  const hipoK = el.k > 0 ? hipocalemiaDengue(el.k, peso) : null
  const bic = el.hco3 > 0 ? bicarbonatoDengue(el.hco3, el.ph, peso) : null
  const card = cardiopataDengue(nyha, peso)
  const anti = plaq > 0 ? antitromboticoDengue(droga, plaq) : null
  const laco = provaDoLaco(pa.pas, pa.pad)

  return (
    <ToolLayout
      title="Dengue — classificação, conduta e hidratação (MS 2024)"
      description="Grupos A–D, hidratação por peso, grupo D com hemocomponentes, eletrólitos, hipertensos, cardiopatas, gestante, antiagregantes e anticoagulantes pelo manual do Ministério da Saúde (6ª ed., 2024). A classificação vale para qualquer idade; os volumes desta tela são do adulto."
      ficha={fichaDengue}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label>Paciente</Label>
            <div className="flex gap-2">
              {([['adulto', 'Adulto (14 anos ou mais)'], ['crianca', 'Criança (menos de 14 anos)']] as const).map(([v, rotulo]) => (
                <button key={v} type="button" aria-pressed={paciente === v} onClick={() => setPaciente(v)}
                  className={cn('rounded-lg border px-3 py-2 text-left text-sm', paciente === v ? 'border-acao bg-acao/5 ring-1 ring-acao' : 'hover:bg-trilha/50')}>
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
          <NumberField id="dg-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={1} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Achados (Figura 2, p. 27)</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          <p className="text-sm text-tinta-sussurro">{CASO_SUSPEITO}</p>
          <Marca texto="Sangramento de pele espontâneo ou induzido (petéquias, prova do laço positiva)" marcado={sangramentoPele} onChange={() => setSangramentoPele((v) => !v)} />
          <Marca texto={`Condição especial, risco social ou comorbidade: ${CONDICOES_ESPECIAIS.join(', ')}`} marcado={especial} onChange={() => setEspecial((v) => !v)} />
          <div className="mt-2 text-xs font-medium text-tinta-sussurro">Sinais de alarme (Quadro 1, p. 13)</div>
          {SINAIS_ALARME.map((s) => <Marca key={s} texto={s} marcado={alarme.has(s)} onChange={() => alternar(alarme, setAlarme, s)} />)}
          <div className="mt-2 text-xs font-medium text-tinta-sussurro">Gravidade (p. 36, 56)</div>
          {SINAIS_GRAVIDADE.map((s) => <Marca key={s} texto={s} marcado={grave.has(s)} onChange={() => alternar(grave, setGrave, s)} />)}
          <p className="text-sm text-tinta-sussurro">{HIPOTENSAO}</p>
        </CardContent>
      </Card>

      <Card className={grupo === 'D' ? 'border-critico/30' : grupo === 'C' ? 'border-atencao/30' : 'border-acao'}>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-3 text-base">
            Grupo <Badge className="text-lg">{grupo}</Badge>
            <span className="text-sm font-normal text-tinta-sussurro">{DESCRICAO_GRUPO[grupo]}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {crianca ? (
            <SemReferenciaPediatrica detalhe="A classificação acima vale para a criança. Os volumes da criança estão na ferramenta Dengue — criança (seção Pediatria), pelo livro do ICr-HCFMUSP com o manual do MS ao lado." />
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {fases.map((f) => (
                  <tr key={f.etapa} className="border-b last:border-0 align-top">
                    <td className="py-1.5 pr-3 font-medium">{f.etapa}</td>
                    <td className="py-1.5 pr-3 text-tinta-sussurro">{f.regra}</td>
                    <td className="py-1.5 text-right tabular-nums whitespace-nowrap">
                      {f.volumeMl === null ? '—' : `${f.volumeMl.toLocaleString('pt-BR')} mL`}
                      {f.mlH ? <span className="block text-xs text-tinta-sussurro">{f.mlH.toLocaleString('pt-BR')} mL/h</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p><span className="font-medium">Reavaliação:</span> {REAVALIACAO[grupo]}</p>
          <p><span className="font-medium">Exames:</span> {EXAMES[grupo]}</p>
          {(grupo === 'C' || grupo === 'D') && <p className="text-atencao">{IDOSOS_ALERTA}</p>}
          <p className="text-tinta-sussurro">O grupo muda no curso da doença: vale para a reavaliação de agora. Paracetamol e/ou dipirona; não usar salicilatos, anti-inflamatórios nem corticoide (p. 28).</p>
        </CardContent>
      </Card>

      {!crianca && grupo === 'D' && (
        <Bloco titulo="Grupo D — choque persistente (p. 38–40)" descricao="Com o peso informado. A escolha depende do Ht e do sangramento; a decisão é do médico.">
          <LinhaManual nome="Ht em ascensão — albumina 0,5–1 g/kg a 5%" texto="100 mL da solução = 25 mL de albumina 20% + 75 mL de SF 0,9%; na falta, coloide sintético 10 mL/kg/h" pagina="p. 38"
            conta={d ? <><strong>{faixa(d.albuminaG)} g</strong> = {faixa(d.albumina5Ml)} mL a 5% ({faixa(d.albumina20Ml)} mL de albumina 20% + {faixa(d.sfParaAlbuminaMl)} mL de SF) · coloide {n(d.coloideMlH)} mL/h</> : 'informe o peso'} />
          <LinhaManual nome="Ht em queda com hemorragia — concentrado de hemácias" texto="10 a 15 mL/kg/dia" pagina="p. 38" conta={d ? <strong>{faixa(d.concentradoHemaciasMlDia)} mL/dia</strong> : 'informe o peso'} />
          <LinhaManual nome="Coagulopatia — plasma, vitamina K e crioprecipitado" texto="plasma 10 mL/kg; vitamina K EV; crioprecipitado 1 U para cada 5–10 kg" pagina="p. 38" conta={d ? <>plasma <strong>{n(d.plasmaMl)} mL</strong> · crio <strong>{faixa(d.crioU)} U</strong></> : 'informe o peso'} />
          <p className="text-sm">{PLAQUETAS_GRUPO_D}</p>
          <p className="text-sm">{HIPERIDRATACAO}</p>
          <p className="text-sm font-medium">Reduzir ou interromper a infusão quando houver:</p>
          <Lista itens={INTERROMPER_INFUSAO} />
          <p className="text-sm font-medium">Inotrópicos no choque com disfunção miocárdica (p. 40):</p>
          <Lista itens={INOTROPICOS.map((i) => `${i.droga} ${faixa(i.ugKgMin, 1)} µg/kg/min${peso > 0 ? ` = ${faixa([i.ugKgMin[0] * peso, i.ugKgMin[1] * peso], 0)} µg/min` : ''}`)} />
        </Bloco>
      )}

      {!crianca && (grupo === 'C' || grupo === 'D') && (
        <Bloco titulo="Grupos C e D — considerações (p. 39–42)">
          <Lista itens={CONSIDERACOES_C_D} />
        </Bloco>
      )}

      <Bloco titulo="Eletrólitos e acidose (p. 41)" descricao="Corrigir depois de tratar a desidratação ou o choque. Valores do paciente informados; o peso é o de cima.">
        <div className="grid gap-3 sm:grid-cols-4">
          <NumberField id="dg-na" label="Sódio" unit="mEq/L" value={el.na} onChange={(x) => setEl({ ...el, na: x })} min={0} />
          <NumberField id="dg-k" label="Potássio" unit="mEq/L" value={el.k} onChange={(x) => setEl({ ...el, k: x })} min={0} step={0.1} />
          <NumberField id="dg-hco3" label="Bicarbonato" unit="mEq/L" value={el.hco3} onChange={(x) => setEl({ ...el, hco3: x })} min={0} />
          <NumberField id="dg-ph" label="pH" value={el.ph} onChange={(x) => setEl({ ...el, ph: x })} min={0} step={0.01} />
        </div>
        {hipoNa && <LinhaManual nome="Hiponatremia" texto="(130 − Na) × peso × 0,6 = mEq; NaCl 3% tem 0,51 mEq/mL; 1–2 mL/kg/h; corrigir com Na < 120 ou sintomas neurológicos; NaCl 3%: 85 mL de água destilada + 15 mL de NaCl 20%" pagina="p. 41"
          conta={<><strong>{n(hipoNa.mEq)} mEq</strong> = {n(hipoNa.mlNaCl3)} mL de NaCl 3% · {faixa(hipoNa.mlH)} mL/h{hipoNa.indicada ? '' : ' — Na ≥ 120: o manual só corrige com sintomas neurológicos'}</>} />}
        {hipoK && <LinhaManual nome="Hipocalemia" texto="EV nos casos graves com K < 2,5; 0,2–0,4 mEq/kg/h, no máximo 4 mEq por 100 mL" pagina="p. 41"
          conta={<><strong>{faixa(hipoK.mEqH, 1)} mEq/h</strong>{hipoK.indicada ? '' : ' — K ≥ 2,5: fora do critério EV do manual'}</>} />}
        {bic && <LinhaManual nome="Bicarbonato" texto="só com HCO3 < 10 e/ou pH < 7,20: (HCO3 desejado 15 a 22 − encontrado) × 0,4 × peso" pagina="p. 41"
          conta={<><strong>{faixa(bic.mEq)} mEq</strong>{bic.indicado ? '' : ' — fora do critério do manual'}</>} />}
        <p className="text-sm text-tinta-sussurro">{BICARBONATO_SEM_GASOMETRIA}</p>
      </Bloco>

      <Bloco titulo="Hipertensos e cardiopatas (p. 44–51)">
        <Lista itens={HIPERTENSOS} />
        <div className="flex flex-wrap gap-2 pt-2">
          {([1, 2, 3, 4] as ClasseNyha[]).map((c) => (
            <button key={c} type="button" aria-pressed={nyha === c} onClick={() => setNyha(c)}
              className={cn('rounded-lg border px-3 py-1.5 text-sm', nyha === c ? 'border-acao bg-acao/5 ring-1 ring-acao' : 'hover:bg-trilha/50')}>NYHA {['I', 'II', 'III', 'IV'][c - 1]}</button>
          ))}
        </div>
        <LinhaManual nome={`Cardiopata NYHA ${['I', 'II', 'III', 'IV'][nyha - 1]}`} texto={card.etapa} pagina="p. 49–51"
          conta={card.volumeMl ? <><strong>{n(card.volumeMl)} mL</strong> em 30 min ({n(card.mlH!)} mL/h){card.manutencao12hMl ? ` · manutenção ${faixa(card.manutencao12hMl)} mL a cada 12 h` : ''}</> : card.manutencao12hMl ? <>manutenção {faixa(card.manutencao12hMl)} mL a cada 12 h</> : undefined} />
        <Lista itens={CARDIOPATA_PARAMETROS} />
        <Lista itens={AMINAS_CARDIOPATA.map((a) => `${a.droga} ${faixa(a.ugKgMin, 2)} µg/kg/min — ${a.efeito}`)} />
      </Bloco>

      <Bloco titulo="Antiagregantes e anticoagulantes pela contagem de plaquetas (p. 58–63)">
        <div className="flex flex-col gap-1.5">
          {ANTITROMBOTICOS.map((a) => (
            <label key={a.value} className="flex items-center gap-2 text-sm"><input type="radio" name="dg-anti" checked={droga === a.value} onChange={() => setDroga(a.value)} className="size-4" /> {a.label}</label>
          ))}
        </div>
        <NumberField id="dg-plaq" label="Plaquetas" unit="/mm³" value={plaq} onChange={setPlaq} min={0} step={1000} />
        {anti ? <p className="text-sm font-medium">{anti}</p> : <p className="text-sm text-tinta-sussurro">Informe a contagem de plaquetas.</p>}
        <p className="text-sm text-tinta-sussurro">{SANGRAMENTO_ANTITROMBOTICO}</p>
      </Bloco>

      <Bloco titulo="Gestante (p. 19, 52–54)"><Lista itens={GESTANTE} /></Bloco>

      <Bloco titulo="Analgesia — Apêndice H (p. 77)">
        <Lista itens={ANALGESICOS_ADULTO.map((a) => `${a.droga}: ${a.dose}`)} />
        <p className="text-sm text-tinta-sussurro">Errata: {ERRATA_PARACETAMOL}</p>
      </Bloco>

      <Bloco titulo="Prova do laço — Apêndice G (p. 76)" descricao={`Adulto: insuflar até o valor médio por ${PROVA_LACO.adulto.minutos} min; positiva com ${PROVA_LACO.adulto.petequias} ou mais petéquias no quadrado de 2,5 cm. ${PROVA_LACO.nota}`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField id="dg-pas" label="PAS" unit="mmHg" value={pa.pas} onChange={(x) => setPa({ ...pa, pas: x })} min={0} />
          <NumberField id="dg-pad" label="PAD" unit="mmHg" value={pa.pad} onChange={(x) => setPa({ ...pa, pad: x })} min={0} />
        </div>
        {laco !== null && <p className="text-sm">Insuflar a <strong>{n(laco)} mmHg</strong>.</p>}
      </Bloco>

      <Bloco titulo="Internação e alta (p. 43)">
        <p className="text-sm font-medium">Indicações de internação</p>
        <Lista itens={INTERNACAO} />
        <p className="text-sm font-medium">Alta: todos os cinco critérios</p>
        <Lista itens={ALTA} />
      </Bloco>

      <Bloco titulo="Avaliação hemodinâmica — Tabela 1 (p. 15)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left align-top text-sm">
            <thead className="text-tinta-sussurro"><tr><th className="pr-3 pb-2">Parâmetro</th><th className="pr-3 pb-2">Sem choque</th><th className="pr-3 pb-2">Choque compensado</th><th className="pb-2">Choque com hipotensão</th></tr></thead>
            <tbody>{TABELA_HEMODINAMICA.map((l) => <tr key={l.parametro} className="border-t"><td className="pr-3 py-2 font-medium">{l.parametro}</td><td className="pr-3 py-2">{l.ausente}</td><td className="pr-3 py-2">{l.compensado}</td><td className="py-2">{l.hipotensao}</td></tr>)}</tbody>
          </table>
        </div>
      </Bloco>

      <Bloco titulo="Diagnóstico, notificação e diferencial (p. 20, 34–35, 55–57)">
        <Lista itens={DIAGNOSTICO_LAB} />
        <p className="text-sm text-tinta-sussurro">{DIFERENCIAL}</p>
      </Bloco>

      <Bloco titulo="Quadro 2 do MS — referência do protocolo (p. 25)" descricao="Cor da classificação de risco que o manual associa a cada grupo. A classificação de risco do paciente é da enfermagem; a tela não atribui cor.">
        <Lista itens={QUADRO2_PRIORIDADE.map((q) => `Grupo ${q.grupo}: ${q.cor} — ${q.texto}`)} />
      </Bloco>

      <Bloco titulo="O que mudou nesta versão">
        <ul className="list-disc pl-5 text-sm text-tinta-sussurro">{DIFERENCAS_2024.map((x) => <li key={x}>{x}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
