// ─────────────────────────────────────────────────────────────────────────────
// Pacientes em Observação (porte do Bloco 3 do protótipo, index.html 3541–3723).
//
// Alerta de quem passou de 6 horas ou "tudo calmo" com a maior permanência;
// filtros por prazo e pelos cinco estados (com contagem); a lista de boxes.
// O estado de cada box vem derivado do banco (painel_observacao); os relógios
// correm pelo relógio do servidor.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Eye, Shield, ShieldCheck } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { LeitoAberto } from '@/components/internacao/LeitoAberto'
import { Chip, TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'

import { CartaoObservacao } from './CartaoObservacao'
import { ESTADOS, duracao, msgErro, relogioPermanencia, type EstadoObservacao, type LinhaObservacao } from './modelo'

type FiltroPrazo = 'todos' | 'acima' | 'dentro'
const FILTROS_PRAZO: [FiltroPrazo, string][] = [['todos', 'Todos'], ['acima', 'Acima de 6h'], ['dentro', 'Dentro do prazo']]

export function PainelObservacao({ embutido = false }: { embutido?: boolean }) {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const ehGestor = papelAtivo === 'gestor' || papelAtivo === 'admin'

  const [filtroPrazo, setFiltroPrazo] = React.useState<FiltroPrazo>('todos')
  const [filtroEstado, setFiltroEstado] = React.useState<EstadoObservacao | ''>('')
  const [prancheta, setPrancheta] = React.useState<LinhaObservacao | null>(null)

  const painel = useQuery({
    queryKey: ['painel-observacao', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('painel_observacao', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as unknown as LinhaObservacao[]
    },
  })

  // Relógio do servidor: a diferença para o do aparelho, e um tique a cada 30 s.
  const { data: desvio } = useQuery({
    queryKey: ['hora-servidor-desvio'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const antes = Date.now()
      const { data, error } = await supabase.rpc('horario_servidor')
      if (error) throw error
      return Date.parse(data as string) - (antes + Date.now()) / 2
    },
  })
  const [tique, setTique] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = window.setInterval(() => setTique(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  const agora = tique + (desvio ?? 0)

  const linhas = React.useMemo(() => painel.data ?? [], [painel.data])
  const ativas = linhas.filter((l) => l.estado !== 'finalizado')
  const acima = ativas.filter((l) => relogioPermanencia(l.entrada, l.prazo, agora).acima)
  const maior = ativas.reduce((m, l) => Math.max(m, relogioPermanencia(l.entrada, l.prazo, agora).decorridoMin), 0)
  const setores = [...new Set(linhas.map((l) => l.setor_nome))].join(', ')

  const visiveis = linhas.filter((l) => {
    if (filtroEstado && l.estado !== filtroEstado) return false
    if (filtroPrazo === 'todos') return true
    if (l.estado === 'finalizado') return false
    const passou = relogioPermanencia(l.entrada, l.prazo, agora).acima
    return filtroPrazo === 'acima' ? passou : !passou
  })

  const corpo = !unidadeId ? (
    <p className="text-apoio text-tinta-sussurro">Escolha a unidade.</p>
  ) : painel.isLoading ? (
    <div className="flex h-40 items-center justify-center"><Spinner /></div>
  ) : painel.error ? (
    <p className="rounded-container border border-critico/30 bg-alerta-critico px-4 py-3 text-apoio text-critico">{msgErro(painel.error)}</p>
  ) : (
    <div className="flex flex-col gap-3.5">
      {acima.length > 0 ? (
        <div role="alert" className="flex items-center gap-[9px] rounded-container border border-nota bg-nota/50 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-observacao" aria-hidden />
          <span className="text-apoio text-atencao">
            {acima.length === 1 ? '1 paciente passou' : `${acima.length} pacientes passaram`} de 6 horas em observação
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-[9px] rounded-container border border-conforme/25 bg-alerta-conforme px-4 py-3">
          <ShieldCheck className="size-4 shrink-0 text-conforme" aria-hidden />
          <span className="text-apoio text-conforme">
            {ativas.length > 0 ? `Todos dentro do limite de 6 horas · maior permanência de ${duracao(maior)}` : 'Ninguém em observação agora'}
          </span>
        </div>
      )}

      <div className="flex items-center gap-[7px] text-apoio text-tinta-sussurro">
        <Shield className="size-3.5 shrink-0" aria-hidden />
        <span>
          {setores ? `Você vê a observação de ${setores}` : 'Você vê a observação dos setores da sua escala agora'}
          {ehGestor ? ' e o que terminou nas últimas 12 horas.' : ' e o que terminou neste plantão. Pacientes de outros setores não aparecem aqui.'}
        </span>
      </div>

      <div role="group" aria-label="Filtros da observação" className="flex flex-wrap items-center gap-[7px]">
        {FILTROS_PRAZO.map(([k, r]) => <Chip key={k} ativo={filtroPrazo === k} onClick={() => setFiltroPrazo(k)}>{r}</Chip>)}
        <span aria-hidden className="mx-1 w-px self-stretch bg-fio" />
        {ESTADOS.map((e) => (
          <Chip key={e.id} ativo={filtroEstado === e.id} onClick={() => setFiltroEstado(filtroEstado === e.id ? '' : e.id)}>
            {e.rotulo} · {linhas.filter((l) => l.estado === e.id).length}
          </Chip>
        ))}
      </div>

      <div className="overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso">
        {visiveis.map((l) => (
          <CartaoObservacao key={l.internacao_id} linha={l} agora={agora} eu={perfil?.id} unidadeId={unidadeId}
            podeAgir={!ehGestor} ehMedico={papelAtivo === 'plantonista'} abrirPrancheta={setPrancheta} />
        ))}
        {visiveis.length === 0 && (
          <div className="flex flex-col items-center gap-[5px] px-5 py-10 text-center">
            <ShieldCheck className="size-[22px] text-conforme" aria-hidden />
            <span className="text-corpo font-semibold text-tinta">
              {linhas.length === 0 ? 'Nenhum paciente em observação' : filtroPrazo === 'acima' && !filtroEstado ? 'Ninguém acima de 6 horas agora' : 'Nenhum box neste filtro'}
            </span>
            <span className="text-apoio text-tinta-sussurro">Nada a fazer nesta lista neste momento.</span>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col">
      {!embutido && (
        <>
          <Trilha niveis={[{ rotulo: 'Início', to: '/' }, { rotulo: 'Observação' }]} />
          <TituloPagina icone={Eye} titulo="Pacientes em Observação" descricao="Permanência máxima de 6 horas: aviso de quem passou do prazo." />
        </>
      )}
      {corpo}

      <Dialog open={!!prancheta} onOpenChange={(o) => !o && setPrancheta(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{prancheta?.box ? `${prancheta.box} · ` : ''}{prancheta?.nome}</DialogTitle>
            <DialogDescription>Acuidade, vitais, pendências, passagem, alta e pacote.</DialogDescription>
          </DialogHeader>
          {prancheta && <LeitoAberto pacienteId={prancheta.paciente_id} pacienteNome={prancheta.nome} ehGestor={ehGestor} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
