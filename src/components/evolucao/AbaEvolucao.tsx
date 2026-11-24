// ─────────────────────────────────────────────────────────────────────────────
// AbaEvolucao — a aba Evolução do caderno do leito (protótipo: LEITO_ABAS
// "evol"). EV1 (revisão da Internação, RT 24/11/2026): duas subabas, "Evoluir
// hoje" e "Histórico". O "Resumo evoluções" foi para o Resumo do leito (como
// "Resumo do caso"); o Diagnóstico entrou no formulário (EV3, um lugar só); o
// painel lateral que repetia o histórico saiu. O formato de entrada é fixo: o
// caderno do leito importa daqui.
// ─────────────────────────────────────────────────────────────────────────────
import { FileText, History } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Acao } from '@/components/internacao/caderno/comum'
import { EvolucaoMedica } from './EvolucaoMedica'
import { Historico } from './Historico'

export type SubEvolucao = 'hoje' | 'historico'

export type AbaEvolucaoProps = {
  pacienteId: string
  internacaoId: string
  /** O diagnóstico dentro do formulário (a mesma peça da antiga aba do leito). */
  diagnostico: { podeEditar: boolean; acao: Acao; onAbrirNotificacao: () => void }
  /** Leitura (gestor, leito depois da alta): só o histórico. */
  somenteLeitura?: boolean
  subInicial?: SubEvolucao
  /** MA1: a ficha de admissão (corrigir, reavaliação do quadro) abre do histórico. */
  onAbrirAdmissao?: () => void
}

const SUBS: { id: SubEvolucao; rotulo: string; Icone: typeof History }[] = [
  { id: 'hoje', rotulo: 'Evoluir hoje', Icone: FileText },
  { id: 'historico', rotulo: 'Histórico', Icone: History },
]

export function AbaEvolucao({ pacienteId, internacaoId, diagnostico, somenteLeitura = false, subInicial, onAbrirAdmissao }: AbaEvolucaoProps) {
  const subs = somenteLeitura ? SUBS.filter((s) => s.id !== 'hoje') : SUBS
  const [sub, setSub] = React.useState<SubEvolucao>(() =>
    subInicial && subs.some((s) => s.id === subInicial) ? subInicial : subs[0].id)
  return (
    <div className="flex flex-col">
      {subs.length > 1 && (
        <div role="tablist" aria-label="Evolução" className="mb-3.5 flex flex-wrap gap-1.5">
          {subs.map(({ id, rotulo, Icone }) => (
            // Subaba com ícone: o Button no papel de aba (a peça Abas não leva ícone).
            <Button key={id} role="tab" aria-selected={sub === id} onClick={() => setSub(id)}
              variant={sub === id ? 'default' : 'outline'}
              className={cn('min-h-10 px-3.5 py-2 text-controle', sub === id && 'border-acao')}>
              <Icone className="size-[15px]" aria-hidden /> {rotulo}
            </Button>
          ))}
        </div>
      )}
      <div role="tabpanel" className="flex min-w-0 flex-col gap-3.5">
        {sub === 'hoje' && <EvolucaoMedica pacienteId={pacienteId} internacaoId={internacaoId} diagnostico={diagnostico} />}
        {sub === 'historico' && <Historico internacaoId={internacaoId} onAbrirAdmissao={onAbrirAdmissao} />}
      </div>
    </div>
  )
}
