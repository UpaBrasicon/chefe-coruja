import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ambulance, BedDouble, Bell, CalendarClock, ChevronDown, ChevronUp, Clock, CornerDownLeft, FileCheck, FileText, FlaskConical, MessageSquare, Pill, Send, ShieldCheck, TriangleAlert, Users, Video, Waypoints, type LucideIcon } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { itensDeNavegacao } from '@/components/casca/navegacao'
import { Abas, Chip, Chips, TituloCartao, TituloPagina } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useDesfazer } from '@/contexts/DesfazerContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { agruparAvisos, type Categoria, type GrupoAvisos } from '@/lib/avisos'
import { dataHora, diaMes } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { MinhaNotificacao } from '@/types/database'

// Avisos (P/index.html 9561–9598), com a desfazer que volta no servidor
// (marcar_avisos_lidos / reabrir_avisos). A categoria sai do tipo do aviso
// (src/lib/avisos.ts). Revisão de tela do RT (24/11/2026): repetidos numa linha
// só e contador por grupo (M1); "Precisa de ação" no topo, separado dos
// informativos, e prescrição com categoria própria (M2); "Não lidos / Todos",
// filtros do perfil com o resto em "Mais", rótulos sem caixa alta e abrir o
// aviso já marca como lido (M3).

// a ação aparece se a rota estiver no menu do papel; com mais de uma, vale a
// primeira que o papel tem (ex.: o leito liberado abre o NIR para o NIR e a
// internação para a enfermagem)
type Acao = { to: string; rotulo: string }
const VISUAL: Record<Categoria, { icone: LucideIcon; cor: string; acao?: Acao | Acao[] }> = {
  Turno: { icone: Clock, cor: 'text-acao bg-acao/10', acao: { to: '/plantao', rotulo: 'Abrir Plantão' } },
  Observação: { icone: TriangleAlert, cor: 'text-atencao bg-atencao/10', acao: { to: '/observacao', rotulo: 'Abrir Observação' } },
  Triagem: { icone: TriangleAlert, cor: 'text-critico bg-critico/10', acao: { to: '/atendimento', rotulo: 'Abrir atendimento' } },
  Prescrição: { icone: Pill, cor: 'text-critico bg-critico/10', acao: [
    { to: '/plantao/internacao/pacientes', rotulo: 'Abrir leitos' }, { to: '/enfermagem/internacao', rotulo: 'Abrir internação' },
    { to: '/internacao', rotulo: 'Abrir internação' }, { to: '/atendimento', rotulo: 'Abrir atendimento' }] },
  Farmácia: { icone: Pill, cor: 'text-critico bg-critico/10', acao: [
    { to: '/plantao/internacao/pacientes', rotulo: 'Abrir leitos' }, { to: '/atendimento', rotulo: 'Abrir atendimento' }] },
  Leitos: { icone: BedDouble, cor: 'text-conforme bg-conforme/10', acao: [
    { to: '/nir', rotulo: 'Abrir NIR' }, { to: '/enfermagem/internacao', rotulo: 'Abrir internação' }, { to: '/internacao', rotulo: 'Abrir internação' }] },
  Escala: { icone: CalendarClock, cor: 'text-tinta-apoio bg-trilha', acao: { to: '/agenda', rotulo: 'Ver escala' } },
  Candidatura: { icone: Users, cor: 'text-tinta-apoio bg-trilha', acao: { to: '/agenda', rotulo: 'Ver vagas' } },
  Mensagem: { icone: MessageSquare, cor: 'text-tinta-apoio bg-trilha' },
  Regulação: { icone: Waypoints, cor: 'text-acao bg-acao/10', acao: { to: '/regulacao', rotulo: 'Abrir Regulação' } },
  Encaminhamento: { icone: Ambulance, cor: 'text-atencao bg-atencao/10', acao: [
    { to: '/encaminhados', rotulo: 'Abrir Encaminhados' }, { to: '/recepcao', rotulo: 'Abrir recepção' }, { to: '/atendimento', rotulo: 'Abrir atendimento' }] },
  Retorno: { icone: CornerDownLeft, cor: 'text-acao bg-acao/10', acao: { to: '/encaminhados?aba=retornos', rotulo: 'Abrir Retornos' } },
  AIH: { icone: FileText, cor: 'text-acao bg-acao/10', acao: { to: '/aih', rotulo: 'Abrir AIH' } },
  APAC: { icone: FileCheck, cor: 'text-acao bg-acao/10', acao: { to: '/apac', rotulo: 'Abrir APAC' } },
  Exames: { icone: FlaskConical, cor: 'text-critico bg-critico/10', acao: [
    { to: '/atendimento', rotulo: 'Abrir atendimento' }, { to: '/plantao/internacao/pacientes', rotulo: 'Abrir leitos' }, { to: '/enfermagem/internacao', rotulo: 'Abrir internação' }] },
  RNDS: { icone: Send, cor: 'text-atencao bg-atencao/10', acao: { to: '/integracoes?aba=rnds', rotulo: 'Abrir RNDS' } },
  Reunião: { icone: Video, cor: 'text-acao bg-acao/10', acao: { to: '/agenda-admin', rotulo: 'Abrir agenda' } },
  Outros: { icone: Bell, cor: 'text-tinta-apoio bg-trilha' },
}

