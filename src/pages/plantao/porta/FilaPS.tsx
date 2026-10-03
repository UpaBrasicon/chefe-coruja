// Fila médica do Pronto-Socorro (protótipo, "Pronto Socorro"): triados
// aguardando por cor e espera; "Em atendimento" à parte (com o estado "em
// reavaliação"); "Saídas do plantão" com os finalizados e excluídos do dia.
// A cor manda; 80+ e prioridade legal só desempatam dentro da mesma cor.
import { useQuery } from '@tanstack/react-query'
import { Check, Clock, LogOut, Stethoscope } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import { faixaEtaria, rotuloFaixa, rotuloIdade } from '@/domain/idade'
import { rotulosPrioridade } from '@/domain/prioridade'
import { ALVO_MIN, ordemMedica, type CorRisco } from '@/domain/risco'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { PilulaRisco } from '@/components/clinico/PilulaRisco'
import { BotaoChamar } from '@/components/porta/Chamada'
import { EncaminhamentosRecebidos } from '@/components/encaminhamento/EncaminhamentosRecebidos'
import { useChamadasPorEpisodio } from '@/hooks/useChamadas'

import { hoje, hora, minutos, nomeDe, rotuloDesfecho, useAgora, type EpFila } from './comum'

type Saida = {
  id: string; cor_atual: CorRisco | null; queixa: string; desfecho: string | null; desfecho_motivo: string | null
  desfecho_detalhes: Record<string, unknown> | null; desfecho_em: string | null; encerrado_em: string | null; desfecho_por: string | null
  paciente: { nome: string; nome_social: string | null; data_nascimento: string | null } | null
}

const MOTIVO_EXCLUSAO: Record<string, string> = { evasao: 'evasão', duplicada: 'ficha duplicada', engano: 'engano' }

const idadeDe = (p: { data_nascimento: string | null } | null) => (p?.data_nascimento ? rotuloIdade(p.data_nascimento, hoje()) : '')

function Pilula({ tom, children }: { tom: 'ambar' | 'verde' | 'teal' | 'cinza' | 'vermelho'; children: React.ReactNode }) {
  const t = {
    ambar: 'bg-alerta-atencao text-atencao', verde: 'bg-alerta-conforme text-conforme', teal: 'bg-alerta-marca text-acao',
    cinza: 'bg-trilha text-tinta-apoio', vermelho: 'bg-alerta-critico text-critico',
  }[tom]
  return <span className={cn('inline-flex items-center gap-1 self-start rounded-capsula px-2.5 py-[3px] text-rotulo font-semibold whitespace-nowrap', t)}>{children}</span>
}

function Bloco({ titulo, resumo, children }: { titulo?: string; resumo?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
      {titulo && <div className="border-b border-trilha px-5 py-3 text-apoio font-semibold text-tinta">{titulo}</div>}
      {resumo && <div className="border-b border-trilha px-5 py-3 text-apoio text-tinta-sussurro">{resumo}</div>}
      {children}
    </section>
  )
}

