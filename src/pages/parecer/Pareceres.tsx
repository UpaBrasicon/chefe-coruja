import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, MessageSquare, Printer, Search, X } from 'lucide-react'
import * as React from 'react'

import { Abas, Chip, TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import {
  RESPOSTA_MIN, STATUS_PARECER, mensagem, prioridade, useEspecialidades,
  type PrioridadeParecer, type StatusParecer,
} from '@/components/parecer/comum'
import { Badge } from '@/components/ui/badge'
import { BotaoLinha, OpcaoLista } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { fmtData, fmtDataHora } from '@/lib/datas'
import { diaMesHora } from '@/lib/formato'
import { imprimirRelatorio } from '@/lib/prontuario'
import { normalizar } from '@/lib/search'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Tela Pareceres (protótipo: Plantão › Internação › Parecer médico, 2400–2464,
// parecerVals). Fila dos pedidos da unidade nas especialidades que eu declarei,
// por prioridade; abrir, iniciar análise (fica o nome e a hora), ler o resumo
// do paciente (só enquanto analisa e até 24 h depois de concluir), salvar
// rascunho, concluir ou cancelar a análise. Migration 20261004000002.

type ItemFila = {
  id: string
  paciente_id: string
  paciente_nome: string
  paciente_nascimento: string | null
  local: string | null
  especialidade: string
  prestador: string | null
  prioridade: PrioridadeParecer
  pergunta: string
  status: StatusParecer
  solicitante_nome: string
  solicitado_em: string
  analista_nome: string | null
  analise_iniciada_em: string | null
  rascunho: string | null
  rascunho_salvo_em: string | null
  resposta: string | null
  respondido_em: string | null
  documento_solicitacao_numero: string | null
  documento_resposta_numero: string | null
  minha: boolean
  posso_analisar: boolean
}

type DadosPaciente = {
  paciente: { nome: string; nome_social: string | null; nascimento: string | null; sexo: string | null; prontuario: string | null } | null
  alergias: { substancia: string; reacao: string | null; gravidade: string | null }[]
  exames: { exame: string; situacao: string; pedido_em: string; resultado: string | null; resolvido_em: string | null }[]
  documentos: { tipo: string; numero: string | null; emitido_em: string | null; autor: string | null; conteudo: string }[]
}

const CARTAO = 'rounded-container border border-fio bg-superficie shadow-[0_1px_2px_rgba(15,23,42,0.04)]'

// ── minhas especialidades ───────────────────────────────────────────────────
// Revisão do perfil Médico (RT 24/11/2026, M1): busca com seleção múltipla
// em fichas, sem a parede das 41 especialidades. No perfil Médico só as
// especialidades médicas; as multiprofissionais ficam para os outros perfis.
const NAO_MEDICAS = new Set(['fisioterapia', 'fonoaudiologia', 'nutricao', 'psicologia', 'servico social',
  'enfermagem', 'farmacia', 'terapia ocupacional', 'odontologia'])
const ehMedica = (e: string) => !NAO_MEDICAS.has(normalizar(e).trim())

function useMinhasEspecialidades(perfilId: string) {
  return useQuery({
    queryKey: ['pareceres', 'minhas-especialidades', perfilId],
    enabled: !!perfilId,
    queryFn: async () => {
      const { data, error } = await supabase.from('especialidades_perfil').select('especialidade').eq('perfil_id', perfilId)
      if (error) throw error
      return (data ?? []).map((e) => e.especialidade)
    },
  })
}

function EditarEspecialidades({ atuais, soMedicas, fechar }: { atuais: string[]; soMedicas: boolean; fechar: () => void }) {
  const qc = useQueryClient()
  const todas = useEspecialidades()
  const [marcadas, setMarcadas] = React.useState<string[]>(atuais)
  const [termo, setTermo] = React.useState('')
  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('definir_minhas_especialidades', { p_especialidades: marcadas })
      if (error) throw error
    },
    onSuccess: () => {
      fechar()
      void qc.invalidateQueries({ queryKey: ['pareceres'] })
    },
  })
  const opcoes = (todas.data ?? []).filter((e) => (!soMedicas || ehMedica(e)) && !marcadas.includes(e))
  const t = normalizar(termo.trim())
  const achadas = t ? opcoes.filter((e) => normalizar(e).includes(t)).slice(0, 8) : []

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-apoio text-tinta-sussurro">
        Busque e escolha as especialidades em que você responde parecer nesta rede. A declaração fica registrada na auditoria.
      </p>
      {marcadas.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Especialidades escolhidas">
          {marcadas.map((e) => (
            <span key={e} className="inline-flex items-center gap-1.5 rounded-capsula border border-acao/40 bg-acao/10 py-1 pr-1.5 pl-[11px] text-apoio font-medium text-acao">
              {e}
              <Button variant="ghost" size="icon-xs" aria-label={`Tirar ${e}`} onClick={() => setMarcadas((m) => m.filter((x) => x !== e))}
                className="size-auto p-0.5 text-acao hover:text-acao-pressionada">
                <X className="size-3.5" aria-hidden />
              </Button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
        <Input aria-label="Buscar especialidade" className="pl-9" placeholder="Buscar especialidade, ex.: cardio" autoComplete="off"
          value={termo} onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && achadas.length > 0) { e.preventDefault(); setMarcadas((m) => [...m, achadas[0]]); setTermo('') }
          }} />
      </div>
      {achadas.length > 0 && (
        <div role="listbox" aria-label="Especialidades encontradas" className="overflow-hidden rounded-controle border border-fio bg-superficie">
          {achadas.map((e) => (
            <OpcaoLista key={e} onClick={() => { setMarcadas((m) => [...m, e]); setTermo('') }} className="text-controle text-tinta hover:bg-campo">{e}</OpcaoLista>
          ))}
        </div>
      )}
      {t && achadas.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhuma especialidade com esse nome{soMedicas ? ' entre as médicas' : ''}.</span>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {salvar.error && <span className="mr-auto text-apoio text-critico">{mensagem(salvar.error)}</span>}
        <Button size="sm" variant="ghost" onClick={fechar}>Voltar</Button>
        <Button size="sm" onClick={() => salvar.mutate()} disabled={salvar.isPending}>Salvar especialidades</Button>
      </div>
    </div>
  )
}

