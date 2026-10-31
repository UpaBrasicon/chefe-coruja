// ─────────────────────────────────────────────────────────────────────────────
// Escala do mês para o gestor (protótipo, aba Mensal, P/index.html 7133–7230).
// Revisão visual 3.9 (27/10/2026, opção A do RT): o mês com o dia ao lado. À
// esquerda o calendário (cada dia diz se está coberto ou quantas vagas tem) e
// "Publicar escala"; à direita o dia escolhido, setor por setor e faixa por
// faixa, onde se escala, remove, marca e retira vaga. A grade da semana saiu
// da aba do gestor; os pedidos (trocas, passagens, faltas, candidaturas) ficam
// na aba Pedidos, com uma linha de aviso aqui em cima. O modelo da escala
// continua o de sempre (ADR 0003). Dados de escala_mes_gestor; escalar por
// adicionar_plantao_escala; marcar/retirar vaga e publicar pelas RPCs da
// migration 20261007000003.
// Aba Escala, E2 (28/10/2026, opção B do RT): todas as categorias juntas. Cada
// nome leva a sigla da categoria, a vaga diz de qual categoria é e o filtro
// "Categorias" recorta o mês e o dia. Escalar e marcar vaga pedem a categoria
// (profissionais_da_unidade; migration 20270202000003).
// ─────────────────────────────────────────────────────────────────────────────
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'
import * as React from 'react'
import { useSearchParams } from 'react-router-dom'

import { supabase } from '@/lib/supabase'
import { PAPEL_LABEL } from '@/lib/constants'
import { dataHora, dataIso, dataPorExtenso } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { useUnidade } from '@/contexts/UnidadeContext'
import { Estado } from '@/components/porta/Estado'
import { Button } from '@/components/ui/button'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import type { Papel } from '@/types/database'
import { ehRetroativo } from '@/lib/retroativo'

import { contarPedidos, useCandidaturasEscala, useSolicitacoesEscala, useTrocasEscala } from '@/hooks/usePedidosEscala'

type Escalado = { plantao_id: string; perfil_id: string; nome: string; turno: string; duracao_min: number; quinzenal: boolean; rotulo: string | null; papel: Papel | null }
// o que falta na faixa, categoria por categoria: vaga marcada (vaga_id) ou prevista pela fixa
type Aberta = { papel: Papel | null; vaga_id: string | null; obs: string | null }
type Faixa = {
  data: string; setor_id: string; turno: 'manha' | 'tarde' | 'noite'; escalados: Escalado[]; previsto: boolean
  vaga_id: string | null; vaga_obs: string | null; abertas: Aberta[]; situacao: 'coberto' | 'vaga' | 'sem_plantao'
}
type Publicacao = { versao: number; publicada_em: string; publicada_por: string | null; plantoes: number; vagas: number; alteracoes_depois: number }
type Mes = { setores: { id: string; nome: string; tipo: string }[]; categorias: Papel[]; faixas: Faixa[]; publicacao: Publicacao | null }
type Profissional = { perfil_id: string; nome_completo: string; crm: string | null; papel: Papel }

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const FAIXA: Record<Faixa['turno'], [string, string]> = { manha: ['Manhã', '07h–13h'], tarde: ['Tarde', '13h–19h'], noite: ['Noite', '19h–07h'] }

const hojeSP = () => dataIso()
const quando = (iso: string) => dataHora(iso)
const ORDEM_FAIXA: Faixa['turno'][] = ['manha', 'tarde', 'noite']
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const SIGLA: Partial<Record<Papel, string>> = {
  plantonista: 'Méd', telemedicina: 'Tele', enfermeiro: 'Enf', tecnico_enfermagem: 'Téc', recepcao: 'Rec', farmaceutico: 'Farm',
  regulador: 'Reg', faturamento: 'Fat', nir: 'NIR', secretaria: 'Sec', regulacao_regional: 'RegR', faturamento_rede: 'FatR',
}
const sigla = (p: Papel | null) => (p ? SIGLA[p] ?? PAPEL_LABEL[p] : 'sem categoria')
const categoriaMinuscula = (p: Papel | null) => (p ? PAPEL_LABEL[p].toLowerCase() : 'sem categoria')

