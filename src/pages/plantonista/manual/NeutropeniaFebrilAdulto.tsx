import { useState } from 'react'

import {
  ANTIFUNGICOS_NF, ATB_ALTO_RISCO, DEFINICOES_NF, DURACAO_NF, ERRATA_ANFO_DEOXICOLATO, ERRATA_MASCC, INDICACOES_VANCO_NF, antifungicosPorPeso,
  fichaNeutropeniaFebrilAdulto,
} from '@/clinico/adulto/neutropeniaFebril'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { Erratas, ListaLivro } from './PecasLoteE7'
import { br, faixa } from './loteE7Formato'

/** Neutropenia febril: definições e doses empíricas (cap. 81 do manual do HCFMUSP). */
export function NeutropeniaFebrilAdulto() {
  const [peso, setPeso] = useState(0)
  const af = antifungicosPorPeso(peso)

  return (
    <ToolLayout
      title="Neutropenia febril — definições e doses (adulto)"
      description="Definições, β-lactâmicos antipseudomonas do alto risco, indicações de cobertura para Gram-positivo, antifúngicos por peso e duração, pelo manual do HC. O MASCC está em ferramenta própria. Adulto (14 anos ou mais)."
      ficha={fichaNeutropeniaFebrilAdulto}
    >
      <Bloco titulo="Definições (p. 1062–1068)">
        <ListaLivro itens={DEFINICOES_NF} />
      </Bloco>

      <Bloco titulo="Alto risco: monoterapia antipseudomonas em internação (p. 1069–1070)">
        {ATB_ALTO_RISCO.map((a) => <LinhaManual key={a.nome} nome={a.nome} texto={a.dose} pagina="p. 1069–1070" />)}
        <p className="text-sm font-medium">Vancomicina ou teicoplanina não fazem parte do esquema inicial; o livro associa em (p. 1070):</p>
        <ul className="list-disc pl-5 text-sm">{INDICACOES_VANCO_NF.map((i) => <li key={i}>{i}</li>)}</ul>
        <p className="text-sm text-tinta-sussurro">O livro não traz dose de vancomicina nem de teicoplanina neste capítulo.</p>
      </Bloco>

      <CampoPeso id="nf-peso" peso={peso} onChange={setPeso} />
      <Bloco titulo="Antifúngicos (p. 1072)">
        <LinhaManual nome="Caspofungina" texto={ANTIFUNGICOS_NF.caspofungina.texto} pagina={ANTIFUNGICOS_NF.pagina} />
        <LinhaManual
          nome="Anfotericina B lipossomal"
          texto={ANTIFUNGICOS_NF.anfoLipossomal.texto}
          conta={af ? <strong>{faixa(af.anfoLipossomalMg, 0)} mg/dia</strong> : 'informe o peso'}
          pagina={ANTIFUNGICOS_NF.pagina}
        />
        <LinhaManual
          nome="Voriconazol"
          texto={ANTIFUNGICOS_NF.voriconazol.texto}
          conta={af ? <>1º dia <strong>{br(af.voriconazolAtaqueMg, 0)} mg</strong> 12/12 h · depois {br(af.voriconazolManutencaoMg, 0)} mg 12/12 h</> : 'informe o peso'}
          pagina={ANTIFUNGICOS_NF.pagina}
        />
        <LinhaManual nome="Anfotericina B deoxicolato" texto="5 mg/kg 1 x/d (como está no livro)" conta="não calculado" pagina={ANTIFUNGICOS_NF.pagina} errata={ERRATA_ANFO_DEOXICOLATO} />
      </Bloco>

      <Bloco titulo="Duração (p. 1071–1072)">
        <ListaLivro itens={DURACAO_NF} />
      </Bloco>

      <Bloco titulo="Errata do MASCC">
        <Erratas itens={[ERRATA_MASCC, 'p. 1067–1068 — CISNE citado (3 níveis, usa monócitos) sem tabela de pontos: não implementado.']} />
      </Bloco>
    </ToolLayout>
  )
}
