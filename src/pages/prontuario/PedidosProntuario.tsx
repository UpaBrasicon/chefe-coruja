import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderSearch, Search } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { TituloPagina } from '@/components/monitor/Pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'

// Pedido de acesso ao prontuário encerrado (fase 6, migration 20261001000001).
// Fora da escala o profissional não lista pacientes: identifica por documento
// exato, ou por nome com data de nascimento. O gestor aprova; vale 24 horas,
// só leitura.

type Achado = {
  paciente_id: string
  nome: string
  data_nascimento: string | null
  prontuario: string | null
  ultimo_encerramento: string | null
  tem_acesso: boolean
}

type MeuPedido = {
  id: string
  paciente_id: string
  paciente_nome: string
  motivo: string
  status: 'pendente' | 'aprovado' | 'recusado' | 'cancelado'
  criado_em: string
  decidido_em: string | null
  motivo_decisao: string | null
  valido_ate: string | null
  vigente: boolean
}

export function StatusPedido({ status, vigente }: { status: MeuPedido['status']; vigente?: boolean }) {
  if (status === 'aprovado') return <Badge variant={vigente === false ? 'secondary' : 'success'}>{vigente === false ? 'Aprovado · vencido' : 'Aprovado'}</Badge>
  if (status === 'pendente') return <Badge variant="warning">Aguardando o gestor</Badge>
  if (status === 'recusado') return <Badge variant="destructive">Recusado</Badge>
  return <Badge variant="secondary">Cancelado</Badge>
}

export default function PedidosProntuario() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()

  const [documento, setDocumento] = React.useState('')
  const [nome, setNome] = React.useState('')
  const [nascimento, setNascimento] = React.useState('')
  const [escolhido, setEscolhido] = React.useState<Achado | null>(null)
  const [motivo, setMotivo] = React.useState('')

  const busca = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('buscar_paciente_para_pedido', {
        p_unidade: unidadeId!,
        p_documento: documento.trim() || undefined,
        p_nome: documento.trim() ? undefined : nome.trim() || undefined,
        p_nascimento: documento.trim() ? undefined : nascimento || undefined,
      })
      if (error) throw error
      return (data ?? []) as Achado[]
    },
    onSuccess: () => setEscolhido(null),
  })

  const meus = useQuery({
    queryKey: ['meus-pedidos-acesso', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('meus_pedidos_acesso', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as MeuPedido[]
    },
    refetchInterval: 30_000,
  })

  const pedir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('pedir_acesso_prontuario', { p_paciente: escolhido!.paciente_id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setEscolhido(null)
      setMotivo('')
      busca.reset()
      void qc.invalidateQueries({ queryKey: ['meus-pedidos-acesso'] })
    },
  })

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancelar_pedido_acesso', { p_pedido: id })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['meus-pedidos-acesso'] }),
  })

  const podeBuscar = documento.trim().length > 0 || (nome.trim().length >= 3 && nascimento !== '')

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <TituloPagina
        icone={FolderSearch}
        titulo="Prontuários fora do plantão"
        descricao="Para ler o prontuário de um paciente que não está nos setores do seu plantão, peça ao gestor da unidade. Aprovado, o acesso vale 24 horas e é só de leitura."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Identificar o paciente</CardTitle>
          <CardDescription>Use o número do prontuário, o CPF ou o CNS exatos. Sem documento, informe o nome e a data de nascimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              if (podeBuscar) busca.mutate()
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="doc">Prontuário, CPF ou CNS</Label>
              <Input id="doc" value={documento} onChange={(e) => setDocumento(e.target.value)} autoComplete="off" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nome">ou nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} disabled={!!documento.trim()} autoComplete="off" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="nasc">e nascimento</Label>
              <Input id="nasc" type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} disabled={!!documento.trim()} />
            </div>
            <Button type="submit" disabled={!podeBuscar || busca.isPending}>
              <Search className="size-4" /> Buscar
            </Button>
          </form>
          {busca.error && <p className="mt-3 text-sm text-critico">{(busca.error as Error).message}</p>}
          {busca.data && busca.data.length === 0 && <p className="mt-3 text-sm text-tinta-sussurro">Nenhum paciente com essa identificação nesta unidade.</p>}
          {busca.data && busca.data.length > 0 && (
            <ul className="mt-4 divide-y rounded-lg border">
              {busca.data.map((a) => (
                <li key={a.paciente_id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <div className="font-medium">{a.nome}</div>
                    <div className="text-xs text-tinta-sussurro">
                      {a.data_nascimento ? 'nasc. ' + fmtData(a.data_nascimento) : 'sem data de nascimento'}
                      {a.prontuario ? ' · prontuário ' + a.prontuario : ''}
                      {a.ultimo_encerramento ? ' · último atendimento encerrado em ' + fmtDataHora(a.ultimo_encerramento) : ''}
                    </div>
                  </div>
                  {a.tem_acesso ? (
                    <Button variant="outline" size="sm" render={<Link to={`/prontuarios/${a.paciente_id}`} />}>Ler prontuário</Button>
                  ) : (
                    <Button variant={escolhido?.paciente_id === a.paciente_id ? 'default' : 'outline'} size="sm" onClick={() => setEscolhido(a)}>
                      Pedir acesso
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {escolhido && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Motivo do pedido — {escolhido.nome}</CardTitle>
            <CardDescription>O gestor lê o motivo para decidir. O pedido e a decisão ficam na trilha de auditoria da unidade.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: paciente retornou e preciso da evolução do atendimento anterior." />
            <div className="flex items-center gap-2">
              <Button onClick={() => pedir.mutate()} disabled={motivo.trim().length < 10 || pedir.isPending}>Enviar ao gestor</Button>
              <Button variant="ghost" onClick={() => setEscolhido(null)}>Cancelar</Button>
              {motivo.trim().length < 10 && <span className="text-xs text-tinta-sussurro">Pelo menos 10 caracteres.</span>}
            </div>
            {pedir.error && <p className="text-sm text-critico">{(pedir.error as Error).message}</p>}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meus pedidos (últimos 30 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {meus.isLoading && <Spinner />}
          {meus.error && <p className="text-sm text-critico">{(meus.error as Error).message}</p>}
          {meus.data && meus.data.length === 0 && <p className="text-sm text-tinta-sussurro">Nenhum pedido.</p>}
          {meus.data && meus.data.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {meus.data.map((p) => (
                <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.paciente_nome}</span>
                      <StatusPedido status={p.status} vigente={p.status === 'aprovado' ? p.vigente : undefined} />
                    </div>
                    <div className="mt-0.5 text-xs text-tinta-sussurro">
                      Pedido em {fmtDataHora(p.criado_em)}
                      {p.status === 'aprovado' && p.valido_ate ? ' · vale até ' + fmtDataHora(p.valido_ate) : ''}
                    </div>
                    <p className="mt-1 text-sm">{p.motivo}</p>
                    {p.status === 'recusado' && p.motivo_decisao && <p className="mt-1 text-sm text-critico">Motivo da recusa: {p.motivo_decisao}</p>}
                  </div>
                  {p.vigente && <Button size="sm" render={<Link to={`/prontuarios/${p.paciente_id}`} />}>Ler prontuário</Button>}
                  {p.status === 'pendente' && (
                    <Button size="sm" variant="ghost" onClick={() => cancelar.mutate(p.id)} disabled={cancelar.isPending}>Cancelar pedido</Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
