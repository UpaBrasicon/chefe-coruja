import { useState } from 'react'

import {
  DIETA_EH, FORA_HEPATOPATA, HEPATITES_GRAVES, MADDREY, NAC_CAP60, NOTAS_KINGS, PAGINA_WEST_HAVEN, PFC_HEPATITE, TRATAMENTO_EH, WEST_HAVEN, dietaEh,
  fichaInsuficienciaHepatica, kingsCollege, lactuloseMlDia, nacCap60, pfcHepatiteMl,
} from '@/clinico/adulto/hepatopata'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'

import { Bloco, Escolha, Resultado } from './LoteAPecas'
import { br, faixaBr } from './loteAFormato'
import { CampoPeso, LinhaManual } from './PecasLoteC'
import { Errata, Fora, ListaRef, Marca } from './PecasLoteE6'

type Etiologia = 'paracetamol' | 'outras'

/** Encefalopatia hepática e hepatites graves (caps. 59–60 do manual do HCFMUSP). */
export function InsuficienciaHepaticaAdulto() {
  const [peso, setPeso] = useState(0)
  const [estadio, setEstadio] = useState<'I' | 'II' | 'III' | 'IV'>('I')
  const [etio, setEtio] = useState<Etiologia>('paracetamol')
  const [k, setK] = useState({ ph: false, inr65: false, cr: false, eh: false, idade: false, causa: false, ictericia: false, inr35: false, bt: false })
  const marca = (id: keyof typeof k) => (v: boolean) => setK((x) => ({ ...x, [id]: v }))

  const wh = WEST_HAVEN.find((w) => w.estadio === estadio)!
  const kings = etio === 'paracetamol'
    ? kingsCollege({ etiologia: 'paracetamol', phMenor730: k.ph, inrMaior65: k.inr65, crMaior34: k.cr, encefalopatia3ou4: k.eh })
    : kingsCollege({ etiologia: 'outras', inrMaior65: k.inr65, idadeMaior40: k.idade, causaMedicamentosaOuIndeterminada: k.causa, ictericiaMais7Dias: k.ictericia, inrMaior35: k.inr35, btMaior175: k.bt })
  const lac = lactuloseMlDia()
  const dieta = dietaEh(peso)
  const nac = nacCap60(peso)
  const pfc = pfcHepatiteMl(peso)

  return (
    <ToolLayout
      title="Encefalopatia hepática e hepatites graves — adulto"
      description="West Haven, lactulose e antibióticos, meta nutricional, King's College, N-acetilcisteína e plasma, como o manual do HCFMUSP traz. Maddrey em ferramenta própria. Adulto (14 anos ou mais)."
      ficha={fichaInsuficienciaHepatica}
    >
      <CampoPeso id="ih-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Classificação de West Haven" descricao={PAGINA_WEST_HAVEN}>
        <Escolha label="Estádio" value={estadio} onChange={setEstadio} opcoes={WEST_HAVEN.map((w) => ({ value: w.estadio, label: w.estadio }))} />
        <dl className="grid gap-2 sm:grid-cols-2">
          <div><dt className="text-tinta-sussurro">Consciência</dt><dd>{wh.consciencia}</dd></div>
          <div><dt className="text-tinta-sussurro">Função intelectual</dt><dd>{wh.intelecto}</dd></div>
          <div><dt className="text-tinta-sussurro">Comportamento</dt><dd>{wh.comportamento}</dd></div>
          <div><dt className="text-tinta-sussurro">Alterações neuromusculares</dt><dd>{wh.neuromuscular}</dd></div>
        </dl>
      </Bloco>

      <Bloco titulo="Encefalopatia hepática — tratamento" descricao={`Lactulose 20–40 mL × 3 a 6 tomadas = ${faixaBr(lac, 0)} mL/dia.`}>
        {TRATAMENTO_EH.map((t) => <LinhaManual key={t.droga} nome={t.droga} texto={t.texto} pagina={t.pagina} />)}
        <div className="grid gap-3 sm:grid-cols-3">
          <Resultado rotulo="Calorias 35–40 kcal/kg" valor={dieta ? `${faixaBr(dieta.kcal, 0)} kcal/dia` : 'informe o peso'} />
          <Resultado rotulo="Proteína 1,25–1,5 g/kg (texto)" valor={dieta ? `${faixaBr(dieta.proteinaTexto, 0)} g/dia` : '—'} />
          <Resultado rotulo="Proteína 1,2–1,5 g/kg (Tabela 4)" valor={dieta ? `${faixaBr(dieta.proteinaTabela, 0)} g/dia` : '—'} />
        </div>
        <Errata texto={DIETA_EH.errata} />
      </Bloco>

      <Bloco titulo="Hepatites graves">
        <ListaRef itens={HEPATITES_GRAVES} />
        <LinhaManual nome="Hepatite alcoólica grave (Maddrey)" texto={`4,6 × (TP − TP controle, em s) + bilirrubina total; > ${MADDREY.corte}: ${MADDREY.prednisona}`} pagina={MADDREY.pagina} nota="A conta está na ferramenta de Maddrey." />
        <LinhaManual nome="Plasma fresco no sangramento" texto={PFC_HEPATITE.texto} pagina={PFC_HEPATITE.pagina} conta={pfc ? <strong>{br(pfc, 0)} mL</strong> : 'informe o peso'} />
      </Bloco>

      <Bloco titulo="Critérios do King's College (Tabela 5)" descricao="Critérios para indicação de transplante hepático na hepatite fulminante (p. 818–819).">
        <Escolha label="Etiologia" value={etio} onChange={setEtio} opcoes={[{ value: 'paracetamol', label: 'Intoxicação por paracetamol' }, { value: 'outras', label: 'Outras etiologias' }]} />
        {etio === 'paracetamol' ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            <Marca rotulo="pH < 7,30 (basta sozinho)" marcado={k.ph} onChange={marca('ph')} />
            <Marca rotulo="INR > 6,5 (acima de 100 s)" marcado={k.inr65} onChange={marca('inr65')} />
            <Marca rotulo="Creatinina > 3,4 mg/dL" marcado={k.cr} onChange={marca('cr')} />
            <Marca rotulo="Encefalopatia graus III e IV" marcado={k.eh} onChange={marca('eh')} />
          </div>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-2">
            <Marca rotulo="INR > 6,5 (basta sozinho)" marcado={k.inr65} onChange={marca('inr65')} />
            <Marca rotulo="Idade > 40 anos" marcado={k.idade} onChange={marca('idade')} />
            <Marca rotulo="Causa: hepatite medicamentosa ou indeterminada" marcado={k.causa} onChange={marca('causa')} />
            <Marca rotulo="Icterícia > 7 dias antes da encefalopatia" marcado={k.ictericia} onChange={marca('ictericia')} />
            <Marca rotulo="INR > 3,5" marcado={k.inr35} onChange={marca('inr35')} />
            <Marca rotulo="Bilirrubina > 17,5 mg/dL" marcado={k.bt} onChange={marca('bt')} />
          </div>
        )}
        <p className="rounded-lg border p-3">
          {kings.preenchido ? <Badge variant="warning" className="mr-2">critério da Tabela 5 preenchido</Badge> : <Badge variant="outline" className="mr-2">não preenchido</Badge>}
          {kings.motivo}
        </p>
        <ListaRef itens={NOTAS_KINGS} />
      </Bloco>

      <Bloco titulo="N-acetilcisteína (cap. 60)" descricao={`${NAC_CAP60.pagina}. A ferramenta de intoxicações usa o esquema do cap. 98.`}>
        {NAC_CAP60.ev.map((f, i) => (
          <LinhaManual key={f.rotulo} nome={`EV — ${f.rotulo}`} texto={`${f.mgKg} mg/kg em ${f.minutos} min, ${f.preparo}`} pagina={NAC_CAP60.pagina}
            conta={nac ? <strong>{br(nac.ev[i].mg, 0)} mg ({br(nac.ev[i].mgH, 0)} mg/h)</strong> : 'informe o peso'} />
        ))}
        <LinhaManual nome="EV — 3ª etapa" texto={NAC_CAP60.terceira} pagina={NAC_CAP60.pagina} conta="não calculada" errata={NAC_CAP60.errata} />
        <LinhaManual nome="VO/SNG" texto={NAC_CAP60.vo} pagina={NAC_CAP60.pagina}
          conta={nac ? <strong>{br(nac.vo.ataqueMg, 0)} mg; depois {br(nac.vo.manutencaoMg, 0)} mg 4/4 h</strong> : 'informe o peso'} />
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <Fora itens={FORA_HEPATOPATA} />
      </Bloco>
    </ToolLayout>
  )
}
