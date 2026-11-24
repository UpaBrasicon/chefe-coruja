import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FolderSearch, Search } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { TituloPagina } from '@/components/monitor/Pagina'
import type { SituacaoPedido } from '@/components/prontuario/StatusPedido'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { HORAS_URGENCIA, letrasDaJustificativa, MIN_LETRAS_URGENCIA, podeAbrirUrgencia } from '@/lib/acessoUrgencia'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { dataIso, diaMesHora, hora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Pedido de acesso ao prontuário encerrado (fase 6, migration 20261001000001).
// Fora da escala o profissional não lista pacientes: identifica por documento
// exato, ou por nome com data de nascimento. O gestor aprova; vale 24 horas,
// só leitura.
//
// Revisão do perfil Médico (RT 24/11/2026): os pacientes do plantão abrem
// direto (M1, mesma consulta da paleta); o pedido em passos visíveis com um
// campo só de busca (M2) — nome ainda pede a data de nascimento, regra do
// banco; "Meus pedidos" com a situação e abrir direto quando aprovado (M3).
//
// Regra do RT (24/11/2026, revisão do perfil Enfermeiro): Prontuários serve
// para quem já esteve na unidade e saiu; quem está internado agora fica na
// Internação (e no Pronto-Socorro da enfermagem). Sai o bloco "Pacientes do seu
// plantão"; fica uma linha com o caminho.
//
// Urgência, a quebra de vidro (ajustes da revisão, item 6, RT em 24/11/2026;
// migration 20270421000075): o médico abre na hora, sem o gestor, com
// justificativa de 20 letras ou mais; só leitura, por 2 horas; vai à auditoria
// e o gestor da unidade recebe aviso.

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
  status: SituacaoPedido
  criado_em: string
  decidido_em: string | null
  motivo_decisao: string | null
  valido_ate: string | null
  vigente: boolean
}

const PASSOS = ['Paciente', 'Motivo', 'Aprovação do gestor'] as const

function Passos({ atual }: { atual: number }) {
  return (
    <ol aria-label="Passos do pedido" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-apoio">
      {PASSOS.map((p, i) => (
        <li key={p} className="flex items-center gap-1.5" aria-current={i === atual ? 'step' : undefined}>
          {i > 0 && <span aria-hidden className="mr-1.5 text-tinta-sussurro">·</span>}
          <span aria-hidden className={cn('inline-flex size-5 items-center justify-center rounded-capsula text-rotulo font-semibold tabular-nums',
            i === atual ? 'bg-acao text-sobre-acao' : i < atual ? 'bg-acao/15 text-acao' : 'bg-trilha text-tinta-sussurro')}>{i + 1}</span>
          <span className={i === atual ? 'font-medium text-tinta' : 'text-tinta-apoio'}>{p}</span>
        </li>
      ))}
    </ol>
  )
}

/** Situação do pedido em texto: pendente, aprovado até HH:MM, urgência até HH:MM, recusado, expirado. */
function situacao(p: MeuPedido): { texto: string; tom: string } {
  if (p.status === 'pendente') return { texto: 'Pendente com o gestor', tom: 'bg-atencao/10 text-atencao' }
  if (p.status === 'recusado') return { texto: 'Recusado', tom: 'bg-critico/10 text-critico' }
  if (p.status === 'cancelado') return { texto: 'Cancelado', tom: 'bg-trilha text-tinta-apoio' }
  if (p.status === 'urgencia') {
    if (!p.vigente || !p.valido_ate) return { texto: 'Urgência · vencida', tom: 'bg-trilha text-tinta-apoio' }
    const ate = p.valido_ate
    return { texto: dataIso(ate) === dataIso() ? `Urgência até ${hora(ate)}` : `Urgência até ${diaMesHora(ate)}`, tom: 'bg-atencao/10 text-atencao' }
  }
  if (!p.vigente) return { texto: 'Expirado', tom: 'bg-trilha text-tinta-apoio' }
  const ate = p.valido_ate
  const texto = !ate ? 'Aprovado' : dataIso(ate) === dataIso() ? `Aprovado até ${hora(ate)}` : `Aprovado até ${diaMesHora(ate)}`
  return { texto, tom: 'bg-conforme/10 text-conforme' }
}