// ── resumo do paciente (leitura temporária) ─────────────────────────────────
function ResumoPaciente({ parecerId }: { parecerId: string }) {
  const dados = useQuery({
    queryKey: ['pareceres', 'dados', parecerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('parecer_dados_paciente', { p_id: parecerId })
      if (error) throw error
      return data as unknown as DadosPaciente
    },
  })
  if (dados.isLoading) return <div className={`${CARTAO} px-5 py-4`}><Spinner /></div>
  if (dados.error) return <div className={`${CARTAO} px-5 py-4 text-apoio text-critico`}>{mensagem(dados.error)}</div>
  const d = dados.data!
  return (
    <>
      <div className={`${CARTAO} flex flex-col gap-2 px-5 py-4`}>
        <h3 className="text-controle font-semibold text-tinta">Dados do paciente</h3>
        {d.paciente && (
          <span className="text-apoio text-tinta-apoio">
            {d.paciente.nome_social ? `${d.paciente.nome_social} (${d.paciente.nome})` : d.paciente.nome}
            {d.paciente.nascimento ? ` · nasc. ${fmtData(d.paciente.nascimento)}` : ''}
            {d.paciente.sexo ? ` · ${d.paciente.sexo}` : ''}
            {d.paciente.prontuario ? ` · prontuário ${d.paciente.prontuario}` : ''}
          </span>
        )}
        <span className={d.alergias.length ? 'text-apoio font-medium text-critico' : 'text-apoio text-tinta-sussurro'}>
          {d.alergias.length
            ? `Alergias: ${d.alergias.map((a) => a.substancia + (a.reacao ? ` (${a.reacao})` : '')).join(' · ')}`
            : 'Nenhuma alergia registrada.'}
        </span>
        <p className="text-rotulo text-tinta-sussurro">Leitura registrada no log do prontuário. Vale enquanto você analisa e até 24 h depois de concluir.</p>
      </div>
      <div className={`${CARTAO} flex flex-col gap-2 px-5 py-4`}>
        <h3 className="text-controle font-semibold text-tinta">Exames do paciente</h3>
        {d.exames.length === 0 && <span className="text-apoio text-tinta-sussurro">Nenhum exame registrado no sistema para este paciente.</span>}
        {d.exames.map((x, i) => (
          <div key={i} className="text-apoio text-tinta">
            {x.exame} · {x.situacao === 'resultado' && x.resolvido_em ? `resultado ${fmtDataHora(x.resolvido_em)}` : `pedido ${fmtDataHora(x.pedido_em)}`}
            {x.resultado && <p className="mt-0.5 whitespace-pre-wrap text-tinta-apoio">{x.resultado}</p>}
          </div>
        ))}
      </div>
      {d.documentos.length > 0 && (
        <div className={`${CARTAO} flex flex-col gap-2 px-5 py-4`}>
          <h3 className="text-controle font-semibold text-tinta">Últimos registros clínicos</h3>
          {d.documentos.map((doc, i) => (
            <details key={i} className="rounded-controle border border-fio bg-campo px-3 py-2">
              <summary className="cursor-pointer text-apoio text-tinta">
                {doc.tipo.replace(/_/g, ' ')}{doc.numero ? ` nº ${doc.numero}` : ''}
                {doc.emitido_em ? ` · ${fmtDataHora(doc.emitido_em)}` : ''}{doc.autor ? ` · ${doc.autor}` : ''}
              </summary>
              <p className="mt-2 text-apoio leading-normal whitespace-pre-wrap text-tinta-apoio">{doc.conteudo}</p>
            </details>
          ))}
        </div>
      )}
    </>
  )
}

