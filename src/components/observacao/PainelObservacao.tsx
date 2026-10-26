// ─────────────────────────────────────────────────────────────────────────────
// Pacientes em Observação (porte do Bloco 3 do protótipo, index.html 3541–3723).
//
// Revisão visual 3.6 (opção B do RT, 26/10/2026), como a fila do PS: alerta de
// quem passou de 6 horas; abas "Em observação" e "Finalizados" com a contagem e,
// à direita, a maior permanência e quantos passaram do prazo; uma tabela por aba.
// O estado de cada box vem derivado do banco (painel_observacao); os relógios
// correm pelo relógio do servidor.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Eye, Shield } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { LeitoAberto } from '@/components/internacao/LeitoAberto'
import { TituloPagina, Trilha } from '@/components/monitor/Pagina'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'

import { CartaoObservacao } from './CartaoObservacao'
import { duracao, msgErro, relogioPermanencia, type LinhaObservacao } from './modelo'

type Aba = 'ativas' | 'finalizadas'

export function PainelObservacao({ embutido = false }: { embutido?: boolean }) {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const ehGestor = papelAtivo === 'gestor' || papelAtivo === 'admin'

  const [aba, setAba] = React.useState<Aba>('ativas')
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

  const finalizadas = linhas.filter((l) => l.estado === 'finalizado')

  const tabela = (lista: LinhaObservacao[], vazio: string) => (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      {lista.length === 0 ? (
        <p className="px-5 py-5 text-controle text-tinta-sussurro">{vazio}</p>
      ) : (
        <Table aria-label="Pacientes em observação">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Box</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Na observação</TableHead>
              <TableHead>Prazo de 6 h</TableHead>
              <TableHead className="pr-5 text-right"><span className="sr-only">Ações</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((l) => (
              <CartaoObservacao key={l.internacao_id} linha={l} agora={agora} eu={perfil?.id} unidadeId={unidadeId!}
                podeAgir={!ehGestor} ehMedico={papelAtivo === 'plantonista'} abrirPrancheta={setPrancheta} />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  )

  const corpo = !unidadeId ? (
    <p className="text-apoio text-tinta-sussurro">Escolha a unidade.</p>
  ) : painel.isLoading ? (
    <div className="flex h-40 items-center justify-center"><Spinner /></div>
  ) : painel.error ? (
    <p className="rounded-container border border-critico/30 bg-alerta-critico px-4 py-3 text-apoio text-critico">{msgErro(painel.error)}</p>
  ) : (
    <div className="flex flex-col gap-3">
      {acima.length > 0 && (
        <div role="alert" className="flex items-center gap-[9px] rounded-container border border-nota bg-nota/50 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-observacao" aria-hidden />
          <span className="text-apoio text-atencao">
            {acima.length === 1 ? '1 paciente passou' : `${acima.length} pacientes passaram`} de 6 horas em observação
          </span>
        </div>
      )}

      <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="gap-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1 border-b border-fio">
          <TabsList aria-label="Observação" className="w-auto max-w-full flex-[1_0_auto] gap-5 border-b-0">
            <TabsTrigger value="ativas">Em observação <span className="text-rotulo font-semibold text-acao tabular-nums">{ativas.length}</span></TabsTrigger>
            <TabsTrigger value="finalizadas">
              {ehGestor ? 'Finalizados em 12 horas' : 'Finalizados no plantão'} <span className="text-rotulo font-semibold text-acao tabular-nums">{finalizadas.length}</span>
            </TabsTrigger>
          </TabsList>
          {/* quem passou do prazo aparece em qualquer aba: não some ao olhar a outra */}
          <span className="pb-2.5 text-apoio text-tinta-sussurro">
            {ativas.length > 0 ? `maior permanência ${duracao(maior)}` : 'ninguém em observação agora'}
            {acima.length > 0 && <span className="font-medium text-critico"> · {acima.length} acima de 6 horas</span>}
          </span>
        </div>

        <TabsContent value="ativas">{tabela(ativas, 'Nenhum paciente em observação agora.')}</TabsContent>
        <TabsContent value="finalizadas">{tabela(finalizadas, ehGestor ? 'Nada terminou nas últimas 12 horas.' : 'Nada terminou neste plantão.')}</TabsContent>
      </Tabs>

      <div className="flex items-center gap-[7px] text-apoio text-tinta-sussurro">
        <Shield className="size-3.5 shrink-0" aria-hidden />
        <span>
          {setores ? `Você vê a observação de ${setores}` : 'Você vê a observação dos setores da sua escala agora'}
          {ehGestor ? ' e o que terminou nas últimas 12 horas.' : ' e o que terminou neste plantão. Pacientes de outros setores não aparecem aqui.'}
        </span>
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
