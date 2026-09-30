// Aba "Prescrição" (protótipo, "Prescrição do Pronto Socorro"): dose única ou
// para fazer aqui; vai para a checagem da enfermagem. Situação de cada item
// vem da checagem (quem checa é a enfermagem, não o médico). Nada se apaga:
// suspender pede motivo. Dose sempre escrita pelo médico.
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Ban, Pill } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResumoAlergias } from '@/components/paciente/AlergiasEventos'
import { NovoItem } from '@/components/prescricao/PrescricaoEstruturada'

import { hora, type ItemPS } from './comum'

function Situacao({ i }: { i: ItemPS }) {
  let tom = 'bg-alerta-atencao text-atencao'
  let texto = `Prescrito ${hora(i.criado_em)}`
  if (i.suspenso_em) { tom = 'bg-trilha text-tinta-sussurro'; texto = `Suspenso ${hora(i.suspenso_em)}` }
  else if (i.checagem?.situacao === 'feito') { tom = 'bg-alerta-conforme text-conforme'; texto = `Administrado ${hora(i.checagem.em)}${i.checagem.por ? ` · ${i.checagem.por}` : ''}` }
  else if (i.checagem) { tom = 'bg-alerta-critico text-critico'; texto = `${i.checagem.situacao === 'recusado' ? 'Recusado' : 'Não feito'} ${hora(i.checagem.em)}` }
  return <span className={cn('rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold whitespace-nowrap', tom)}>{texto}</span>
}

function Linha({ i, n, aoMudar }: { i: ItemPS; n: number; aoMudar: () => void }) {
  const [suspendendo, setSuspendendo] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  return (
    <div className={cn('flex flex-col gap-1.5 border-b border-trilha px-4 py-3 last:border-0', i.suspenso_em && 'opacity-70')}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-5 text-apoio tabular-nums text-tinta-sussurro">{n}.</span>
        <div className="flex min-w-0 flex-[1_1_220px] flex-col">
          <span className={cn('text-controle font-medium text-tinta', i.suspenso_em && 'line-through')}>{i.descricao}</span>
          <span className="text-apoio text-tinta-sussurro">
            {i.tipo === 'medicamento'
              ? [i.dose, i.via, i.se_necessario ? 'Se necessário' : i.posologia].filter(Boolean).join(' · ')
              : 'cuidado'}
            {i.autor && ` · ${i.autor}`}
          </span>
          {i.checagem && i.checagem.situacao !== 'feito' && i.checagem.motivo && <span className="text-rotulo text-critico">Motivo: {i.checagem.motivo}</span>}
          {i.suspenso_em && i.motivo_suspensao && <span className="text-rotulo text-tinta-sussurro">Suspenso: {i.motivo_suspensao}</span>}
        </div>
        <Situacao i={i} />
        {!i.suspenso_em && !suspendendo && (
          <Button size="xs" variant="ghost" onClick={() => setSuspendendo(true)}><Ban /> Suspender</Button>
        )}
      </div>
      {suspendendo && (
        <div className="flex flex-wrap gap-2 pl-8">
          <Input className="h-8 min-w-48 flex-1" placeholder="Por que suspende" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Button size="sm" variant="outline" disabled={motivo.trim().length < 5} onClick={async () => {
            const { error } = await supabase.rpc('suspender_item', { p_item: i.id, p_motivo: motivo })
            if (error) return setErro(error.message)
            setErro(null); setSuspendendo(false); aoMudar()
          }}>Suspender</Button>
          <Button size="sm" variant="ghost" onClick={() => setSuspendendo(false)}>Voltar</Button>
          {erro && <p className="w-full text-apoio text-critico">{erro}</p>}
        </div>
      )}
    </div>
  )
}

export function AbaPrescricao({ pacienteId, nome, itens, pediatrico, aoMudar }: {
  pacienteId: string; nome: string; itens: ItemPS[]; pediatrico: boolean; aoMudar: () => void
}) {
  const [erro, setErro] = React.useState<string | null>(null)
  const peso = useQuery({
    queryKey: ['peso-atual', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('observacao').select('valor_num, aferido_em, conceito!inner(nome)')
        .eq('paciente_id', pacienteId).eq('conceito.nome', 'peso').order('aferido_em', { ascending: false }).limit(1)
      if (error) throw error
      return (data?.[0] ?? null) as { valor_num: number; aferido_em: string } | null
    },
  })
  const ativos = itens.filter((i) => !i.suspenso_em)
  const suspensos = itens.filter((i) => i.suspenso_em)
  return (
    <div className="flex flex-col gap-4">
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-container border border-critico/30 bg-alerta-critico px-3.5 py-2.5 text-apoio text-critico">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {erro}
        </p>
      )}
      <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-4 py-3">
          <Pill className="size-4 text-acao" aria-hidden />
          <span className="text-controle font-semibold text-tinta">Prescrição do Pronto Socorro</span>
          <span className="text-apoio text-tinta-sussurro">Dose única ou para fazer aqui. Vai para a checagem da enfermagem.</span>
        </div>
        <div className="px-4 pt-3"><ResumoAlergias pacienteId={pacienteId} nome={nome} /></div>
        {ativos.length === 0 && <p className="px-4 py-4 text-apoio text-tinta-sussurro">Nada prescrito no PS.</p>}
        {ativos.map((i, n) => <Linha key={i.id} i={i} n={n + 1} aoMudar={aoMudar} />)}
        {suspensos.length > 0 && (
          <details className="border-t border-trilha px-4 py-2 text-apoio text-tinta-sussurro">
            <summary className="cursor-pointer">Suspensos ({suspensos.length})</summary>
            {suspensos.map((i, n) => <Linha key={i.id} i={i} n={n + 1} aoMudar={aoMudar} />)}
          </details>
        )}
        <p className="border-t border-trilha px-4 py-2 text-rotulo text-tinta-sussurro">
          "Administrado" é a checagem da enfermagem, com o nome de quem checou. A alta após medicação espera a checagem.
        </p>
      </section>
      <NovoItem pacienteId={pacienteId} peso={peso.data} porta pediatrico={pediatrico}
        aoMudar={() => { void peso.refetch(); aoMudar() }} aoErro={setErro} />
    </div>
  )
}