// ── parecer aberto ──────────────────────────────────────────────────────────
function ParecerAberto({ p, voltar }: { p: ItemFila; voltar: () => void }) {
  const qc = useQueryClient()
  const [texto, setTexto] = React.useState(p.rascunho ?? '')
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['pareceres'] })
  const rpc = useMutation({
    mutationFn: async (acao: 'iniciar' | 'cancelar' | 'salvar' | 'concluir') => {
      const r = acao === 'iniciar' ? await supabase.rpc('iniciar_analise_parecer', { p_id: p.id })
        : acao === 'cancelar' ? await supabase.rpc('cancelar_analise_parecer', { p_id: p.id })
        : acao === 'salvar' ? await supabase.rpc('salvar_rascunho_parecer', { p_id: p.id, p_texto: texto })
        : await supabase.rpc('concluir_parecer', { p_id: p.id, p_resposta: texto.trim() })
      if (r.error) throw r.error
      return acao
    },
    onSuccess: (acao) => {
      invalidar()
      if (acao === 'concluir' || acao === 'cancelar') voltar()
    },
  })

  // hora de abertura: a janela de 24 h é conferida de novo no banco
  const [abertoEm] = React.useState(() => Date.now())
  const meu = p.minha && p.status === 'em_analise'
  const outro = p.status === 'em_analise' && !p.minha
  const leitura = p.minha && (p.status === 'em_analise' || (p.status === 'realizado' && !!p.respondido_em
    && abertoEm - new Date(p.respondido_em).getTime() < 24 * 3600_000))
  const pr = prioridade(p.prioridade)

  return (
    <>
      <Button variant="ghost" size="sm" onClick={voltar} className="self-start gap-1.5 px-0 text-tinta-apoio">
        <ChevronLeft className="size-3.5" />Voltar aos pareceres
      </Button>
      <div className={`${CARTAO} flex flex-col gap-2.5 px-5 py-4`}>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-secao font-semibold text-tinta">{p.paciente_nome}</span>
          <span className="text-apoio text-tinta-sussurro">
            {[p.paciente_nascimento ? `nasc. ${fmtData(p.paciente_nascimento)}` : '', p.local ?? ''].filter(Boolean).join(' · ')}
          </span>
          <Badge className="ml-auto" variant={STATUS_PARECER[p.status].variante}>{STATUS_PARECER[p.status].rotulo}</Badge>
        </div>
        <span className="flex flex-wrap items-center gap-2 text-controle font-medium text-tinta">
          {p.especialidade}{p.prestador ? ` · para ${p.prestador}` : ''}
          <Badge variant={pr.variante}>{pr.rotulo}</Badge>
        </span>
        <span className="text-apoio text-tinta-sussurro">
          Pedido por {p.solicitante_nome} em {fmtDataHora(p.solicitado_em)}
          {p.documento_solicitacao_numero ? ` · documento nº ${p.documento_solicitacao_numero}` : ''}
        </span>
        <span className="text-controle leading-relaxed whitespace-pre-wrap text-pretty text-tinta">{p.pergunta}</span>
        {p.status === 'em_analise' && p.analista_nome && (
          <span className="text-apoio text-suprimento">
            Em análise desde {p.analise_iniciada_em ? fmtDataHora(p.analise_iniciada_em) : ''} por {p.analista_nome}
          </span>
        )}
      </div>

      {leitura && <ResumoPaciente parecerId={p.id} />}

      <div className={`${CARTAO} flex flex-col gap-2.5 px-5 py-4`}>
        {p.status === 'solicitado' && (p.posso_analisar ? (
          <>
            <span className="text-apoio text-tinta-apoio">Inicie a análise para ler o paciente e registrar o parecer. A data, a hora e o seu nome ficam no pedido.</span>
            <div><Button onClick={() => rpc.mutate('iniciar')} disabled={rpc.isPending}>Iniciar análise</Button></div>
          </>
        ) : (
          <span className="text-apoio text-tinta-sussurro">Você não responde esta especialidade (ou foi quem pediu).</span>
        ))}
        {outro && <span className="text-apoio text-atencao">{p.analista_nome} está analisando este parecer.</span>}
        {meu && (
          <>
            <label htmlFor="resposta-parecer" className="text-apoio font-medium text-tinta-apoio">Parecer</label>
            <Textarea id="resposta-parecer" rows={8} value={texto} onChange={(e) => setTexto(e.target.value)}
              placeholder="Avaliação do especialista, conduta sugerida e se volta a acompanhar" />
            {p.rascunho_salvo_em && <span className="text-rotulo text-tinta-sussurro">Rascunho salvo em {fmtDataHora(p.rascunho_salvo_em)}</span>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="destructive" onClick={() => rpc.mutate('cancelar')} disabled={rpc.isPending}>Cancelar análise</Button>
              <Button variant="outline" onClick={() => void imprimirRelatorio({ tipo: 'pareceres', pacienteId: p.paciente_id, ids: [p.id] })}>
                <Printer className="size-3.5" />Imprimir
              </Button>
              <Button variant="outline" onClick={() => rpc.mutate('salvar')} disabled={rpc.isPending}>Salvar</Button>
              <Button onClick={() => rpc.mutate('concluir')} disabled={rpc.isPending || texto.trim().length < RESPOSTA_MIN}>
                <Check className="size-3.5" />Salvar e concluir
              </Button>
            </div>
          </>
        )}
        {p.status === 'realizado' && (
          <div className="rounded-controle border border-conforme/30 bg-alerta-conforme p-2.5">
            <p className="text-rotulo text-tinta-sussurro">
              Respondido em {p.respondido_em ? fmtDataHora(p.respondido_em) : ''}
              {p.documento_resposta_numero ? ` · documento nº ${p.documento_resposta_numero}` : ''}
            </p>
            <p className="mt-1 text-apoio whitespace-pre-wrap text-tinta">{p.resposta}</p>
            <Button size="sm" variant="outline" className="mt-2"
              onClick={() => void imprimirRelatorio({ tipo: 'pareceres', pacienteId: p.paciente_id, ids: [p.id] })}>
              <Printer className="size-3.5" />Imprimir
            </Button>
          </div>
        )}
        {rpc.error && <span className="text-apoio text-critico">{mensagem(rpc.error)}</span>}
      </div>
    </>
  )
}

