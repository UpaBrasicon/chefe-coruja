import { useState } from 'react'

import {
  ANALGESIA_POR_INTENSIDADE, HIDRATACAO_FALCIFORME, METAS_FALCIFORME, MORFINA_FALCIFORME, NOTA_QUETAMINA_FALCIFORME, QUETAMINA_FALCIFORME, STA_ANTIBIOTICOS,
  fichaFalciformeAdulto, hidratacaoFalciforme, morfinaFalciforme, quetaminaFalciforme,
} from '@/clinico/adulto/falciforme'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { ListaLivro } from './PecasLoteE7'
import { br, faixa } from './loteE7Formato'

/** Anemia falciforme do adulto: crise álgica e síndrome torácica aguda (cap. 80 do manual do HCFMUSP). */
export function FalciformeAdulto() {
  const [peso, setPeso] = useState(0)
  const h = hidratacaoFalciforme(peso)
  const m = morfinaFalciforme(peso)
  const q = quetaminaFalciforme(peso)

  return (
    <ToolLayout
      title="Anemia falciforme — crise álgica e STA (adulto)"
      description="Hidratação por peso, analgesia por intensidade (Tabela 5) com morfina e quetamina por peso, antibiótico e metas da síndrome torácica aguda, pelo manual do HC. Adulto (14 anos ou mais); o capítulo não traz dose pediátrica."
      ficha={fichaFalciformeAdulto}
    >
      <CampoPeso id="fal-peso" peso={peso} onChange={setPeso} />

      <Bloco titulo="Hidratação na crise álgica (p. 1056)">
        <LinhaManual
          nome="Volume em 24 h"
          texto={`${HIDRATACAO_FALCIFORME.mlKg24h} mL/kg em 24 horas com solução discretamente hipotônica (SF 0,9% + SG 5%); SF 0,9% se hipovolêmico`}
          conta={h ? <><strong>{br(h.ml24h, 0)} mL/24 h</strong> = {br(h.mlH, 0)} mL/h</> : 'informe o peso'}
          pagina={HIDRATACAO_FALCIFORME.pagina}
        />
      </Bloco>

      <Bloco titulo="Analgesia — Tabela 5 (p. 1057–1058)" descricao="Escala de 1 a 10; dor ≥ 8: opioide parenteral com tempo porta-opioide ≤ 30 min (p. 1056).">
        {ANALGESIA_POR_INTENSIDADE.map((a) => <LinhaManual key={a.faixa} nome={a.faixa} texto={a.texto} pagina={a.pagina} />)}
        <LinhaManual
          nome="Morfina na dor grave"
          texto={`${br(MORFINA_FALCIFORME.ataqueMgKg, 2)} mg/kg EV; repetir ${br(MORFINA_FALCIFORME.repeticaoMgKg, 2)} mg/kg a cada ${MORFINA_FALCIFORME.intervaloMin} min até o controle`}
          conta={m ? <><strong>{br(m.ataqueMg)} mg</strong> · repetição {br(m.repeticaoMg)} mg</> : 'informe o peso'}
          pagina={MORFINA_FALCIFORME.pagina}
        />
      </Bloco>

      <Bloco titulo="Quetamina na dor refratária a opioide (p. 1056)">
        <LinhaManual nome="Intranasal" texto={`${br(QUETAMINA_FALCIFORME.inMgKg, 2)} mg/kg`} conta={q ? <strong>{br(q.inMg)} mg</strong> : 'informe o peso'} pagina={QUETAMINA_FALCIFORME.pagina} />
        <LinhaManual
          nome="Infusão EV"
          texto={`${faixa(QUETAMINA_FALCIFORME.infusaoUgKgMin, 0)} µg/kg/min (o livro escreve "0,1 a 0,3 mg/kg/hora")`}
          conta={q ? <><strong>{faixa(q.infusaoMgH)} mg/h</strong> pelos µg/kg/min · {faixa(q.infusaoLivroMgH)} mg/h pelo parêntese</> : 'informe o peso'}
          pagina={QUETAMINA_FALCIFORME.pagina}
          errata={NOTA_QUETAMINA_FALCIFORME}
        />
        <LinhaManual nome="Bolus EV" texto={`${faixa(QUETAMINA_FALCIFORME.bolusMgKg)} mg/kg`} conta={q ? <strong>{faixa(q.bolusMg)} mg</strong> : 'informe o peso'} pagina={QUETAMINA_FALCIFORME.pagina} />
        <LinhaManual nome="Dose máxima" texto={`${QUETAMINA_FALCIFORME.maxMgKgH} mg/kg/hora`} conta={q ? <strong>{br(q.maxMgH)} mg/h</strong> : 'informe o peso'} pagina={QUETAMINA_FALCIFORME.pagina} />
      </Bloco>

      <Bloco titulo="Síndrome torácica aguda: antibiótico empírico (p. 1057–1058)" descricao="Os critérios diagnósticos (Tabela 3) estão em ferramenta própria.">
        <ListaLivro itens={STA_ANTIBIOTICOS} />
      </Bloco>

      <Bloco titulo="Metas, transfusão e alta (p. 1055–1061)">
        <ListaLivro itens={METAS_FALCIFORME} />
      </Bloco>
    </ToolLayout>
  )
}