export default function PedidosProntuario() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const qc = useQueryClient()
  const navigate = useNavigate()
  const medico = podeAbrirUrgencia(papelAtivo)

  const [termo, setTermo] = React.useState('')
  const [nascimento, setNascimento] = React.useState('')
  const [escolhido, setEscolhido] = React.useState<Achado | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [modo, setModo] = React.useState<'pedido' | 'urgencia'>('pedido')
  // prontuário, CPF e CNS têm número; nome não tem e pede a data de nascimento
  const ehDocumento = /\d/.test(termo)

  // onde ficam os pacientes de agora, pelo perfil em uso
  const agora: [string, string][] = papelAtivo === 'enfermeiro' || papelAtivo === 'tecnico_enfermagem'
    ? [['/enfermagem/internacao', 'Internação'], ['/enfermagem/pronto-socorro', 'Pronto-Socorro']]
    : papelAtivo === 'plantonista' ? [['/plantao/internacao/pacientes', 'Internação']] : []

  const busca = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('buscar_paciente_para_pedido', {
        p_unidade: unidadeId!,
        p_documento: ehDocumento ? termo.trim() : undefined,
        p_nome: ehDocumento ? undefined : termo.trim() || undefined,
        p_nascimento: ehDocumento ? undefined : nascimento || undefined,
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

  const urgencia = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('abrir_acesso_urgencia', { p_paciente: escolhido!.paciente_id, p_justificativa: motivo.trim() })
      if (error) throw error
      return escolhido!.paciente_id
    },
    onSuccess: (pacienteId) => {
      void qc.invalidateQueries({ queryKey: ['meus-pedidos-acesso'] })
      navigate(`/prontuarios/${pacienteId}`)
    },
  })

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancelar_pedido_acesso', { p_pedido: id })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['meus-pedidos-acesso'] }),
  })

  const podeBuscar = ehDocumento ? termo.trim().length > 0 : termo.trim().length >= 3 && nascimento !== ''
  const pendente = (meus.data ?? []).some((p) => p.status === 'pendente')
  const passo = escolhido ? 1 : pendente && !busca.data ? 2 : 0

  return (
    <div className="flex w-full max-w-4xl flex-col gap-4">
      <TituloPagina
        icone={FolderSearch}
        titulo="Prontuários"
        descricao={medico
          ? `Pacientes que já tiveram alta ou saíram da unidade: peça o acesso ao gestor; aprovado, vale 24 horas e é só de leitura. Em urgência, você abre na hora, só leitura, por ${HORAS_URGENCIA} horas, com justificativa; o gestor é avisado.`
          : 'Pacientes que já tiveram alta ou saíram da unidade: peça o acesso ao gestor; aprovado, vale 24 horas e é só de leitura.'}
      />

      {agora.length > 0 && (
        <p className="text-apoio text-tinta-sussurro">
          Quem está na unidade agora fica na{' '}
          {agora.map(([to, rotulo], k) => (
            <React.Fragment key={to}>{k > 0 && ' e no '}<Link to={to} className="text-acao hover:underline">{rotulo}</Link></React.Fragment>
          ))}.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Pedir acesso ao prontuário</CardTitle>
          <CardDescription><Passos atual={passo} /></CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault()
              if (podeBuscar) busca.mutate()
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="pront-busca">Prontuário, CPF, CNS ou nome</Label>
              <Input id="pront-busca" value={termo} onChange={(e) => setTermo(e.target.value)} autoComplete="off"
                placeholder="Número exato ou nome do paciente" />
            </div>
            {!ehDocumento && termo.trim() !== '' && (
              <div className="grid gap-1.5">
                <Label htmlFor="nasc">Nascimento</Label>
                <Input id="nasc" type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
              </div>
            )}
            <Button type="submit" disabled={!podeBuscar || busca.isPending} className="sm:col-start-3">
              <Search className="size-4" /> Buscar
            </Button>
          </form>
          {!ehDocumento && termo.trim() !== '' && !podeBuscar && (
            <p className="-mt-2 text-apoio text-tinta-sussurro">Pelo nome, informe também a data de nascimento.</p>
          )}
          {busca.error && <p className="text-apoio text-critico">{(busca.error as Error).message}</p>}
          {busca.data && busca.data.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhum paciente com essa identificação nesta unidade.</p>}
          {busca.data && busca.data.length > 0 && (
            <ul className="divide-y rounded-controle border">
              {busca.data.map((a) => (
                <li key={a.paciente_id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <div>
                    <div className="font-medium">{a.nome}</div>
                    <div className="text-rotulo text-tinta-sussurro">
                      {a.data_nascimento ? 'nasc. ' + fmtData(a.data_nascimento) : 'sem data de nascimento'}
                      {a.prontuario ? ' · prontuário ' + a.prontuario : ''}
                      {a.ultimo_encerramento ? ' · último atendimento encerrado em ' + fmtDataHora(a.ultimo_encerramento) : ''}
                    </div>
                  </div>
                  {a.tem_acesso ? (
                    <Button variant="outline" size="sm" render={<Link to={`/prontuarios/${a.paciente_id}`} />}>Abrir prontuário</Button>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button variant={escolhido?.paciente_id === a.paciente_id && modo === 'pedido' ? 'default' : 'outline'} size="sm"
                        onClick={() => { setEscolhido(a); setModo('pedido') }}>
                        Pedir acesso
                      </Button>
                      {medico && (
                        <Button variant={escolhido?.paciente_id === a.paciente_id && modo === 'urgencia' ? 'default' : 'outline'} size="sm"
                          onClick={() => { setEscolhido(a); setModo('urgencia') }}>
                          Abrir em urgência
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {escolhido && modo === 'urgencia' && (
            <div className="grid gap-3 rounded-controle border border-atencao/40 bg-campo p-3">
              <Label htmlFor="pront-urgencia">Justificativa da urgência · {escolhido.nome}</Label>
              <Textarea id="pront-urgencia" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
                placeholder="Ex.: paciente chegou em parada e preciso das alergias e do último atendimento." />
              <p className="text-rotulo text-tinta-sussurro">Abre agora, sem esperar o gestor: só leitura, por {HORAS_URGENCIA} horas. A justificativa fica na auditoria da unidade e o gestor recebe aviso.</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => urgencia.mutate()} disabled={letrasDaJustificativa(motivo) < MIN_LETRAS_URGENCIA || urgencia.isPending}>Abrir agora</Button>
                <Button variant="ghost" onClick={() => setEscolhido(null)}>Cancelar</Button>
                {letrasDaJustificativa(motivo) < MIN_LETRAS_URGENCIA && (
                  <span className="text-rotulo text-tinta-sussurro">Falta: a justificativa, com pelo menos {MIN_LETRAS_URGENCIA} letras ({letrasDaJustificativa(motivo)} até agora).</span>
                )}
              </div>
              {urgencia.error && <p className="text-apoio text-critico">{(urgencia.error as Error).message}</p>}
            </div>
          )}

          {escolhido && modo === 'pedido' && (
            <div className="grid gap-3 rounded-controle border border-fio bg-campo p-3">
              <Label htmlFor="pront-motivo">Motivo do pedido · {escolhido.nome}</Label>
              <Textarea id="pront-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
                placeholder="Ex.: paciente retornou e preciso da evolução do atendimento anterior." />
              <p className="text-rotulo text-tinta-sussurro">O gestor lê o motivo para decidir. O pedido e a decisão ficam na trilha de auditoria da unidade.</p>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => pedir.mutate()} disabled={motivo.trim().length < 10 || pedir.isPending}>Enviar ao gestor</Button>
                <Button variant="ghost" onClick={() => setEscolhido(null)}>Cancelar</Button>
                {motivo.trim().length < 10 && <span className="text-rotulo text-tinta-sussurro">Falta: o motivo, com pelo menos 10 caracteres.</span>}
              </div>
              {pedir.error && <p className="text-apoio text-critico">{(pedir.error as Error).message}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">Meus pedidos <span className="font-normal text-tinta-sussurro">· 30 dias</span></CardTitle>
        </CardHeader>
        <CardContent>
          {meus.isLoading && <Spinner />}
          {meus.error && <p className="text-apoio text-critico">{(meus.error as Error).message}</p>}
          {meus.data && meus.data.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhum pedido nos últimos 30 dias.</p>}
          {meus.data && meus.data.length > 0 && (
            <ul className="divide-y rounded-controle border">
              {meus.data.map((p) => {
                const s = situacao(p)
                return (
                  <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {p.vigente
                          ? <Link to={`/prontuarios/${p.paciente_id}`} className="font-medium text-tinta underline-offset-2 hover:text-acao hover:underline">{p.paciente_nome}</Link>
                          : <span className="font-medium">{p.paciente_nome}</span>}
                        <span className={cn('rounded-capsula px-2.5 py-[3px] text-apoio font-medium whitespace-nowrap', s.tom)}>{s.texto}</span>
                      </div>
                      <div className="mt-0.5 text-rotulo text-tinta-sussurro">{p.status === 'urgencia' ? 'Aberto em urgência em ' : 'Pedido em '}{fmtDataHora(p.criado_em)}</div>
                      <p className="mt-1 text-apoio">{p.motivo}</p>
                      {p.status === 'recusado' && p.motivo_decisao && <p className="mt-1 text-apoio text-critico">Motivo da recusa: {p.motivo_decisao}</p>}
                    </div>
                    {p.vigente && <Button size="sm" render={<Link to={`/prontuarios/${p.paciente_id}`} />}>Abrir prontuário</Button>}
                    {p.status === 'pendente' && (
                      <Button size="sm" variant="ghost" onClick={() => cancelar.mutate(p.id)} disabled={cancelar.isPending}>Cancelar pedido</Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
