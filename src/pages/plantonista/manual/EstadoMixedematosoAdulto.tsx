import { ERRATA_INVERNO, FORA_ENDOCRINO, NOTA_MIXEDEMA_PESO_IDADE, REPOSICAO_MIXEDEMA, SUPORTE_MIXEDEMA, fichaMixedema, totaisMixedema } from '@/clinico/adulto/endocrino'
import { ToolLayout } from '@/components/plantonista/ToolLayout'

import { Bloco } from './LoteAPecas'
import { faixaBr } from './loteAFormato'
import { LinhaManual } from './PecasLoteC'
import { Errata, Fora } from './PecasLoteE6'

/** Estado mixedematoso — reposição hormonal e suporte (cap. 71 do manual do HCFMUSP). */
export function EstadoMixedematosoAdulto() {
  const t = totaisMixedema()
  const conta: Record<string, string> = {
    'T3 + T4 combinadas': `T3 de manutenção: ${faixaBr(t.t3CombinadaUgDia, 0)} µg/dia`,
    Hidrocortisona: `${t.hidrocortisonaMgDia} mg/dia`,
  }
  return (
    <ToolLayout
      title="Estado mixedematoso — adulto"
      description="Doses de T4, T3 e hidrocortisona e medidas de suporte, como o manual do HCFMUSP traz. Escore diagnóstico em ferramenta própria. Adulto (14 anos ou mais)."
      ficha={fichaMixedema}
    >
      <Bloco titulo="Reposição hormonal" descricao={NOTA_MIXEDEMA_PESO_IDADE}>
        {REPOSICAO_MIXEDEMA.map((d) => (
          <LinhaManual key={d.droga} nome={d.droga} texto={d.texto} pagina={d.pagina} errata={d.errata} conta={conta[d.droga] && <strong>{conta[d.droga]}</strong>} />
        ))}
        <p className="text-muted-foreground">Via EV idealmente; com disponibilidade limitada, VO ou por sonda (p. 961).</p>
      </Bloco>

      <Bloco titulo="Suporte (Tabela 5)">
        {SUPORTE_MIXEDEMA.map((d) => <LinhaManual key={d.droga} nome={d.droga} texto={d.texto} pagina={d.pagina} />)}
        <Errata texto={ERRATA_INVERNO} />
      </Bloco>

      <Bloco titulo="O que o manual não traz">
        <Fora itens={FORA_ENDOCRINO} />
      </Bloco>
    </ToolLayout>
  )
}