export function FilaPS({ aviso, onAbrir }: { aviso: string | null; onAbrir: (e: EpFila) => void }) {
  const { unidadeAtiva } = useUnidade()
  const agora = useAgora()

  const setores = useQuery({
    queryKey: ['setores-na-escala', unidadeAtiva?.unidade_id],
    enabled: !!unidadeAtiva,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('setores_na_escala_agora')
      if (error) throw error
      return (Array.isArray(data) ? data : []) as string[]
    },
  })
  const meusSetores = setores.data ?? []

  const fila = useQuery({
    queryKey: ['fila-medica', unidadeAtiva?.unidade_id, meusSetores],
    enabled: meusSetores.length > 0,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('episodios')
        .select('id, paciente_id, setor_id, cor_atual, classificado_em, chegada_em, queixa, publico, prioridades_legais, atendimento_iniciado_em, reavaliar_em, paciente:pacientes(nome, nome_social, data_nascimento)')
        .in('setor_id', meusSetores)
        .eq('etapa', 'atendimento')
      if (error) throw error
      return ((data ?? []) as unknown as EpFila[]).sort(ordemMedica)
    },
  })
  // finalizados e excluídos do dia (desde 0h de Brasília)
  const saidas = useQuery({
    queryKey: ['saidas-plantao', unidadeAtiva?.unidade_id, meusSetores],
    enabled: meusSetores.length > 0,
    refetchInterval: 60_000,
    queryFn: async () => {
      const desde = new Date(`${hoje()}T00:00:00-03:00`).toISOString()
      const { data, error } = await supabase
        .from('episodios')
        .select('id, cor_atual, queixa, desfecho, desfecho_motivo, desfecho_detalhes, desfecho_em, encerrado_em, desfecho_por, paciente:pacientes(nome, nome_social, data_nascimento)')
        .in('setor_id', meusSetores)
        .not('etapa', 'in', '(triagem,atendimento)')
        .not('desfecho', 'is', null)
        .or(`desfecho_em.gte.${desde},encerrado_em.gte.${desde}`)
        .limit(200)
      if (error) throw error
      const quando = (s: Saida) => Date.parse(s.desfecho_em ?? s.encerrado_em ?? '') || 0
      return ((data ?? []) as unknown as Saida[]).sort((a, b) => quando(b) - quando(a))
    },
  })

  const aguardando = (fila.data ?? []).filter((e) => !e.atendimento_iniciado_em)
  const emAtendimento = (fila.data ?? []).filter((e) => e.atendimento_iniciado_em)
  const setoresDaFila = [...new Set((fila.data ?? []).map((e) => e.setor_id))]
  const chamadas = useChamadasPorEpisodio(setoresDaFila, 'atendimento')

  const carregando = setores.isLoading || fila.isLoading
  const erro = setores.error ?? fila.error

  return (
    <div className="flex flex-col gap-3">
      {aviso && (
        <div role="status" className="flex items-center gap-2 rounded-container border border-marca/20 bg-alerta-marca px-4 py-3 text-controle text-acao">
          <Check className="size-4 shrink-0" aria-hidden /> {aviso}
        </div>
      )}
      {/* encaminhamentos internos para mim: antes ninguém podia aceitar (o componente não estava em tela nenhuma) */}
      <EncaminhamentosRecebidos vazio={null} />
      {erro && <p className="text-apoio text-critico">{(erro as Error).message}</p>}
      {!carregando && !erro && meusSetores.length === 0 && (
        <p className="rounded-container border border-fio bg-superficie px-5 py-4 text-apoio text-tinta-sussurro">
          Você não está na escala de nenhuma porta agora: a fila aparece para quem está de plantão.
        </p>
      )}

      <Bloco resumo={`${aguardando.length} ${aguardando.length === 1 ? 'paciente triado' : 'pacientes triados'} · por cor e tempo de espera`}>
        {carregando && <div className="px-5 py-4"><Spinner /></div>}
        {!carregando && aguardando.length === 0 && <p className="px-5 py-5 text-controle text-tinta-sussurro">Nenhum paciente triado aguardando.</p>}
        {aguardando.map((e) => {
          const min = Math.max(0, Math.round((agora - Date.parse(e.classificado_em)) / 60_000))
          const acima = min > ALVO_MIN[e.cor_atual]
          return (
            <div key={e.id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3 last:border-0">
              <PilulaRisco cor={e.cor_atual} />
              <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                <span className="text-corpo font-medium text-tinta">{nomeDe(e)} <span className="text-apoio font-normal text-tinta-sussurro">{idadeDe(e.paciente)}</span></span>
                <span className="text-apoio text-tinta-sussurro [text-wrap:pretty]">
                  {[e.queixa, e.prioridades_legais.length ? `Prioridade: ${rotulosPrioridade(e.prioridades_legais).join(', ')}` : '', rotuloFaixa(faixaEtaria(e.paciente?.data_nascimento, e.chegada_em))]
                    .filter(Boolean).join(' · ')}
                </span>
                <Pilula tom="cinza">Aguardando</Pilula>
              </div>
              <span className={cn('text-apoio whitespace-nowrap tabular-nums', acima ? 'font-semibold text-critico' : 'text-tinta-apoio')}>
                espera {minutos(e.classificado_em, agora)} · alvo {ALVO_MIN[e.cor_atual]} min
              </span>
              <div className="flex flex-wrap gap-2">
                <BotaoChamar episodioId={e.id} setorId={e.setor_id} etapa="atendimento" chamadas={chamadas.data?.get(e.id) ?? 0} />
                <Button size="sm" onClick={() => onAbrir(e)}><Stethoscope /> Abrir atendimento</Button>
              </div>
            </div>
          )
        })}
      </Bloco>

      {emAtendimento.length > 0 && (
        <Bloco titulo="Em atendimento">
          {emAtendimento.map((e) => {
            const reav = !!e.reavaliar_em
            const atrasada = reav && Date.parse(e.reavaliar_em!) < agora
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3 last:border-0">
                <PilulaRisco cor={e.cor_atual} />
                <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                  <span className="text-corpo font-medium text-tinta">{nomeDe(e)} <span className="text-apoio font-normal text-tinta-sussurro">{idadeDe(e.paciente)}</span></span>
                  <span className="text-apoio text-tinta-sussurro [text-wrap:pretty]">{e.queixa}</span>
                  {reav
                    ? <Pilula tom={atrasada ? 'vermelho' : 'ambar'}><Clock className="size-3" aria-hidden /> Em reavaliação · às {hora(e.reavaliar_em)}{atrasada ? ' · atrasada' : ''}</Pilula>
                    : <Pilula tom="teal">Em atendimento</Pilula>}
                </div>
                <span className="text-apoio whitespace-nowrap tabular-nums text-tinta-apoio">há {minutos(e.atendimento_iniciado_em, agora)}</span>
                <Button size="sm" variant="outline" onClick={() => onAbrir(e)}>{reav ? 'Reavaliar' : 'Abrir atendimento'}</Button>
              </div>
            )
          })}
        </Bloco>
      )}

      {(saidas.data ?? []).length > 0 && (
        <Bloco titulo="Saídas do plantão">
          {(saidas.data ?? []).map((s) => {
            // retirado da fila (recepção/enfermagem): sem médico no desfecho
            const excluido = s.desfecho === 'cancelado' || (s.desfecho === 'evasao' && !s.desfecho_por)
            const [codigo, ...resto] = (s.desfecho_motivo ?? '').split(': ')
            const d = s.desfecho_detalhes ?? {}
            const linha = excluido
              ? [resto.join(': ') || s.desfecho_motivo, `às ${hora(s.encerrado_em)}`].filter(Boolean).join(' · ')
              : [d.cid_alta ? `CID ${String(d.cid_alta)}` : '', d.destino ? `Destino: ${String(d.destino)}` : '', `às ${hora(s.desfecho_em ?? s.encerrado_em)}`]
                .filter(Boolean).join(' · ')
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-2.5 last:border-0">
                <PilulaRisco cor={s.cor_atual} />
                <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                  <span className="text-controle font-medium text-tinta">{nomeDe(s)} <span className="text-apoio font-normal text-tinta-sussurro">{idadeDe(s.paciente)}</span></span>
                  <span className="text-apoio text-tinta-sussurro [text-wrap:pretty]">{linha}</span>
                </div>
                {excluido
                  ? <Pilula tom="vermelho"><LogOut className="size-3" aria-hidden /> Excluído · {MOTIVO_EXCLUSAO[codigo] ?? codigo}</Pilula>
                  : <Pilula tom="teal">{rotuloDesfecho(s.desfecho)}</Pilula>}
              </div>
            )
          })}
        </Bloco>
      )}
    </div>
  )
}
