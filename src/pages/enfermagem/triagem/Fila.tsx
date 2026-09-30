import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, MapPin, Volume2 } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { rotuloIdade } from '@/domain/idade'
import { rotulosPrioridade } from '@/domain/prioridade'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/monitor/Pagina'
import { ExcluirDaFila } from '@/components/porta/Chamada'
import { dataSP, esperaMin, gravarSala, hora, lerSala, nomeDe, type NaFila } from './comum'

// Fila da triagem no desenho do protótipo: sala escolhida uma vez no topo
// (guardada no aparelho), status da chamada por linha, espera em minutos,
// Chamar · Triar · Excluir da fila (com motivo e justificativa).

type SalaTriagem = { id: string; nome: string; setor_id: string; setor: { nome: string } | null }
type UltimaChamada = { numero: number; sala: string; em: string }

function useSalasTriagem(setores: string[]) {
  return useQuery({
    queryKey: ['salas-triagem', setores.join(',')],
    enabled: setores.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salas')
        .select('id, nome, setor_id, setor:setores(nome)')
        .in('setor_id', setores)
        .eq('tipo', 'triagem')
        .eq('ativo', true)
        .order('ordem')
      if (error) throw error
      return (data ?? []) as unknown as SalaTriagem[]
    },
  })
}

/** Última chamada de cada episódio na triagem (últimas 24 h). */
function useChamadasTriagem(setores: string[]) {
  return useQuery({
    queryKey: ['triagem-chamadas', setores.join(',')],
    enabled: setores.length > 0,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamadas')
        .select('episodio_id, numero, criado_em, sala:salas(nome)')
        .in('setor_id', setores)
        .eq('etapa', 'triagem')
        .gte('criado_em', new Date(Date.now() - 24 * 3600_000).toISOString())
      if (error) throw error
      const mapa = new Map<string, UltimaChamada>()
      for (const c of (data ?? []) as unknown as { episodio_id: string; numero: number; criado_em: string; sala: { nome: string } | null }[]) {
        const atual = mapa.get(c.episodio_id)
        if (!atual || c.numero > atual.numero) mapa.set(c.episodio_id, { numero: c.numero, sala: c.sala?.nome ?? '', em: c.criado_em })
      }
      return mapa
    },
  })
}