// quantos filtros ficam à vista; o resto vai para "Mais"
const FILTROS_A_VISTA = 4

function haQuanto(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  if (h < 48) return 'ontem'
  return diaMes(iso)
}

function LinhaAviso({ g, rotas, marcar, marcando }: {
  g: GrupoAvisos; rotas: Set<string>; marcar: (ids: string[]) => void; marcando: boolean
}) {
  const v = VISUAL[g.categoria]
  const acao = (v.acao ? [v.acao].flat() : []).find((a) => rotas.has(a.to.split('?')[0])) ?? null
  const naoLido = g.naoLidos.length > 0
  return (
    <div className="flex items-start gap-[13px] border-b border-trilha px-5 py-[15px] last:border-0">
      <span className={cn('mt-[7px] size-[7px] shrink-0 rounded-capsula', naoLido ? 'bg-acao' : 'bg-transparent')} aria-hidden />
      <span className={cn('grid size-[34px] shrink-0 place-items-center rounded-controle', v.cor)} aria-hidden>
        <v.icone className="size-[17px]" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-rotulo font-medium text-tinta-sussurro">
          {g.categoria}{naoLido ? <span className="sr-only"> · não lido</span> : null}
        </span>
        <span className={cn('text-corpo text-pretty text-tinta', naoLido ? 'font-semibold' : 'font-normal')}>
          {g.mensagem}
          {g.vezes > 1 && (
            <span className="font-normal text-tinta-sussurro"> · {g.vezes} vezes desde {diaMes(g.primeiro)}</span>
          )}
        </span>
        {(acao || naoLido) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-3.5">
            {acao ? (
              // abrir o aviso já marca o grupo como lido
              <Link to={acao.to} onClick={() => { if (naoLido) marcar(g.naoLidos) }} className="text-apoio font-medium text-acao hover:underline">
                {acao.rotulo}
              </Link>
            ) : (
              <Button variant="link" disabled={marcando} onClick={() => marcar(g.naoLidos)}
                className="min-h-0 px-0 py-0 underline underline-offset-4">
                Marcar como lido
              </Button>
            )}
          </div>
        )}
      </div>
      <span className="shrink-0 text-apoio whitespace-nowrap text-tinta-sussurro" title={dataHora(g.ultimo)}>
        {haQuanto(g.ultimo)}
      </span>
    </div>
  )
}

