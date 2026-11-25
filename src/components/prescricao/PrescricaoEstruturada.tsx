// ─────────────────────────────────────────────────────────────────────────────
// Prescrição estruturada (Fase 4.4) — internação e porta.
//
// Item ligado ao medicamento do cadastro; dose, via e frequência escritas pelo
// médico (nada é sugerido). Nada se apaga: suspender deixa o item no histórico.
// Medicamento, em qualquer idade (Portão 2, tarefa 2): data de nascimento ou
// idade estimada, e peso deste atendimento — aferido, estimado ou referido
// pelo paciente, com a marca de como foi obtido. Alergia
// registrada trava o item. O item guarda a diluição padrão vigente (publicada
// pelo farmacêutico); diluir diferente só com justificativa. Toda regra é do
// servidor; aqui só se mostra e se pede.
//
// Leito (modelo do RT, 24/11/2026, PM1 a PM5): uma folha só, com linhas
// numeradas — 01 a dieta, 02 em diante os itens vigentes, "PS" os vindos da
// porta e, por último, a linha em branco do novo item (abas Medicamento ·
// Cuidado · Contenção mecânica; Ctrl+Enter prescreve; "ED" quando altera um
// item). Cabeçalho com peso e alergias, faixa dos vencidos com a revisão item
// a item, painel do paciente à direita. Mesmas RPCs e mesmas travas de antes.
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban, CalendarClock, ChevronDown, Pencil, Plus, RefreshCw, Star, X } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { dataHora } from '@/lib/formato'
import { faltaNoItem, trechosAchados, type MedicamentoAchado } from '@/lib/buscaMedicamento'
import { FREQUENCIAS_PORTA, OUTRA, aprazamentoImpresso } from '@/lib/frequenciaPorta'
import { deFavoritoParaPorta } from '@/lib/favoritoPorta'
import { abrirImpressao } from '@/lib/prontuario'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OpcaoLista } from '@/components/ui/botao-linha'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Chip, TituloCartao } from '@/components/monitor/Pagina'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { CabecalhoFolha } from '@/components/prescricao/CabecalhoFolha'
import { CampoPeso } from '@/components/prescricao/CampoPeso'
import { NovoItemContencao } from '@/components/prescricao/ItemContencao'
import { PainelPacienteFolha, type ContextoPacienteFolha } from '@/components/prescricao/PainelPacienteFolha'
import { textoDoPeso, useFaltaParaPrescrever } from '@/components/prescricao/pesoAtendimento'
import { ativas, useAlergias } from '@/components/paciente/useAlergias'
import { useTravas } from '@/components/paciente/useTravas'
import { frase, interacoesDoErro, semPontoFinal, type InteracaoJustificada, type InteracaoNaPrescricao } from '@/lib/interacoes'
import { resumoMudanca, type Alteracao } from '@/lib/alteracaoPrescricao'
import { jaPrescritos, textoJaPrescrito } from '@/lib/jaPrescrito'
import { useValorAdiado } from '@/hooks/useValorAdiado'
import { SeloDoMedicamento } from '@/components/farmacia/SeloControlado'
import { PedidoDeRenovacao, RenovarPrescricao } from '@/components/prescricao/ValidadeItem'
import { alterarItemPrescricao, renovarItem } from '@/components/prescricao/renovarItem'
import { ehRenovacao, resumoValidade, textoValidoAte } from '@/lib/validadePrescricao'
import { gruposDaPrescricao, opcoesSemMedicamento, textoDiluicao } from '@/lib/prescricaoLeito'
import {
  ehAtalhoPrescrever, etiquetaTipo, etiquetaValidade, faixaVencidos, indiceNovaLinha, linhaPosologia, numeroLinha, ultimaAtualizacao,
} from '@/lib/folhaPrescricao'
import { useAgora } from '@/hooks/useAgora'

type ItemVigente = {
  id: string; tipo: 'medicamento' | 'cuidado' | 'contencao'; descricao: string; medicamento_id: string | null; dose: string | null; via: string | null
  posologia: string | null; se_necessario: boolean; observacao: string | null; peso_kg: number | null; diluicao_versao: number | null
  diluicao_texto: string | null; diluicao_divergente: boolean; justificativa_divergencia: string | null; vasoativo: boolean
  autor: string | null; criado_em: string; validacao: string | null; validacao_motivo: string | null
  /** Lacuna 6: validade do item (24 h, COFEN 689/2022), estado do servidor e pedido de renovação da enfermagem. */
  valida_ate?: string | null; validade?: string | null; renovacao_pedida_em?: string | null
}
/** Item da prescrição da porta que segue ativo no leito (prescricao_porta_ativa). */
type ItemDaPorta = ItemVigente & { horarios: string[]; episodio_id: string | null }
type Medicamento = { id: string; principio_ativo: string; apresentacao: string | null; concentracao: string | null; alta_vigilancia: boolean }
type Diluicao = { id: string; versao: number; texto: string; fonte: string; revisor_crf: string | null }
/** Favorito do médico (preferencias_prescricao; RLS: só o dono lê). */
type Favorito = {
  id: string; receita_padrao: string | null; dose: string | null; via: string | null; posologia: string; quantidade: string | null
  medicamento_id: string; medicamento: Omit<Medicamento, 'id'> | null
}

export type PacientePrescricao = { nome: string; dataAtual?: string; leito?: string; diagnostico?: string }
export type PesoAtual = { valor_num: number; aferido_em: string; metodo: string | null }
/** Dieta da linha 01 da folha: o rascunho do leito (só neste navegador), como já era. */
export type DietaFolha = { valor: string; opcoes: readonly string[]; mudar: (v: string) => void; dica?: string }

const VIAS = ['VO', 'EV', 'IM', 'SC', 'SL', 'INAL', 'TÓPICA', 'RETAL', 'SNE', 'OCULAR']
const VIAS_COM_DILUICAO = ['EV', 'IM', 'SC']
// Cuidados sem dose (o catálogo antigo, sem as doses — decisão de 27/09/2026)
const CUIDADOS = ['Dieta', 'Cabeceira elevada', 'Precaução padrão', 'Vigilância de sintomas álgicos', 'Sinais vitais',
  'Comunicar intercorrências', 'Cuidados gerais de enfermagem', 'Medicações de uso contínuo', 'Mudança de decúbito']

const hora = (iso: string) => dataHora(iso)

/** Grade da linha da folha: índice, conteúdo e, à direita, autor e ações. */
const GRADE_LINHA = 'grid grid-cols-[32px_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-4 py-2.5 sm:grid-cols-[32px_minmax(0,1fr)_auto]'
/** Ações da linha: no computador aparecem ao passar o mouse (ou com o foco); no toque, sempre. */
const ACOES_AO_PASSAR = 'transition-opacity pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100'

