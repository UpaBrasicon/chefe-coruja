import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ScrollText, ShieldCheck, ShieldAlert, X } from 'lucide-react'
import * as React from 'react'

import { TabsPagina, type AbaDef } from '@/components/TabsPagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useUnidade } from '@/contexts/UnidadeContext'
import { supabase } from '@/lib/supabase'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { StatusPedido } from '@/pages/prontuario/PedidosProntuario'

// Auditoria da unidade (fase 6): pedidos de acesso ao prontuário encerrado,
// acessos ao prontuário (log_acesso_prontuario) e trilha de ações
// (log_auditoria, cadeia de hash). Tudo por RPC restrita ao gestor da unidade.

type Pedido = {
  id: string
  paciente_nome: string
  paciente_nascimento: string | null
  solicitante_nome: string
  papel: string
  motivo: string
  status: 'pendente' | 'aprovado' | 'recusado' | 'cancelado'
  criado_em: string
  decidido_por_nome: string | null
  decidido_em: string | null
  motivo_decisao: string | null
  valido_ate: string | null
  /** calculado ao buscar (vigente agora) */
  vigente?: boolean
}
type Acesso = {
  id: string
  criado_em: string
  profissional_nome: string
  papel: string | null
  paciente_nome: string
  tipo_acesso: string
  documento_tipo: string | null
  ip: string | null
  via_pedido: boolean
}
type Trilha = { seq: number; criado_em: string; ator_nome: string | null; acao: string; entidade: string; entidade_id: string | null; payload: Record<string, unknown> | null }

const TIPO_ACESSO: Record<string, string> = { leitura_prontuario: 'Leitura', leitura_documento: 'Leitura de documento', impressao: 'Impressão', exportacao: 'Exportação' }
const PAPEL: Record<string, string> = { plantonista: 'plantonista', enfermeiro: 'enfermeiro', tecnico_enfermagem: 'técnico de enfermagem', farmaceutico: 'farmacêutico', telemedicina: 'telemedicina', gestor: 'gestor', recepcao: 'recepção' }

