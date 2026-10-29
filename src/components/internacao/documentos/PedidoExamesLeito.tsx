// Pedido de exames do leito (ponto 12 do plantonista; o RT aprovou em
// 28/10/2026 três pedidos e a tela A). Laboratório, imagem e ECG em três
// seções lado a lado, cada uma com o seu "Pedir": um pedido por grupo,
// ligado à internação (pedir_exames_internacao). Os botões vêm da lista de
// exames da unidade; sem lista no grupo, os de texto livre. O texto livre
// fica no grupo da seção. A regra (um grupo por pedido, quem pede) é do
// servidor; aqui só se marca e se pede.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, FlaskConical, ScanLine, X } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useUnidade } from '@/contexts/UnidadeContext'
import {
  GRUPOS_EXAME, botoesDoGrupo, codigoExameNaTela, grupoDoCodigo, jaPedido,
  type ExameBuscado, type GrupoExame, type ListaExamesUnidade, type Urgencia,
} from '@/lib/exames'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Chip } from '@/components/monitor/Pagina'

type Item = { rotulo: string; procedimento: string | null }
type Pedido = { exame: string; procedimento: string | null; situacao: string }

const ICONE: Record<GrupoExame, React.ReactNode> = {
  laboratorio: <FlaskConical className="size-4 text-acao" aria-hidden />,
  imagem: <ScanLine className="size-4 text-acao" aria-hidden />,
  grafico: <Activity className="size-4 text-acao" aria-hidden />,
}

export function PedidoExamesLeito({ internacaoId }: { internacaoId: string }) {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const lista = useQuery({
    queryKey: ['exames-unidade', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('exames_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as ListaExamesUnidade
    },
  })
  const pedidos = useQuery({
    queryKey: ['exames-da-internacao', internacaoId],
    queryFn: async () => {
      const { data, error } = await supabase.from('exames_pedidos').select('exame, procedimento, situacao').eq('internacao_id', internacaoId)
      if (error) throw error
      return (data ?? []) as Pedido[]
    },
  })
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {GRUPOS_EXAME.map((g) => (
        <SecaoGrupo key={g.id} grupo={g.id} rotulo={g.rotulo} internacaoId={internacaoId} unidadeId={unidadeId}
          botoes={botoesDoGrupo(lista.data?.exames, g.id)} pedidos={pedidos.data ?? []} />
      ))}
    </div>
  )
}