function BarraSala({ salas, escolhidas, escolher }: { salas: SalaTriagem[]; escolhidas: Record<string, string>; escolher: (setor: string, sala: string) => void }) {
  const porSetor = [...new Set(salas.map((s) => s.setor_id))]
  if (porSetor.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-cartao border border-fio bg-superficie px-4 py-[11px] text-apoio text-tinta-sussurro shadow-repouso">
        <MapPin className="size-[15px] text-acao" aria-hidden /> Nenhuma sala de triagem cadastrada nesta porta. O gestor cadastra em Setores.
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-cartao border border-fio bg-superficie px-4 py-[11px] shadow-repouso">
      {porSetor.map((setor) => {
        const doSetor = salas.filter((s) => s.setor_id === setor)
        const atual = doSetor.find((s) => s.id === escolhidas[setor])
        return (
          <div key={setor} className="flex flex-wrap items-center gap-2.5">
            <MapPin className="size-[15px] text-acao" aria-hidden />
            <span className="text-apoio font-medium text-grafite">
              {porSetor.length > 1 && `${doSetor[0].setor?.nome ?? 'Porta'} · `}
              {atual ? `Sua sala: ${atual.nome}` : 'Escolha sua sala para poder chamar no painel'}
            </span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sala de triagem">
              {doSetor.map((s) => (
                <Chip key={s.id} ativo={s.id === atual?.id} onClick={() => escolher(setor, s.id)}>{s.nome}</Chip>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

const PILULA = 'inline-flex items-center rounded-capsula px-2.5 py-1 text-rotulo font-semibold'

function statusDe(ch: UltimaChamada | undefined) {
  if (!ch) return { texto: 'Aguardando', classe: 'bg-trilha text-tinta-apoio' }
  const base = `Chamado${ch.numero > 1 ? ` ${ch.numero}ª vez` : ''}${ch.sala ? ` · ${ch.sala}` : ''} · ${hora(ch.em)}`
  if (ch.numero >= 3) return { texto: `${base} · sem resposta após 3 chamadas`, classe: 'bg-alerta-critico text-critico whitespace-normal' }
  return { texto: base, classe: 'bg-[#FEF3C7] text-atencao' }
}

function BotaoChamar({ ep, salaId, chamadas }: { ep: NaFila; salaId: string | undefined; chamadas: number }) {
  const queryClient = useQueryClient()
  const chamar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('chamar_paciente', { p_episodio: ep.id, p_sala: salaId! })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['triagem-chamadas'] })
      void queryClient.invalidateQueries({ queryKey: ['chamadas-contagem'] })
    },
  })
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={!salaId || chamar.isPending}
        title={salaId ? 'Chamar no painel' : 'Escolha sua sala antes de chamar'}
        onClick={() => chamar.mutate()}
      >
        <Volume2 /> {chamadas > 0 ? 'Chamar de novo' : 'Chamar'}
      </Button>
      {chamar.error && <span className="text-rotulo text-critico">{(chamar.error as Error).message}</span>}
    </div>
  )
}

export function FilaTriagem({ fila, carregando, erro, onTriar }: { fila: NaFila[]; carregando: boolean; erro: Error | null; onTriar: (ep: NaFila) => void }) {
  const setores = React.useMemo(() => [...new Set(fila.map((e) => e.setor_id))], [fila])
  const salas = useSalasTriagem(setores)
  const chamadas = useChamadasTriagem(setores)
  const [escolhidas, setEscolhidas] = React.useState<Record<string, string>>({})
  // a sala guardada no aparelho vale enquanto existir nesta porta
  const salaDoSetor = (setor: string) => {
    const doSetor = (salas.data ?? []).filter((s) => s.setor_id === setor)
    const id = escolhidas[setor] ?? lerSala(setor)
    return doSetor.find((s) => s.id === id)?.id
  }
  const escolher = (setor: string, sala: string) => {
    gravarSala(setor, sala)
    setEscolhidas((m) => ({ ...m, [setor]: sala }))
  }
  const escolhidasAgora = Object.fromEntries(setores.map((s) => [s, salaDoSetor(s) ?? '']))

  // re-render a cada 30 s para a espera andar
  const [, tique] = React.useState(0)
  React.useEffect(() => {
    const t = setInterval(() => tique((x) => x + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const hoje = dataSP()
  const n = fila.length

  return (
    <div className="flex flex-col gap-3">
      {setores.length > 0 && salas.data && <BarraSala salas={salas.data} escolhidas={escolhidasAgora} escolher={escolher} />}
      <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
        <div className="border-b border-trilha px-5 py-[13px] text-apoio text-tinta-sussurro">
          {n} {n === 1 ? 'ficha aguardando' : 'fichas aguardando'} · 80+ primeiro, depois as demais prioridades legais, depois a chegada
        </div>
        {carregando && <div className="px-5 py-5 text-controle text-tinta-sussurro">Carregando a fila…</div>}
        {erro && <div className="px-5 py-5 text-controle text-critico">{erro.message}</div>}
        {!carregando && !erro && n === 0 && <div className="px-5 py-[22px] text-controle text-tinta-sussurro">Nenhuma ficha aguardando triagem.</div>}
        {fila.map((e) => {
          const ch = chamadas.data?.get(e.id)
          const st = statusDe(ch)
          const esp = esperaMin(e.chegada_em)
          const prios = rotulosPrioridade(e.prioridades_legais)
          return (
            <div key={e.id} className="flex flex-col gap-2 border-b border-trilha px-5 py-[13px] last:border-b-0">
              <div className="flex flex-wrap items-center gap-3.5">
                <span className={cn(PILULA, 'min-w-[70px] justify-center bg-trilha text-tinta-sussurro')}>Sem triagem</span>
                <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                  <span className="text-corpo font-medium text-tinta">
                    {nomeDe(e)}{' '}
                    <span className="text-apoio font-normal text-tinta-sussurro">
                      {e.paciente?.data_nascimento ? rotuloIdade(e.paciente.data_nascimento, hoje) : 'idade não informada'}
                    </span>
                  </span>
                  <span className="text-apoio text-pretty text-tinta-sussurro">
                    {[`Queixa: ${e.queixa}`, prios.length ? `Prioridade: ${prios.join(', ')}` : '', `Ficha às ${hora(e.chegada_em)}`].filter(Boolean).join(' · ')}
                  </span>
                  <span className={cn(PILULA, 'self-start', st.classe)}>{st.texto}</span>
                </div>
                <span className="text-apoio whitespace-nowrap tabular-nums text-tinta-apoio" title="Espera desde a ficha da recepção">
                  {esp} min
                </span>
                <div className="flex flex-wrap items-start gap-[7px]">
                  <BotaoChamar ep={e} salaId={salaDoSetor(e.setor_id)} chamadas={ch?.numero ?? 0} />
                  <Button size="sm" onClick={() => onTriar(e)}>
                    <Activity /> Triar
                  </Button>
                  <ExcluirDaFila episodioId={e.id} nome={nomeDe(e)} />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
