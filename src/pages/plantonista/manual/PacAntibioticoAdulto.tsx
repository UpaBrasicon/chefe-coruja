import { useState } from 'react'

import {
  CRITERIOS_ALTA_PAC, DESTINO_POR_PORT, DURACAO_PAC, FATORES_PSEUDOMONAS, METILPREDNISOLONA_PAC, NOTA_CLARITROMICINA, PAC_ANTIBIOTICOS,
  PROCALCITONINA_PAC, fichaPacAntibioticoAdulto, metilprednisolonaPac, type GrupoPac,
} from '@/clinico/adulto/tepPac'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco, CampoPeso, LinhaManual } from './PecasLoteC'
import { Escolhas, ListaLivro } from './PecasLoteE7'
import { br } from './loteE7Formato'

/** Antibiótico da PAC por grupo (Tabela 10 do cap. 33 do manual do HCFMUSP). */
export function PacAntibioticoAdulto() {
  const [peso, setPeso] = useState(0)
  const [grupo, setGrupo] = useState<GrupoPac>('baixo')
  const g = PAC_ANTIBIOTICOS.find((x) => x.grupo === grupo)!
  const mp = metilprednisolonaPac(peso)

  return (
    <ToolLayout
      title="PAC — antibiótico por grupo de risco (adulto)"
      description="Esquemas da Tabela 10 por grupo de risco, destino por PORT, fatores de Pseudomonas, corticoide no choque e critérios de alta, pelo manual do HC. PSI, CURB-65, SMART-COP e ATS/IDSA estão em ferramentas próprias. Adulto (14 anos ou mais)."
      ficha={fichaPacAntibioticoAdulto}
    >
      <Bloco titulo="Grupo de risco — Tabela 10 (p. 463–464)" descricao="O livro liga baixo risco a PORT I-II, intermediário a PORT III e alto a PORT IV-V (Tabela 5, p. 457).">
        <Escolhas valor={grupo} opcoes={PAC_ANTIBIOTICOS.map((x) => [x.grupo, x.nome] as const)} onChange={setGrupo} />
        {g.opcoes.map((o, i) => <LinhaManual key={o} nome={`Opção ${i + 1}`} texto={o} pagina="p. 463" />)}
        <p className="text-sm text-muted-foreground">{NOTA_CLARITROMICINA}</p>
        <ListaLivro itens={DURACAO_PAC.map((d) => ({ texto: `${d.grupo}: ${d.texto}`, pagina: d.pagina }))} />
      </Bloco>

      <Bloco titulo="Destino por PORT — Tabela 5 (p. 457)">
        {DESTINO_POR_PORT.map((d) => <LinhaManual key={d.classes} nome={d.classes} texto={d.texto} pagina="p. 457" />)}
      </Bloco>

      <Bloco titulo="Fatores de risco para Pseudomonas — Tabela 8 (p. 461–462)">
        <ul className="list-disc pl-5 text-sm">{FATORES_PSEUDOMONAS.map((f) => <li key={f}>{f}</li>)}</ul>
      </Bloco>

      <CampoPeso id="pac-peso" peso={peso} onChange={setPeso} />
      <Bloco titulo="Corticoide (p. 461)" descricao="Sem indicação na maioria; pode ser considerado no choque séptico com altas doses de vasopressores.">
        <LinhaManual
          nome="Metilprednisolona"
          texto={`${br(METILPREDNISOLONA_PAC.mgKg)} mg/kg 12/12 h EV por ${METILPREDNISOLONA_PAC.dias} dias`}
          conta={mp ? <><strong>{br(mp.mgDose)} mg por dose</strong> · {br(mp.mgDia)} mg/dia</> : 'informe o peso'}
          pagina={METILPREDNISOLONA_PAC.pagina}
        />
      </Bloco>

      <Bloco titulo="Procalcitonina e alta (p. 452, 464–465)">
        <ListaLivro itens={PROCALCITONINA_PAC} />
        <p className="text-sm font-medium">Sinais vitais estáveis por 24 horas e demais critérios de alta</p>
        <ul className="list-disc pl-5 text-sm">{CRITERIOS_ALTA_PAC.map((c) => <li key={c}>{c}</li>)}</ul>
      </Bloco>
    </ToolLayout>
  )
}
