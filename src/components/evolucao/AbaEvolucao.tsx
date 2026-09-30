// ─────────────────────────────────────────────────────────────────────────────
// AbaEvolucao — a aba Evolução do caderno do leito (protótipo: LEITO_ABAS
// "evol"). Três subabas — Resumo evoluções, Evolução médica, Histórico de
// evoluções — e, ao lado, o painel lateral de leitura do histórico (que some
// na subaba do histórico, onde a lista já está inteira). O formato de entrada
// é fixo: o caderno do leito importa daqui.
// ─────────────────────────────────────────────────────────────────────────────
import { Activity, FileText, History } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { EvolucaoMedica } from './EvolucaoMedica'
import { Historico, HistoricoLateral } from './Historico'
import { ResumoClinico } from './ResumoClinico'

export type AbaEvolucaoProps = { pacienteId: string; internacaoId: string }

type Sub = 'resumo' | 'medica' | 'historico'
const SUBS: { id: Sub; rotulo: string; Icone: typeof Activity }[] = [
  { id: 'resumo', rotulo: 'Resumo evoluções', Icone: Activity },
  { id: 'medica', rotulo: 'Evolução médica', Icone: FileText },
  { id: 'historico', rotulo: 'Histórico de evoluções', Icone: History },
]

export function AbaEvolucao({ pacienteId, internacaoId }: AbaEvolucaoProps) {
  const [sub, setSub] = React.useState<Sub>('resumo')
  return (
    <div className="flex flex-col">
      <div role="tablist" aria-label="Evolução" className="mb-3.5 flex flex-wrap gap-1.5">
        {SUBS.map(({ id, rotulo, Icone }) => (
          <button key={id} type="button" role="tab" aria-selected={sub === id} onClick={() => setSub(id)}
            className={cn('inline-flex min-h-10 items-center gap-[7px] rounded-controle border px-3.5 py-2 text-controle',
              sub === id ? 'border-acao bg-acao font-medium text-white' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao')}>
            <Icone className="size-[15px]" aria-hidden /> {rotulo}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-start gap-3.5">
        <div role="tabpanel" className="flex min-w-0 flex-[3_1_520px] flex-col gap-3.5">
          {sub === 'resumo' && <ResumoClinico pacienteId={pacienteId} internacaoId={internacaoId} />}
          {sub === 'medica' && <EvolucaoMedica pacienteId={pacienteId} internacaoId={internacaoId} />}
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
