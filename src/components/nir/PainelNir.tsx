// Painel NIR (NIR1, modelo do RT de 25/11/2026), em duas colunas.
// À esquerda: busca ("/"), setor e os filtros com contagem (Todos, Ação NIR,
// Cobrar médico, Vaga / remoção, Sem regulação); cada linha com o leito, o
// nome, a idade, o nº do pedido (ou "Sem reg."), setor · tipo de leito ·
// prioridade, o isolamento e o sinal principal colorido. Sem regulação fica
// recolhido no fim. J/K e as setas andam na lista.
// À direita: o dossiê do paciente (DossieNir).
import { ChevronDown, Search } from 'lucide-react'
import * as React from 'react'

import { AbasLinha } from '@/components/nir/AbasLinha'
import { DossieNir } from '@/components/nir/DossieNir'
import { CodigoLeito, EtiquetaIso } from '@/components/nir/Etiquetas'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Input } from '@/components/ui/input'
import { rotuloIdade } from '@/domain/idade'
import { dataIso, tempoDecorrido } from '@/lib/formato'
import {
  FILTROS, contagens, contextoDoLeito, idsNavegaveis, listaNir, pedidoPrincipal, pendenciasAbertas, sinalPrincipal, vizinho,
  type FiltroNir, type MapaLeitos, type PendenciaUnidade, type Tom,
} from '@/lib/nirPainel'
import { PRIORIDADES, TIPOS_LEITO, prioridadeEfetiva } from '@/lib/regulacao'
import type { PacienteRegulacao } from '@/lib/regulacaoPaciente'
import { cn } from '@/lib/utils'

const FAIXA: Record<Tom, string> = {
  critico: 'border-l-critico', atencao: 'border-l-atencao', info: 'border-l-suprimento', sucesso: 'border-l-conforme', neutro: 'border-l-transparent',
}
const COR: Record<Tom, string> = {
  critico: 'text-critico', atencao: 'text-atencao', info: 'text-suprimento', sucesso: 'text-conforme', neutro: 'text-tinta-sussurro',
}

