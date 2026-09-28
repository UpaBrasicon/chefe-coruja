import { useState } from 'react'

import {
  ALOPURINOL_SLT, HIDRATACAO_SLT, OUTRAS_SLT, RASBURICASE_SLT, RISCO_SLT, alopurinolSlt, fichaLiseTumoralAdulto, hidratacaoSlt, produtoCalcioFosforo,
  rasburicaseSlt, type FuncaoRenalAlopurinol,
} from '@/clinico/adulto/liseTumoral'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { Escolhas, ListaLivro } from './PecasLoteE7'
import { br, faixa } from './loteE7Formato'

/** Síndrome de lise tumoral do adulto (cap. 84 do manual do HCFMUSP). */
export function LiseTumoralAdulto() {
  const [peso, setPeso] = useState(0)
  const [sc, setSc] = useState(0)
  const [renal, setRenal] = useState<FuncaoRenalAlopurinol>('normal')
  const [ca, setCa] = useState(0)
  const [p, setP] = useState(0)
  const h = hidratacaoSlt(sc, peso > 0 ? peso : undefined)
  const alo = alopurinolSlt(sc > 0 ? sc : undefined, peso > 0 ? peso : undefined, renal)
  const ras = rasburicaseSlt(peso)
  const cap = produtoCalcioFosforo(ca, p)

  return (
    <ToolLayout
      title="Síndrome de lise tumoral — adulto"
      description="Risco por neoplasia, hidratação por superfície corporal, alopurinol com ajuste renal, rasburicase por peso e produto cálcio × fósforo, pelo manual do HC. Cairo-Bishop está em ferramenta própria. Adulto (14 anos ou mais); os valores de criança do livro não entram."
      ficha={fichaLiseTumoralAdulto}
    >
      <CampoPeso id="slt-peso" peso={peso} onChange={setPeso}>
        <NumberField id="slt-sc" label="Superfície corporal" unit="m²" value={sc} onChange={setSc} min={0} step={0.01} />
      </CampoPeso>
      <p className="text-sm text-muted-foreground">O livro não traz fórmula de superfície corporal: informe a SC já calculada.</p>

      <Bloco titulo="Risco — Tabela 2 (p. 1100–1102)">
        {RISCO_SLT.map((r) => (
          <div key={r.neoplasia} className="rounded-lg border px-3 py-2 text-sm">
            <span className="font-medium">{r.neoplasia}</span>
            <p><span className="text-muted-foreground">Baixo:</span> {r.baixo}</p>
            <p><span className="text-muted-foreground">Moderado:</span> {r.moderado}</p>
            <p><span className="text-muted-foreground">Alto:</span> {r.alto}</p>
          </div>
        ))}
      </Bloco>

      <Bloco titulo="Hidratação (p. 1103)" descricao="Risco moderado ou alto. Diuréticos se disfunção cardíaca ou renal, excluídas hipovolemia e uropatia obstrutiva.">
        <LinhaManual
          nome="Volume"
          texto={`${faixa(HIDRATACAO_SLT.lM2Dia, 0)} L/m²/dia (aproximadamente ${faixa(HIDRATACAO_SLT.lDiaAprox, 0)} L/dia)`}
          conta={h ? <><strong>{faixa(h.lDia)} L/dia</strong> = {faixa(h.mlH, 0)} mL/h</> : 'informe a SC'}
          pagina={HIDRATACAO_SLT.pagina}
        />
        <LinhaManual
          nome="Diurese-alvo"
          texto={`${HIDRATACAO_SLT.diureseMlM2H} mL/m²/h (${HIDRATACAO_SLT.diureseMlKgH} mL/kg/h para adultos)`}
          conta={h ? <><strong>{br(h.diureseAlvoScMlH ?? 0, 0)} mL/h</strong> pela SC{h.diureseAlvoPesoMlH !== null && <> · {br(h.diureseAlvoPesoMlH, 0)} mL/h pelo peso</>}</> : 'informe a SC'}
          pagina={HIDRATACAO_SLT.pagina}
        />
      </Bloco>

      <Bloco titulo="Hipouricemiantes (p. 1103–1104)">
        <Escolhas
          valor={renal}
          opcoes={[['normal', 'Função renal sem ajuste'], ['ira', 'IRA'], ['clcr10a20', 'ClCr 10-20 mL/min'], ['clcrMenor10', 'ClCr < 10 mL/min']] as const}
          onChange={setRenal}
        />
        <LinhaManual
          nome="Alopurinol"
          texto={`${ALOPURINOL_SLT.mgM2Dose} mg/m²/dose a cada ${ALOPURINOL_SLT.intervaloH} horas (ou ${ALOPURINOL_SLT.mgKgDia} mg/kg/dia, máximo de ${ALOPURINOL_SLT.maxMgDia} mg/dia em ${ALOPURINOL_SLT.tomadas} tomadas) VO; ${alo.ajusteRenal}`}
          conta={
            renal === 'clcr10a20' ? <strong>200 mg/dia</strong>
              : renal === 'clcrMenor10' ? <strong>100 mg/dia</strong>
                : <>
                  {alo.porSc ? <><strong>{br(alo.porSc.mgDose, 0)} mg 8/8 h</strong> ({br(alo.porSc.mgDia, 0)} mg/dia)</> : 'SC —'}
                  {' · '}
                  {alo.porPeso ? <>{br(alo.porPeso.mgDia, 0)} mg/dia pelo peso{alo.porPeso.limitado && ' (no teto de 800)'}</> : 'peso —'}
                </>
          }
          pagina={ALOPURINOL_SLT.pagina}
          nota="O livro não diz se o teto de 800 mg/dia vale também para a dose por m²; a conta por SC é mostrada sem teto."
        />
        <LinhaManual
          nome="Rasburicase"
          texto={`${faixa(RASBURICASE_SLT.mgKg, 2)} mg/kg EV 1 vez ao dia, por ${faixa(RASBURICASE_SLT.dias, 0)} dias`}
          conta={ras ? <strong>{faixa(ras)} mg/dia</strong> : 'informe o peso'}
          pagina={RASBURICASE_SLT.pagina}
        />
        <ListaLivro itens={OUTRAS_SLT} />
      </Bloco>

      <Bloco titulo="Produto cálcio × fósforo (p. 1105)">
        <div className="grid gap-3 md:grid-cols-3">
          <NumberField id="slt-ca" label="Cálcio" unit="mg/dL" value={ca} onChange={setCa} min={0} step={0.1} />
          <NumberField id="slt-p" label="Fósforo" unit="mg/dL" value={p} onChange={setP} min={0} step={0.1} />
          <p className="self-end text-sm tabular-nums">
            {cap ? <><strong>{br(cap.produto)} mg²/dL²</strong>{cap.acimaDoCorte ? ' — ≥ 70, entre as indicações de hemodiálise do livro' : ' — abaixo de 70'}</> : 'informe cálcio e fósforo'}
          </p>
        </div>
      </Bloco>
    </ToolLayout>
  )
}