// ── linha da fila ───────────────────────────────────────────────────────────
function Linha({ p, abrir }: { p: ItemFila; abrir: () => void }) {
  const pr = prioridade(p.prioridade)
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-trilha px-5 py-3 last:border-b-0">
      <span className="tabular w-[82px] shrink-0 text-apoio font-semibold text-tinta">
        {diaMesHora(p.solicitado_em)}
      </span>
      <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
        <span className="text-controle font-medium text-tinta">{p.paciente_nome}</span>
        <span className="text-apoio text-tinta-sussurro">{[p.local, `Pedido por ${p.solicitante_nome}`].filter(Boolean).join(' · ')}</span>
      </div>
      <div className="flex min-w-0 flex-[2_1_260px] flex-col gap-0.5">
        <span className="text-controle font-medium text-tinta">{p.especialidade}{p.prestador ? ` · para ${p.prestador}` : ''}</span>
        <span className="line-clamp-2 text-apoio text-tinta-apoio">{p.pergunta}</span>
      </div>
      <Badge variant={pr.variante}>{pr.rotulo}</Badge>
      <Badge variant={STATUS_PARECER[p.status].variante}>{STATUS_PARECER[p.status].rotulo}</Badge>
      <Button size="sm" variant="outline" onClick={abrir}><MessageSquare className="size-3.5" />Abrir</Button>
    </div>
  )
}