export function PrescricaoEstruturada({ pacienteId, paciente, dieta, contexto }: {
  pacienteId: string; paciente: PacientePrescricao
  /** PM1: a dieta na linha 01 (rascunho do leito). */
  dieta?: DietaFolha
  /** PM5: o painel do paciente à direita (leito, situação, datas, classificação, diagnóstico). */
  contexto?: ContextoPacienteFolha
}) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const agora = useAgora()
  const [renovando, setRenovando] = React.useState(false)
  // PM4: "Alterar" leva o item para a linha do novo item ("ED")
  const [editando, setEditando] = React.useState<ItemVigente | null>(null)
  const novaLinha = React.useRef<HTMLDivElement>(null)
  const recarregar = () => {
    for (const k of ['prescricao-vigente', 'prescricao-porta-ativa', 'alergias', 'peso-atual', 'falta-prescrever', 'prescricao-suspensos']) {
      void qc.invalidateQueries({ queryKey: [k, pacienteId] })
    }
    void qc.invalidateQueries({ queryKey: ['alteracoes-itens'] })
  }

  const itens = useQuery({
    queryKey: ['prescricao-vigente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_vigente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as ItemVigente[]
    },
  })
  // frequência na porta (F4): na observação ou na internação, os itens da porta
  // que seguem ativos (e na checagem) aparecem para o médico do leito decidir
  const daPorta = useQuery({
    queryKey: ['prescricao-porta-ativa', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_porta_ativa', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as ItemDaPorta[]
    },
  })
  // alergia em três estados (tem / nega / não registrada): o painel mora em
  // components/paciente; aqui só o resumo e a folha
  const alergias = useAlergias(pacienteId)
  const peso = useQuery({
    queryKey: ['peso-atual', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('observacao').select('valor_num, aferido_em, metodo, conceito!inner(nome)')
        .eq('paciente_id', pacienteId).eq('conceito.nome', 'peso').order('aferido_em', { ascending: false }).limit(1)
      if (error) throw error
      return (data?.[0] ?? null) as PesoAtual | null
    },
  })

  async function imprimir() {
    const lista = itens.data ?? []
    // F6: a coluna de aprazamento leva os horários da enfermagem
    const { data: aprazados, error } = await supabase.rpc('horarios_dos_itens', { p_itens: lista.map((i) => i.id) })
    if (error) return setErro(error.message)
    const horarios = new Map(((aprazados ?? []) as unknown as { item_id: string; horarios: string[] }[]).map((h) => [h.item_id, h.horarios]))
    const impressao = await abrirImpressao({
      pacienteId, internacaoId: null, tipo: 'Prescrição',
      documento: {
        tipo: 'prescricao',
        conteudo: JSON.stringify({
          paciente: {
            ...paciente,
            // PM5: a dieta da linha 01 sai na folha (a folha já tinha o campo)
            ...(dieta ? { dieta: dieta.valor } : {}),
            // lista vazia não é "nega": só imprime NEGA quando há o registro explícito
            alergias: !alergias.data ? 'NÃO VERIFICADA'
              : alergias.data.estado === 'tem' ? ativas(alergias.data).map((a) => a.substancia).join(', ')
              : alergias.data.estado === 'nega' ? 'NEGA' : 'NÃO REGISTRADA',
            peso: peso.data?.valor_num ?? '',
          },
          itens: lista.map((i) => ({
            med: i.tipo === 'medicamento'
              ? `${i.descricao} — ${i.dose ?? ''}${i.diluicao_texto ? ` · ${i.diluicao_divergente ? 'DILUIÇÃO FORA DO PADRÃO: ' : ''}${i.diluicao_texto}` : ''}`
              // lacuna 4: a ordem de contenção sai com motivo, período e critérios
              : i.tipo === 'contencao' ? [i.descricao, i.observacao].filter(Boolean).join('. ') : i.descricao,
            via: i.via ?? '—',
            pos: `${i.posologia ?? '—'}${i.se_necessario ? ' — se necessário' : ''}`,
            apr: aprazamentoImpresso(horarios.get(i.id)),
            // lacuna 6 (V9): cada item sai com a validade; "Agora" não vence
            val: textoValidoAte(i.valida_ate),
          })),
          obs: '',
        }),
      },
    })
    if (!impressao) return
    impressao.janela.focus()
    setTimeout(() => impressao.janela.print(), 300)
  }

  const lista = itens.data ?? []
  const porta = daPorta.data ?? []
  // os ids da prescrição do leito e dos itens vindos da porta
  const ids = [...lista, ...porta].map((i) => i.id)
  // interações justificadas pelo médico (Fase 2, tarefa 3)
  const justificadas = useQuery({
    queryKey: ['interacoes-justificadas', pacienteId, ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('interacoes_justificadas', { p_itens: ids })
      if (error) throw error
      return (data ?? []) as unknown as InteracaoJustificada[]
    },
  })
  // item alterado (Fase 2, tarefa 6): versão, o que mudou e o motivo, como na Checagem
  const alteracoes = useQuery({
    queryKey: ['alteracoes-itens', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('alteracoes_de_itens', { p_itens: ids })
      if (error) throw error
      return new Map(((data ?? []) as unknown as Alteracao[]).map((e) => [e.item_id, e]))
    },
  })
  // PM3: os vencidos e vencendo (leito e porta) vão para a revisão item a item
  const g = gruposDaPrescricao(lista, porta, agora)
  const renovaveis = new Set(g.vencidos.map((i) => i.id))
  const r = resumoValidade([...lista, ...porta], agora)
  const faixa = faixaVencidos(r.vencidos, r.vencendo)
  const alterar = (i: ItemVigente) => {
    setEditando(i)
    requestAnimationFrame(() => novaLinha.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }
  const linha = (i: ItemVigente | ItemDaPorta, indice: string, deOndeVem: 'leito' | 'porta') => (
    <LinhaItem key={i.id} i={i} indice={indice} daPorta={deOndeVem === 'porta'} renovavel={renovaveis.has(i.id)} pacienteId={pacienteId}
      horarios={'horarios' in i ? i.horarios : undefined} justificadas={(justificadas.data ?? []).filter((j) => j.item_id === i.id)}
      alteracao={alteracoes.data?.get(i.id)} emEdicao={editando?.id === i.id} aoAlterar={alterar} aoMudar={recarregar} aoErro={setErro} />
  )
  return (
    <div className={cn('grid items-start gap-4', contexto && 'lg:grid-cols-[minmax(0,1fr)_260px]')}>
      <section aria-label="Prescrição médica" className="flex min-w-0 flex-col overflow-hidden rounded-cartao border border-fio bg-superficie text-apoio">
        <CabecalhoFolha pacienteId={pacienteId} nome={paciente.nome} nVigentes={lista.length + porta.length}
          ultima={ultimaAtualizacao([...lista, ...porta])} aoImprimir={() => void imprimir()} podeImprimir={lista.length > 0} />
        {erro && <p role="alert" className="border-b border-critico/30 bg-alerta-critico px-4 py-2 text-critico">{erro}</p>}

        {/* PM3: faixa dos vencidos; "Revisar e renovar" abre a revisão item a item (manter, alterar ou suspender) */}
        {faixa && (
          <div role="status" className={cn('flex flex-wrap items-center gap-2 border-b px-4 py-2',
            faixa.tom === 'critico' ? 'border-critico/30 bg-alerta-critico text-critico' : 'border-atencao/40 bg-alerta-atencao text-atencao')}>
            <CalendarClock className="size-4 shrink-0" aria-hidden />
            <span className="flex-[1_1_240px] font-medium text-pretty">{faixa.texto}</span>
            {!renovando && <Button size="xs" variant="outline" onClick={() => setRenovando(true)}><RefreshCw aria-hidden /> Revisar e renovar</Button>}
          </div>
        )}
        {renovando && (
          <div className="border-b border-fio px-4 py-3">
            <RenovarPrescricao embutido pacienteId={pacienteId} aoMudar={recarregar} itens={g.vencidos} aoFechar={() => setRenovando(false)} />
          </div>
        )}

        {/* PM1: a folha numerada — 01 dieta, depois os itens vigentes do leito */}
        <ol aria-label="Itens da prescrição" className="flex flex-col divide-y divide-trilha">
          <LinhaDieta dieta={dieta} />
          {lista.map((i, k) => linha(i, numeroLinha(k + 2), 'leito'))}
        </ol>

        {/* F4 da frequência na porta: o que a porta prescreveu e segue correndo */}
        {porta.length > 0 && (
          <section aria-label="Vindos da porta" className="flex flex-col border-t border-fio">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 bg-campo px-4 py-2">
              <span className="text-controle font-semibold text-tinta">Vindos da porta</span>
              <span className="text-rotulo font-semibold text-tinta-sussurro tabular-nums">{porta.length}</span>
              <span className="w-full text-rotulo text-tinta-apoio sm:w-auto">
                Seguem ativos e na checagem da enfermagem. Mantenha no leito, altere ou suspenda: a nova versão entra na prescrição do leito.
              </span>
            </div>
            <ol aria-label="Itens vindos da porta" className="flex flex-col divide-y divide-trilha border-t border-trilha">
              {porta.map((i) => linha(i, 'PS', 'porta'))}
            </ol>
          </section>
        )}

        {/* PM4: a linha em branco do novo item; alterando um item, a mesma linha vira "ED" */}
        <div ref={novaLinha} className="border-t border-dashed border-fio-forte">
          {editando && <EdicaoNaFolha key={editando.id} item={editando} aoFechar={() => setEditando(null)} aoMudar={recarregar} />}
          <div className={editando ? 'hidden' : undefined}>
            <NovoItem pacienteId={pacienteId} peso={peso.data} aoMudar={recarregar} aoErro={setErro} folha={{ indice: indiceNovaLinha(lista.length, false) }} />
          </div>
        </div>

        <Suspensos pacienteId={pacienteId} />
        <p className="border-t border-trilha px-4 py-2 text-rotulo text-tinta-sussurro">
          Autor de cada item: quem prescreveu (login). Suspender deixa o item no histórico.
        </p>
      </section>
      {contexto && <PainelPacienteFolha contexto={contexto} />}
    </div>
  )
}