export function PainelNir({ unidadeId, lista, pend, mapa, agora, selecionado, selecionar, abrirNovo }: {
  unidadeId: string; lista: PacienteRegulacao[]; pend: PendenciaUnidade[]; mapa: MapaLeitos | undefined; agora: number
  selecionado: string | null; selecionar: (id: string | null) => void
  abrirNovo?: { pacienteId: string; vez: number } | null
}) {
  const [busca, setBusca] = React.useState('')
  const [setor, setSetor] = React.useState('')
  const [filtro, setFiltro] = React.useState<FiltroNir>('todos')
  const [semRegAberto, setSemRegAberto] = React.useState(false)
  const [verDossie, setVerDossie] = React.useState(false)
  const campoBusca = React.useRef<HTMLInputElement>(null)

  const medicosPorSetor = React.useMemo(
    () => Object.fromEntries((mapa?.setores ?? []).map((s) => [s.id, s.medicos.map((m) => m.nome)])), [mapa])
  const grupos = listaNir(lista, pend, { busca, setor, filtro, medicosPorSetor })
  const total = grupos.comRegulacao.length + grupos.semRegulacao.length
  // no filtro "Sem regulação" e na busca o grupo aparece aberto
  const semRegVisivel = semRegAberto || filtro === 'sem_regulacao' || !!busca.trim() || grupos.comRegulacao.length === 0
  const ids = idsNavegaveis(grupos, semRegVisivel)
  const conta = contagens(lista, pend)
  const setores = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const l of lista) if (l.setor) m.set(l.setor.id, l.setor.nome)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))
  }, [lista])

  // seleção: o pedido do aviso ou do mapa; sem ela (ou fora do filtro), o primeiro da lista
  const atual = selecionado && lista.some((l) => l.paciente.id === selecionado) ? selecionado : ids[0] ?? null
  const linha = lista.find((l) => l.paciente.id === atual) ?? null
  const escolher = React.useCallback((id: string | null) => { selecionar(id); if (id) setVerDossie(true) }, [selecionar])
  // o paciente escolhido de fora (aviso, mapa, pendências) fica visível mesmo no grupo recolhido
  const [selecionadoVisto, setSelecionadoVisto] = React.useState(selecionado)
  if (selecionado !== selecionadoVisto) {
    setSelecionadoVisto(selecionado)
    if (selecionado && grupos.semRegulacao.some((l) => l.paciente.id === selecionado)) setSemRegAberto(true)
    if (selecionado && !ids.includes(selecionado) && !grupos.semRegulacao.some((l) => l.paciente.id === selecionado)) {
      setFiltro('todos'); setSetor(''); setBusca('')
    }
  }

  // "/" busca; J/K e as setas andam na lista (fora dos campos e sem diálogo aberto)
  React.useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      const campo = !!alvo && (alvo.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName))
      if (campo || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[role="dialog"]')) return
      if (e.key === '/') { e.preventDefault(); campoBusca.current?.focus(); return }
      const delta = e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown' ? 1 : e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp' ? -1 : 0
      if (!delta) return
      e.preventDefault()
      const prox = vizinho(ids, atual, delta)
      if (prox) {
        selecionar(prox)
        document.getElementById(`nir-linha-${prox}`)?.scrollIntoView({ block: 'nearest' })
      }
    }
    document.addEventListener('keydown', tecla)
    return () => document.removeEventListener('keydown', tecla)
  }, [ids, atual, selecionar])

  const linhaDaLista = (l: PacienteRegulacao) => (
    <LinhaNir key={l.paciente.id} l={l} pend={pend} agora={agora} selecionado={l.paciente.id === atual}
      isolamento={mapa?.internados.find((x) => x.paciente_id === l.paciente.id)?.isolamento}
      onClick={() => escolher(l.paciente.id)} />
  )

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[420px_minmax(0,1fr)]">
      <aside aria-label="Pacientes por leito" className={cn('flex min-h-0 min-w-0 flex-col border-fio bg-superficie lg:border-r', verDossie && 'hidden lg:flex')}>
        <div className="flex shrink-0 gap-2 px-3 pt-2.5">
          <label className="relative flex min-w-0 flex-1 items-center">
            <Search className="pointer-events-none absolute left-2.5 size-3.5 text-tinta-sussurro" aria-hidden />
            <Input ref={campoBusca} value={busca} onChange={(e) => setBusca(e.target.value)} className="min-h-8 py-1 pr-8 pl-8 md:text-apoio"
              placeholder="Leito, paciente, nº, CID ou médico" aria-label="Buscar paciente" />
            <kbd className="cc-tecla absolute right-2">/</kbd>
          </label>
          <CampoSelecao tamanho="compacto" aria-label="Setor" className="w-36 shrink-0" value={setor} onChange={(e) => setSetor(e.target.value)}>
            <option value="">Todos os setores</option>
            {setores.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </CampoSelecao>
        </div>
        <AbasLinha rotulo="Filtros" tamanho="compacto" className="shrink-0 border-b border-fio px-1.5" valor={filtro} onChange={setFiltro}
          abas={FILTROS.map(([k, r]) => ({ valor: k, rotulo: r, contagem: conta[k] }))} />
        <div className="flex shrink-0 items-center justify-between border-b border-trilha px-3 py-1 text-rotulo text-tinta-sussurro">
          <span>{total === 1 ? '1 paciente listado' : `${total} pacientes listados`}</span>
          <span className="font-mono">J/K navegar · / buscar</span>
        </div>
        {total === 0 ? <p className="px-3 py-6 text-center text-tinta-sussurro">Nenhum paciente com estes filtros.</p> : (
          <div role="listbox" aria-label="Pacientes" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {grupos.comRegulacao.map(linhaDaLista)}
            {grupos.semRegulacao.length > 0 && filtro !== 'sem_regulacao' && grupos.comRegulacao.length > 0 && (
              <BotaoLinha variante="linha" aria-expanded={semRegVisivel} onClick={() => setSemRegAberto(!semRegAberto)}
                className="items-center gap-1.5 bg-campo px-3 py-1.5 text-rotulo font-semibold tracking-wide text-tinta-apoio uppercase">
                <ChevronDown className={cn('size-3.5 transition-transform', !semRegVisivel && '-rotate-90')} aria-hidden />
                Sem regulação ({grupos.semRegulacao.length})
                <span className="ml-auto font-normal">Internados na unidade</span>
              </BotaoLinha>
            )}
            {semRegVisivel && grupos.semRegulacao.map(linhaDaLista)}
          </div>
        )}
      </aside>
      <section aria-label="Dossiê do paciente" className={cn('min-h-0 min-w-0 overflow-y-auto bg-superficie', !verDossie && 'hidden lg:block')}>
        {linha ? (
          <DossieNir key={linha.paciente.id} unidadeId={unidadeId} linha={linha} pend={pend} agora={agora} contexto={contextoDoLeito(mapa, linha)}
            abrirNovo={abrirNovo && abrirNovo.pacienteId === linha.paciente.id ? abrirNovo.vez : undefined}
            voltar={() => setVerDossie(false)} />
        ) : (
          <p className="p-6 text-center text-tinta-sussurro">Escolha um paciente na lista.</p>
        )}
      </section>
    </div>
  )
}