// ── que eu pedi (M2) ────────────────────────────────────────────────────────
// Os pedidos de parecer feitos por mim nesta unidade (a RLS de
// pareceres_medicos já deixa o solicitante ler os dele), 30 dias.
type MeuPedido = {
  id: string
  paciente_id: string
  especialidade: string
  prestador: string | null
  prioridade: string
  pergunta: string
  status: StatusParecer
  solicitado_em: string
  analise_iniciada_em: string | null
  respondido_em: string | null
  resposta: string | null
  cancelado_em: string | null
  motivo_cancelamento: string | null
  pacientes: { nome: string } | null
}

function useQueEuPedi(unidadeId: string | undefined, perfilId: string | undefined) {
  return useQuery({
    queryKey: ['pareceres', 'que-eu-pedi', unidadeId, perfilId],
    enabled: !!unidadeId && !!perfilId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const desde = new Date(Date.now() - 30 * 24 * 3600_000).toISOString()
      const { data, error } = await supabase.from('pareceres_medicos')
        .select('id, paciente_id, especialidade, prestador, prioridade, pergunta, status, solicitado_em, analise_iniciada_em, respondido_em, resposta, cancelado_em, motivo_cancelamento, pacientes!pareceres_medicos_paciente_id_fkey(nome)')
        .eq('unidade_id', unidadeId!).eq('solicitante_id', perfilId!).gte('solicitado_em', desde)
        .order('solicitado_em', { ascending: false }).limit(100)
      if (error) throw error
      return (data ?? []) as unknown as MeuPedido[]
    },
  })
}

const ETAPAS_PARECER: [StatusParecer, string, keyof MeuPedido][] = [
  ['solicitado', 'Aguardando', 'solicitado_em'], ['em_analise', 'Em análise', 'analise_iniciada_em'], ['realizado', 'Respondido', 'respondido_em'],
]

function EtapasParecer({ p }: { p: MeuPedido }) {
  if (p.status === 'cancelado') {
    return <p className="text-apoio text-tinta-sussurro">Cancelado{p.cancelado_em ? ` em ${fmtDataHora(p.cancelado_em)}` : ''}{p.motivo_cancelamento ? `: ${p.motivo_cancelamento}` : '.'}</p>
  }
  const atual = ETAPAS_PARECER.findIndex(([k]) => k === p.status)
  return (
    <ol aria-label="Etapa do parecer" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-apoio">
      {ETAPAS_PARECER.map(([k, r, campo], i) => {
        const quando = p[campo] as string | null
        return (
          <li key={k} className="flex items-center gap-2" aria-current={i === atual ? 'step' : undefined}>
            {i > 0 && <span aria-hidden className="text-tinta-sussurro">→</span>}
            <span aria-hidden className={cn('size-2 rounded-capsula', i <= atual ? 'bg-acao' : 'border border-fio-forte bg-superficie')} />
            <span className={i <= atual ? 'font-medium text-tinta' : 'text-tinta-sussurro'}>{r}{i <= atual && quando ? ` · ${diaMesHora(quando)}` : ''}</span>
          </li>
        )
      })}
    </ol>
  )
}

