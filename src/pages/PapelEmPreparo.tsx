import { Hourglass } from 'lucide-react'

import { useUnidade } from '@/contexts/UnidadeContext'
import { PAPEL_DESCRIPTION, PAPEL_LABEL } from '@/lib/constants'
import type { Papel } from '@/types/database'
import { TituloPagina, Vazio } from '@/components/monitor/Pagina'

// Os papéis novos (ADR 0008) existem no banco desde a Fase 1, mas as telas
// deles chegam com as fases que criam as tabelas de cada um. Até lá o papel
// entra, vê o que está por vir e não recebe tela com dado de demonstração.

const QUANDO: Partial<Record<Papel, string>> = {
  telemedicina: 'Fase 7 — teleinterconsulta de apoio ao plantonista.',
}

export default function PapelEmPreparo() {
  const { papelAtivo } = useUnidade()
  const papel = papelAtivo ?? undefined
  return (
    <>
      <TituloPagina
        icone={Hourglass}
        titulo={papel ? PAPEL_LABEL[papel] : 'Seu papel'}
        descricao={papel ? PAPEL_DESCRIPTION[papel] : undefined}
      />
      <Vazio
        icone={Hourglass}
        titulo="As telas deste papel ainda estão sendo construídas"
        texto={papel && QUANDO[papel] ? `Chegam na ${QUANDO[papel]}` : 'Chegam nas próximas fases do plano.'}
      />
    </>
  )
}
