import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Fuse from 'fuse.js'
import { ArrowRight, History, Pill, Search, Sparkles, Star, Stethoscope } from 'lucide-react'

import { CHAVES_FERRAMENTAS, SECOES, SECOES_EXIBIDAS, SECOES_JUNTAS, secaoExibida, type SecaoExibida } from '@/content/registry'
import { GRUPOS_SECAO } from '@/content/gruposSecoes'
import { publicoDaFerramenta, valeEmAdulto, valeEmCrianca } from '@/content/publicoFerramentas'
import { ROTA_SOBRE_MODULO } from '@/content/sobreModuloClinico'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useValorAdiado } from '@/hooks/useValorAdiado'
import { filtroDaUnidade } from '@/lib/medicamentoCadastro'
import { normalizar, normalizarMedicamento } from '@/lib/search'
import { expandirSiglas } from '@/lib/siglas'
import { supabase } from '@/lib/supabase'
import { buscarSemantico, useClinicalAsk, type ToolHit } from '@/lib/useClinicalAsk'
import { chaveFerramenta, useFavoritos } from '@/lib/useFavoritos'
import { usePacienteCentral } from '@/lib/pacienteCentral'
import { cn } from '@/lib/utils'
import { Chip, TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { BotaoLinha } from '@/components/ui/botao-linha'
import { Button } from '@/components/ui/button'
import { SeloAltaVigilancia } from '@/components/farmacia/SeloAltaVigilancia'
import { RespostaIa } from '@/components/plantonista/RespostaIa'
import { CartaoTurno } from '@/components/plantonista/central/CartaoTurno'
import { SessaoAssinatura } from '@/components/assinatura/SessaoAssinatura'
import { ModoPaciente } from '@/components/plantonista/central/ModoPaciente'
import { GuiaRapido } from '@/components/plantonista/central/GuiaRapido'
import { useLarguraAte } from '@/hooks/useLarguraAte'

// Central do Plantonista (P/index.html 1368–1566). Desde a onda 9 do porte a
// faixa de parâmetros saiu daqui: o cartão de turno a substitui (decisão do
// protótipo de 19–20/09). O paciente (adulto ou pediátrico) vem antes da
// ferramenta; favoritos e contagem de uso são do perfil, no banco.
//
// Busca (guia produto/docs/pesquisa/busca-ia-guia-implementacao.md, §9): a
// busca local (Fuse.js sobre nome, sinônimos e categoria) não usa rede e
// funciona com a biblioteca fora do ar; "Perguntar à IA" e as sugestões por
// significado passam pela Edge Function clinical-search.
//
// Revisão da Central (RT, 24/11/2026): M2 as seções numa lista à esquerda,
// ícones numa cor só; M3 a busca no centro com Recentes, Favoritos e Mais
// usados em abas; IA3 a resposta da IA em painel próprio (à direita na tela
// bem larga, por cima de tudo no celular); IA4 o remédio digitado mostra a
// ficha do medicamento antes das condutas.

type Ferramenta = {
  chave: string; secao: string; secaoLabel: string; slug: string; label: string; description: string; tags: string[]; categoria: string
  comCrianca: boolean; comAdulto: boolean
}

const CATEGORIA: Record<string, string> = {}
for (const [secao, grupos] of Object.entries(GRUPOS_SECAO)) for (const g of grupos) for (const s of g.slugs) CATEGORIA[`${secao}/${s}`] = g.rotulo

const TODAS: Ferramenta[] = SECOES.flatMap((s) =>
  s.tools.map((t) => {
    const publico = publicoDaFerramenta(s.slug, t.slug, t.publico)
    return {
      chave: chaveFerramenta(s.slug, t.slug),
      secao: s.slug,
      secaoLabel: secaoExibida(s.slug)?.label ?? s.label,
      slug: t.slug,
      label: t.label,
      description: t.description,
      tags: t.tags ?? [],
      categoria: CATEGORIA[`${s.slug}/${t.slug}`] ?? s.label,
      comCrianca: valeEmCrianca(publico),
      comAdulto: valeEmAdulto(publico),
    }
  }),
)

// Índice local: acentos ignorados nos campos e na consulta.
const semAcento = (v: unknown): string | string[] =>
  Array.isArray(v) ? v.map((x) => normalizar(String(x))) : v == null ? '' : normalizar(String(v))
const FUSE = new Fuse(TODAS, {
  keys: [
    { name: 'label', weight: 0.5 },
    { name: 'tags', weight: 0.3 },
    { name: 'categoria', weight: 0.2 },
    { name: 'description', weight: 0.15 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
  getFn: (obj, path) => semAcento(Fuse.config.getFn(obj, path)),
})

function buscarLocal(consulta: string): Ferramenta[] {
  const q = normalizar(consulta.trim())
  if (!q) return []
  // siglas ("icc", "tep", "cad"…) também procuram pela expansão
  const consultas = [q, ...expandirSiglas(consulta).map(normalizar)]
  const vistos = new Set<string>()
  const saida: Ferramenta[] = []
  for (const c of consultas) {
    for (const r of FUSE.search(c)) {
      if (!vistos.has(r.item.chave)) { vistos.add(r.item.chave); saida.push(r.item) }
    }
  }
  return saida
}

type Medicamento = { id: string; principio_ativo: string; concentracao: string | null; apresentacao: string | null; alta_vigilancia: boolean }
type MedicamentoAchado = { nome: string; ids: string[]; altaVigilancia: boolean; apresentacoes: string[] }

/**
 * IA4: o texto digitado bate com um medicamento do cadastro da unidade (o
 * mesmo da Referência de diluição)? Casa pelo começo de uma palavra do nome,
 * ou pelo nome inteiro dentro da pergunta ("dose de amiodarona na FA").
 */
function useMedicamentosDaBusca(consulta: string, unidadeId: string | undefined) {
  const adiada = normalizarMedicamento(useValorAdiado(consulta.trim()).slice(0, 120))
  // só letras e números (normalizarMedicamento), então cabem no filtro do PostgREST
  const palavras = [...new Set(adiada.split(' ').filter((p) => p.length >= 4 && !COMUNS.has(p)))].slice(0, 6)
  const chave = palavras.join(' ')
  const { data } = useQuery({
    queryKey: ['central-medicamento', chave, unidadeId],
    enabled: palavras.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medicamento')
        .select('id, principio_ativo, concentracao, apresentacao, alta_vigilancia')
        .eq('ativo', true).or(filtroDaUnidade(unidadeId))
        .or(palavras.map((p) => `principio_ativo_norm.ilike.%${p}%`).join(','))
        .order('principio_ativo')
        .limit(20)
      if (error) throw error
      return (data ?? []) as Medicamento[]
    },
  })
  return useMemo(() => {
    const ps = chave ? chave.split(' ') : []
    if (!ps.length || !data?.length) return []
    const porNome = new Map<string, MedicamentoAchado>()
    for (const m of data) {
      const nome = normalizarMedicamento(m.principio_ativo)
      const casa = nome.split(' ').some((w) => w.length >= 4 && ps.some((p) => w.startsWith(p))) || (nome.length >= 4 && adiada.includes(nome))
      if (!casa) continue
      const ja = porNome.get(m.principio_ativo) ?? { nome: m.principio_ativo, ids: [], altaVigilancia: false, apresentacoes: [] }
      ja.ids.push(m.id)
      ja.altaVigilancia ||= m.alta_vigilancia
      const ap = [m.concentracao, m.apresentacao].filter(Boolean).join(' ')
      if (ap && !ja.apresentacoes.includes(ap)) ja.apresentacoes.push(ap)
      porNome.set(m.principio_ativo, ja)
    }
    return [...porNome.values()].slice(0, 3)
  }, [data, chave, adiada])
}

/** Palavras da pergunta que não são nome de remédio (não vão à busca do cadastro). */
const COMUNS = new Set(['dose', 'doses', 'ataque', 'manutencao', 'qual', 'como', 'quando', 'para', 'com', 'sem', 'crianca', 'adulto', 'paciente', 'diluicao', 'diluir', 'infusao', 'conduta', 'tratamento', 'escore', 'calculo', 'instabilidade', 'insuficiencia', 'aguda', 'cronica', 'grave'])

function FichaMedicamentos({ achados }: { achados: MedicamentoAchado[] }) {
  if (!achados.length) return null
  return (
    <section aria-label="Medicamento" className="mb-5">
      <TituloSecao className="mb-2.5">
        <span className="flex items-center gap-1.5"><Pill className="size-4 text-tinta-sussurro" aria-hidden /> Medicamento</span>
      </TituloSecao>
      <div className="overflow-hidden rounded-cartao border border-fio bg-superficie">
        {achados.map((m) => (
          <div key={m.nome} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-trilha px-4 py-3 last:border-0">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-corpo font-semibold text-tinta">
                {m.nome}
                {m.altaVigilancia && <SeloAltaVigilancia />}
              </p>
              <p className="truncate text-apoio text-tinta-sussurro" title={m.apresentacoes.join(' · ')}>
                {m.apresentacoes.length ? m.apresentacoes.slice(0, 3).join(' · ') : 'sem apresentação cadastrada'}
                {m.apresentacoes.length > 3 ? ` · mais ${m.apresentacoes.length - 3}` : ''}
              </p>
            </div>
            <Link to={`/plantonista/farmacia/referencia-diluicao?m=${encodeURIComponent(m.ids[0])}&q=${encodeURIComponent(m.nome)}`}
              className="inline-flex items-center gap-1 text-apoio font-medium text-acao underline-offset-4 hover:underline">
              Ver diluição <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

function CartaoFerramenta({ f, favorito, onFavoritar, destacado, aviso }: { f: Ferramenta; favorito: boolean; onFavoritar: () => void; destacado?: boolean; aviso?: string }) {
  const navigate = useNavigate()
  return (
    <div className={cn('group relative rounded-container border border-fio bg-superficie transition-colors hover:border-acao', destacado && 'border-acao ring-2 ring-acao/30')}>
      <BotaoLinha
        onClick={() => navigate(`/plantonista/${f.secao}/${f.slug}`)}
        className="w-full items-stretch gap-0 border-0 bg-transparent px-4 py-3 pr-10 hover:bg-transparent"
      >
        <span className="rotulo block text-tinta-sussurro">{f.secaoLabel}{aviso ? ` · ${aviso}` : ''}</span>
        <span className="mt-1 block text-corpo font-semibold tracking-[-0.01em] text-tinta">{f.label}</span>
        <span className="mt-0.5 line-clamp-2 block text-apoio text-tinta-sussurro">{f.description}</span>
      </BotaoLinha>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onFavoritar}
        aria-pressed={favorito}
        aria-label={favorito ? `Tirar ${f.label} dos favoritos` : `Favoritar ${f.label}`}
        className="absolute top-2.5 right-2.5"
      >
        <Star className={cn('size-4', favorito && 'fill-acao text-acao')} />
      </Button>
    </div>
  )
}

/** Atalho de recente, favorito ou mais usado: ícone, nome e a seção. */
function Atalho({ f, vezes, favorito }: { f: Ferramenta; vezes: number; favorito?: boolean }) {
  const navigate = useNavigate()
  return (
    <BotaoLinha
      onClick={() => navigate(`/plantonista/${f.secao}/${f.slug}`)}
      className="flex-row items-center gap-[9px] border-0 border-b border-trilha px-4 py-[11px] last:border-0 hover:bg-campo"
    >
      {favorito ? <Star className="size-4 shrink-0 fill-acao text-acao" aria-hidden /> : <History className="size-4 shrink-0 text-tinta-sussurro" aria-hidden />}
      <span className="min-w-0 flex-1 text-apoio font-medium text-tinta">{f.label}</span>
      <span className="hidden truncate text-rotulo text-tinta-sussurro sm:block" title={vezes > 0 ? `Aberta ${vezes} ${vezes === 1 ? 'vez' : 'vezes'} por você` : undefined}>{f.secaoLabel}</span>
    </BotaoLinha>
  )
}

type Aba = 'recentes' | 'favoritos' | 'usados'

// Celular e tablet (abaixo de 1024 px, a mesma largura da barra de baixo): o
// Guia rápido (F4, RT em 17/11/2026). "Calculadoras e escores" abre esta mesma
// Central completa com ?todas=1. No computador nada muda.
export default function PlantonistaHome() {
  const estreito = useLarguraAte(1023)
  const [params] = useSearchParams()
  if (estreito && params.get('todas') !== '1') return <GuiaRapido />
  return <CentralCompleta />
}

function CentralCompleta() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { unidadeAtiva } = useUnidade()
  // a busca do início do celular chega aqui com o texto em ?q= (item 6, RT em 23/11/2026)
  const [params] = useSearchParams()
  const [consulta, setConsulta] = useState(() => (params.get('q') ?? '').slice(0, 800))
  const { favoritos, usos, lista, alternarFavorito } = useFavoritos(CHAVES_FERRAMENTAS)
  const paciente = usePacienteCentral()
  const unidadeId = unidadeAtiva?.unidade_id
  const ia = useClinicalAsk(unidadeId, paciente.modo)
  const campoBusca = useRef<HTMLInputElement>(null)
  const [destacado, setDestacado] = useState(-1)
  const [sugestoes, setSugestoes] = useState<ToolHit[] | null>(null)
  const [aba, setAba] = useState<Aba | null>(null)
  const estreito = useLarguraAte(1023)
  // IA3: o painel da resposta vai para a direita só quando cabe ao lado da busca
  const painelAoLado = !useLarguraAte(1399)

  const resultados = useMemo(() => buscarLocal(consulta), [consulta])
  const medicamentos = useMedicamentosDaBusca(consulta, unidadeId)
  const perguntavel = consulta.trim().length >= 3

  // "Perguntar à IA" da barra de baixo (?ia=1) e a busca flutuante (?busca=1) abrem
  // esta tela com o campo já em foco (item 6, CM1 e CM7).
  const focarAoAbrir = params.get('ia') === '1' || params.get('busca') === '1'
  useEffect(() => {
    if (focarAoAbrir) campoBusca.current?.focus()
  }, [focarAoAbrir])

  // Atalho "/" foca a busca (fora de campos de texto).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !alvo?.closest('input, textarea, select, [contenteditable="true"]')) {
        e.preventDefault()
        campoBusca.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Sem resultado local: sugere ferramentas por significado (busca semântica,
  // sem gerar texto). Falha em silêncio se a biblioteca estiver fora do ar.
  useEffect(() => {
    if (!perguntavel || resultados.length > 0 || !unidadeId) return
    const ac = new AbortController()
    const t = window.setTimeout(async () => {
      const r = await buscarSemantico(consulta.trim(), unidadeId, ac.signal, paciente.modo)
      if (!ac.signal.aborted) setSugestoes(r?.ferramentas ?? null)
    }, 450)
    return () => { window.clearTimeout(t); ac.abort() }
  }, [consulta, perguntavel, resultados.length, unidadeId, paciente.modo])

  const aoDigitar = (valor: string) => {
    setConsulta(valor)
    setDestacado(-1)
    setSugestoes(null)
  }

  const perguntar = () => {
    if (!perguntavel) return
    void ia.ask(consulta.trim())
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setDestacado((d) => Math.min(d + 1, resultados.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setDestacado((d) => Math.max(d - 1, -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      const f = resultados[destacado]
      if (f) navigate(`/plantonista/${f.secao}/${f.slug}`)
      else perguntar()
    } else if (e.key === 'Escape') {
      if (consulta) { aoDigitar(''); ia.limpar() } else campoBusca.current?.blur()
    }
  }

  // O aviso do cartão no modo do paciente em vigor.
  const avisoModo = (f: Ferramenta) =>
    paciente.modo === 'pediatrico' && !f.comCrianca ? 'sem referência pediátrica' : paciente.modo === 'adulto' && !f.comAdulto ? 'só pediátrica' : undefined

  const porChave = (c: string) => TODAS.find((f) => f.chave === c)
  const favoritosCards = favoritos.map(porChave).filter((f): f is Ferramenta => !!f)
  // Recentes: as últimas abertas por você (o banco guarda a data do último uso)
  const recentes = lista
    .filter((u) => u.ultimo_uso_em)
    .sort((a, b) => (b.ultimo_uso_em ?? '').localeCompare(a.ultimo_uso_em ?? ''))
    .map((u) => porChave(u.chave))
    .filter((f): f is Ferramenta => !!f)
    .slice(0, 8)
  const maisUsados = Object.entries(usos)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => porChave(c))
    .filter((f): f is Ferramenta => !!f)
    .slice(0, 8)
  const abas = ([
    ['recentes', 'Recentes', recentes],
    ['favoritos', 'Favoritos', favoritosCards],
    ['usados', 'Mais usados', maisUsados],
  ] as const).filter(([, , itens]) => itens.length > 0)
  const abaAtual = abas.find(([id]) => id === aba) ?? abas[0]

  // Grade do celular: sem paciente, ou com o peso que falta, os blocos ficam
  // inertes (P/index.html 32366–32395); no pediátrico conta quantas da seção
  // têm referência pediátrica. A lista larga não trava.
  const secoes = SECOES_EXIBIDAS.filter((s) => s.tools.length)
  const faltaPaciente = !paciente.modo || !paciente.leitura.completo
  const contagemModo = (s: SecaoExibida) => {
    const fs = TODAS.filter((f) => f.secao === s.slug || SECOES_JUNTAS[f.secao] === s.slug)
    if (paciente.modo === 'pediatrico') return { n: fs.filter((f) => f.comCrianca).length, texto: `${fs.filter((f) => f.comCrianca).length} de ${fs.length} com referência pediátrica` }
    if (paciente.modo === 'adulto') return { n: fs.filter((f) => f.comAdulto).length, texto: `${fs.filter((f) => f.comAdulto).length} de ${fs.length} para adulto` }
    return { n: fs.length, texto: `${fs.length} ${fs.length === 1 ? 'ferramenta' : 'ferramentas'}` }
  }

  const iaAberta = ia.status !== 'idle'
  const resposta = (
    <RespostaIa
      key={ia.pergunta}
      pergunta={ia.pergunta}
      texto={ia.texto}
      fontes={ia.fontes}
      ferramentas={ia.ferramentas}
      status={ia.status}
      alerta={ia.alerta}
      requestId={ia.requestId}
      publico={ia.publico}
      confianca={ia.confianca}
      pubmed={ia.pubmed}
      etapa={ia.etapa}
      anteriores={ia.anteriores}
      sugestoes={ia.sugestoes}
      onSeguir={ia.seguimento ? ia.seguir : undefined}
      onFechar={ia.limpar}
      className={estreito ? 'h-full rounded-none border-0' : painelAoLado ? 'max-h-[calc(100dvh-2rem)]' : 'mb-[22px]'}
    />
  )

  return (
    <div className="min-w-0">
      <TituloPagina
        icone={Stethoscope}
        titulo="Central do Médico"
        descricao={
          <>
            {unidadeAtiva && `${unidadeAtiva.unidade.nome} · ${TODAS.length} ferramentas clínicas · `}
            <Link to={ROTA_SOBRE_MODULO} className="text-acao underline-offset-4 hover:underline">Sobre o módulo clínico</Link>
          </>
        }
      />

      {/* Adulto ou pediátrico só no celular (pedido do RT de 23/10/2026): na
          tela larga cada ferramenta pergunta o paciente na própria tela. */}
      <div className="lg:hidden"><ModoPaciente /></div>
      <CartaoTurno unidadeId={unidadeId} perfilId={perfil?.id} ubs={unidadeAtiva?.unidade.tipo === 'ubs'} />
      {/* LG7: sessão de assinatura ICP-Brasil (some enquanto o assinador estiver desligado) */}
      <SessaoAssinatura />

      <div className={cn('grid items-start gap-x-8 gap-y-6 lg:grid-cols-[220px_minmax(0,1fr)]', iaAberta && painelAoLado && !estreito && 'lg:grid-cols-[200px_minmax(0,1fr)_minmax(380px,440px)]')}>
        {/* M2: seções clínicas como lista à esquerda, ícones numa cor só */}
        <nav aria-label="Seções clínicas" className="sticky top-4 hidden flex-col gap-0.5 lg:flex">
          <span className="rotulo mb-1.5 px-2.5 text-tinta-sussurro">Seções clínicas</span>
          {secoes.map((s) => {
            const Icone = s.icon
            return (
              <Link key={s.slug} to={`/plantonista/${s.slug}`} title={paciente.modo ? contagemModo(s).texto : `${s.tools.length} ferramentas`}
                className="flex items-center gap-2.5 rounded-controle px-2.5 py-2 text-apoio text-tinta no-underline hover:bg-campo hover:text-acao">
                <Icone className="size-4 shrink-0 text-tinta-sussurro" aria-hidden />
                <span className="min-w-0 flex-1 leading-tight">{s.label}</span>
                <span className="text-rotulo text-tinta-sussurro tabular">{s.tools.length}</span>
              </Link>
            )
          })}
        </nav>

        <div className="min-w-0">
          <div className="mb-[22px]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
              <input
                ref={campoBusca}
                type="search"
                value={consulta}
                onChange={(e) => aoDigitar(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Buscar por droga, escore ou conduta… ou pergunte à IA"
                aria-label="Buscar ferramenta ou perguntar à IA"
                aria-keyshortcuts="/"
                autoComplete="off"
                maxLength={800}
                className="h-12 w-full rounded-container border border-fio bg-superficie pr-3 pl-10 text-corpo text-tinta outline-none placeholder:text-tinta-sussurro focus-visible:border-acao focus-visible:shadow-anel-campo"
              />
            </div>
            {consulta.trim() && (
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={perguntar}
                  disabled={!perguntavel || !unidadeId || ia.status === 'loading' || ia.status === 'streaming'}
                  className="gap-1.5 rounded-container px-3 py-1.5 text-left font-medium whitespace-normal text-tinta hover:text-tinta"
                >
                  <Sparkles className="size-4 text-acao" aria-hidden />
                  Perguntar à IA: "{consulta.trim()}"
                </Button>
                <span className="text-apoio text-tinta-sussurro">Não digite nome, CPF ou dados identificáveis do paciente. Enter pergunta; ↑↓ escolhem uma ferramenta.</span>
              </div>
            )}
          </div>

          {iaAberta && !painelAoLado && !estreito && resposta}

          {consulta.trim() ? (
            <>
              <FichaMedicamentos achados={medicamentos} />
              <section aria-live="polite">
                <TituloSecao extra={`${resultados.length} ${resultados.length === 1 ? 'ferramenta' : 'ferramentas'}`}>
                  {medicamentos.length ? 'Condutas e ferramentas' : `Resultados para "${consulta.trim()}"`}
                </TituloSecao>
                {resultados.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {resultados.map((f, i) => (
                      <CartaoFerramenta key={f.chave} f={f} aviso={avisoModo(f)} favorito={favoritos.includes(f.chave)} onFavoritar={() => alternarFavorito(f.chave)} destacado={i === destacado} />
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-apoio text-tinta-sussurro">
                    <p>Nenhuma ferramenta com esse nome para "{consulta.trim()}".</p>
                    {sugestoes && sugestoes.length > 0 && (
                      <div className="mt-4 text-left">
                        <TituloSecao>Sugestões por significado</TituloSecao>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {sugestoes.map((s) => {
                            const f = TODAS.find((x) => `/plantonista/${x.secao}/${x.slug}` === s.rota)
                            return f ? <CartaoFerramenta key={f.chave} f={f} aviso={avisoModo(f)} favorito={favoritos.includes(f.chave)} onFavoritar={() => alternarFavorito(f.chave)} /> : null
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </>
          ) : (
            <>
              {/* M3: recentes, favoritos e mais usados em abas, embaixo da busca */}
              {abaAtual && (
                <section className="mb-[26px]" aria-label="Suas ferramentas">
                  <div role="radiogroup" aria-label="Suas ferramentas" className="mb-2.5 flex flex-wrap gap-2">
                    {abas.map(([id, rotulo, itens]) => (
                      <Chip key={id} radio ativo={abaAtual[0] === id} onClick={() => setAba(id)} contagem={itens.length}>{rotulo}</Chip>
                    ))}
                  </div>
                  <div className="overflow-hidden rounded-cartao border border-fio bg-superficie">
                    {abaAtual[2].map((f) => <Atalho key={f.chave} f={f} vezes={usos[f.chave] ?? 0} favorito={abaAtual[0] === 'favoritos'} />)}
                  </div>
                </section>
              )}
              {!abaAtual && (
                <p className="mb-[26px] flex items-center gap-2 text-apoio text-tinta-sussurro">
                  <History className="size-4" aria-hidden />
                  As ferramentas que você abrir e as favoritas aparecem aqui.
                </p>
              )}
              {/* Celular e tablet: as seções em lista, uma linha por seção (o ícone numa cor só) */}
              <section className="lg:hidden">
                <TituloSecao>Seções clínicas</TituloSecao>
                <div className="overflow-hidden rounded-cartao border border-fio bg-superficie">
                  {secoes.map((s) => {
                    const m = contagemModo(s)
                    const inerte = faltaPaciente || m.n === 0
                    const Icone = s.icon
                    return (
                      <BotaoLinha
                        key={s.slug}
                        variante="linha"
                        disabled={inerte}
                        onClick={() => navigate(`/plantonista/${s.slug}`)}
                        className={cn('items-center', inerte && 'opacity-60')}
                      >
                        <Icone className="size-[18px] shrink-0 text-tinta-sussurro" aria-hidden />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-controle font-medium text-tinta">{s.label}</span>
                          <span className="text-apoio text-tinta-sussurro">
                            {!paciente.modo ? 'Escolha adulto ou pediátrico' : !paciente.leitura.completo ? 'Aguardando os dados do paciente' : m.texto}
                          </span>
                        </span>
                        <span className="text-apoio tabular-nums text-tinta-sussurro">{s.tools.length}</span>
                      </BotaoLinha>
                    )
                  })}
                </div>
              </section>
            </>
          )}
        </div>

        {iaAberta && painelAoLado && !estreito && <div className="sticky top-4">{resposta}</div>}
      </div>

      {/* IA3 no celular e no tablet: a resposta cobre a tela, com o fechar no topo */}
      {iaAberta && estreito && (
        <div role="dialog" aria-modal="true" aria-label="Resposta da IA" className="fixed inset-0 z-50 flex flex-col bg-superficie pb-[env(safe-area-inset-bottom)]">
          {resposta}
        </div>
      )}
    </div>
  )
}

