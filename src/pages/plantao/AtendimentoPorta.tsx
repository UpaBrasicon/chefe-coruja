import { Stethoscope } from 'lucide-react'
import * as React from 'react'

import { TituloPagina } from '@/components/monitor/Pagina'

import { FilaPS } from './porta/FilaPS'
import { JanelaAtendimento } from './porta/JanelaAtendimento'
import type { EpFila } from './porta/comum'

// Atendimento médico no Pronto-Socorro (Fase 2.4, porte do protótipo): a fila
// médica (cor → 80+ → prioridade legal → espera), "Em atendimento" à parte,
// "Saídas do plantão" e a janela do atendimento em abas. Nada aqui sugere
// cor ou conduta (ADR 0007). As peças moram em ./porta/.

export default function AtendimentoPorta() {
  const [atual, setAtual] = React.useState<EpFila | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)

  if (atual) {
    return (
      <JanelaAtendimento
        key={atual.id}
        ep={atual}
        onFechar={(texto) => { setAviso(texto ?? null); setAtual(null) }}
      />
    )
  }

  return (
    <>
      <TituloPagina icone={Stethoscope} titulo="Pronto Socorro" descricao="Pacientes triados por prioridade · chamar e atender. A cor manda; 80+ e prioridade legal só desempatam dentro da mesma cor." />
      <FilaPS aviso={aviso} onAbrir={(e) => { setAviso(null); setAtual(e) }} />
    </>
  )
}