const hoje = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const diasAtras = (n: number) => new Date(Date.now() - n * 86_400_000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
const inicioDoDia = (d: string) => new Date(d + 'T00:00:00-03:00').toISOString()
const fimDoDia = (d: string) => new Date(d + 'T23:59:59.999-03:00').toISOString()

function Periodo({ de, ate, setDe, setAte }: { de: string; ate: string; setDe: (v: string) => void; setAte: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5"><Label htmlFor="de">De</Label><Input id="de" type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} /></div>
      <div className="grid gap-1.5"><Label htmlFor="ate">Até</Label><Input id="ate" type="date" value={ate} min={de} max={hoje()} onChange={(e) => setAte(e.target.value)} /></div>
    </div>
  )
}

function PedidosAcesso() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const [motivos, setMotivos] = React.useState<Record<string, string>>({})

  const { data, isLoading, error } = useQuery({
    queryKey: ['pedidos-acesso-unidade', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pedidos_acesso_da_unidade', { p_unidade: unidadeId!, p_dias: 30 })
      if (error) throw error
      const agora = Date.now()
      return ((data ?? []) as Pedido[]).map((p) => ({ ...p, vigente: p.status === 'aprovado' && !!p.valido_ate && Date.parse(p.valido_ate) > agora }))
    },
  })

  const decidir = useMutation({
    mutationFn: async ({ id, aprovar }: { id: string; aprovar: boolean }) => {
      const { error } = await supabase.rpc('decidir_pedido_acesso', { p_pedido: id, p_aprovar: aprovar, p_motivo: motivos[id]?.trim() || undefined })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pedidos-acesso-unidade'] })
      void qc.invalidateQueries({ queryKey: ['painel-gestor'] })
    },
  })

  if (isLoading) return <Spinner />
  if (error) return <p className="text-sm text-critico">{(error as Error).message}</p>
  const pendentes = (data ?? []).filter((p) => p.status === 'pendente')
  const decididos = (data ?? []).filter((p) => p.status !== 'pendente')

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aguardando decisão ({pendentes.length})</CardTitle>
          <CardDescription>Aprovado, o acesso vale 24 horas a partir de agora e é só de leitura. Para recusar, escreva o motivo: quem pediu vai lê-lo.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendentes.length === 0 && <p className="text-sm text-tinta-sussurro">Nenhum pedido pendente.</p>}
          <ul className="flex flex-col gap-3">
            {pendentes.map((p) => (
              <li key={p.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{p.solicitante_nome}</span>
                  <span className="text-tinta-sussurro">({PAPEL[p.papel] ?? p.papel}) pede o prontuário de</span>
                  <span className="font-medium">{p.paciente_nome}</span>
                  {p.paciente_nascimento && <span className="text-tinta-sussurro">nasc. {fmtData(p.paciente_nascimento)}</span>}
                </div>
                <div className="text-xs text-tinta-sussurro">{fmtDataHora(p.criado_em)}</div>
                <p className="mt-2 rounded bg-trilha/60 p-2 text-sm">{p.motivo}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Input className="max-w-sm" placeholder="Motivo (obrigatório para recusar)" value={motivos[p.id] ?? ''}
                    onChange={(e) => setMotivos((m) => ({ ...m, [p.id]: e.target.value }))} />
                  <Button size="sm" onClick={() => decidir.mutate({ id: p.id, aprovar: true })} disabled={decidir.isPending}><Check className="size-4" />Aprovar por 24 h</Button>
                  <Button size="sm" variant="destructive" onClick={() => decidir.mutate({ id: p.id, aprovar: false })}
                    disabled={decidir.isPending || (motivos[p.id]?.trim().length ?? 0) < 5}><X className="size-4" />Recusar</Button>
                </div>
              </li>
            ))}
          </ul>
          {decidir.error && <p className="mt-3 text-sm text-critico">{(decidir.error as Error).message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Decididos nos últimos 30 dias</CardTitle></CardHeader>
        <CardContent>
          {decididos.length === 0 ? <p className="text-sm text-tinta-sussurro">Nenhum.</p> : (
            <ul className="divide-y rounded-lg border">
              {decididos.map((p) => (
                <li key={p.id} className="p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{p.solicitante_nome}</span>
                    <span className="text-tinta-sussurro">→</span>
                    <span>{p.paciente_nome}</span>
                    <StatusPedido status={p.status} vigente={p.status === 'aprovado' ? p.vigente : undefined} />
                  </div>
                  <div className="text-xs text-tinta-sussurro">
                    Pedido {fmtDataHora(p.criado_em)}
                    {p.decidido_em ? ` · decidido por ${p.decidido_por_nome ?? '—'} em ${fmtDataHora(p.decidido_em)}` : ''}
                    {p.valido_ate ? ` · vale até ${fmtDataHora(p.valido_ate)}` : ''}
                  </div>
                  <p className="mt-1">{p.motivo}</p>
                  {p.motivo_decisao && <p className="mt-1 text-tinta-apoio">Decisão: {p.motivo_decisao}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function AcessosProntuario() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [de, setDe] = React.useState(diasAtras(7))
  const [ate, setAte] = React.useState(hoje())
  const [filtro, setFiltro] = React.useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['acessos-prontuario', unidadeId, de, ate],
    enabled: !!unidadeId && !!de && !!ate,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('acessos_prontuario_da_unidade', { p_unidade: unidadeId!, p_desde: inicioDoDia(de), p_ate: fimDoDia(ate) })
      if (error) throw error
      return (data ?? []) as Acesso[]
    },
  })

  const f = filtro.trim().toLowerCase()
  const linhas = (data ?? []).filter((a) => !f || a.profissional_nome.toLowerCase().includes(f) || a.paciente_nome.toLowerCase().includes(f))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quem abriu, imprimiu ou exportou prontuário</CardTitle>
        <CardDescription>Registro feito pelo servidor a cada abertura (agrupada em 5 minutos) e a cada impressão. No máximo 1000 linhas por consulta.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Periodo de={de} ate={ate} setDe={setDe} setAte={setAte} />
          <div className="grid gap-1.5"><Label htmlFor="filtro">Profissional ou paciente</Label><Input id="filtro" value={filtro} onChange={(e) => setFiltro(e.target.value)} /></div>
        </div>
        {isLoading && <Spinner />}
        {error && <p className="text-sm text-critico">{(error as Error).message}</p>}
        {data && (
          <div className="overflow-x-auto">
            <p className="mb-2 text-xs text-tinta-sussurro">{linhas.length} registro{linhas.length === 1 ? '' : 's'}{data.length >= 1000 ? ' · limite atingido, reduza o período' : ''}</p>
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs text-tinta-sussurro">
                <tr><th className="py-1.5 font-medium">Quando</th><th className="font-medium">Profissional</th><th className="font-medium">Paciente</th><th className="font-medium">Tipo</th><th className="font-medium">Origem</th></tr>
              </thead>
              <tbody>
                {linhas.map((a) => (
                  <tr key={a.id} className="border-t">
                    <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDataHora(a.criado_em)}</td>
                    <td className="pr-2">{a.profissional_nome}<span className="text-xs text-tinta-sussurro"> · {PAPEL[a.papel ?? ''] ?? a.papel ?? '—'}</span></td>
                    <td className="pr-2">{a.paciente_nome}</td>
                    <td className="pr-2">{TIPO_ACESSO[a.tipo_acesso] ?? a.tipo_acesso}{a.documento_tipo ? ` · ${a.documento_tipo.replace(/_/g, ' ')}` : ''}</td>
                    <td>{a.via_pedido ? <Badge variant="info">pedido aprovado</Badge> : <span className="text-xs text-tinta-sussurro">{a.papel === 'gestor' ? 'gestor (sem pedido)' : 'escala'}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TrilhaUnidade() {
  const { unidadeAtiva } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const [de, setDe] = React.useState(diasAtras(7))
  const [ate, setAte] = React.useState(hoje())

  const integridade = useQuery({
    queryKey: ['integridade-trilha', unidadeId],
    enabled: !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('integridade_trilha', { p_unidade: unidadeId! })
      if (error) throw error
      return data as unknown as { integra: boolean; quebra_seq: number | null; conferido_em: string; registros: number }
    },
  })
  const trilha = useQuery({
    queryKey: ['trilha-unidade', unidadeId, de, ate],
    enabled: !!unidadeId && !!de && !!ate,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('trilha_da_unidade', { p_unidade: unidadeId!, p_desde: inicioDoDia(de), p_ate: fimDoDia(ate) })
      if (error) throw error
      return (data ?? []) as Trilha[]
    },
  })

  const i = integridade.data
  return (
    <div className="flex flex-col gap-4">
      {i && (
        <div className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${i.integra ? 'border-conforme/30 bg-conforme/[0.06]' : 'border-critico/40 bg-critico/[0.08] text-critico'}`}>
          {i.integra ? <ShieldCheck className="size-4 text-conforme" /> : <ShieldAlert className="size-4" />}
          {i.integra
            ? `Cadeia de auditoria íntegra: ${i.registros} registros conferidos em ${fmtDataHora(i.conferido_em)}.`
            : `Cadeia de auditoria QUEBRADA no registro ${i.quebra_seq}. Algum registro foi alterado fora do sistema: acione o suporte e preserve o banco.`}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trilha de ações da unidade</CardTitle>
          <CardDescription>Só inserção, encadeada por hash. Os detalhes guardam apenas campos de uma lista fechada, sem dado clínico.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Periodo de={de} ate={ate} setDe={setDe} setAte={setAte} />
          {trilha.isLoading && <Spinner />}
          {trilha.error && <p className="text-sm text-critico">{(trilha.error as Error).message}</p>}
          {trilha.data && trilha.data.length === 0 && <p className="text-sm text-tinta-sussurro">Nenhuma ação no período.</p>}
          {trilha.data && trilha.data.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-tinta-sussurro">
                  <tr><th className="py-1.5 font-medium">Nº</th><th className="font-medium">Quando</th><th className="font-medium">Quem</th><th className="font-medium">Ação</th><th className="font-medium">Detalhes</th></tr>
                </thead>
                <tbody>
                  {trilha.data.map((t) => (
                    <tr key={t.seq} className="border-t align-top">
                      <td className="py-1.5 pr-2 tabular text-tinta-sussurro">{t.seq}</td>
                      <td className="pr-2 whitespace-nowrap">{fmtDataHora(t.criado_em)}</td>
                      <td className="pr-2">{t.ator_nome ?? 'sistema'}</td>
                      <td className="pr-2">{t.acao.replace(/_/g, ' ')}<span className="text-xs text-tinta-sussurro"> · {t.entidade.replace(/_/g, ' ')}</span></td>
                      <td className="text-xs text-tinta-apoio">
                        {t.payload ? Object.entries(t.payload).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join(' · ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function Auditoria() {
  const abas: AbaDef[] = [
    { valor: 'pedidos', rotulo: 'Pedidos de acesso', conteudo: () => <PedidosAcesso /> },
    { valor: 'acessos', rotulo: 'Acessos ao prontuário', conteudo: () => <AcessosProntuario /> },
    { valor: 'trilha', rotulo: 'Trilha da unidade', conteudo: () => <TrilhaUnidade /> },
  ]
  return (
    <TabsPagina
      titulo="Auditoria"
      descricao="Pedidos de acesso ao prontuário encerrado, quem abriu cada prontuário e a trilha de ações da unidade."
      icone={ScrollText}
      abas={abas}
    />
  )
}