function SecaoGrupo({ grupo, rotulo, internacaoId, unidadeId, botoes, pedidos }: {
  grupo: GrupoExame; rotulo: string; internacaoId: string; unidadeId: string | undefined; botoes: Item[]; pedidos: Pedido[]
}) {
  const qc = useQueryClient()
  const [marcados, setMarcados] = React.useState<Item[]>([])
  const [termo, setTermo] = React.useState('')
  const [urgencia, setUrgencia] = React.useState<Urgencia>('rotina')
  const [observacao, setObservacao] = React.useState('')
  const [pedindo, setPedindo] = React.useState(false)
  const [aviso, setAviso] = React.useState<{ erro: boolean; texto: string } | null>(null)
  const t = termo.trim()
  const busca = useQuery({
    queryKey: ['buscar-exames', unidadeId, t],
    enabled: !!unidadeId && t.length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_exames', { p_unidade: unidadeId!, p_termo: t })
      if (error) throw error
      return (data ?? []) as unknown as ExameBuscado[]
    },
  })
  const achados = (busca.data ?? []).filter((x) => grupoDoCodigo(x.procedimento) === grupo)
  const igual = (a: Item, b: Item) => (a.procedimento ? a.procedimento === b.procedimento : a.rotulo.toLowerCase() === b.rotulo.toLowerCase())
  const marcado = (b: Item) => marcados.some((m) => igual(m, b))
  const alternar = (b: Item) => setMarcados((xs) => (xs.some((m) => igual(m, b)) ? xs.filter((m) => !igual(m, b)) : [...xs, b]))

  async function pedir() {
    setPedindo(true)
    const { data, error } = await supabase.rpc('pedir_exames_internacao', {
      p_internacao: internacaoId, p_grupo: grupo, p_urgencia: urgencia, p_observacao: observacao.trim() || undefined,
      p_itens: marcados.map((m) => (m.procedimento ? { procedimento: m.procedimento } : { nome: m.rotulo })),
    })
    setPedindo(false)
    if (error) return setAviso({ erro: true, texto: error.message })
    const n = (data as { pedidos?: number } | null)?.pedidos ?? marcados.length
    setAviso({ erro: false, texto: `Pedido de ${rotulo.toLowerCase()} feito: ${n} exame${n === 1 ? '' : 's'}. Fica pendente até o resultado.` })
    setMarcados([]); setObservacao(''); setUrgencia('rotina')
    // a lista do leito (ExamesEAgravos) e os impeditivos de alta leem os exames pedidos
    for (const k of [['exames-da-internacao', internacaoId], ['exames-pedidos'], ['impeditivos']]) void qc.invalidateQueries({ queryKey: k })
  }

  return (
    <section aria-label={`Pedido de ${rotulo}`} className="flex flex-col overflow-hidden rounded-cartao border border-fio bg-superficie">
      <div className="flex items-center gap-2 border-b border-trilha px-3.5 py-2.5">
        {ICONE[grupo]}
        <span className="text-controle font-semibold text-tinta">{rotulo}</span>
        <span className="ml-auto text-rotulo text-tinta-sussurro">um pedido só de {rotulo.toLowerCase()}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 px-3.5 py-3">
        {botoes.map((b) => {
          const ja = jaPedido(b, pedidos)
          return (
            <Chip key={b.rotulo + (b.procedimento ?? '')} ativo={marcado(b) || ja} desabilitado={ja || pedindo} onClick={() => alternar(b)}
              titulo={ja ? 'Já pedido nesta internação' : b.procedimento ? `Marcar ${b.rotulo}` : `Marcar ${b.rotulo} (sem código)`}>
              {b.rotulo}
            </Chip>
          )
        })}
      </div>
      <div className="flex flex-col gap-2 border-t border-trilha px-3.5 py-3">
        <div className="flex gap-2">
          <Input className="h-8 min-w-0 flex-1" aria-label={`Buscar exame de ${rotulo}`} placeholder={`Buscar exame de ${rotulo.toLowerCase()}`}
            value={termo} onChange={(e) => setTermo(e.target.value)} />
          <Button size="sm" variant="outline" disabled={t.length < 2 || pedindo} title="Sem código: não vai ao serviço integrado"
            onClick={() => { alternar({ rotulo: t, procedimento: null }); setTermo('') }}>Texto livre</Button>
        </div>
        {achados.length > 0 && (
          <div className="flex max-h-40 flex-col overflow-y-auto rounded-controle border border-fio">
            {achados.map((x) => (
              <Button key={x.procedimento} type="button" variant="ghost" size="sm" className="justify-start"
                onClick={() => { alternar({ rotulo: x.nome, procedimento: x.procedimento }); setTermo('') }}>
                {x.nome}<span className="ml-1 text-rotulo text-tinta-sussurro">{codigoExameNaTela(x.procedimento)}</span>
              </Button>
            ))}
          </div>
        )}
        {t.length >= 3 && busca.isSuccess && achados.length === 0 && (
          <span className="text-rotulo text-tinta-sussurro">Nada de {rotulo.toLowerCase()} com esse nome. Pode marcar como texto livre.</span>
        )}
      </div>
      {marcados.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-trilha bg-campo px-3.5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {marcados.map((m) => (
              <span key={m.rotulo + (m.procedimento ?? '')} className="inline-flex items-center gap-1 rounded-controle border border-fio bg-superficie px-2 py-0.5 text-rotulo text-tinta">
                {m.rotulo}{!m.procedimento && <span className="text-tinta-sussurro"> (sem código)</span>}
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Tirar ${m.rotulo}`} onClick={() => alternar(m)}>
                  <X aria-hidden />
                </Button>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['rotina', 'urgente'] as const).map((u) => (
              <Chip key={u} ativo={urgencia === u} onClick={() => setUrgencia(u)} tom={u === 'urgente' ? 'critico' : 'acao'}>{u}</Chip>
            ))}
            <Input className="h-8 min-w-0 flex-1" aria-label={`Observação do pedido de ${rotulo}`} placeholder="Observação (opcional)" maxLength={300}
              value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
          <Button size="sm" className="self-start" disabled={pedindo} onClick={() => void pedir()}>
            Pedir {marcados.length} exame{marcados.length === 1 ? '' : 's'} de {rotulo.toLowerCase()}
          </Button>
        </div>
      )}
      {aviso && (
        <p role={aviso.erro ? 'alert' : 'status'} className={`border-t border-trilha px-3.5 py-2 text-apoio ${aviso.erro ? 'text-critico' : 'text-conforme'}`}>
          {aviso.texto}
        </p>
      )}
    </section>
  )
}
