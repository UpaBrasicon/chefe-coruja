// ─────────────────────────────────────────────────────────────────────────────
// Encaminhamentos recebidos (protótipo, fila do PS: "Deseja aceitar o
// encaminhamento?"). Para quem recebe: os pendentes que posso responder (sou o
// médico de destino, ou estou com o paciente no plantão e não fui eu quem
// encaminhou) e os que aceitei e ainda não marquei como atendidos.
//   • Sim, aceitar — assume o atendimento.
//   • Não aceitar — justificativa de 10 letras ou mais.
//   • Acessar o paciente — abre sem decidir (quem usa passa onAcessar).
// A tela do PS pode usar depois; aqui não se pluga em tela nenhuma.
// ─────────────────────────────────────────────────────────────────────────────
import { ArrowRightLeft } from 'lucide-react'
import * as React from 'react'

import { idadeEm } from '@/domain/idade'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

import { msg, quando, useEncaminhamentosRecebidos, useRecarregarEncaminhamentos, type EncaminhamentoRecebido } from './useEncaminhamentos'

export type EncaminhamentosRecebidosProps = {
  /** "Acessar o paciente": quem usa decide para onde vai. Sem ela, o botão não aparece. */
  onAcessar?: (e: EncaminhamentoRecebido) => void
  /** Texto quando não há nada (null esconde o componente vazio). */
  vazio?: string | null
  className?: string
}

function idadeTexto(nasc: string | null) {
  if (!nasc) return null
  const i = idadeEm(nasc, new Date())
  if (!i) return null
  return i.anos >= 2 ? `${i.anos} anos` : i.anos === 1 ? `1 ano e ${i.meses} m` : `${i.meses} m ${i.dias} d`
}

export function EncaminhamentosRecebidos({ onAcessar, vazio = 'Nenhum encaminhamento para você.', className }: EncaminhamentosRecebidosProps) {
  const q = useEncaminhamentosRecebidos()
  const recarregar = useRecarregarEncaminhamentos()
  const [recusando, setRecusando] = React.useState<string | null>(null)
  const [just, setJust] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)

  const executar = async (fn: () => PromiseLike<{ error: unknown }>, ok: string) => {
    setOcupado(true)
    try {
      const { error } = await fn()
      if (error) { setErro(msg(error)); setAviso(null); return false }
      setErro(null); setAviso(ok); recarregar(); return true
    } finally { setOcupado(false) }
  }

  if (q.isLoading) return <div className="flex justify-center py-4"><Spinner /></div>
  if (q.error) return <p className="text-apoio text-critico">{msg(q.error)}</p>
  const itens = q.data ?? []
  if (itens.length === 0 && vazio === null) return null

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {erro && <p role="alert" className="rounded-controle border border-critico/30 bg-alerta-critico p-2.5 text-apoio text-critico">{erro}</p>}
      {aviso && <p role="status" className="rounded-controle border border-conforme/30 bg-alerta-conforme p-2.5 text-apoio text-conforme">{aviso}</p>}
      {itens.length === 0 && <span className="text-apoio text-tinta-sussurro">{vazio}</span>}
      {itens.map((e) => {
        const idade = idadeTexto(e.data_nascimento)
        return (
          <div key={e.id} className="flex flex-col gap-1.5 rounded-controle border border-pediatria/25 bg-pediatria/5 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <ArrowRightLeft className="size-3.5 text-pediatria" aria-hidden />
              <span className="text-controle font-semibold text-tinta">{e.paciente}</span>
              {(idade || e.sexo) && <span className="text-rotulo text-tinta-sussurro">{[idade, e.sexo].filter(Boolean).join(' · ')}</span>}
            </div>
            <span className="text-apoio text-pediatria [text-wrap:pretty]">
              {e.estado === 'pendente'
                ? `Encaminhado para ${[e.especialidade, e.medico_destino, e.servico].filter(Boolean).join(' · ')} por ${e.encaminhado_por ?? '—'} em ${quando(e.encaminhado_em)}. Deseja aceitar o encaminhamento?`
                : `Você aceitou em ${quando(e.respondido_em)} (${e.especialidade}). Marque como atendido quando terminar.`}
            </span>
            <span className="text-apoio text-tinta-apoio [text-wrap:pretty]">{e.justificativa}</span>
            <div className="flex flex-wrap gap-1.5">
              {e.estado === 'pendente' && e.posso_responder && (
                <>
                  <Button size="sm" className="bg-pediatria hover:bg-pediatria/90" disabled={ocupado}
                    onClick={() => void executar(() => supabase.rpc('aceitar_encaminhamento', { p_encaminhamento: e.id }),
                      `Encaminhamento aceito: você assumiu o atendimento de ${e.paciente}.`)}>
                    Sim, aceitar
                  </Button>
                  <Button size="sm" variant="outline" disabled={ocupado} onClick={() => { setRecusando(e.id); setJust('') }}>Não aceitar</Button>
                </>
              )}
              {e.sou_quem_aceitou && (
                <Button size="sm" variant="outline" disabled={ocupado}
                  onClick={() => void executar(() => supabase.rpc('concluir_encaminhamento', { p_encaminhamento: e.id }), 'Encaminhamento marcado como atendido.')}>
                  Marcar como atendido
                </Button>
              )}
              {onAcessar && <Button size="sm" variant="outline" onClick={() => onAcessar(e)}>Acessar o paciente</Button>}
            </div>
            {recusando === e.id && (
              <div className="flex flex-col gap-1.5">
                <Textarea rows={2} aria-label="Justificativa da rejeição" placeholder="Justificativa da rejeição (mínimo 10 caracteres)"
                  value={just} onChange={(ev) => setJust(ev.target.value)} />
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => setRecusando(null)}>Voltar</Button>
                  <Button size="sm" variant="destructive" disabled={just.trim().length < 10 || ocupado}
                    onClick={() => void executar(() => supabase.rpc('recusar_encaminhamento', { p_encaminhamento: e.id, p_motivo: just }),
                      'Encaminhamento recusado. A justificativa fica no histórico.').then((ok) => { if (ok) setRecusando(null) })}>
                    Confirmar recusa
                  </Button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
