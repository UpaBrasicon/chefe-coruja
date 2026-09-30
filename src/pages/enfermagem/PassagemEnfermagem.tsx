// ─────────────────────────────────────────────────────────────────────────────
// Passagem de plantão da enfermagem, do setor, leito a leito.
//
// Diferente da médica (por paciente, para um colega nomeado, com aceite): a
// da enfermagem é um registro do SETOR. Quem sai ENTREGA a passagem de cada
// paciente do setor (todos; nenhum fica sem) e, se quiser, uma observação
// geral (material em falta, intercorrências do setor). O banco guarda junto,
// em cada leito, o retrato das pendências do turno (aprazamentos atrasados);
// quem assume o setor RECEBE, dando ciência. Nada se apaga nem se reescreve.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Inbox } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Chip, Chips } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import { PILULA, hora, msgErro, quando, usePendenciasEnfermagem, type PassagemEnfermagem as Passagem } from './useEnfermagem'

const TURNO: Record<string, string> = { manha: 'manhã', tarde: 'tarde', noite: 'noite', diurno: 'diurno', noturno: 'noturno' }
type PacienteDoSetor = { paciente_id: string; nome: string; local: string | null }

export function PassagemEnfermagem({ setores }: { setores: { id: string; nome: string }[] }) {
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const [setorSel, setSetorSel] = React.useState<string | null>(null)
  const setor = setores.find((s) => s.id === setorSel) ?? setores[0] ?? null
  // texto de cada leito, pela chave do paciente
  const [notas, setNotas] = React.useState<Record<string, string>>({})
  const [geral, setGeral] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [enviando, setEnviando] = React.useState(false)

  const passagens = useQuery({
    queryKey: ['passagens-enfermagem', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('passagens_enfermagem_do_plantao', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as unknown as Passagem[]
    },
  })
  const pacientes = useQuery({
    queryKey: ['enfermagem-pacientes-do-setor', setor?.id],
    enabled: !!setor,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('enfermagem_pacientes_do_setor', { p_setor: setor!.id })
      if (error) throw error
      return (data ?? []) as PacienteDoSetor[]
    },
  })
  const pendencias = usePendenciasEnfermagem()

  if (!setor) return null
  const doSetor = (passagens.data ?? []).filter((p) => p.setor_id === setor.id)
  const aReceber = doSetor.filter((p) => !p.recebida_em && p.entregue_por !== perfil?.id)
  const historico = doSetor.filter((p) => !aReceber.includes(p)).slice(0, 6)
  const leitos = pacientes.data ?? []
  const pendDe = (pacienteId: string) => (pendencias.data ?? []).filter((p) => p.paciente_id === pacienteId)
  const escritos = leitos.filter((l) => (notas[l.paciente_id] ?? '').trim().length >= 3).length
  const pronta = leitos.length > 0 ? escritos === leitos.length : geral.trim().length >= 10

  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['passagens-enfermagem'] })
    void qc.invalidateQueries({ queryKey: ['enfermagem-pacientes-do-setor'] })
  }

  async function entregar() {
    if (!pronta || !setor) return
    setEnviando(true)
    const { error } = await supabase.rpc('entregar_passagem_enfermagem', {
      p_setor: setor.id,
      p_leitos: leitos.map((l) => ({ paciente_id: l.paciente_id, texto: (notas[l.paciente_id] ?? '').trim() })),
      p_texto: geral.trim(),
    })
    setEnviando(false)
    if (error) { recarregar(); return setErro(msgErro(error)) }
    setErro(null); setNotas({}); setGeral(''); recarregar()
  }

  async function receber(id: string) {
    const { error } = await supabase.rpc('receber_passagem_enfermagem', { p_passagem: id })
    if (error) return setErro(msgErro(error))
    setErro(null); recarregar()
  }

  return (
    <section className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-5 py-[18px] shadow-repouso">
      <h2 className="text-corpo font-semibold text-tinta">Passagem de plantão da enfermagem</h2>
      {setores.length > 1 && (
        <Chips rotulo="Setor da passagem">
          {setores.map((s) => <Chip key={s.id} ativo={s.id === setor.id} onClick={() => setSetorSel(s.id)}>{s.nome}</Chip>)}
        </Chips>
      )}
      {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}

      {aReceber.map((p) => (
        <div key={p.id} className="flex flex-col gap-2 rounded-container border border-atencao/30 bg-alerta-atencao px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Inbox className="size-4 text-atencao" aria-hidden />
            <span className="text-apoio font-semibold text-atencao">A receber</span>
            <span className="text-apoio text-tinta-sussurro">
              {p.entregue_por_nome} · {quando(p.entregue_em)}{p.turno ? ` · ${TURNO[p.turno] ?? p.turno}` : ''}
            </span>
          </div>
          <LeitosDaPassagem p={p} />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => void receber(p.id)}><Check /> Receber passagem</Button>
          </div>
        </div>
      ))}

      <div className="flex flex-col">
        <span className="rotulo text-tinta-sussurro">Leito a leito</span>
        {!pacientes.isLoading && leitos.length === 0 && (
          <span className="py-2 text-apoio text-tinta-sussurro">Nenhum paciente no setor agora: registre a observação geral.</span>
        )}
        {leitos.map((l) => {
          const pend = pendDe(l.paciente_id)
          return (
            <div key={l.paciente_id} className="flex flex-col gap-1.5 border-b border-trilha py-2.5 last:border-0">
              <span className="text-controle text-tinta">
                <span className="font-semibold text-acao">{l.local ?? '—'}</span> · {l.nome}
              </span>
              {pend.map((x) => (
                <span key={`${x.item_id}-${x.horario}`} className="text-apoio text-tinta-apoio">
                  <span className="font-semibold text-critico tabular-nums">{x.horario}</span> · {x.descricao}
                </span>
              ))}
              <Textarea rows={2} aria-label={`Passagem de ${l.local ?? ''} ${l.nome}`} value={notas[l.paciente_id] ?? ''}
                onChange={(e) => setNotas((n) => ({ ...n, [l.paciente_id]: e.target.value }))}
                placeholder="Estado, cuidados em curso, o que ficou pendente" />
            </div>
          )
        })}
      </div>

      <Textarea value={geral} onChange={(e) => setGeral(e.target.value)} rows={2} aria-label="Observação geral do setor"
        placeholder={leitos.length > 0 ? 'Observação geral do setor (opcional): material em falta, intercorrências' : 'Observação geral do setor: material em falta, intercorrências'} />
      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-apoio text-tinta-sussurro">
          {leitos.length > 0 ? `${escritos} de ${leitos.length} leitos escritos. ` : ''}As pendências de cada leito vão junto, como estão agora.
        </span>
        <Button size="sm" disabled={!pronta || enviando} onClick={() => void entregar()}><Check /> Registrar passagem</Button>
      </div>

      {historico.map((p) => (
        <details key={p.id} className="border-t border-trilha py-2.5">
          <summary className="flex cursor-pointer flex-col gap-1">
            <span className="text-rotulo text-tinta-sussurro">
              {p.entregue_por_nome} · {quando(p.entregue_em)}{p.turno ? ` · ${TURNO[p.turno] ?? p.turno}` : ''}
              {p.leitos.length > 0 ? ` · ${p.leitos.length} ${p.leitos.length === 1 ? 'leito' : 'leitos'}` : ''}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {p.recebida_em
                ? <span className={cn(PILULA, 'bg-alerta-conforme text-conforme')}>Recebida por {p.recebida_por_nome} às {hora(p.recebida_em)}</span>
                : <span className={cn(PILULA, 'bg-trilha text-tinta-apoio')}>Aguardando quem assume</span>}
              {p.pendencias.length > 0 && (
                <span className={cn(PILULA, 'bg-alerta-critico text-critico')}>
                  {p.pendencias.length} {p.pendencias.length === 1 ? 'pendência' : 'pendências'} na entrega
                </span>
              )}
            </div>
          </summary>
          <div className="mt-2"><LeitosDaPassagem p={p} /></div>
        </details>
      ))}
    </section>
  )
}

/** O que foi entregue: cada leito com o seu texto e pendências, e a observação geral. */
function LeitosDaPassagem({ p }: { p: Passagem }) {
  return (
    <div className="flex flex-col gap-2">
      {p.leitos.map((l) => (
        <div key={l.paciente_id} className="flex flex-col gap-0.5">
          <span className="text-apoio text-tinta">
            <span className="font-semibold text-acao">{l.local ?? '—'}</span> · {l.nome}
          </span>
          <span className="text-controle leading-[1.5] text-tinta [text-wrap:pretty]">{l.texto}</span>
          {l.pendencias.map((x) => (
            <span key={`${x.descricao}-${x.horario}`} className="text-apoio text-tinta-apoio">
              <span className="font-semibold text-critico tabular-nums">{x.horario}</span> · {x.descricao}
            </span>
          ))}
        </div>
      ))}
      {p.texto && (
        <div className="flex flex-col gap-0.5">
          {p.leitos.length > 0 && <span className="rotulo text-tinta-sussurro">Geral do setor</span>}
          <span className="text-controle leading-[1.5] text-tinta [text-wrap:pretty]">{p.texto}</span>
        </div>
      )}
    </div>
  )
}
