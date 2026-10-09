import { useMutation, useQuery } from '@tanstack/react-query'
import { ExternalLink, History, Lock } from 'lucide-react'
import * as React from 'react'

import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import type { CorRisco } from '@/domain/risco'
import { motivoValido, rotuloDesfechoFinal, type HistoricoEncerrado as Dados } from '@/lib/historico'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Histórico encerrado no prontuário (Fase 1, tarefa 8 do BACKLOG). Quem cuida
// do paciente agora vê o resumo dos atendimentos encerrados nesta unidade
// (data, setor, cor, CID, desfecho, médico), sem pedido ao gestor. O detalhe
// abre com motivo escrito, só leitura, por 12 horas; quem, quando e o motivo
// ficam no registro de acesso (migration 20261030000002).

const dataCurta = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export function HistoricoEncerrado({ pacienteId, className }: { pacienteId: string; className?: string }) {
  const [pedindo, setPedindo] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const [tentou, setTentou] = React.useState(false)

  const historico = useQuery({
    queryKey: ['historico-encerrado', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('historico_encerrado', { p_paciente: pacienteId })
      if (error) throw error
      const d = data as unknown as Dados
      // o prazo do detalhe é conferido na leitura (nunca durante a renderização)
      return { ...d, liberado: !!d.detalhe_liberado_ate && new Date(d.detalhe_liberado_ate).getTime() > Date.now() }
    },
    retry: false,
  })

  const abrir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('abrir_historico_encerrado', { p_paciente: pacienteId, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setPedindo(false)
      setMotivo('')
      void historico.refetch()
      abrirLeitura()
    },
  })

  // o detalhe abre em outra aba: o atendimento e o rascunho continuam aqui
  function abrirLeitura() {
    window.open(`/prontuarios/${pacienteId}`, '_blank', 'noopener')
  }

  if (historico.isLoading) return <div className={cn('px-5 py-4', className)}><Spinner /></div>
  // sem acesso (não cuida do paciente agora): o cartão não aparece; fica o pedido ao gestor
  if (historico.error || !historico.data) return null
  const d = historico.data
  const liberado = d.liberado

  return (
    <section aria-label="Histórico na unidade" className={cn('overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-trilha px-5 py-3">
        <h3 className="flex items-center gap-2 text-corpo font-semibold text-tinta">
          <History className="size-4 text-tinta-sussurro" aria-hidden /> Histórico na unidade
          <span className="text-apoio font-normal text-tinta-sussurro">· {d.atendimentos.length} atendimento{d.atendimentos.length === 1 ? '' : 's'} encerrado{d.atendimentos.length === 1 ? '' : 's'}</span>
        </h3>
        {d.atendimentos.length > 0 && (liberado ? (
          <Button size="sm" variant="outline" onClick={abrirLeitura}>
            <ExternalLink /> Ver detalhe · liberado até {new Date(d.detalhe_liberado_ate!).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
          </Button>
        ) : d.pode_abrir_detalhe ? (
          <Button size="sm" variant="outline" onClick={() => { setPedindo(true); setTentou(false); abrir.reset() }}>
            <Lock /> Ver detalhe (com motivo)
          </Button>
        ) : null)}
      </div>
      {d.atendimentos.length === 0 ? (
        <p className="px-5 py-3.5 text-apoio text-tinta-sussurro">Nenhum atendimento encerrado nesta unidade.</p>
      ) : (
        <ul className="max-h-[320px] overflow-y-auto">
          {d.atendimentos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-trilha px-5 py-2.5 last:border-0">
              <span className="w-[86px] flex-none text-apoio font-medium tabular-nums text-tinta">{dataCurta(a.chegada_em)}</span>
              <span className="min-w-[120px] flex-1 text-apoio text-tinta-apoio">{a.setor}{a.medico ? ` · ${a.medico}` : ''}</span>
              <PilulaRisco cor={(a.cor as CorRisco | null) ?? null} />
              <span className="w-[72px] text-apoio font-medium tabular-nums text-tinta">{a.cid ?? 'sem CID'}</span>
              <span className="w-[140px] text-apoio text-tinta-apoio">{rotuloDesfechoFinal(a.desfecho)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-trilha px-5 py-2 text-rotulo text-tinta-sussurro">
        Resumo sem texto clínico. Evoluções, prescrições e documentos abrem com motivo, só leitura, e ficam no registro de acesso.
      </p>

      <Dialog open={pedindo} onOpenChange={setPedindo}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-dialogo">Ver o detalhe do histórico</DialogTitle>
            <DialogDescription className="text-controle">
              Abre os atendimentos encerrados deste paciente, só para leitura, por 12 horas. O motivo fica registrado com o seu nome e o gestor da unidade vê na Auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`motivo-hist-${pacienteId}`}>Motivo</Label>
            <Textarea id={`motivo-hist-${pacienteId}`} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: comparar com a internação anterior por pneumonia" aria-invalid={tentou && !motivoValido(motivo)} />
            <span className={cn('text-rotulo', tentou && !motivoValido(motivo) ? 'text-critico' : 'text-tinta-sussurro')}>Mínimo de 10 letras.</span>
          </div>
          {abrir.error && <p role="alert" className="text-apoio text-critico">{(abrir.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPedindo(false)}>Cancelar</Button>
            <Button disabled={abrir.isPending} onClick={() => { setTentou(true); if (motivoValido(motivo)) abrir.mutate() }}>
              <ExternalLink /> Abrir o detalhe
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