export default function Notificacoes() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const { fazer } = useDesfazer()
  const [aba, setAba] = React.useState<'nao-lidos' | 'todos'>('nao-lidos')
  const [filtro, setFiltro] = React.useState<Categoria | 'Todas'>('Todas')
  const [verMais, setVerMais] = React.useState(false)
  const chave = ['minhas-notificacoes', unidadeId]

  const { data: notificacoes, isLoading } = useQuery({
    queryKey: chave,
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('minhas_notificacoes', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as MinhaNotificacao[]
    },
    refetchInterval: 60_000,
  })
  const recarregar = () => void qc.invalidateQueries({ queryKey: chave })

  const marcar = useMutation({
    mutationFn: async (ids: string[] | null) => {
      const { data, error } = await supabase.rpc('marcar_avisos_lidos', { p_unidade: unidadeId!, p_ids: ids ?? undefined })
      if (error) throw error
      return data ?? []
    },
    onSuccess: (ids) => {
      recarregar()
      if (!ids.length) return
      fazer(ids.length === 1 ? 'Aviso marcado como lido' : `${ids.length} avisos marcados como lidos`, async () => {
        const { error } = await supabase.rpc('reabrir_avisos', { p_ids: ids })
        if (error) throw error
        recarregar()
      })
    },
  })

  const rotas = new Set(itensDeNavegacao(papelAtivo, false, false, unidadeAtiva?.unidade.tipo ?? null).map((i) => i.to))
  const grupos = agruparAvisos(notificacoes ?? [])
  const naoLidos = grupos.filter((g) => g.naoLidos.length > 0)
  const daAba = aba === 'nao-lidos' ? naoLidos : grupos

  // filtros do perfil: só categorias que têm aviso; AIH e APAC só para quem tem essas telas
  const permitida = (c: Categoria) => (c === 'AIH' ? rotas.has('/aih') : c === 'APAC' ? rotas.has('/apac') : true)
  const contagem = new Map<Categoria, number>()
  for (const g of daAba) if (permitida(g.categoria)) contagem.set(g.categoria, (contagem.get(g.categoria) ?? 0) + 1)
  const categorias = [...contagem.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  const aVista = categorias.slice(0, FILTROS_A_VISTA)
  const naGaveta = categorias.slice(FILTROS_A_VISTA)
  const mostrarGaveta = verMais || naGaveta.includes(filtro as Categoria)
  const filtroValido = filtro === 'Todas' || categorias.includes(filtro)

  const lista = daAba.filter((g) => !filtroValido || filtro === 'Todas' || g.categoria === filtro)
  const comAcao = lista.filter((g) => g.acao)
  const informativos = lista.filter((g) => !g.acao)
  const marcarGrupo = (ids: string[]) => { if (ids.length) marcar.mutate(ids) }

  return (
    <div className="mx-auto flex w-full max-w-[896px] flex-col">
      <TituloPagina
        icone={Bell}
        titulo="Avisos"
        descricao={naoLidos.length ? `${naoLidos.length} não ${naoLidos.length === 1 ? 'lido' : 'lidos'}` : 'Tudo lido'}
        acoes={
          <Button variant="outline" disabled={!naoLidos.length || marcar.isPending} onClick={() => marcar.mutate(null)} className="px-[13px] py-2">
            <ShieldCheck className="size-[15px]" aria-hidden /> Marcar todas como lidas
          </Button>
        }
      />
      <Abas
        abas={[['nao-lidos', 'Não lidos', naoLidos.length], ['todos', 'Todos', grupos.length]]}
        valor={aba}
        onChange={(k) => { setAba(k); setFiltro('Todas') }}
        rotulo="Quais avisos"
        className="mb-3"
      />
      {categorias.length > 1 && (
        <Chips rotulo="Filtrar por assunto">
          <Chip ativo={filtro === 'Todas' || !filtroValido} onClick={() => setFiltro('Todas')}>Todos os assuntos</Chip>
          {aVista.map((c) => <Chip key={c} ativo={filtro === c} contagem={contagem.get(c)} onClick={() => setFiltro(c)}>{c}</Chip>)}
          {mostrarGaveta && naGaveta.map((c) => <Chip key={c} ativo={filtro === c} contagem={contagem.get(c)} onClick={() => setFiltro(c)}>{c}</Chip>)}
          {naGaveta.length > 0 && !naGaveta.includes(filtro as Categoria) && (
            <Chip ativo={false} onClick={() => setVerMais((v) => !v)}>
              {verMais ? <><ChevronUp className="size-3.5" aria-hidden /> Menos</> : <><ChevronDown className="size-3.5" aria-hidden /> Mais</>}
            </Chip>
          )}
        </Chips>
      )}
      {marcar.error && <p role="alert" className="mb-3 text-apoio text-critico">{(marcar.error as Error).message}</p>}

      {isLoading ? (
        <div className="flex h-24 items-center justify-center rounded-cartao border border-fio bg-superficie"><Spinner /></div>
      ) : lista.length === 0 ? (
        <div className="rounded-cartao border border-fio bg-superficie px-5 py-[26px] text-center text-apoio text-tinta-sussurro">
          {aba === 'nao-lidos' ? 'Nenhum aviso por ler. Os já lidos ficam em Todos.' : 'Nenhum aviso nesse filtro.'}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {comAcao.length > 0 && (
            <section aria-labelledby="avisos-acao">
              <TituloCartao id="avisos-acao" extra={`${comAcao.length}`}>Precisa de ação</TituloCartao>
              <div className="overflow-hidden rounded-cartao border border-atencao/40 bg-superficie shadow-repouso">
                {comAcao.map((g) => <LinhaAviso key={g.chave} g={g} rotas={rotas} marcar={marcarGrupo} marcando={marcar.isPending} />)}
              </div>
            </section>
          )}
          {informativos.length > 0 && (
            <section aria-labelledby={comAcao.length > 0 ? 'avisos-info' : undefined} aria-label={comAcao.length > 0 ? undefined : 'Avisos'}>
              {comAcao.length > 0 && <TituloCartao id="avisos-info" extra={`${informativos.length}`}>Informativos</TituloCartao>}
              <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
                {informativos.map((g) => <LinhaAviso key={g.chave} g={g} rotas={rotas} marcar={marcarGrupo} marcando={marcar.isPending} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
