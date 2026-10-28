// ─────────────────────────────────────────────────────────────────────────────
// AbaEvolucao — a aba Evolução do caderno do leito (protótipo: LEITO_ABAS
// "evol"). Quatro subabas — Resumo evoluções, Evolução médica, Diagnóstico e
// Histórico de evoluções — e, ao lado, o painel lateral de leitura do
// histórico (que some na subaba do histórico, onde a lista já está inteira).
// O Diagnóstico era aba própria do leito e passou para cá (ponto 9 do
// plantonista, opção A do RT em 28/10/2026). O formato de entrada é fixo: o
// caderno do leito importa daqui.
// ─────────────────────────────────────────────────────────────────────────────
import { Activity, ClipboardList, FileText, History } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AbaDiagnostico } from '@/components/internacao/caderno/Diagnostico'
import type { Acao } from '@/components/internacao/caderno/comum'
import { EvolucaoMedica } from './EvolucaoMedica'
import { Historico, HistoricoLateral } from './Historico'
import { ResumoClinico } from './ResumoClinico'

export type SubEvolucao = 'resumo' | 'medica' | 'diagnostico' | 'historico'

export type AbaEvolucaoProps = {
  pacienteId: string
  internacaoId: string
  /** O que a subaba Diagnóstico precisa (a mesma peça da antiga aba do leito). */
  diagnostico: { podeEditar: boolean; acao: Acao; onAbrirNotificacao: () => void }
  /** Leitura (gestor, leito depois da alta): sem a subaba de escrever a evolução. */
  somenteLeitura?: boolean
  subInicial?: SubEvolucao
}

const SUBS: { id: SubEvolucao; rotulo: string; Icone: typeof Activity }[] = [
  { id: 'resumo', rotulo: 'Resumo evoluções', Icone: Activity },
  { id: 'medica', rotulo: 'Evolução médica', Icone: FileText },
  { id: 'diagnostico', rotulo: 'Diagnóstico', Icone: ClipboardList },
  { id: 'historico', rotulo: 'Histórico de evoluções', Icone: History },
]

export function AbaEvolucao({ pacienteId, internacaoId, diagnostico, somenteLeitura = false, subInicial }: AbaEvolucaoProps) {
  const subs = somenteLeitura ? SUBS.filter((s) => s.id !== 'medica') : SUBS
  const [sub, setSub] = React.useState<SubEvolucao>(() =>
    subInicial && subs.some((s) => s.id === subInicial) ? subInicial : 'resumo')
  return (
    <div className="flex flex-col">
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
      <div className="flex flex-wrap items-start gap-3.5">
        <div role="tabpanel" className="flex min-w-0 flex-[3_1_520px] flex-col gap-3.5">
          {sub === 'resumo' && <ResumoClinico pacienteId={pacienteId} internacaoId={internacaoId} />}
          {sub === 'medica' && <EvolucaoMedica pacienteId={pacienteId} internacaoId={internacaoId} />}
          {sub === 'diagnostico' && (
            <AbaDiagnostico internacaoId={internacaoId} podeEditar={diagnostico.podeEditar} acao={diagnostico.acao}
              onAbrirNotificacao={diagnostico.onAbrirNotificacao} />
          )}
          {sub === 'historico' && <Historico internacaoId={internacaoId} />}
        </div>
        {sub !== 'historico' && (
          <div className="min-w-0 flex-[1_1_260px]">
            <HistoricoLateral internacaoId={internacaoId} aoVerTudo={() => setSub('historico')} />
          </div>
        )}
      </div>
    </div>
  )
}