function QueEuPedi({ pedidos }: { pedidos: ReturnType<typeof useQueEuPedi> }) {
  const [abertoId, setAbertoId] = React.useState<string | null>(null)
  const lista = pedidos.data ?? []
  const aberto = lista.find((p) => p.id === abertoId) ?? lista[0] ?? null
  if (pedidos.isLoading) return <div className={`${CARTAO} px-5 py-4`}><Spinner /></div>
  if (pedidos.error) return <p className="text-apoio text-critico">{mensagem(pedidos.error)}</p>
  if (lista.length === 0) {
    return (
      <div className={`${CARTAO} px-5 py-4 text-apoio text-tinta-sussurro`}>
        Nenhum parecer pedido por você nos últimos 30 dias. O pedido é feito no prontuário do paciente, na aba Parecer.
      </div>
    )
  }
  return (
    <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
      <ul className={`${CARTAO} overflow-hidden`}>
        {lista.map((p) => (
          <li key={p.id}>
            <BotaoLinha variante="linha" aria-current={aberto?.id === p.id ? 'true' : undefined}
              className={cn('flex-col gap-0.5', aberto?.id === p.id && 'bg-alerta-marca')} onClick={() => setAbertoId(p.id)}>
              <span className="flex w-full items-baseline gap-2">
                <span className="min-w-0 truncate text-controle font-medium text-tinta">{p.pacientes?.nome ?? 'Paciente'}</span>
                <span className="ml-auto shrink-0 text-rotulo text-tinta-sussurro tabular-nums">{diaMesHora(p.solicitado_em)}</span>
              </span>
              <span className="text-apoio text-tinta-apoio">{p.especialidade} · {STATUS_PARECER[p.status].rotulo}</span>
            </BotaoLinha>
          </li>
        ))}
      </ul>
      {aberto && (
        <div className={`${CARTAO} flex flex-col gap-2.5 px-5 py-4`}>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-corpo font-semibold text-tinta">{aberto.pacientes?.nome ?? 'Paciente'}</span>
            <span className="text-apoio text-tinta-apoio">{aberto.especialidade}{aberto.prestador ? ` · para ${aberto.prestador}` : ''} · {prioridade(aberto.prioridade).rotulo}</span>
          </div>
          <EtapasParecer p={aberto} />
          <p className="text-controle leading-relaxed whitespace-pre-wrap text-pretty text-tinta">{aberto.pergunta}</p>
          {aberto.status === 'realizado' && aberto.resposta && (
            <div className="rounded-controle border border-conforme/30 bg-alerta-conforme p-2.5">
              <p className="text-rotulo text-tinta-sussurro">Parecer em {aberto.respondido_em ? fmtDataHora(aberto.respondido_em) : ''}</p>
              <p className="mt-1 text-apoio whitespace-pre-wrap text-tinta">{aberto.resposta}</p>
              <Button size="sm" variant="outline" className="mt-2"
                onClick={() => void imprimirRelatorio({ tipo: 'pareceres', pacienteId: aberto.paciente_id, ids: [aberto.id] })}>
                <Printer className="size-3.5" />Imprimir
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Pareceres() {
  const { perfil } = useAuth()
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const soMedicas = papelAtivo === 'plantonista' || papelAtivo === 'telemedicina'
  const [aba, setAba] = React.useState<'responder' | 'pedi'>('responder')
  const [filtro, setFiltro] = React.useState('')
  const [abertoId, setAbertoId] = React.useState<string | null>(null)
  const [editando, setEditando] = React.useState(false)

  const fila = useQuery({
    queryKey: ['pareceres', 'fila', unidadeId],
    enabled: !!unidadeId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pareceres_fila', { p_unidade: unidadeId!, p_dias: 7 })
      if (error) throw error
      return (data ?? []) as unknown as ItemFila[]
    },
  })
  const minhas = useMinhasEspecialidades(perfil?.id ?? '')
  const pedidos = useQueEuPedi(unidadeId, perfil?.id)

  if (!unidadeId || !perfil) return <Spinner />
  const todos = fila.data ?? []
  const ativos = todos.filter((p) => p.status === 'solicitado' || p.status === 'em_analise')
  const feitos = todos.filter((p) => p.status === 'realizado')
  const esps = Array.from(new Set(ativos.map((p) => p.especialidade))).sort()
  const f = esps.includes(filtro) ? filtro : ''
  const vis = ativos.filter((p) => !f || p.especialidade === f)
  const aberto = todos.find((p) => p.id === abertoId) ?? null
  const declaradas = minhas.data ?? []
  const semDeclarar = !minhas.isLoading && !minhas.error && declaradas.length === 0
  const pedidosAbertos = (pedidos.data ?? []).filter((p) => p.status === 'solicitado' || p.status === 'em_analise').length

  return (
    <div className="flex w-full max-w-5xl flex-col gap-4">
      <TituloPagina icone={MessageSquare} titulo="Pareceres"
        descricao="Pedidos de parecer às especialidades que você responde e os que você pediu. O parecer entra no prontuário como documento numerado." />
      {aberto ? (
        <ParecerAberto key={aberto.id} p={aberto} voltar={() => setAbertoId(null)} />
      ) : (
        <>
          <Abas rotulo="Pareceres" className="mb-0" valor={aba} onChange={setAba}
            abas={[['responder', 'Para eu responder', ativos.length], ['pedi', 'Que eu pedi', pedidosAbertos || undefined]]} />
          {aba === 'pedi' ? <QueEuPedi pedidos={pedidos} /> : (
            <>
              {/* M3: um bloco só — especialidades, convite e fila */}
              <div className={`${CARTAO} overflow-hidden`}>
                <div className="flex flex-col gap-2.5 px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-apoio font-medium text-tinta">Especialidades que respondo:</span>
                    {minhas.isLoading && <Spinner />}
                    {minhas.error && <span className="text-apoio text-critico">{mensagem(minhas.error)}</span>}
                    {semDeclarar && <span className="text-apoio text-tinta-sussurro">nenhuma declarada</span>}
                    {declaradas.length > 0 && <span className="text-apoio text-tinta-apoio">{declaradas.join(' · ')}</span>}
                    {!editando && declaradas.length > 0 && (
                      <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEditando(true)}>Alterar</Button>
                    )}
                  </div>
                  {editando && <EditarEspecialidades atuais={declaradas} soMedicas={soMedicas} fechar={() => setEditando(false)} />}
                  {semDeclarar && !editando && (
                    <div className="flex flex-wrap items-center gap-3 rounded-controle border border-dashed border-fio px-4 py-3">
                      <span className="flex-1 text-apoio text-tinta-apoio">
                        Declare as especialidades em que você responde parecer. A fila mostra os pedidos dessas especialidades nesta unidade.
                      </span>
                      <Button size="sm" onClick={() => setEditando(true)}>Declarar especialidades</Button>
                    </div>
                  )}
                </div>
                {!semDeclarar && (
                  <div className="border-t border-trilha">
                    <div className="flex flex-wrap items-center gap-2 border-b border-trilha px-5 py-2.5">
                      <span className="text-apoio text-tinta-apoio">
                        {vis.length} {vis.length === 1 ? 'parecer' : 'pareceres'} {f ? `de ${f}` : 'aguardando'} · ordem por prioridade
                      </span>
                      {esps.length > 1 && (
                        <div role="group" aria-label="Filtrar por especialidade" className="ml-auto flex flex-wrap gap-1.5">
                          <Chip ativo={!f} onClick={() => setFiltro('')}>Todas</Chip>
                          {esps.map((e) => <Chip key={e} ativo={f === e} onClick={() => setFiltro(e)}>{e}</Chip>)}
                        </div>
                      )}
                    </div>
                    {fila.isLoading && <div className="px-5 py-4"><Spinner /></div>}
                    {fila.error && <p className="px-5 py-4 text-apoio text-critico">{mensagem(fila.error)}</p>}
                    {vis.map((p) => <Linha key={p.id} p={p} abrir={() => setAbertoId(p.id)} />)}
                    {!fila.isLoading && !fila.error && vis.length === 0 && (
                      <span className="block px-5 py-4 text-controle text-tinta-sussurro">Nenhum parecer aguardando resposta.</span>
                    )}
                  </div>
                )}
              </div>
              {feitos.length > 0 && (
                <div>
                  <TituloSecao extra="7 dias">Respondidos</TituloSecao>
                  <div className={`${CARTAO} overflow-hidden`}>
                    {feitos.map((p) => <Linha key={p.id} p={p} abrir={() => setAbertoId(p.id)} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