export function EscalaMes() {
  const { unidadeAtiva, papelAtivo } = useUnidade()
  const unidadeId = unidadeAtiva?.unidade_id
  const ehGestor = papelAtivo === 'gestor'
  const qc = useQueryClient()
  const [, setSearchParams] = useSearchParams()
  const hoje = hojeSP()
  const [mes, setMes] = React.useState(() => hoje.slice(0, 7))
  const [dia, setDia] = React.useState<string | null>(null)
  const [publicando, setPublicando] = React.useState(false)
  const [obs, setObs] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [aviso, setAviso] = React.useState<string | null>(null)
  const [escalar, setEscalar] = React.useState<Faixa | null>(null)
  // a mesma janela escala ou marca vaga; as duas pedem a categoria
  const [modo, setModo] = React.useState<'escalar' | 'vaga'>('escalar')
  const [categoria, setCategoria] = React.useState<Papel | ''>('')
  const [filtro, setFiltro] = React.useState<Papel | 'todas'>('todas')
  const [perfilId, setPerfilId] = React.useState('')
  const [rotulo, setRotulo] = React.useState('')
  const [quinzenal, setQuinzenal] = React.useState(false)
  const [salvando, setSalvando] = React.useState(false)
  // B3: a hora em que a tela abriu, para avisar do acerto retroativo
  const [abertaEm] = React.useState(() => Date.now())
  const [ano, mesNum] = mes.split('-').map(Number)

  const dados = useQuery({
    // prefixo 'escala-plantao-mes': a Escala também invalida essa chave ao
    // escalar, remover ou gerar o mês da fixa, e o calendário acompanha
    queryKey: ['escala-plantao-mes', 'gestor', unidadeId, mes],
    enabled: !!unidadeId && ehGestor,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('escala_mes_gestor', { p_unidade: unidadeId!, p_ano: ano, p_mes: mesNum })
      if (error) throw error
      return data as unknown as Mes
    },
  })
  const profissionais = useQuery({
    queryKey: ['escala-profissionais', unidadeId],
    enabled: !!unidadeId && ehGestor && !!escalar && modo === 'escalar',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('profissionais_da_unidade', { p_unidade: unidadeId! })
      if (error) throw error
      return (data ?? []) as Profissional[]
    },
  })
  const solicitacoes = useSolicitacoesEscala(unidadeId, ehGestor)
  const candidaturas = useCandidaturasEscala(unidadeId, ehGestor)
  const trocas = useTrocasEscala(unidadeId, ehGestor)
  if (!ehGestor) return null

  const pedidos = contarPedidos(solicitacoes.data, candidaturas.data, trocas.data)
  const recarregar = () => {
    void qc.invalidateQueries({ queryKey: ['escala-plantao-mes'] })
    void qc.invalidateQueries({ queryKey: ['escala-plantao'] })
    void qc.invalidateQueries({ queryKey: ['resumo-carga'] })
    void qc.invalidateQueries({ queryKey: ['historico-escala'] })
  }
  const mudarMes = (n: number) => {
    const d = new Date(ano, mesNum - 1 + n, 1)
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setDia(null); setErro(null); setAviso(null)
  }
  const verPedidos = () => setSearchParams((atual) => { const p = new URLSearchParams(atual); p.set('aba', 'pedidos'); return p }, { replace: true })

  const m = dados.data
  const setores = m?.setores ?? []
  const categorias = m?.categorias ?? []
  // o filtro recorta quem aparece e o que falta; "todas" mostra a unidade inteira
  const daCategoria = (p: Papel | null) => filtro === 'todas' || p === filtro
  const faixas = (m?.faixas ?? []).map((f) => ({ ...f, escalados: f.escalados.filter((e) => daCategoria(e.papel)), abertas: f.abertas.filter((a) => daCategoria(a.papel)) }))
  const porDia = new Map<string, Faixa[]>()
  for (const f of faixas) porDia.set(f.data, [...(porDia.get(f.data) ?? []), f])
  const vagasMes = faixas.reduce((n, f) => n + f.abertas.length, 0)
  const plantoesMes = new Set(faixas.flatMap((f) => f.escalados.map((e) => e.plantao_id))).size
  const primeiro = new Date(ano, mesNum - 1, 1).getDay()
  const diasNoMes = new Date(ano, mesNum, 0).getDate()
  const celulas: (string | null)[] = [...Array(primeiro).fill(null),
    ...Array.from({ length: diasNoMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`)]
  while (celulas.length % 7) celulas.push(null)
  const pub = m?.publicacao
  const mesPassou = `${mes}-${String(diasNoMes).padStart(2, '0')}` < hoje
  // o dia escolhido: o clicado; sem clique, hoje (se o mês é o de hoje) ou o dia 1
  const diaSel = dia ?? (hoje.startsWith(mes) ? hoje : `${mes}-01`)
  const doDia = porDia.get(diaSel) ?? []
  const vagasDia = doDia.reduce((n, f) => n + f.abertas.length, 0)
  const plantoesDia = new Set(doDia.flatMap((f) => f.escalados.map((e) => e.plantao_id))).size

  async function publicar() {
    setErro(null)
    const { data, error } = await supabase.rpc('publicar_escala', { p_unidade: unidadeId!, p_ano: ano, p_mes: mesNum, p_observacao: obs.trim() || undefined })
    if (error) return setErro(error.message)
    setPublicando(false); setObs('')
    setAviso(`Escala de ${MESES[mesNum - 1]} publicada (versão ${data}). Quem está escalado no mês foi avisado.`)
    recarregar()
  }
  async function confirmarVaga() {
    if (!escalar || !categoria) return
    setErro(null); setSalvando(true)
    const { error } = await supabase.rpc('marcar_vaga_escala', { p_setor: escalar.setor_id, p_data: escalar.data, p_turno: escalar.turno, p_papel: categoria })
    setSalvando(false)
    if (error) return setErro(error.message)
    setEscalar(null)
    recarregar()
  }
  async function retirarVaga(id: string) {
    setErro(null)
    const { error } = await supabase.rpc('retirar_vaga_escala', { p_vaga: id })
    if (error) return setErro(error.message)
    recarregar()
  }
  async function remover(e: Escalado) {
    setErro(null)
    const { error } = await supabase.from('escala_plantao').delete().eq('id', e.plantao_id)
    if (error) return setErro(error.message)
    recarregar()
  }
  // a categoria já vem escolhida: a do filtro, ou a da primeira vaga da faixa
  function abrirJanela(f: Faixa, qual: 'escalar' | 'vaga') {
    const sugerida = filtro !== 'todas' ? filtro : f.abertas.find((a) => a.papel)?.papel ?? ''
    setErro(null); setPerfilId(''); setRotulo(''); setQuinzenal(false); setCategoria(sugerida); setModo(qual); setEscalar(f)
  }
  async function confirmarEscalar() {
    if (!escalar || !perfilId || !categoria) return
    setErro(null); setSalvando(true)
    const { error } = await supabase.rpc('adicionar_plantao_escala', {
      p_unidade: unidadeId!, p_setor: escalar.setor_id, p_perfil: perfilId, p_data: escalar.data, p_turno: escalar.turno,
      p_rotulo: rotulo.trim() || undefined, p_quinzenal: quinzenal, p_papel: categoria,
    })
    setSalvando(false)
    if (error) return setErro(error.message)
    setEscalar(null)
    recarregar()
  }
  const nomeSetor = (id: string) => setores.find((s) => s.id === id)?.nome ?? 'Setor'
  const daJanela = (profissionais.data ?? []).filter((p) => p.papel === categoria)

  return (
    <div className="mb-2 flex flex-col gap-3">
      {pedidos.total > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-controle border border-atencao/40 bg-superficie px-4 py-2 text-apoio">
          <span className="font-medium text-atencao">{plural(pedidos.total, 'pedido aguardando você', 'pedidos aguardando você')}</span>
          <span className="text-tinta-sussurro">
            {[pedidos.escala ? plural(pedidos.escala, 'da escala', 'da escala') : '', pedidos.candidaturas ? plural(pedidos.candidaturas, 'candidatura', 'candidaturas') : '', pedidos.trocas ? plural(pedidos.trocas, 'troca', 'trocas') : ''].filter(Boolean).join(', ')}
          </span>
          <Button variant="link" onClick={verPedidos} className="ml-auto h-auto min-h-0 p-0 text-apoio font-medium">Ver os pedidos</Button>
        </div>
      )}

      <section aria-label="Escala do mês" className="grid overflow-hidden rounded-cartao border border-fio bg-superficie md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col border-fio md:border-r">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-trilha px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon-sm" aria-label="Mês anterior" onClick={() => mudarMes(-1)}><ChevronLeft /></Button>
              <span className="min-w-[140px] text-center text-apoio font-semibold text-tinta">{MESES[mesNum - 1][0].toUpperCase() + MESES[mesNum - 1].slice(1)} de {ano}</span>
              <Button variant="outline" size="icon-sm" aria-label="Próximo mês" onClick={() => mudarMes(1)}><ChevronRight /></Button>
            </div>
            <Button size="sm" onClick={() => { setErro(null); setPublicando(true) }} disabled={!m || plantoesMes === 0 || mesPassou}>
              <ShieldCheck /> Publicar escala
            </Button>
          </div>
          <p className={cn('border-b border-trilha px-4 py-1.5 text-rotulo', pub?.alteracoes_depois ? 'text-atencao' : 'text-tinta-sussurro')}>
            {pub
              ? `Versão ${pub.versao} publicada em ${quando(pub.publicada_em)}${pub.publicada_por ? ` por ${pub.publicada_por}` : ''}`
                + (pub.alteracoes_depois ? ` · ${plural(pub.alteracoes_depois, 'alteração', 'alterações')} depois` : '')
              : 'Ainda não publicada'}
            {m ? ` · ${plural(plantoesMes, 'plantão', 'plantões')} · ${plural(vagasMes, 'vaga aberta', 'vagas abertas')}` : ''}
          </p>
          {categorias.length > 1 && (
            <div className="flex items-center justify-end gap-2 border-b border-trilha px-4 py-1.5">
              <Label htmlFor="mes-filtro" className="text-rotulo font-normal text-tinta-sussurro">Categorias</Label>
              <Select value={filtro} onValueChange={(v) => setFiltro((v ?? 'todas') as Papel | 'todas')}>
                <SelectTrigger id="mes-filtro" className="w-auto min-w-[180px]"><SelectValue>{filtro === 'todas' ? 'Todas' : PAPEL_LABEL[filtro]}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {categorias.map((c) => <SelectItem key={c} value={c}>{PAPEL_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {aviso && <p role="status" className="border-b border-trilha bg-alerta-conforme px-4 py-2 text-apoio text-conforme">{aviso}</p>}
          {erro && !publicando && !escalar && <MensagemErro className="m-3" texto={erro} />}
          {dados.isLoading && <div className="flex justify-center py-8"><Spinner /></div>}
          {dados.error && <MensagemErro className="m-3" texto={(dados.error as Error).message} />}

          {m && (
            <div className="grid grid-cols-7 gap-px bg-trilha" role="grid" aria-label={`Dias de ${MESES[mesNum - 1]}`}>
              {SEMANA.map((s) => <span key={s} role="columnheader" className="bg-superficie py-1.5 text-center text-rotulo text-tinta-sussurro">{s}</span>)}
              {celulas.map((d, i) => {
                if (!d) return <span key={i} className="bg-superficie" />
                const fs = porDia.get(d) ?? []
                const abertas = fs.flatMap((f) => f.abertas)
                const vagas = abertas.length
                const siglas = [...new Set(abertas.map((a) => sigla(a.papel)))].join(' · ')
                const pessoas = new Set(fs.flatMap((f) => f.escalados.map((e) => e.plantao_id))).size
                return (
                  <BotaoLinha key={d} variante="linha" onClick={() => setDia(d)} aria-pressed={d === diaSel}
                    aria-label={`${Number(d.slice(8))} de ${MESES[mesNum - 1]}: ${vagas ? `${plural(vagas, 'vaga aberta', 'vagas abertas')} (${siglas})` : pessoas ? 'coberto' : 'sem plantão'}`}
                    className={cn('min-h-[72px] flex-col items-stretch gap-1 rounded-none border-0 bg-superficie px-2 py-1.5',
                      d === diaSel && 'bg-alerta-marca ring-2 ring-acao ring-inset hover:bg-alerta-marca', d < hoje && d !== diaSel && 'text-tinta-sussurro')}>
                    <span className="flex items-center justify-between text-apoio tabular-nums">
                      <span className={cn(d === hoje ? 'font-semibold text-tinta' : 'text-tinta')}>{Number(d.slice(8))}</span>
                      {d === hoje && <span className="text-rotulo text-acao">hoje</span>}
                    </span>
                    <span className={cn('mt-auto flex min-w-0 flex-col text-rotulo', vagas ? 'text-atencao' : 'text-tinta-sussurro')}>
                      {vagas ? plural(vagas, 'vaga', 'vagas') : pessoas ? 'coberto' : 'sem plantão'}
                      {vagas > 0 && <span className="truncate text-tinta-sussurro">{siglas}</span>}
                    </span>
                  </BotaoLinha>
                )
              })}
            </div>
          )}
        </div>

        {m && (
          <aside aria-label={`Escala de ${dataPorExtenso(`${diaSel}T12:00:00Z`)}`} className="order-first flex flex-col border-b border-fio md:order-none md:border-b-0">
            <div className="border-b border-trilha px-4 py-2.5">
              <span className="text-apoio font-semibold text-tinta">{dataPorExtenso(`${diaSel}T12:00:00Z`)}</span>
              <span className={cn('block text-rotulo', vagasDia ? 'text-atencao' : 'text-tinta-sussurro')}>
                {[vagasDia ? plural(vagasDia, 'vaga aberta', 'vagas abertas') : '', plural(plantoesDia, 'plantão', 'plantões')].filter(Boolean).join(' · ')}
              </span>
            </div>
            {setores.map((s) => {
              const fs = doDia.filter((f) => f.setor_id === s.id).sort((x, y) => ORDEM_FAIXA.indexOf(x.turno) - ORDEM_FAIXA.indexOf(y.turno))
              return (
                <div key={s.id} className="flex flex-col gap-2 border-b border-trilha px-4 py-2.5 last:border-b-0">
                  <span className="text-rotulo font-semibold text-tinta-sussurro">{s.nome}</span>
                  {fs.map((f) => (
                    <div key={f.turno} className="grid grid-cols-[52px_minmax(0,1fr)] gap-x-2 text-apoio">
                      <span className="text-tinta-sussurro" title={FAIXA[f.turno][1]}>{FAIXA[f.turno][0]}</span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        {f.escalados.map((e) => (
                          <span key={e.plantao_id} className="flex items-baseline gap-1.5">
                            <span className="min-w-0 truncate text-tinta">{e.nome}</span>
                            {e.papel && <span title={PAPEL_LABEL[e.papel]} className="shrink-0 rounded-controle bg-campo px-1.5 text-rotulo text-tinta-sussurro">{sigla(e.papel)}</span>}
                            <span className="shrink-0 text-rotulo text-tinta-sussurro">
                              {e.duracao_min === 720 ? '12 h' : '6 h'}{e.quinzenal ? ' · 15/15' : ''}{e.rotulo ? ` · ${e.rotulo}` : ''}
                            </span>
                            <Button variant="link" onClick={() => void remover(e)} aria-label={`Remover ${e.nome} de ${s.nome}, ${FAIXA[f.turno][0].toLowerCase()}`}
                              className="ml-auto h-auto min-h-0 shrink-0 p-0 text-rotulo text-tinta-sussurro hover:text-critico">Remover</Button>
                          </span>
                        ))}
                        {f.abertas.map((a, k) => (
                          <span key={a.vaga_id ?? `prevista-${a.papel}-${k}`} className="flex flex-wrap items-baseline gap-x-1.5">
                            <Estado tom="ambar">vaga aberta</Estado>
                            <span className="text-rotulo text-tinta-sussurro">
                              {categoriaMinuscula(a.papel)} · {a.vaga_id ? `marcada${a.obs ? `: ${a.obs}` : ''}` : 'prevista pela fixa'}
                            </span>
                            {a.vaga_id && (
                              <Button variant="link" onClick={() => void retirarVaga(a.vaga_id!)} className="ml-auto h-auto min-h-0 p-0 text-rotulo text-tinta-sussurro hover:text-critico">Retirar vaga</Button>
                            )}
                          </span>
                        ))}
                        {f.escalados.length === 0 && f.abertas.length === 0 && <span className="text-tinta-sussurro">sem plantão</span>}
                        <span className="flex flex-wrap gap-x-3 text-rotulo">
                          <Button variant="link" onClick={() => abrirJanela(f, 'escalar')} className="h-auto min-h-0 p-0 text-rotulo">Escalar</Button>
                          {diaSel >= hoje && (
                            <Button variant="link" onClick={() => abrirJanela(f, 'vaga')} className="h-auto min-h-0 p-0 text-rotulo">Marcar vaga</Button>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
            <p className="mt-auto border-t border-trilha bg-campo px-4 py-2 text-rotulo text-pretty text-tinta-sussurro">
              Marcar vaga avisa quem tem a categoria da vaga; ela deixa de contar quando alguém dessa categoria é escalado. Trocas, passagens e candidaturas chegam em Pedidos.
            </p>
          </aside>
        )}
      </section>

      <Dialog open={!!escalar} onOpenChange={(v) => { if (!v) setEscalar(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{modo === 'vaga' ? 'Marcar vaga' : 'Escalar'}</DialogTitle>
            <DialogDescription>
              {escalar && `${nomeSetor(escalar.setor_id)} · ${dataPorExtenso(`${escalar.data}T12:00:00Z`)} · ${FAIXA[escalar.turno][0]} (${FAIXA[escalar.turno][1]})`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Categoria</Label>
              <Select value={categoria || null} onValueChange={(v) => { setCategoria((v ?? '') as Papel | ''); setPerfilId('') }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecione">{categoria ? PAPEL_LABEL[categoria] : undefined}</SelectValue></SelectTrigger>
                <SelectContent>
                  {categorias.map((c) => <SelectItem key={c} value={c}>{PAPEL_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {modo === 'escalar' && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>Profissional</Label>
                  <Select value={perfilId || null} onValueChange={(v) => setPerfilId(v ?? '')} disabled={!categoria}>
                    <SelectTrigger className="w-full"><SelectValue placeholder={categoria ? 'Selecione' : 'Escolha a categoria'} /></SelectTrigger>
                    <SelectContent>
                      {daJanela.map((p) => (
                        <SelectItem key={p.perfil_id} value={p.perfil_id}>{p.nome_completo}{p.crm ? ` · CRM ${p.crm}` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {profissionais.isLoading && <Spinner />}
                  {categoria && !profissionais.isLoading && daJanela.length === 0 && (
                    <span className="text-rotulo text-tinta-sussurro">Ninguém com vínculo de {PAPEL_LABEL[categoria].toLowerCase()} nesta unidade.</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mes-rotulo">Rótulo (opcional)</Label>
                  <Input id="mes-rotulo" value={rotulo} onChange={(e) => setRotulo(e.target.value)} placeholder='Ex.: "cobertura", "coordenação"' />
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-apoio font-medium">
                  <input type="checkbox" className="size-4 accent-primary" checked={quinzenal} onChange={(e) => setQuinzenal(e.target.checked)} />
                  Escala quinzenal (15/15)
                </label>
                {escalar && ehRetroativo(escalar.data, escalar.turno, abertaEm) && (
                  <p role="status" className="text-apoio text-pretty text-atencao">Este plantão já começou: fica como acerto retroativo no histórico da escala.</p>
                )}
              </>
            )}
            {modo === 'vaga' && categoria && (
              <p className="text-apoio text-tinta-sussurro">Quem tem vínculo de {PAPEL_LABEL[categoria].toLowerCase()} na unidade recebe o aviso da vaga.</p>
            )}
            <MensagemErro texto={escalar ? erro : null} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEscalar(null)}>Cancelar</Button>
            {modo === 'vaga' ? (
              <Button onClick={() => void confirmarVaga()} disabled={!categoria || salvando}>{salvando ? <Spinner /> : null} Marcar vaga</Button>
            ) : (
              <Button onClick={() => void confirmarEscalar()} disabled={!perfilId || !categoria || salvando}>{salvando ? <Spinner /> : null} Escalar</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={publicando} onOpenChange={setPublicando}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publicar a escala de {MESES[mesNum - 1]}</DialogTitle>
            <DialogDescription>
              {plural(plantoesMes, 'plantão', 'plantões')} e {plural(vagasMes, 'vaga aberta', 'vagas abertas')}.
              Quem está escalado no mês recebe o aviso. Publicar não muda acesso: a escala vale pelo que está nela, e mudança depois
              aparece como alterada até a próxima publicação.
            </DialogDescription>
          </DialogHeader>
          {vagasMes > 0 && <p className="flex items-center gap-1.5 text-apoio text-atencao"><AlertTriangle className="size-3.5" /> O mês ainda tem vagas abertas.</p>}
          <label className="flex flex-col gap-[5px]">
            <span className="text-apoio font-medium text-grafite">Observação (opcional)</span>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: versão com as férias de outubro" />
          </label>
          <MensagemErro texto={publicando ? erro : null} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPublicando(false)}>Cancelar</Button>
            <Button onClick={() => void publicar()}><ShieldCheck /> Publicar{pub ? ` versão ${pub.versao + 1}` : ''}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
