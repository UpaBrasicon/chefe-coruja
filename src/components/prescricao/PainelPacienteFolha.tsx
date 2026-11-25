// Painel do paciente ao lado da folha de prescrição (PM5, modelo do RT de
// 24/11/2026): leito, situação, datas da internação, classificação e
// diagnóstico, com o que o leito já leu. Só mostra: a cor da classificação é da
// enfermagem (não se muda aqui). No celular, recolhido atrás do botão Paciente.
import { UserRound } from 'lucide-react'
import * as React from 'react'

import { dataHora } from '@/lib/formato'
import { cn } from '@/lib/utils'
import type { CorRisco } from '@/domain/risco'
import { Button } from '@/components/ui/button'
import { SeloClassificacao } from '@/components/paciente/CabecalhoPaciente'

export type ContextoPacienteFolha = {
  leito: string | null
  situacao: string
  internadoEm: string | null
  naUnidadeDesde: string | null
  cor: CorRisco | null
  diagnostico: string
}

export function PainelPacienteFolha({ contexto: c }: { contexto: ContextoPacienteFolha }) {
  const [aberto, setAberto] = React.useState(false)
  return (
    <aside aria-label="Paciente" className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-3">
      <Button size="sm" variant="outline" className="self-start lg:hidden" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>
        <UserRound aria-hidden /> Paciente
      </Button>
      <dl className={cn('flex-col gap-3 rounded-cartao border border-fio bg-superficie p-4 text-apoio lg:flex', aberto ? 'flex' : 'hidden')}>
        <Campo rotulo="Leito">{c.leito || 'Aguardando leito'}</Campo>
        <Campo rotulo="Situação">{c.situacao}</Campo>
        {c.internadoEm && <Campo rotulo="Internado em"><span className="tabular-nums">{dataHora(c.internadoEm)}</span></Campo>}
        {c.naUnidadeDesde && <Campo rotulo="Na unidade desde"><span className="tabular-nums">{dataHora(c.naUnidadeDesde)}</span></Campo>}
        <Campo rotulo="Classificação">{c.cor ? <SeloClassificacao cor={c.cor} /> : <span className="text-tinta-sussurro">Sem classificação da porta</span>}</Campo>
        <Campo rotulo="Diagnóstico">{c.diagnostico || <span className="text-atencao">Sem diagnóstico registrado</span>}</Campo>
      </dl>
    </aside>
  )
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-rotulo text-tinta-sussurro">{rotulo}</dt>
      <dd className="text-pretty text-tinta">{children}</dd>
    </div>
  )
}