function LinhaNir({ l, pend, agora, selecionado, isolamento, onClick }: {
  l: PacienteRegulacao; pend: PendenciaUnidade[]; agora: number; selecionado: boolean; isolamento: readonly string[] | undefined; onClick: () => void
}) {
  const p = pedidoPrincipal(l)
  const sinal = sinalPrincipal(l, pend, agora)
  const idade = l.paciente.nascimento ? rotuloIdade(l.paciente.nascimento, dataIso()) : null
  const avisado = pendenciasAbertas(l, pend).find((x) => x.status === 'medico_avisado')
  return (
    <BotaoLinha id={`nir-linha-${l.paciente.id}`} variante="linha" role="option" aria-selected={selecionado} onClick={onClick}
      className={cn('scroll-mt-2 flex-col gap-0.5 border-l-[3px] px-3 py-2 text-rotulo', FAIXA[sinal.tom], selecionado && 'bg-alerta-marca')}>
      <span className="flex w-full min-w-0 items-center gap-1.5">
        <CodigoLeito>{l.leito ?? (l.internacao ? 'Sem leito' : 'Porta')}</CodigoLeito>
        <span className="min-w-0 truncate text-apoio font-semibold text-tinta">{l.paciente.nome}</span>
        {idade && <span className="shrink-0 font-mono text-tinta-sussurro">{idade}</span>}
        <span className={cn('ml-auto shrink-0 font-mono', p ? 'text-tinta-apoio' : 'text-tinta-sussurro')}>{p ? `nº ${p.numero}` : 'Sem reg.'}</span>
      </span>
      <span className="flex w-full min-w-0 items-center gap-1.5 text-tinta-apoio">
        <span className="min-w-0 truncate">
          {[l.setor?.nome, p?.tipo_leito ? TIPOS_LEITO[p.tipo_leito] ?? p.tipo_leito : null, p ? PRIORIDADES[prioridadeEfetiva(p)].rotulo : null]
            .filter(Boolean).join(' · ') || 'Sem setor'}
        </span>
        <EtiquetaIso tipos={isolamento} />
      </span>
      <span className="flex w-full min-w-0 items-center gap-1.5">
        <span className={cn('min-w-0 truncate', COR[sinal.tom], sinal.tom !== 'neutro' && 'font-medium')} title={sinal.texto}>{sinal.texto}</span>
        {avisado && (
          <span className="shrink-0 rounded-controle bg-atencao/10 px-1 text-atencao">
            Médico avisado{avisado.avisado_em ? ` · ${tempoDecorrido(avisado.avisado_em, agora).replace(/^há /, '')}` : ''}
          </span>
        )}
      </span>
    </BotaoLinha>
  )
}