/** Linha 01: a dieta (o rascunho do leito, como já era; não vai ao banco). */
function LinhaDieta({ dieta }: { dieta?: DietaFolha }) {
  return (
    <li className={GRADE_LINHA}>
      <span className="pt-1.5 text-rotulo font-semibold text-tinta-sussurro tabular-nums">01</span>
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-medium text-tinta">Dieta</span>
        {dieta ? (
          <CampoSelecao id="folha-dieta" aria-label="Dieta" tamanho="compacto" value={dieta.valor} onChange={(e) => dieta.mudar(e.target.value)}
            className="min-w-0 max-w-64" title={dieta.dica}>
            {dieta.opcoes.map((d) => <option key={d} value={d}>{d}</option>)}
          </CampoSelecao>
        ) : <span className="text-tinta-sussurro">Sem dieta neste leito.</span>}
        {dieta?.dica && <span className="w-full text-rotulo text-tinta-sussurro">{dieta.dica}</span>}
      </div>
    </li>
  )
}

/** Etiqueta da linha em caixa normal (tipo, validade). */
function Etiqueta({ tom = 'neutro', titulo, children }: { tom?: 'neutro' | 'critico' | 'atencao'; titulo?: string; children: React.ReactNode }) {
  return (
    <Badge variant={tom === 'critico' ? 'destructive' : tom === 'atencao' ? 'warning' : 'secondary'} title={titulo} className="tracking-normal normal-case">
      {children}
    </Badge>
  )
}

/** Itens suspensos e o histórico: a contagem sempre; a lista só é lida quando o médico abre. */
function Suspensos({ pacienteId }: { pacienteId: string }) {
  const [aberto, setAberto] = React.useState(false)
  const n = useQuery({
    queryKey: ['prescricao-suspensos', pacienteId, 'n'],
    queryFn: async () => {
      const { count, error } = await supabase.from('prescricao_itens')
        .select('id, prescricoes!inner(paciente_id)', { count: 'exact', head: true })
        .eq('prescricoes.paciente_id', pacienteId).not('suspenso_em', 'is', null)
      if (error) throw error
      return count ?? 0
    },
  })
  const q = useQuery({
    queryKey: ['prescricao-suspensos', pacienteId],
    enabled: aberto,
    queryFn: async () => {
      const { data, error } = await supabase.from('prescricao_itens')
        .select('id, descricao, dose, via, posologia, suspenso_em, motivo_suspensao, prescricoes!inner(paciente_id)')
        .eq('prescricoes.paciente_id', pacienteId).not('suspenso_em', 'is', null)
        .order('suspenso_em', { ascending: false }).limit(30)
      if (error) throw error
      return (data ?? []) as unknown as { id: string; descricao: string; dose: string | null; via: string | null; posologia: string | null; suspenso_em: string; motivo_suspensao: string | null }[]
    },
  })
  return (
    <div className="flex flex-col gap-1.5 border-t border-fio px-4 py-2">
      <Button size="sm" variant="ghost" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="self-start px-0 text-tinta-apoio hover:bg-transparent">
        <ChevronDown className={cn('transition-transform', aberto && 'rotate-180')} aria-hidden /> Itens suspensos / histórico
        {n.data !== undefined && <span className="tabular-nums">({n.data})</span>}
      </Button>
      {aberto && (q.isLoading ? <p className="text-tinta-sussurro">Carregando…</p>
        : q.error ? <p className="text-critico">Não foi possível ler os suspensos: {(q.error as Error).message}</p>
          : (q.data ?? []).length === 0 ? <p className="text-tinta-sussurro">Nenhum item suspenso.</p>
            : (
              <ul className="flex flex-col gap-1">
                {(q.data ?? []).map((s) => (
                  <li key={s.id} className="text-rotulo text-tinta-sussurro">
                    <span className="text-tinta-apoio line-through decoration-tinta-sussurro">{s.descricao}{s.dose ? ` ${s.dose}` : ''}{s.via ? ` · ${s.via}` : ''}{s.posologia ? ` · ${s.posologia}` : ''}</span>
                    {' '}· suspenso <span className="tabular-nums">{hora(s.suspenso_em)}</span>{s.motivo_suspensao ? ` · ${s.motivo_suspensao}` : ''}
                  </li>
                ))}
                {(n.data ?? 0) > (q.data ?? []).length && <li className="text-rotulo text-tinta-sussurro">Os 30 mais recentes.</li>}
              </ul>
            ))}
    </div>
  )
}

