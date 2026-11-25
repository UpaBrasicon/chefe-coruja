// Solicitar exames do leito (modelo do RT de 25/11/2026, EXM1 a EXM5; antes,
// EX1 da revisão de 24/11/2026). Catálogo à esquerda, cesta fixa à direita e,
// embaixo, os pedidos já feitos nesta internação.
//
// Catálogo: uma busca só (atalho "/"), com o setor de cada exame (LAB, IMG,
// ECG) e, sem achar no catálogo, o exame avulso em texto livre com o setor
// escolhido. Combos da unidade (o gestor monta; sem combo, a linha some). Os
// frequentes da unidade em grade por setor, com "2× · 27/10" quando já pedido.
// Cesta: lista compacta (setor, nome, tirar), uma observação para o pedido todo
// (RT, 25/11/2026: não uma por exame), indicação clínica e CID-10 opcionais
// (EXM3), prioridade Rotina ou Urgente. "Solicitar e imprimir" abre a folha
// depois do pedido; "Apenas solicitar" só pede. O servidor continua com um
// pedido por setor (pedir_exames_internacao). Fora do plantão no setor do
// leito, a cesta avisa antes e não deixa pedir (a regra é do servidor; a
// tela lê o mesmo motivo da evolução, por_que_nao_evoluo).
// Pedidos já feitos: tabela com seleção para imprimir ou cancelar (cancelar
// pede motivo, como antes); cada linha abre o resultado do exame.
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, Plus, Search, X } from 'lucide-react'
import * as React from 'react'

import { ResultadoExame } from '@/components/clinico/ResultadoExame'
import { useMotivoEvolucao } from '@/components/evolucao/dados'
import { useCombosExames } from '@/components/exames/combos'
import { pendente, type PedidoLeito } from '@/components/internacao/exames/dados'
import type { PedidoParaImprimir } from '@/components/internacao/exames/ImprimirPedidoExames'
import { Chip, TituloCartao, VazioLinha } from '@/components/monitor/Pagina'
import { OpcaoLista } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { CaixaMarcar } from '@/components/ui/caixa-marcar'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useValorAdiado } from '@/hooks/useValorAdiado'
import { botoesDoGrupo, GRUPOS_EXAME, grupoDoCodigo, SITUACAO_EXAME, type ExameBuscado, type GrupoExame, type ListaExamesUnidade, type SituacaoExame, type Urgencia } from '@/lib/exames'
import {
  cidDoCampo, mesmoExame, pedidosDaCesta, porNaCesta, resumoJaPedido, ROTULO_SETOR, setorSugerido, textoJaPedido, type ItemCesta,
} from '@/lib/examesAba'
import { exameCabeParaSexo } from '@/lib/examesLeito'
import { dataHora, diaMes } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

type Item = ItemCesta
const SETORES_AVULSO: GrupoExame[] = ['laboratorio', 'imagem', 'grafico']
const AVISO_SEM_PLANTAO = 'Você não está de plantão neste setor agora: faça o check-in para pedir exames.'

/** Etiqueta do setor (LAB, IMG, ECG), em texto: a cor não carrega sentido aqui. */
export function EtiquetaSetor({ grupo }: { grupo: GrupoExame | null }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-controle border border-fio px-1.5 text-rotulo font-semibold tracking-[0.02em] text-tinta-apoio tabular-nums">
      {grupo ? ROTULO_SETOR[grupo] : 'LAB'}
    </span>
  )
}

