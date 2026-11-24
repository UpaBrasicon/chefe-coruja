import { useQueries, useQuery } from '@tanstack/react-query'
import { Bird } from 'lucide-react'
import * as React from 'react'

import { Abas } from '@/components/admin/ui'
import { TituloPagina } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { GaviaoPainel } from '@/pages/admin/GaviaoPainel'
import OlhoDeGaviao from '@/pages/gestor/OlhoDeGaviao'

// Um Gavião só (revisão do gestor, RT 24/11/2026, M3): o gestor vê o Olho de
// Gavião da unidade dele; o administrador geral vê o MESMO modelo, de todas as
// unidades — a lista à esquerda com os apontamentos abertos de cada uma, e a
// unidade escolhida ao lado, igual à do gestor. O Sentinela da plataforma (o
// antigo painel do admin) fica numa aba. /gestao/gaviao redireciona para cá.

type Unidade = { id: string; nome: string }
type Contagem = { alta: number; media: number; baixa: number; total: number }

export default function GaviaoGrupo() {
  const { papelAtivo, ehSuperAdmin } = useUnidade()
  if (papelAtivo !== 'admin') return <OlhoDeGaviao />
  return <GaviaoDaRede superAdmin={ehSuperAdmin} />
}

function GaviaoDaRede({ superAdmin }: { superAdmin: boolean }) {
  const [aba, setAba] = React.useState<'unidades' | 'sentinela'>(superAdmin ? 'unidades' : 'sentinela')
  const [escolhida, setEscolhida] = React.useState<string | null>(null)

  const unidades = useQuery({
    queryKey: ['gaviao-unidades'],
    enabled: superAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from('unidades').select('id, nome').eq('ativo', true).order('nome')
      if (error) throw error
      return (data ?? []) as Unidade[]
    },
  })
  // os mesmos apontamentos que o gestor vê (o banco deixa o administrador geral ler qualquer unidade)
  const contagens = useQueries({
    queries: (unidades.data ?? []).map((u) => ({
      queryKey: ['gaviao-apontamentos', u.id],
      refetchInterval: 5 * 60_000,
      queryFn: async () => {
        const { data, error } = await supabase.rpc('gaviao_apontamentos', { p_unidade: u.id })
        if (error) throw error
        return { lista: data ?? [], em: new Date().toISOString() }
      },
    })),
  })

  const linhas = (unidades.data ?? []).map((u, i) => {
    const q = contagens[i]
    const abertos = (q?.data?.lista ?? []).filter((a) => !a.decisao)
    const c: Contagem = {
      alta: abertos.filter((a) => a.severidade === 'alta').length,
      media: abertos.filter((a) => a.severidade === 'media').length,
      baixa: abertos.filter((a) => a.severidade === 'baixa').length,
      total: abertos.length,
    }
    return { u, c, carregando: !!q?.isLoading, erro: q?.error as Error | null }
  }).sort((a, b) => b.c.alta - a.c.alta || b.c.total - a.c.total || a.u.nome.localeCompare(b.u.nome, 'pt-BR'))
  const atual = escolhida ?? linhas[0]?.u.id ?? null
  const comAlgo = linhas.filter((l) => l.c.total > 0).length

  return (
    <div className="flex w-full flex-col">
      <TituloPagina icone={Bird} titulo="Olho de Gavião"
        descricao="Alertas de escala, carga horária e presença, unidade por unidade, no mesmo modelo que o gestor vê. O Sentinela da plataforma fica na outra aba." />
      <div className="mb-4">
        <Abas rotulo="Visão" valor={aba} onChange={setAba}
          opcoes={[
            ...(superAdmin ? [{ valor: 'unidades' as const, rotulo: 'Unidades', contagem: comAlgo }] : []),
            { valor: 'sentinela' as const, rotulo: 'Sentinela da plataforma' },
          ]} />
      </div>

      {aba === 'sentinela' ? <GaviaoPainel embutido /> : unidades.isLoading ? (
        <div className="flex h-40 items-center justify-center"><Spinner /></div>
      ) : unidades.error ? (
        <p role="alert" className="text-apoio text-critico">{(unidades.error as Error).message}</p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <nav aria-label="Unidades" className="flex max-h-[70vh] flex-col overflow-y-auto rounded-cartao border border-fio bg-superficie">
            {linhas.map(({ u, c, carregando, erro }) => (
              <BotaoLinha key={u.id} variante="linha" aria-current={atual === u.id ? 'true' : undefined} onClick={() => setEscolhida(u.id)}
                className={cn('items-center', atual === u.id && 'bg-alerta-marca')}>
                <span className="min-w-0 flex-1 truncate text-controle text-tinta">{u.nome}</span>
                {carregando ? <Spinner /> : erro ? (
                  <span className="text-rotulo text-critico">erro</span>
                ) : c.total === 0 ? (
                  <span className="text-rotulo text-tinta-sussurro">nada aberto</span>
                ) : (
                  <span className="flex items-center gap-2 text-rotulo tabular-nums">
                    {c.alta > 0 && <span className="text-critico">{c.alta} {c.alta === 1 ? 'alta' : 'altas'}</span>}
                    <span className="text-tinta-apoio">{c.total} {c.total === 1 ? 'aberto' : 'abertos'}</span>
                  </span>
                )}
              </BotaoLinha>
            ))}
          </nav>
          <div className="min-w-0">
            {atual ? (
              <>
                <span className="mb-2 block text-apoio font-medium text-tinta-apoio">{linhas.find((l) => l.u.id === atual)?.u.nome}</span>
                <OlhoDeGaviao key={atual} unidade={atual} />
              </>
            ) : <p className="text-apoio text-tinta-sussurro">Nenhuma unidade ativa.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