function LinhaItem({ i, indice, daPorta, renovavel, pacienteId, horarios, justificadas, alteracao, emEdicao, aoAlterar, aoMudar, aoErro }: {
  i: ItemVigente; indice: string; daPorta: boolean
  /** vencido ou vencendo (e não contenção): "Renovar" (leito) ou "Manter no leito" (porta) à vista */
  renovavel: boolean
  pacienteId: string
  justificadas: InteracaoJustificada[]; alteracao: Alteracao | undefined
  emEdicao: boolean; aoAlterar: (i: ItemVigente) => void; aoMudar: () => void; aoErro: (m: string | null) => void
  /** Horários aprazados (itens vindos da porta). */
  horarios?: string[]
}) {
  const agora = useAgora()
  const [suspendendo, setSuspendendo] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const [ocupado, setOcupado] = React.useState(false)
  const dil = i.tipo === 'medicamento' && VIAS_COM_DILUICAO.includes(i.via ?? '') ? textoDiluicao(i) : null
  const tipo = etiquetaTipo(i.tipo)
  const val = etiquetaValidade(i, agora)
  const pos = linhaPosologia(i)
  // porta: "Manter no leito" é a renovação do item (a versão nova entra na prescrição do leito); "Agora" não vence
  const podeManter = daPorta && !!i.valida_ate && i.tipo !== 'contencao'
  async function renovar() {
    setOcupado(true)
    const e = await renovarItem(pacienteId, i.id)
    setOcupado(false)
    aoErro(e)
    if (!e) aoMudar()
  }
  async function suspender() {
    setOcupado(true)
    const { error } = await supabase.rpc('suspender_item', { p_item: i.id, p_motivo: motivo })
    setOcupado(false)
    if (error) return aoErro(error.message)
    aoErro(null); setSuspendendo(false); setMotivo(''); aoMudar()
  }
  return (
    <li className={cn('group', GRADE_LINHA, emEdicao && 'bg-alerta-marca')}>
      <span className="pt-px text-rotulo font-semibold text-tinta-sussurro tabular-nums">{indice}</span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-tinta">{i.descricao}</span>
          {tipo && <Etiqueta>{tipo}</Etiqueta>}
          {/* lacuna 6 (V6): vencido ou vencendo */}
          {val && <Etiqueta tom={val.tom} titulo={val.titulo}>{val.texto}</Etiqueta>}
          {i.vasoativo && <Etiqueta tom="atencao">Vasoativo</Etiqueta>}
          {/* lacuna 3: controlado da Portaria 344 (a farmácia libera antes de administrar) */}
          <SeloDoMedicamento id={i.medicamento_id} />
        </div>
        {pos && <span className="text-tinta-apoio tabular-nums">{pos}</span>}
        {/* PR3: a diluição só aparece quando existe */}
        {dil && <p className={`text-rotulo ${dil.fora ? 'text-atencao' : 'text-tinta-apoio'}`}>{dil.texto}</p>}
        {i.observacao && <p className="text-rotulo text-tinta-sussurro">{i.observacao}</p>}
        <PedidoDeRenovacao em={i.renovacao_pedida_em} />
        {!!horarios?.length && <p className="text-rotulo text-tinta-apoio tabular-nums">Aprazado: {aprazamentoImpresso(horarios)}</p>}
        {alteracao && ehRenovacao(alteracao.motivo) && (
          <p className="text-rotulo text-tinta-apoio">Renovada sem mudança por {alteracao.alterado_por ?? '—'}, {hora(alteracao.alterado_em)}.</p>
        )}
        {alteracao && !ehRenovacao(alteracao.motivo) && (
          <p className="text-rotulo text-atencao">
            Versão {alteracao.versao}, alterada por {alteracao.alterado_por ?? '—'}, {hora(alteracao.alterado_em)}:{' '}
            {resumoMudanca(alteracao.anterior, { dose: i.dose, via: i.via, posologia: i.posologia, se_necessario: i.se_necessario }) || 'observação'}
            {alteracao.motivo ? ` — "${alteracao.motivo}"` : ''}
          </p>
        )}
        {justificadas.map((j) => (
          <p key={j.outro + j.em} className="text-rotulo text-critico">
            Interação {j.gravidade} com {j.outro} ({semPontoFinal(j.efeito)}) — justificada por {j.por ?? '—'}: "{j.justificativa}"
          </p>
        ))}
        {i.validacao === 'devolvido' && <p className="text-rotulo text-critico">Farmácia devolveu para correção: {i.validacao_motivo}</p>}
        {i.validacao === 'confere' && <p className="text-rotulo text-conforme">Conferido pela farmácia.</p>}
        {suspendendo && (
          <div className="mt-1 flex flex-wrap gap-2">
            <Input className="h-8 min-w-48 flex-1" aria-label={`Por que suspende ${i.descricao}`} placeholder="Por que suspende" autoFocus
              value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <Button size="sm" variant="outline" disabled={ocupado || motivo.trim().length < 5} onClick={() => void suspender()}><Ban aria-hidden /> Suspender</Button>
            <Button size="sm" variant="ghost" onClick={() => setSuspendendo(false)}><X aria-hidden /> Voltar</Button>
          </div>
        )}
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-x-2 gap-y-1 sm:col-start-3 sm:max-w-72 sm:flex-col sm:items-end">
        <span className="text-rotulo text-tinta-sussurro tabular-nums">{i.autor ?? '—'} · {hora(i.criado_em)}</span>
        {!suspendendo && (
          <span className="flex flex-wrap items-center gap-1 sm:justify-end">
            {/* lacuna 6 (V4, V8): renovar por linha, a mesma renovar_prescricao com "manter" deste item */}
            {!daPorta && renovavel && (
              <Button size="xs" variant="outline" disabled={ocupado} onClick={() => void renovar()}><RefreshCw aria-hidden /> Renovar</Button>
            )}
            {podeManter && (
              <Button size="xs" variant="outline" disabled={ocupado} className={renovavel ? undefined : ACOES_AO_PASSAR}
                title="Renova o item e o traz para a prescrição do leito, como está" onClick={() => void renovar()}>
                <RefreshCw aria-hidden /> Manter no leito
              </Button>
            )}
            <span className={cn('flex items-center gap-1', ACOES_AO_PASSAR)}>
              {/* Fase 2, tarefa 6: alteração versionada (só medicamento), na linha do novo item (PM4) */}
              {i.tipo === 'medicamento' && (
                <Button size="xs" variant="ghost" disabled={emEdicao} onClick={() => aoAlterar(i)}><Pencil aria-hidden /> Alterar</Button>
              )}
              <Button size="xs" variant="ghost" onClick={() => setSuspendendo(true)}><Ban aria-hidden /> Suspender</Button>
            </span>
          </span>
        )}
      </div>
    </li>
  )
}

/**
 * PM4: alterar um item na linha do novo item ("ED"). Dose, via, frequência e
 * "se necessário", com o motivo; a mesma alterar_item_prescricao do
 * AlterarItem (a versão anterior fica guardada e a nova passa pelas travas).
 */