export function PedidoExamesLeito({ internacaoId, pacienteId, pedidos, recarregar, aoImprimir }: {
  internacaoId: string; pacienteId?: string; pedidos: PedidoLeito[]; recarregar: () => void
  aoImprimir: (p: PedidoParaImprimir) => void
}) {
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
  const combos = useCombosExames(unidadeId)
  // mesma chave e colunas do cabeçalho do paciente: uma leitura só
  const paciente = useQuery({
    queryKey: ['cabecalho-paciente', pacienteId],
    enabled: !!pacienteId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('pacientes').select('nome, nome_social, data_nascimento, sexo').eq('id', pacienteId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
  // EXM3: o CID da internação sugere o do pedido (quem pede pode trocar ou apagar)
  const internacao = useQuery({
    queryKey: ['internacao-cid', internacaoId],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('internacoes').select('cid_principal').eq('id', internacaoId).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const sexo = paciente.data?.sexo ?? null

  const [cesta, setCesta] = React.useState<ItemCesta[]>([])
  const [termo, setTermo] = React.useState('')
  const [ativo, setAtivo] = React.useState(0)
  const [setorAvulso, setSetorAvulso] = React.useState<GrupoExame | null>(null)
  const [urgencia, setUrgencia] = React.useState<Urgencia>('rotina')
  const [indicacao, setIndicacao] = React.useState('')
  const [observacao, setObservacao] = React.useState('')
  // a mesma regra do servidor (evoluo_internacao): de plantão no setor do leito, agora
  const motivo = useMotivoEvolucao(internacaoId, true)
  const foraDoPlantao = !!motivo.data && !motivo.data.pode && motivo.data.motivo !== 'encerrada'
  const encerrada = motivo.data?.motivo === 'encerrada'
  const bloqueado = foraDoPlantao || encerrada
  const [cid, setCid] = React.useState<string | null>(null)
  const [pedindo, setPedindo] = React.useState(false)
  const [aviso, setAviso] = React.useState<{ erro: boolean; texto: string } | null>(null)
  const busca = React.useRef<HTMLInputElement>(null)
  const cidCampo = cid ?? internacao.data?.cid_principal ?? ''

  // atalho "/": vai para a busca (fora de campo de texto)
  React.useEffect(() => {
    const ir = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const alvo = e.target as HTMLElement | null
      if (alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))) return
      e.preventDefault()
      busca.current?.focus()
    }
    document.addEventListener('keydown', ir)
    return () => document.removeEventListener('keydown', ir)
  }, [])

  const t = useValorAdiado(termo.trim())
  const achou = useQuery({
    queryKey: ['buscar-exames', unidadeId, t],
    enabled: !!unidadeId && t.length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_exames', { p_unidade: unidadeId!, p_termo: t })
      if (error) throw error
      return (data ?? []) as unknown as ExameBuscado[]
    },
  })
  const achados: Item[] = (achou.data ?? []).flatMap((x) => {
    const grupo = grupoDoCodigo(x.procedimento)
    return grupo && exameCabeParaSexo(grupo, sexo) ? [{ rotulo: x.nome, procedimento: x.procedimento as string | null, grupo }] : []
  })
  const frequentes = GRUPOS_EXAME.filter((g) => exameCabeParaSexo(g.id, sexo))
    .map((g) => ({ grupo: g.id, itens: botoesDoGrupo(lista.data?.exames, g.id).map((b): Item => ({ ...b, grupo: g.id })) }))
    .filter((g) => g.itens.length > 0)
  const freqLab = frequentes.filter((g) => g.grupo === 'laboratorio' || g.grupo === 'citopatologia').flatMap((g) => g.itens)
  const freqImg = frequentes.filter((g) => g.grupo === 'imagem' || g.grupo === 'grafico').flatMap((g) => g.itens)
  const listaCombos = (combos.data?.combos ?? []).filter((c) => c.itens.length > 0)

  const naCesta = (b: Item) => cesta.some((m) => mesmoExame(m, b))
  const alternar = (b: Item) => setCesta((xs) => (xs.some((m) => mesmoExame(m, b)) ? xs.filter((m) => !mesmoExame(m, b)) : [...xs, { ...b }]))
  const mudar = (b: Item, d: Partial<ItemCesta>) => setCesta((xs) => xs.map((m) => (mesmoExame(m, b) ? { ...m, ...d } : m)))
  const ja = (b: Item) => {
    const r = resumoJaPedido(b, pedidos)
    return r ? textoJaPedido(r, r.ultimo ? diaMes(r.ultimo) : '') : ''
  }

  const avulsoSetor = setorAvulso ?? setorSugerido(t)
  const exato = achados.some((x) => x.rotulo.trim().toLowerCase() === t.toLowerCase())
  const opcoesBusca = achados.length + (exato ? 0 : 1)
  const escolherBusca = (k: number) => {
    if (k < achados.length) { if (!naCesta(achados[k])) alternar(achados[k]) } else if (t.length >= 2) {
      const r = porNaCesta(cesta, [{ rotulo: t, procedimento: null, grupo: avulsoSetor }])
      setCesta(r.cesta)
    }
    setTermo(''); setSetorAvulso(null); setAtivo(0)
  }
  const teclaBusca = (e: React.KeyboardEvent) => {
    if (t.length < 3) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtivo((a) => Math.min(a + 1, opcoesBusca - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setAtivo((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); escolherBusca(ativo) }
    if (e.key === 'Escape') { setTermo('') }
  }

  const aplicarCombo = (c: (typeof listaCombos)[number]) => {
    const itens: Item[] = c.itens.flatMap((i) => {
      const grupo = grupoDoCodigo(i.procedimento)
      return grupo && exameCabeParaSexo(grupo, sexo) ? [{ rotulo: i.nome_curto, procedimento: i.procedimento, grupo }] : []
    })
    const r = porNaCesta(cesta, itens)
    setCesta(r.cesta)
    setAviso({ erro: false, texto: r.entraram ? `Combo ${c.nome}: ${r.entraram} ${r.entraram === 1 ? 'exame entrou' : 'exames entraram'} na cesta.` : `Os exames do combo ${c.nome} já estão na cesta.` })
  }

  const cidNormal = cidDoCampo(cidCampo)
  async function solicitar(imprimir: boolean) {
    if (cidNormal === undefined) return setAviso({ erro: true, texto: 'CID-10 no formato A41 ou A41.9 (ou deixe em branco).' })
    setPedindo(true)
    const feitos: ItemCesta[] = []
    const falhas: string[] = []
    const obs = observacao.trim()
    let semPlantao = false
    for (const p of pedidosDaCesta(cesta, { indicacao, cid: cidNormal })) {
      // a observação do pedido vai no parâmetro do pedido: a mesma para todos os itens
      const { error } = await supabase.rpc('pedir_exames_internacao', {
        p_internacao: internacaoId, p_grupo: p.grupo, p_urgencia: urgencia, p_itens: p.itens, p_observacao: obs || undefined,
      })
      if (error && /médico de plantão com o paciente/.test(error.message)) semPlantao = true
      else if (error) falhas.push(`${GRUPOS_EXAME.find((g) => g.id === p.grupo)?.rotulo}: ${error.message}`)
      else feitos.push(...cesta.filter((m) => m.grupo === p.grupo))
    }
    if (semPlantao) falhas.unshift(AVISO_SEM_PLANTAO)
    setPedindo(false)
    setCesta((xs) => xs.filter((m) => !feitos.some((f) => mesmoExame(f, m))))
    recarregar()
    if (semPlantao) void motivo.refetch()
    if (feitos.length && imprimir) {
      aoImprimir({
        exames: feitos.map((m) => ({ exame: m.rotulo, grupo: m.grupo, obs, urgencia, indicacao, cid: cidNormal })),
        geral: { indicacao, cid: cidNormal, urgente: urgencia === 'urgente', obs },
      })
    }
    if (feitos.length) { setIndicacao(''); setObservacao(''); setUrgencia('rotina') }
    setAviso(falhas.length
      ? { erro: true, texto: `${feitos.length ? `Solicitados: ${feitos.map((m) => m.rotulo).join(', ')}. ` : ''}Não foi: ${falhas.join('; ')}` }
      : { erro: false, texto: `${feitos.length} ${feitos.length === 1 ? 'exame solicitado' : 'exames solicitados'}. Fica aguardando até o resultado.` })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <section aria-labelledby="catalogo-exames" className="flex flex-col gap-4 rounded-cartao border border-fio bg-superficie p-4">
          <TituloCartao id="catalogo-exames" className="mb-0" extra="Atalho de busca: /">Catálogo de solicitação</TituloCartao>
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
              <Input ref={busca} className="pl-9" aria-label="Buscar exame" role="combobox" aria-expanded={t.length >= 3} aria-controls="exames-achados"
                placeholder="Buscar exame por nome (laboratório, imagem, ECG) ou digitar exame avulso"
                value={termo} onChange={(e) => { setTermo(e.target.value); setAtivo(0) }} onKeyDown={teclaBusca} />
            </div>
            {t.length >= 3 && (
              <div id="exames-achados" role="listbox" aria-label="Exames achados" className="flex max-h-64 flex-col overflow-y-auto rounded-controle border border-fio">
                {achados.map((x, k) => {
                  const quando = ja(x)
                  return (
                    <OpcaoLista key={x.procedimento ?? x.rotulo} aria-selected={k === ativo} onClick={() => escolherBusca(k)}
                      className={`items-center ${k === ativo ? 'bg-trilha' : ''}`}>
                      <EtiquetaSetor grupo={x.grupo} />
                      <span className="min-w-0 flex-1 truncate text-tinta">{x.rotulo}</span>
                      <span className="shrink-0 text-rotulo text-tinta-sussurro">{naCesta(x) ? 'na cesta' : quando ? `pedido ${quando}` : ''}</span>
                    </OpcaoLista>
                  )
                })}
                {achou.isSuccess && achados.length === 0 && <span className="px-3 py-2 text-rotulo text-tinta-sussurro">Nada no catálogo com esse nome.</span>}
                {!exato && (
                  <div className={`flex flex-wrap items-center gap-2 border-t border-trilha px-3 py-2 ${ativo === achados.length ? 'bg-trilha' : ''}`}>
                    <span className="text-apoio text-tinta-apoio">Exame avulso: <span className="font-medium text-tinta">{t}</span></span>
                    <span role="radiogroup" aria-label="Setor do exame avulso" className="flex gap-1">
                      {SETORES_AVULSO.map((g) => (
                        <Chip key={g} radio ativo={avulsoSetor === g} onClick={() => setSetorAvulso(g)}>{ROTULO_SETOR[g]}</Chip>
                      ))}
                    </span>
                    <Button size="xs" variant="outline" className="ml-auto" onClick={() => escolherBusca(achados.length)}><Plus aria-hidden /> Adicionar avulso</Button>
                    <span className="basis-full text-rotulo text-tinta-sussurro">Sem código: não vai ao serviço integrado.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* EXM2: os combos da unidade; sem combo, a linha não aparece */}
          {listaCombos.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-rotulo font-semibold text-tinta-sussurro">Combos da unidade (1 clique)</span>
              <div className="flex flex-wrap gap-1.5">
                {listaCombos.map((c) => (
                  <Button key={c.id} size="sm" variant="outline" disabled={pedindo} onClick={() => aplicarCombo(c)}
                    title={c.itens.map((i) => i.nome_curto).join(', ')}>
                    <Plus aria-hidden /> {c.nome}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {[['Frequentes · Laboratório', freqLab], ['Frequentes · Imagem e ECG', freqImg]].map(([titulo, itens]) => (itens as Item[]).length > 0 && (
            <div key={titulo as string} className="flex flex-col gap-1.5">
              <span className="text-rotulo font-semibold text-tinta-sussurro">{titulo as string}</span>
              <div className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                {(itens as Item[]).map((b) => {
                  const quando = ja(b)
                  return (
                    <CaixaMarcar key={b.grupo + b.rotulo} marcado={naCesta(b)} onChange={() => alternar(b)} desabilitado={pedindo}
                      className="rounded-controle px-2 py-1.5 hover:bg-trilha" title={quando ? `Já pedido nesta internação: ${quando}` : undefined}>
                      <span className="flex items-baseline justify-between gap-2 text-apoio">
                        <span className="min-w-0 truncate text-tinta">{b.rotulo}</span>
                        {quando && <span className="shrink-0 text-rotulo text-tinta-sussurro tabular-nums">{quando}</span>}
                      </span>
                    </CaixaMarcar>
                  )
                })}
              </div>
            </div>
          ))}
        </section>

        <PedidosJaFeitos pedidos={pedidos} recarregar={recarregar} aoImprimir={aoImprimir} />
      </div>

      <aside aria-labelledby="cesta-exames" className="flex flex-col gap-3 self-start rounded-cartao border border-fio bg-superficie p-4 lg:sticky lg:top-4">
        <TituloCartao id="cesta-exames" className="mb-0"
          extra={cesta.length > 0 ? <Button size="xs" variant="link" className="min-h-0 px-0" onClick={() => setCesta([])}>Limpar</Button> : undefined}>
          Cesta do pedido ({cesta.length})
        </TituloCartao>
        {cesta.length === 0 ? (
          <VazioLinha>Escolha exames no catálogo, nos frequentes ou num combo para montar o pedido.</VazioLinha>
        ) : (
          <ul className="flex flex-col divide-y divide-trilha rounded-controle border border-fio">
            {cesta.map((m) => (
              <li key={m.grupo + m.rotulo + (m.procedimento ?? '')} className="flex items-center gap-2 px-3 py-1.5">
                {m.procedimento ? <EtiquetaSetor grupo={m.grupo} /> : (
                  // avulso: o setor é escolhido aqui
                  <CampoSelecao tamanho="compacto" aria-label={`Setor de ${m.rotulo}`} value={m.grupo} onChange={(e) => mudar(m, { grupo: e.target.value as GrupoExame })}
                    className="w-auto text-rotulo">
                    {SETORES_AVULSO.map((g) => <option key={g} value={g}>{ROTULO_SETOR[g]}</option>)}
                  </CampoSelecao>
                )}
                <span className="min-w-0 flex-1 truncate text-apoio text-tinta" title={m.rotulo}>{m.rotulo}</span>
                <Button type="button" variant="ghost" size="icon-xs" aria-label={`Tirar ${m.rotulo}`} onClick={() => alternar(m)}><X aria-hidden /></Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-1">
          <Label htmlFor="pedido-indicacao">Indicação clínica (opcional)</Label>
          <Input id="pedido-indicacao" maxLength={500} value={indicacao} onChange={(e) => setIndicacao(e.target.value)} placeholder="Hipótese ou justificativa" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor="pedido-cid">CID-10 (opcional)</Label>
            <Input id="pedido-cid" className="uppercase" maxLength={60} value={cidCampo} onChange={(e) => setCid(e.target.value)} placeholder="A41.9"
              aria-invalid={cidNormal === undefined} />
          </div>
          <div role="radiogroup" aria-label="Prioridade" className="flex gap-1.5 pb-0.5">
            <Chip radio ativo={urgencia === 'rotina'} onClick={() => setUrgencia('rotina')}>Rotina</Chip>
            <Chip radio ativo={urgencia === 'urgente'} tom="critico" onClick={() => setUrgencia('urgente')}>Urgente</Chip>
          </div>
        </div>
        {cidNormal === undefined && <span className="text-rotulo text-critico">CID-10 no formato A41 ou A41.9, ou em branco.</span>}
        {internacao.data?.cid_principal && cid === null && <span className="text-rotulo text-tinta-sussurro">CID da internação; troque ou apague se não for o do pedido.</span>}
        <div className="flex flex-col gap-1">
          <Label htmlFor="pedido-observacao">Observação do pedido (opcional)</Label>
          <Input id="pedido-observacao" maxLength={300} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Ex.: jejum, sem contraste" />
        </div>
        {bloqueado && (
          <p role="status" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-tinta">
            {encerrada ? 'Internação encerrada: não recebe pedido de exames.' : AVISO_SEM_PLANTAO}
          </p>
        )}
        <div className="flex flex-col gap-2 border-t border-trilha pt-3">
          <Button disabled={pedindo || bloqueado || cesta.length === 0} onClick={() => void solicitar(true)}>Solicitar e imprimir</Button>
          <Button variant="outline" disabled={pedindo || bloqueado || cesta.length === 0} onClick={() => void solicitar(false)}>Apenas solicitar</Button>
        </div>
        {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={`text-apoio ${aviso.erro ? 'text-critico' : 'text-conforme'}`}>{aviso.texto}</p>}
      </aside>
    </div>
  )
}

// ── pedidos já feitos nesta internação (EXM5) ───────────────────────────────

function PedidosJaFeitos({ pedidos, recarregar, aoImprimir }: { pedidos: PedidoLeito[]; recarregar: () => void; aoImprimir: (p: PedidoParaImprimir) => void }) {
  const [sel, setSel] = React.useState<Set<string>>(new Set())
  const [aberto, setAberto] = React.useState<string | null>(null)
  const [cancelando, setCancelando] = React.useState(false)
  const [motivo, setMotivo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const [verCancelados, setVerCancelados] = React.useState(false)
  const ativos = pedidos.filter((p) => p.situacao !== 'cancelado')
  const cancelados = pedidos.filter((p) => p.situacao === 'cancelado')
  const escolhidos = ativos.filter((p) => sel.has(p.id))
  const cancelaveis = escolhidos.filter(pendente)
  const todos = ativos.length > 0 && ativos.every((p) => sel.has(p.id))
  const alternar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const imprimir = () => aoImprimir({
    exames: escolhidos.map((p) => ({ exame: p.exame, grupo: p.grupo, obs: p.observacao, urgencia: p.urgencia, indicacao: p.indicacao, cid: p.cid })),
  })
  const cancelar = async () => {
    setErro(null)
    const falhas: string[] = []
    for (const p of cancelaveis) {
      const { error } = await supabase.rpc('resolver_exame', { p_exame: p.id, p_motivo_cancelamento: motivo.trim() })
      if (error) falhas.push(`${p.exame}: ${error.message}`)
    }
    recarregar()
    if (falhas.length) return setErro(falhas.join('; '))
    setCancelando(false); setMotivo(''); setSel(new Set())
  }

  return (
    <section aria-labelledby="pedidos-feitos" className="flex flex-col gap-2 rounded-cartao border border-fio bg-superficie p-4">
      <TituloCartao id="pedidos-feitos" className="mb-0" extra={`${ativos.length} ${ativos.length === 1 ? 'item' : 'itens'}`}>Pedidos já solicitados neste atendimento</TituloCartao>
      {escolhidos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-controle border border-acao/30 bg-alerta-marca px-3 py-2">
          <span className="text-apoio font-medium text-tinta">{escolhidos.length} {escolhidos.length === 1 ? 'pedido selecionado' : 'pedidos selecionados'}</span>
          <Button size="xs" onClick={imprimir}>Imprimir selecionados</Button>
          <Button size="xs" variant="destructive" disabled={cancelaveis.length === 0} onClick={() => setCancelando(true)}
            title={cancelaveis.length === 0 ? 'Só exame aguardando resultado pode ser cancelado' : undefined}>
            Cancelar selecionados{cancelaveis.length !== escolhidos.length && cancelaveis.length > 0 ? ` (${cancelaveis.length})` : ''}
          </Button>
          <Button size="xs" variant="link" className="min-h-0 px-0" onClick={() => setSel(new Set())}>Desmarcar</Button>
        </div>
      )}
      {cancelando && (
        <div className="flex flex-col gap-1.5 rounded-controle border border-fio p-3">
          <Label htmlFor="cancelar-motivo">Cancelar {cancelaveis.length} {cancelaveis.length === 1 ? 'exame' : 'exames'}: motivo</Label>
          <Textarea id="cancelar-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Mínimo de 10 letras" />
          {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setCancelando(false)}>Voltar</Button>
            <Button size="sm" disabled={motivo.trim().length < 10} onClick={() => void cancelar()}>Cancelar com este motivo</Button>
          </div>
        </div>
      )}
      {ativos.length === 0 ? <VazioLinha>Nenhum exame solicitado nesta internação.</VazioLinha> : (
        <Table className="min-w-[560px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-9">
                <input type="checkbox" className="size-4" aria-label="Selecionar todos os pedidos" checked={todos}
                  onChange={() => setSel(todos ? new Set() : new Set(ativos.map((p) => p.id)))} />
              </TableHead>
              <TableHead>Exame</TableHead>
              <TableHead>Setor</TableHead>
              <TableHead>Solicitado em</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {ativos.flatMap((p) => {
              const novo = p.situacao === 'resultado' && !p.resultado_visto_em
              const linhas = [
                <TableRow key={p.id} className={sel.has(p.id) ? 'bg-alerta-marca' : undefined}>
                  <TableCell>
                    <input type="checkbox" className="size-4" aria-label={`Selecionar ${p.exame}`} checked={sel.has(p.id)} onChange={() => alternar(p.id)} />
                  </TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-tinta">{p.exame}</span>
                      {p.urgencia === 'urgente' && <span className="text-rotulo font-semibold text-critico">urgente</span>}
                    </span>
                    {p.observacao && <span className="block text-rotulo text-tinta-sussurro">Obs.: {p.observacao}</span>}
                  </TableCell>
                  <TableCell><EtiquetaSetor grupo={p.grupo} /></TableCell>
                  <TableCell className="whitespace-nowrap text-apoio text-tinta-apoio">{dataHora(p.pedido_em)}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1.5 text-apoio">
                      <span className={pendente(p) ? 'text-atencao' : 'text-tinta'}>{SITUACAO_EXAME[p.situacao as SituacaoExame] ?? p.situacao}</span>
                      {/* o crítico vem só do laboratório */}
                      {p.critico && <span className="text-rotulo font-semibold text-critico">crítico (laboratório)</span>}
                      {novo && <span className="text-rotulo font-semibold text-acao">novo</span>}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="xs" variant="outline" aria-expanded={aberto === p.id} onClick={() => setAberto(aberto === p.id ? null : p.id)}>
                      {aberto === p.id ? 'Fechar' : p.situacao === 'resultado' ? 'Resultado' : 'Detalhe'}
                      <ChevronDown className={aberto === p.id ? 'rotate-180' : undefined} aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>,
              ]
              if (aberto === p.id) {
                linhas.push(
                  <TableRow key={`${p.id}-detalhe`} className="hover:bg-transparent">
                    <TableCell colSpan={6}><ResultadoExame exameId={p.id} aoMudar={recarregar} /></TableCell>
                  </TableRow>,
                )
              }
              return linhas
            })}
          </TableBody>
        </Table>
      )}
      {cancelados.length > 0 && (
        <div className="flex flex-col gap-1">
          <Button size="sm" variant="ghost" aria-expanded={verCancelados} onClick={() => setVerCancelados(!verCancelados)} className="self-start px-0 text-tinta-apoio hover:bg-transparent">
            <ChevronDown className={verCancelados ? 'rotate-180' : undefined} aria-hidden /> Cancelados ({cancelados.length})
          </Button>
          {verCancelados && cancelados.map((e) => (
            <p key={e.id} className="text-rotulo text-tinta-sussurro">{e.exame} · pedido {dataHora(e.pedido_em)} · cancelado: {e.motivo_cancelamento}</p>
          ))}
        </div>
      )}
    </section>
  )
}