function EdicaoNaFolha({ item, aoFechar, aoMudar }: { item: ItemVigente; aoFechar: () => void; aoMudar: () => void }) {
  const [f, setF] = React.useState({ dose: item.dose ?? '', via: item.via ?? '', posologia: item.posologia ?? '', se_necessario: item.se_necessario })
  const [motivo, setMotivo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const mudanca = resumoMudanca(item, f)
  const pronto = !!mudanca && motivo.trim().length >= 5 && !salvando
  async function salvar() {
    if (!pronto) return
    setSalvando(true)
    const e = await alterarItemPrescricao(item.id, motivo, f)
    setSalvando(false)
    if (e) return setErro(e)
    aoMudar(); aoFechar()
  }
  return (
    <div className={GRADE_LINHA} onKeyDown={(e) => { if (ehAtalhoPrescrever(e)) { e.preventDefault(); void salvar() } }}>
      <span className="pt-1 text-rotulo font-semibold text-acao tabular-nums">ED</span>
      <div className="flex min-w-0 flex-col gap-3 sm:col-span-2">
        <div role="status" className="flex flex-wrap items-center gap-2 rounded-controle border border-acao/30 bg-alerta-marca px-3 py-2">
          <Pencil className="size-3.5 shrink-0 text-acao" aria-hidden />
          <span className="flex-1 text-tinta">Alterando prescrição: <b className="font-semibold">{item.descricao}</b></span>
          <Button size="xs" variant="outline" onClick={aoFechar}><X aria-hidden /> Cancelar edição</Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem_1fr]">
          <div className="flex flex-col gap-1">
            <Label htmlFor="ed-dose">Dose *</Label>
            <Input id="ed-dose" className="tabular-nums" autoFocus value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ed-via">Via *</Label>
            <CampoSelecao id="ed-via" tamanho="compacto" value={f.via} onChange={(e) => setF({ ...f, via: e.target.value })}>
              {[...new Set([f.via, ...VIAS])].filter(Boolean).map((v) => <option key={v}>{v}</option>)}
            </CampoSelecao>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="ed-freq">Frequência *</Label>
            <Input id="ed-freq" className="tabular-nums" value={f.posologia} onChange={(e) => setF({ ...f, posologia: e.target.value })} />
          </div>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={f.se_necessario} onChange={(e) => setF({ ...f, se_necessario: e.target.checked })} /> Se necessário
        </label>
        <Input aria-label="Motivo da alteração" placeholder="Motivo da alteração (obrigatório)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        {mudanca && <span className="text-rotulo text-tinta-apoio">Muda: {mudanca}. A versão anterior fica guardada.</span>}
        {erro && <p role="alert" className="text-critico">{erro}</p>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={!pronto} onClick={() => void salvar()}>Salvar alteração</Button>
          <Button size="sm" variant="ghost" onClick={aoFechar}><X aria-hidden /> Cancelar edição</Button>
        </div>
      </div>
    </div>
  )
}

// Porta (protótipo, "Prescrição do Pronto Socorro"): via e "quando" em chips;
// na criança, o campo do peso aferido aparece antes do primeiro medicamento.
// "Quando" (frequência na porta, F1, decisão do RT de 06/11/2026): Agora, Se
// necessário, 4/4h a 24/24h ou "Outra" com campo livre — o servidor confere
// se entende a frequência escrita (FREQUENCIAS_PORTA, @/lib/frequenciaPorta).
const VIAS_PORTA: { v: string; rotulo: string }[] = [
  { v: 'EV', rotulo: 'EV' }, { v: 'IM', rotulo: 'IM' }, { v: 'VO', rotulo: 'VO' }, { v: 'SC', rotulo: 'SC' },
  { v: 'INAL', rotulo: 'Inalatória' }, { v: 'SL', rotulo: 'Sublingual' },
]

function ChipPorta({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Chip ativo={ativo} onClick={onClick}>{children}</Chip>
}

/**
 * "Meus favoritos" na porta (favoritos de prescrição, A em G1 a G5): o chip só
 * preenche o "Novo item" (G2); quem prescreve é o médico, no botão Prescrever.
 * Alergia ao medicamento trava o chip, como no Receituário.
 */
function FavoritosPorta({ favs, carregado, travas, aoEscolher }: {
  favs: Favorito[]; carregado: boolean; travas: Record<string, string | null>; aoEscolher: (f: Favorito) => void
}) {
  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-trilha bg-campo px-5 py-[13px]">
        <Star className="size-[15px] text-atencao" aria-hidden />
        <TituloCartao className="mb-0">Meus favoritos</TituloCartao>
        <span className="text-rotulo text-tinta-sussurro">O favorito preenche o novo item: confira antes de prescrever.</span>
        <Link to="/preferencias-prescricao" className="ml-auto text-apoio text-acao hover:underline">Editar</Link>
      </div>
      <div className="flex flex-wrap gap-2 px-5 py-3.5">
        {favs.map((f) => {
          const nome = f.medicamento?.principio_ativo ?? 'Favorito'
          const trava = travas[f.medicamento_id]
          return (
            // padrao-ok: chip de favorito com estado travado por alergia, como no Receituário; o Chip não tem esse tom
            <button key={f.id} type="button" disabled={!!trava || !f.medicamento} onClick={() => aoEscolher(f)}
              title={trava ? `Bloqueado pela alergia a ${trava}` : [f.dose, f.via, f.posologia].filter(Boolean).join(' · ')}
              className={cn('flex items-center gap-[7px] rounded-capsula border px-[13px] py-1.5 text-apoio whitespace-nowrap',
                trava ? 'cursor-not-allowed border-critico/25 bg-alerta-critico text-critico'
                  : 'border-fio bg-superficie text-tinta-apoio hover:border-acao hover:text-acao')}>
              {trava && <AlertTriangle className="size-[13px]" aria-hidden />}
              {nome}{f.receita_padrao ? <span className="text-tinta-sussurro"> · {f.receita_padrao}</span> : null}
            </button>
          )
        })}
        {carregado && !favs.length && (
          <span className="text-apoio text-tinta-sussurro">
            Nenhum favorito ainda. <Link to="/preferencias-prescricao" className="text-acao hover:underline">Preferências de prescrição</Link>
          </span>
        )}
      </div>
    </section>
  )
}

/** Texto do resultado com as letras achadas em destaque. */
function Achado({ texto, termo }: { texto: string; termo: string }) {
  return <>{trechosAchados(texto, termo).map((p, i) => (p.achou ? <b key={i} className="font-semibold text-tinta">{p.t}</b> : p.t))}</>
}

const ROTULO_TIPO = { medicamento: 'Medicamento', cuidado: 'Cuidado', contencao: 'Contenção mecânica' } as const

export function NovoItem({ pacienteId, peso, aoMudar, aoErro, porta = false, pediatrico = false, folha }: {
  pacienteId: string; peso?: PesoAtual | null; aoMudar: () => void; aoErro: (m: string | null) => void
  /** Modo do Pronto-Socorro: chips de via e de "quando" (Agora, Se necessário, intervalo ou Outra). */
  porta?: boolean
  /** Criança: mostra o campo do peso desde o início. */
  pediatrico?: boolean
  /** PM4 (leito): o novo item como a próxima linha da folha, com o índice dela. */
  folha?: { indice: string }
}) {
  const qc = useQueryClient()
  const [tipo, setTipo] = React.useState<'medicamento' | 'cuidado' | 'contencao'>('medicamento')
  // lacuna 4: o formulário da contenção volta limpo depois de prescrever
  const [novaContencao, setNovaContencao] = React.useState(0)
  const [busca, setBusca] = React.useState('')
  const [med, setMed] = React.useState<Medicamento | null>(null)
  const [f, setF] = React.useState({ dose: '', via: '', posologia: '', observacao: '', se_necessario: false, descricao: '' })
  // porta: "Outra" abre o campo livre da frequência
  const [outra, setOutra] = React.useState(false)
  // favorito com frequência que a porta não entende (G3): "Quando" em branco,
  // nenhum chip marcado (não vale "Agora") até o médico escolher
  const [semQuando, setSemQuando] = React.useState(false)
  // via do favorito fora das vias da porta (G4): só lembrete
  const [viaLembrete, setViaLembrete] = React.useState<string | null>(null)
  const [divergir, setDivergir] = React.useState(false)
  const [dilTexto, setDilTexto] = React.useState('')
  const [justificativa, setJustificativa] = React.useState('')
  const [pedePeso, setPedePeso] = React.useState(false)
  const [pedeIdade, setPedeIdade] = React.useState(false)
  const [anos, setAnos] = React.useState('')
  const [faltaAvisada, setFaltaAvisada] = React.useState(false)
  // Fase 2, tarefa 3: interação crítica trava o item até o médico justificar
  const [interacao, setInteracao] = React.useState<{ item: Record<string, unknown>; lista: InteracaoNaPrescricao[] } | null>(null)
  const [justInteracao, setJustInteracao] = React.useState('')
  // erro do servidor dentro do cartão, junto do botão (ponto 11): no topo da
  // página ele ficava longe de quem apertou "Prescrever"
  const [erroItem, setErroItem] = React.useState<string | null>(null)
  const avisar = (m: string | null) => { setErroItem(m); aoErro(null) }
  const [opcaoAtiva, setOpcaoAtiva] = React.useState(0)
  const doseRef = React.useRef<HTMLInputElement>(null)
  const caixa = React.useRef<HTMLDivElement>(null)
  const { unidadeAtiva } = useUnidade()

  // ponto 11: busca do servidor — sinônimo (AAS, SF 0,9%), várias palavras em
  // qualquer ordem, apresentação; o filtro da unidade fica dentro da RPC
  const termo = useValorAdiado(busca.trim())
  const resultados = useQuery({
    queryKey: ['busca-medicamento', termo, unidadeAtiva?.unidade_id],
    enabled: termo.length >= 2 && !med,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_medicamento', { p_unidade: unidadeAtiva?.unidade_id ?? null, p_termo: termo })
      if (error) throw error
      return (data ?? []) as unknown as MedicamentoAchado[]
    },
  })
  const achados = resultados.data ?? []
  // peso e idade que o servidor vai exigir, perguntados antes do item
  const faltaServidor = useFaltaParaPrescrever(pacienteId)
  const faltaPaciente = faltaServidor.data?.falta ?? []
  // na porta, sem chip escolhido vale "Agora"; no "Outra", o que foi escrito
  const posologia = semQuando ? '' : porta && !outra ? f.posologia || 'Agora' : f.posologia.trim()
  const faltaItem = faltaNoItem({ med: !!med, dose: f.dose, via: f.via, posologia, porta, se_necessario: f.se_necessario }, faltaPaciente)
  const faltaFrequencia = faltaItem.some((x) => x.startsWith('frequência'))
  const textoPeso = faltaServidor.data ? textoDoPeso(faltaServidor.data)
    : peso ? `Último peso: ${peso.valor_num} kg (${hora(peso.aferido_em)})` : null
  function escolher(m: MedicamentoAchado) {
    setMed(m); setOpcaoAtiva(0)
    requestAnimationFrame(() => doseRef.current?.focus())
  }
  function teclaNaBusca(e: React.KeyboardEvent<HTMLInputElement>) {
    if (achados.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpcaoAtiva((i) => (i + 1) % achados.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setOpcaoAtiva((i) => (i - 1 + achados.length) % achados.length) }
    else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); escolher(achados[Math.min(opcaoAtiva, achados.length - 1)]) }
  }
  // Fase 2, tarefa 9: medicamento em falta na farmácia e o retorno dela
  const falta = useQuery({
    queryKey: ['falta-medicamento', unidadeAtiva?.unidade_id, med?.id],
    enabled: !!med && !!unidadeAtiva?.unidade_id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('falta_do_medicamento', { p_unidade: unidadeAtiva!.unidade_id, p_medicamento: med!.id })
      if (error) throw error
      return data as unknown as { situacao: string; sinalizada_em: string; retorno: { texto: string; por: string | null; em: string } | null } | null
    },
  })
  // M4 (A01 P2-1): o item ativo do mesmo medicamento e via aparece antes de
  // gravar; quem decide se o novo entra é o servidor (Agora convive com a
  // manutenção; duas manutenções, não)
  const vigentes = useQuery({
    queryKey: ['prescricao-vigente', pacienteId],
    enabled: !!med,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('prescricao_vigente', { p_paciente: pacienteId })
      if (error) throw error
      return (data ?? []) as unknown as ItemVigente[]
    },
  })
  const avisoJaPrescrito = textoJaPrescrito(jaPrescritos(vigentes.data ?? [], med?.id, f.via))
  // sem data de nascimento, o campo da idade estimada aparece antes do medicamento
  const idade = useQuery({
    queryKey: ['idade-paciente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('data_nascimento, data_nascimento_estimada').eq('id', pacienteId).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const semIdade = !!idade.data && !idade.data.data_nascimento
  const diluicao = useQuery({
    queryKey: ['diluicao-vigente', med?.id, f.via],
    enabled: !!med && VIAS_COM_DILUICAO.includes(f.via),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('diluicao_vigente', { p_medicamento: med!.id, p_via: f.via })
      if (error) throw error
      return ((data ?? [])[0] ?? null) as Diluicao | null
    },
  })

  // favoritos de prescrição na porta (A em G1 a G5): a mesma leitura do
  // Receituário, com a via; paciente pediátrico não recebe favoritos (G5)
  const favoritos = useQuery({
    queryKey: ['preferencias-prescricao', 'porta'],
    enabled: !pediatrico,
    queryFn: async () => {
      const { data, error } = await supabase.from('preferencias_prescricao')
        .select('id, receita_padrao, dose, via, posologia, quantidade, medicamento_id, medicamento:medicamento(principio_ativo, apresentacao, concentracao, alta_vigilancia)')
        .order('created_at')
      if (error) throw error
      return (data ?? []) as unknown as Favorito[]
    },
  })
  // o cache pode ter os favoritos de outra tela: fora da porta, nenhum
  const favs = pediatrico ? [] : porta ? favoritos.data ?? [] : []
  // PR3: no leito, o favorito traz só o remédio e a via; dose e frequência são do médico.
  // Paciente pediátrico não recebe favoritos (G5: o favorito é de adulto).
  const favsLeito = pediatrico || porta ? [] : favoritos.data ?? []
  const travas = useTravas(pacienteId, [...favs, ...favsLeito].map((x) => x.medicamento_id)).data ?? {}

  const limpar = () => {
    setMed(null); setBusca(''); setDivergir(false); setDilTexto(''); setJustificativa(''); setOutra(false)
    setSemQuando(false); setViaLembrete(null)
    setF({ dose: '', via: '', posologia: '', observacao: '', se_necessario: false, descricao: '' })
    setNovaContencao((n) => n + 1)
  }
  /** G2: o favorito só preenche o "Novo item"; o médico confere e clica em Prescrever. */
  function usarFavorito(fav: Favorito) {
    if (!fav.medicamento) return
    const novo = deFavoritoParaPorta(fav, VIAS_PORTA)
    setTipo('medicamento')
    setMed({ id: novo.medicamentoId, ...fav.medicamento }); setBusca(''); setFaltaAvisada(false)
    setDivergir(false); setDilTexto(''); setJustificativa('')
    setF({
      ...f, dose: novo.dose, via: novo.via ?? '',
      posologia: novo.quando === OUTRA ? novo.outraTexto : novo.quando ?? '', se_necessario: novo.quando === 'Se necessário',
    })
    setOutra(novo.quando === OUTRA); setSemQuando(novo.quando === null); setViaLembrete(novo.viaLembrete)
    setInteracao(null); setJustInteracao(''); avisar(null)
    requestAnimationFrame(() => doseRef.current?.focus())
  }
  /** PR3: favorito no leito — remédio e via; a dose e a frequência ficam em branco para o médico escrever. */
  function usarFavoritoLeito(fav: Favorito) {
    if (!fav.medicamento) return
    setTipo('medicamento')
    setMed({ id: fav.medicamento_id, ...fav.medicamento }); setBusca(''); setFaltaAvisada(false)
    setDivergir(false); setDilTexto(''); setJustificativa('')
    setF({ ...f, dose: '', posologia: '', se_necessario: false, via: fav.via && VIAS.includes(fav.via) ? fav.via : '' })
    setInteracao(null); setJustInteracao(''); avisar(null)
    requestAnimationFrame(() => doseRef.current?.focus())
  }
  async function prescrever(item: Record<string, unknown>) {
    const { error } = await supabase.rpc('prescrever', { p_paciente: pacienteId, p_item: item as never })
    if (error) {
      // "Falta para prescrever: …" (servidor) diz o que falta; abre os campos correspondentes
      if (/peso deste atendimento/.test(error.message)) setPedePeso(true)
      if (/data de nascimento ou idade estimada/.test(error.message)) setPedeIdade(true)
      const lista = interacoesDoErro(error)
      if (lista) { setInteracao({ item, lista }); return avisar(null) }
      return avisar(error.message)
    }
    avisar(null); limpar(); setInteracao(null); setJustInteracao('')
    void qc.invalidateQueries({ queryKey: ['prescricao-vigente', pacienteId] })
    aoMudar()
  }
  async function registrarIdade() {
    const n = Number(anos.replace(',', '.'))
    if (anos.trim() === '' || !(n >= 0)) return
    const { error } = await supabase.rpc('registrar_idade_estimada', { p_paciente: pacienteId, p_anos: n })
    if (error) return avisar(error.message)
    setPedeIdade(false); setAnos(''); avisar(null); aoMudar()
    for (const k of ['idade-paciente', 'cabecalho-paciente', 'falta-prescrever']) void qc.invalidateQueries({ queryKey: [k, pacienteId] })
  }
  /** PM4: Ctrl+Enter (⌘+Enter) com o foco no novo item aperta o botão de prescrever que estiver valendo. */
  function atalho(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!ehAtalhoPrescrever(e)) return
    e.preventDefault()
    caixa.current?.querySelector<HTMLButtonElement>('[data-atalho="prescrever"]:not(:disabled)')?.click()
  }

  const corpo = (
    <>
        <div className="flex flex-wrap gap-2">
          {/* PM4 (leito): abas sublinhadas Medicamento · Cuidado · Contenção mecânica */}
          {folha ? (
            <Tabs value={tipo} onValueChange={(v) => { setTipo(v as typeof tipo); avisar(null) }} className="w-full">
              <TabsList aria-label="Tipo do novo item" className="gap-1">
                {(['medicamento', 'cuidado', 'contencao'] as const).map((t) => <TabsTrigger key={t} value={t}>{ROTULO_TIPO[t]}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          ) : porta ? (['medicamento', 'cuidado', 'contencao'] as const).map((t) => (
            <Button key={t} size="sm" variant={tipo === t ? 'default' : 'outline'} onClick={() => setTipo(t)}>
              {ROTULO_TIPO[t]}
            </Button>
          )) : tipo !== 'medicamento' && (
            <Button size="sm" variant="outline" onClick={() => { setTipo('medicamento'); setF({ ...f, descricao: '' }) }}>
              <X aria-hidden /> {tipo === 'cuidado' ? 'Cuidado' : 'Contenção mecânica'} · voltar à busca
            </Button>
          )}
          {!porta && tipo === 'medicamento' && !med && favsLeito.length > 0 && (
            <div role="group" aria-label="Meus favoritos" className="flex w-full flex-wrap items-center gap-1.5">
              <span className="text-rotulo text-tinta-sussurro">Favoritos (remédio e via; a dose é sua):</span>
              {favsLeito.map((fv) => {
                const trava = travas[fv.medicamento_id]
                return (
                  <Chip key={fv.id} desabilitado={!!trava || !fv.medicamento} titulo={trava ? `Bloqueado pela alergia a ${trava}` : undefined}
                    ativo={false} onClick={() => usarFavoritoLeito(fv)}>
                    {fv.medicamento?.principio_ativo ?? 'Favorito'}{fv.via ? ` · ${fv.via}` : ''}
                  </Chip>
                )
              })}
            </div>
          )}
          {/* ponto 11: o peso que o servidor aceita (deste atendimento); na folha do leito ele está no cabeçalho (PM2) */}
          {!folha && textoPeso && <span className="ml-auto self-center text-rotulo text-tinta-sussurro">{textoPeso}</span>}
        </div>

        {tipo === 'medicamento' && (pedeIdade || semIdade || faltaPaciente.includes('idade')) && (
          <div className="flex flex-wrap items-end gap-2 rounded-controle border border-atencao/30 bg-alerta-atencao p-2">
            <span className="w-full text-rotulo text-atencao">Para prescrever medicamento, registre a idade.</span>
            <div className="flex flex-col gap-1">
              <Label htmlFor="idade-estimada">Sem data de nascimento: idade estimada (anos)</Label>
              <Input id="idade-estimada" className="h-8 w-28" inputMode="decimal" value={anos} onChange={(e) => setAnos(e.target.value)} />
            </div>
            <Button size="sm" onClick={() => void registrarIdade()}>Registrar idade estimada</Button>
            <span className="w-full text-rotulo text-tinta-sussurro">Fica no cadastro com a marca "estimada". A data real, quando chegar, substitui.</span>
          </div>
        )}

        {tipo === 'medicamento' && (pedePeso || pediatrico || faltaPaciente.includes('peso')) && (
          <div className="rounded-controle border border-atencao/30 bg-alerta-atencao p-2">
            <CampoPeso pacienteId={pacienteId} aoErro={avisar}
              motivo={faltaPaciente.includes('peso') ? 'Para prescrever medicamento, registre o peso deste atendimento.' : undefined}
              aoGravar={() => { setPedePeso(false); aoMudar() }} />
          </div>
        )}

        {tipo === 'contencao' ? (
          <NovoItemContencao key={novaContencao} aoPrescrever={prescrever} />
        ) : tipo === 'cuidado' ? (
          <>
            <div className="flex flex-wrap gap-1.5">
              {CUIDADOS.map((c) => (
                <Button key={c} size="xs" variant="outline" onClick={() => setF({ ...f, descricao: c })}>{c}</Button>
              ))}
            </div>
            <Input placeholder="Descreva o cuidado" aria-label="Cuidado" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} />
            <Button size="sm" className="self-start" disabled={f.descricao.trim().length < 3} data-atalho="prescrever"
              onClick={() => void prescrever({ tipo: 'cuidado', descricao: f.descricao })}>Prescrever cuidado</Button>
          </>
        ) : (
          <>
            {med ? (
              <div className="flex flex-wrap items-center gap-2 rounded-controle border border-fio px-3 py-2">
                <span className="font-medium">{med.principio_ativo}</span>
                <span className="text-tinta-apoio">{[med.apresentacao, med.concentracao].filter(Boolean).join(' · ')}</span>
                {med.alta_vigilancia && <Badge variant="warning">alta vigilância</Badge>}
                <SeloDoMedicamento id={med.id} />
                <Button size="xs" variant="outline" className="ml-auto" onClick={async () => {
                  if (!unidadeAtiva) return
                  const { error } = await supabase.rpc('sinalizar_falta', { p_unidade: unidadeAtiva.unidade_id, p_medicamento: med.id })
                  avisar(error ? error.message : null)
                  if (!error) setFaltaAvisada(true)
                }}>{faltaAvisada ? 'Falta sinalizada' : 'Sinalizar falta'}</Button>
                <Button size="xs" variant="outline" onClick={() => { setMed(null); setFaltaAvisada(false) }}>Trocar</Button>
                {falta.data && (
                  <span role="note" className="w-full text-rotulo text-atencao">
                    Em falta na farmácia ({falta.data.situacao === 'em_cotacao' ? 'em cotação' : 'sinalizada'}).
                    {falta.data.retorno ? ` Retorno da farmácia: "${falta.data.retorno.texto}".` : ' Sem retorno da farmácia ainda.'}
                  </span>
                )}
              </div>
            ) : (
              // ponto 11 (opção A do RT): lista logo abaixo do campo, com teclado
              // (↑ ↓ Enter), o texto achado destacado e o sinônimo que achou o item
              <div className="flex flex-col gap-1">
                <Input placeholder={porta || folha ? 'Buscar medicamento: nome, sigla ou apresentação (ex.: AAS, SF 0,9%, dipirona gotas)'
                  : 'Novo item: buscar remédio, cuidado ou contenção (ex.: dipirona, cabeceira elevada)'}
                  aria-label={porta || folha ? 'Buscar medicamento' : 'Novo item'} role="combobox" aria-expanded={achados.length > 0} aria-controls="lista-medicamentos"
                  value={busca} onChange={(e) => { setBusca(e.target.value); setOpcaoAtiva(0) }} onKeyDown={teclaNaBusca} />
                {termo.length >= 2 && (
                  <div id="lista-medicamentos" role="listbox" aria-label="Medicamentos do cadastro"
                    className="max-h-56 overflow-y-auto rounded-controle border border-fio bg-superficie">
                    {resultados.isFetching && achados.length === 0 && <p className="px-3 py-2 text-rotulo text-tinta-sussurro">Buscando…</p>}
                    {resultados.isError && (
                      <p className="px-3 py-2 text-rotulo text-critico">Não foi possível buscar. Tente de novo.</p>
                    )}
                    {achados.map((m, i) => (
                      <OpcaoLista key={m.id} aria-selected={i === opcaoAtiva} onClick={() => escolher(m)} onMouseEnter={() => setOpcaoAtiva(i)}
                        className={`flex-col items-start gap-0.5 ${i === opcaoAtiva ? 'bg-trilha' : ''}`}>
                        <span className="text-tinta">
                          {m.casou_por && <span className="text-tinta-apoio">{m.casou_por} = </span>}
                          <Achado texto={m.principio_ativo} termo={termo} />
                          {m.alta_vigilancia && <Badge variant="warning" className="ml-2">alta vigilância</Badge>}
                          <SeloDoMedicamento id={m.id} className="ml-2" />
                        </span>
                        <span className="text-rotulo text-tinta-apoio">
                          <Achado texto={[m.apresentacao, m.concentracao].filter(Boolean).join(' · ')} termo={termo} />
                        </span>
                      </OpcaoLista>
                    ))}
                    {resultados.isSuccess && achados.length === 0 && (
                      <p className="px-3 py-2 text-rotulo text-tinta-sussurro">Nenhum medicamento no cadastro com esse nome. Peça o cadastro ao farmacêutico.</p>
                    )}
                    {/* PR3: no leito, cuidado e contenção também saem da busca (e abrem a aba deles) */}
                    {!porta && opcoesSemMedicamento(busca, CUIDADOS).map((o) => (
                      <OpcaoLista key={o.tipo + o.rotulo} onClick={() => {
                        setTipo(o.tipo); setBusca('')
                        if (o.tipo === 'cuidado') setF({ ...f, descricao: o.rotulo })
                      }} className="flex-col items-start gap-0.5 border-t border-trilha">
                        <span className="text-tinta">{o.rotulo}</span>
                        <span className="text-rotulo text-tinta-apoio">{o.tipo === 'cuidado' ? 'Cuidado' : 'Ordem de contenção mecânica'}</span>
                      </OpcaoLista>
                    ))}
                  </div>
                )}
              </div>
            )}
            {porta ? (
              <>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="item-dose">Dose e diluição *</Label>
                  <Input id="item-dose" ref={doseRef} value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} placeholder="escrita pelo médico" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-apoio font-medium text-tinta-apoio">Via *</span>
                  <div role="group" aria-label="Via" className="flex flex-wrap items-center gap-1.5">
                    {VIAS_PORTA.map((v) => <ChipPorta key={v.v} ativo={f.via === v.v} onClick={() => setF({ ...f, via: v.v })}>{v.rotulo}</ChipPorta>)}
                  </div>
                  {viaLembrete && <span className="text-rotulo text-atencao">Via do favorito: {viaLembrete}. Escolha uma das vias acima.</span>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-apoio font-medium text-tinta-apoio">Quando *</span>
                  <div role="group" aria-label="Quando" className="flex flex-wrap items-center gap-1.5">
                    {FREQUENCIAS_PORTA.map((q) => (
                      <ChipPorta key={q} ativo={!outra && !semQuando && (f.posologia || 'Agora') === q}
                        onClick={() => { setOutra(false); setSemQuando(false); setF({ ...f, posologia: q, se_necessario: q === 'Se necessário' }) }}>{q}</ChipPorta>
                    ))}
                    <ChipPorta ativo={outra} onClick={() => { setOutra(true); setSemQuando(false); setF({ ...f, posologia: '', se_necessario: false }) }}>{OUTRA}</ChipPorta>
                  </div>
                  {semQuando && <span className="text-rotulo text-atencao">A frequência do favorito não é uma que a porta entende: escolha quando.</span>}
                  {outra && (
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="item-freq-outra">Frequência</Label>
                      <Input id="item-freq-outra" className="h-8 sm:max-w-72" value={f.posologia} onChange={(e) => setF({ ...f, posologia: e.target.value })}
                        placeholder="ex.: a cada 6 horas, 3x ao dia" />
                    </div>
                  )}
                </div>
              </>
            ) : (
            // PM4: Dose · Via · Frequência · Se necessário numa linha
            <div className="grid items-end gap-2 sm:grid-cols-[1fr_8rem_1fr_auto]">
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-dose">Dose *</Label>
                <Input id="item-dose" ref={doseRef} className="tabular-nums" value={f.dose} onChange={(e) => setF({ ...f, dose: e.target.value })} placeholder="escrita pelo médico" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-via">Via *</Label>
                <CampoSelecao id="item-via" tamanho="compacto" value={f.via}
                  onChange={(e) => setF({ ...f, via: e.target.value })}>
                  <option value="">Escolha…</option>
                  {VIAS.map((v) => <option key={v} value={v}>{v}</option>)}
                </CampoSelecao>
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="item-freq">Frequência *</Label>
                <Input id="item-freq" className="tabular-nums" value={f.posologia} onChange={(e) => setF({ ...f, posologia: e.target.value })} placeholder="ex.: 8/8h" />
              </div>
              <label className="flex min-h-8 items-center gap-2">
                <input type="checkbox" checked={f.se_necessario} onChange={(e) => setF({ ...f, se_necessario: e.target.checked })} /> Se necessário
              </label>
            </div>
            )}
            {avisoJaPrescrito && (
              <p role="status" className="flex items-center gap-1.5 text-atencao"><AlertTriangle className="size-3.5 shrink-0" /> {avisoJaPrescrito}</p>
            )}
            {med && VIAS_COM_DILUICAO.includes(f.via) && (
              <div className="flex flex-col gap-1.5 rounded-controle border border-fio p-2">
                {diluicao.data ? (
                  <p className="text-tinta-apoio">
                    Diluição padrão v{diluicao.data.versao}: {diluicao.data.texto}
                    <span className="block text-rotulo text-tinta-sussurro">Fonte: {diluicao.data.fonte} · revisão {diluicao.data.revisor_crf}</span>
                  </p>
                ) : (
                  // PR3: sem diluição publicada é detalhe, não alerta
                  <p className="text-rotulo text-tinta-sussurro">Sem diluição padrão publicada para {med.principio_ativo} {f.via}.</p>
                )}
                <label className="flex items-center gap-2 text-rotulo">
                  <input type="checkbox" checked={divergir} onChange={(e) => setDivergir(e.target.checked)} /> Diluir diferente do padrão
                </label>
                {divergir && (
                  <>
                    <Input placeholder="Como diluir" value={dilTexto} onChange={(e) => setDilTexto(e.target.value)} />
                    <Textarea placeholder="Justificativa (mínimo de 10 letras)" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
                  </>
                )}
              </div>
            )}
            <Input placeholder="Observação (opcional)" aria-label="Observação" value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} />
            <Button size="sm" className="self-start" disabled={!med || !f.dose.trim() || !f.via || faltaFrequencia}
              data-atalho={interacao ? undefined : 'prescrever'}
              onClick={() => void prescrever({
                tipo: 'medicamento', medicamento_id: med!.id, dose: f.dose, via: f.via, posologia,
                se_necessario: f.se_necessario, observacao: f.observacao,
                ...(divergir ? { diluicao_divergente: dilTexto, justificativa_divergencia: justificativa } : {}),
              })}>
              Prescrever
            </Button>
            {/* ponto 11: o botão diz o que falta, e o erro do servidor aparece aqui, não no topo da página */}
            {faltaItem.length > 0 && <p className="text-rotulo text-tinta-apoio">Falta: {faltaItem.join(', ')}.</p>}
            {erroItem && <p role="alert" className="rounded-controle border border-critico/30 bg-alerta-critico p-2 text-apoio text-critico">{erroItem}</p>}
            {interacao && (
              <div role="alert" className="flex flex-col gap-2 rounded-controle border border-critico/40 bg-alerta-critico p-3 text-apoio">
                <strong className="text-critico">Interação crítica com a prescrição vigente</strong>
                {interacao.lista.map((x) => (
                  <div key={x.interacao_id + x.outro_item_id} className="flex flex-col gap-0.5">
                    <span className="text-tinta"><b>{x.outro}</b> · {x.gravidade} · {x.grupos}</span>
                    <span className="text-tinta-apoio">{frase(x.efeito)}{x.conduta ? ` Conduta: ${frase(x.conduta)}` : ''}</span>
                    <span className="text-rotulo text-tinta-sussurro">Fonte: {x.fonte}</span>
                  </div>
                ))}
                <Textarea placeholder="Por que prescrever mesmo assim (mínimo de 10 letras; fica no prontuário e na auditoria)" value={justInteracao}
                  onChange={(e) => setJustInteracao(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" disabled={justInteracao.trim().length < 10} data-atalho="prescrever"
                    onClick={() => void prescrever({ ...interacao.item, justificativa_interacao: justInteracao.trim() })}>Prescrever com justificativa</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setInteracao(null); setJustInteracao('') }}>Não prescrever</Button>
                </div>
              </div>
            )}
          </>
        )}
    </>
  )

  if (folha) {
    // PM4: a próxima linha em branco da folha, com o número dela
    return (
      <div ref={caixa} className={GRADE_LINHA} onKeyDown={atalho}>
        <span className="pt-2 text-rotulo font-semibold text-acao tabular-nums" title="Próxima linha da prescrição">{folha.indice}</span>
        <div className="flex min-w-0 flex-col gap-3 sm:col-span-2" role="group" aria-label="Novo item da prescrição">
          {corpo}
          <p className="text-rotulo text-tinta-sussurro">Dose, via e frequência são escritas por você: o sistema não sugere dose.</p>
        </div>
      </div>
    )
  }
  return (
    <>
    {porta && !pediatrico && (
      <FavoritosPorta favs={favs} carregado={favoritos.isSuccess} travas={travas} aoEscolher={usarFavorito} />
    )}
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-corpo"><Plus className="size-4" /> Novo item</CardTitle>
        <CardDescription>Dose, via e frequência são escritas por você: o sistema não sugere dose.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-apoio">{corpo}</CardContent>
    </Card>
    </>
  )
}
