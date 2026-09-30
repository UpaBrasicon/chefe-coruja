import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Fuse from 'fuse.js'
import { History, Search, Sparkles, Star, Stethoscope } from 'lucide-react'

import { CHAVES_FERRAMENTAS, SECOES, type SectionDef } from '@/content/registry'
import { GRUPOS_SECAO } from '@/content/gruposSecoes'
import { coresDaSecao } from '@/content/coresSecao'
import { publicoDaFerramenta, valeEmAdulto, valeEmCrianca } from '@/content/publicoFerramentas'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { normalizar } from '@/lib/search'
import { expandirSiglas } from '@/lib/siglas'
import { buscarSemantico, useClinicalAsk, type ToolHit } from '@/lib/useClinicalAsk'
import { chaveFerramenta, useFavoritos } from '@/lib/useFavoritos'
import { usePacienteCentral } from '@/lib/pacienteCentral'
import { cn } from '@/lib/utils'
import { Canal, Canais } from '@/components/monitor/Canais'
import { TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { RespostaIa } from '@/components/plantonista/RespostaIa'
import { CartaoTurno } from '@/components/plantonista/central/CartaoTurno'
import { ModoPaciente } from '@/components/plantonista/central/ModoPaciente'

// Central do Plantonista (P/index.html 1368–1566). Desde a onda 9 do porte a
// faixa de parâmetros saiu daqui: o cartão de turno a substitui (decisão do
// protótipo de 19–20/09). O paciente (adulto ou pediátrico) vem antes da
// ferramenta; favoritos e contagem de uso são do perfil, no banco.
//
// Busca (guia produto/docs/pesquisa/busca-ia-guia-implementacao.md, §9): a
// busca local (Fuse.js sobre nome, sinônimos e categoria) não usa rede e
// funciona com a biblioteca fora do ar; "Perguntar à IA" e as sugestões por
// significado passam pela Edge Function clinical-search.

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
      secaoLabel: s.label,
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

function CartaoFerramenta({ f, favorito, onFavoritar, destacado, aviso }: { f: Ferramenta; favorito: boolean; onFavoritar: () => void; destacado?: boolean; aviso?: string }) {
  const navigate = useNavigate()
  return (
    <div className={cn('group relative rounded-container border border-fio bg-superficie shadow-repouso transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-halo', destacado && 'border-marca ring-2 ring-marca/30')}>
      <button type="button" onClick={() => navigate(`/plantonista/${f.secao}/${f.slug}`)} className="block w-full px-4 py-3 pr-10 text-left">
        <span className="rotulo block text-tinta-sussurro">{f.secaoLabel}{aviso ? ` · ${aviso}` : ''}</span>
        <span className="mt-1 block text-corpo font-semibold tracking-[-0.01em] text-tinta">{f.label}</span>
        <span className="mt-0.5 line-clamp-2 block text-apoio text-tinta-sussurro">{f.description}</span>
      </button>
      <button
        type="button"
        onClick={onFavoritar}
        aria-pressed={favorito}
        aria-label={favorito ? `Tirar ${f.label} dos favoritos` : `Favoritar ${f.label}`}
        className="absolute top-2.5 right-2.5 rounded-controle-sm p-1 text-tinta-sussurro hover:text-acao"
      >
        <Star className={cn('size-4', favorito && 'fill-marca text-marca')} />
      </button>
    </div>
  )
}

/** Atalho de favorito / mais usado: ícone, nome e "N×" (P/index.html 1497–1509). */
function Atalho({ f, vezes, favorito }: { f: Ferramenta; vezes: number; favorito?: boolean }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(`/plantonista/${f.secao}/${f.slug}`)}
      className="flex items-center gap-[9px] rounded-container border border-fio bg-superficie px-5 py-[13px] text-left shadow-repouso transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-halo"
    >
      {favorito ? <Star className="size-4 shrink-0 fill-marca text-marca" aria-hidden /> : <History className={cn('size-4 shrink-0', coresDaSecao(f.secao).texto)} aria-hidden />}
      <span className="min-w-0 flex-1 text-apoio font-medium text-tinta">{f.label}</span>
      {vezes > 0 && <span className="text-rotulo text-tinta-sussurro tabular" title={`Aberta ${vezes} ${vezes === 1 ? 'vez' : 'vezes'} por você`}>{vezes}×</span>}
    </button>
  )
}

export default function PlantonistaHome() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { unidadeAtiva } = useUnidade()
  const [consulta, setConsulta] = useState('')
  const { favoritos, usos, alternarFavorito } = useFavoritos(CHAVES_FERRAMENTAS)
  const paciente = usePacienteCentral()
  const unidadeId = unidadeAtiva?.unidade_id
  const ia = useClinicalAsk(unidadeId)
  const campoBusca = useRef<HTMLInputElement>(null)
  const [destacado, setDestacado] = useState(-1)
  const [sugestoes, setSugestoes] = useState<ToolHit[] | null>(null)

  const resultados = useMemo(() => buscarLocal(consulta), [consulta])
  const perguntavel = consulta.trim().length >= 3

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
      const r = await buscarSemantico(consulta.trim(), unidadeId, ac.signal)
      if (!ac.signal.aborted) setSugestoes(r?.ferramentas ?? null)
    }, 450)
    return () => { window.clearTimeout(t); ac.abort() }
  }, [consulta, perguntavel, resultados.length, unidadeId])

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
  // "Mais usados por você": as quatro mais abertas que não são favoritas.
  const maisUsados = Object.entries(usos)
    .filter(([c, n]) => n > 0 && !favoritos.includes(c))
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => porChave(c))
    .filter((f): f is Ferramenta => !!f)
    .slice(0, 4)

  // Grade do celular: sem paciente, ou com o peso que falta, os blocos ficam
  // inertes (P/index.html 32366–32395); no pediátrico conta quantas da seção
  // têm referência pediátrica. A lista larga não trava.
  const secoes = SECOES.filter((s) => s.tools.length)
  const faltaPaciente = !paciente.modo || !paciente.leitura.completo
  const contagemModo = (s: SectionDef) => {
    const fs = TODAS.filter((f) => f.secao === s.slug)
    if (paciente.modo === 'pediatrico') return { n: fs.filter((f) => f.comCrianca).length, texto: `${fs.filter((f) => f.comCrianca).length} de ${fs.length} com referência pediátrica` }
    if (paciente.modo === 'adulto') return { n: fs.filter((f) => f.comAdulto).length, texto: `${fs.filter((f) => f.comAdulto).length} de ${fs.length} para adulto` }
    return { n: fs.length, texto: `${fs.length} ${fs.length === 1 ? 'ferramenta' : 'ferramentas'}` }
  }

  return (
    <div className="grid gap-6">
      <div className="min-w-0">
        <TituloPagina
          icone={Stethoscope}
          titulo="Central do Plantonista"
          descricao={unidadeAtiva ? `${unidadeAtiva.unidade.nome} · ${TODAS.length} ferramentas clínicas` : undefined}
        />

        <ModoPaciente />
        <CartaoTurno unidadeId={unidadeId} perfilId={perfil?.id} />

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
              className="h-11 w-full rounded-container border border-fio bg-superficie pr-3 pl-10 text-corpo text-tinta shadow-repouso outline-none placeholder:text-tinta-sussurro focus-visible:border-marca"
            />
          </div>
          {consulta.trim() && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={perguntar}
                disabled={!perguntavel || !unidadeId || ia.status === 'loading' || ia.status === 'streaming'}
                className="inline-flex items-center gap-1.5 rounded-container border border-fio bg-superficie px-3 py-1.5 text-apoio font-medium text-tinta shadow-repouso hover:border-marca disabled:opacity-50"
              >
                <Sparkles className="size-4 text-marca" aria-hidden />
                Perguntar à IA: “{consulta.trim()}”
              </button>
              <span className="text-apoio text-tinta-sussurro">Não digite nome, CPF ou dados identificáveis do paciente. Enter pergunta; ↑↓ escolhem uma ferramenta.</span>
            </div>
          )}
        </div>

        <RespostaIa
          pergunta={ia.pergunta}
          texto={ia.texto}
          fontes={ia.fontes}
          ferramentas={ia.ferramentas}
          status={ia.status}
          alerta={ia.alerta}
          requestId={ia.requestId}
          onFechar={ia.limpar}
        />

        {consulta.trim() ? (
          <section aria-live="polite">
            <TituloSecao extra={`${resultados.length} ${resultados.length === 1 ? 'ferramenta' : 'ferramentas'}`}>
              Resultados para “{consulta.trim()}”
            </TituloSecao>
            {resultados.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {resultados.map((f, i) => (
                  <CartaoFerramenta key={f.chave} f={f} aviso={avisoModo(f)} favorito={favoritos.includes(f.chave)} onFavoritar={() => alternarFavorito(f.chave)} destacado={i === destacado} />
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-apoio text-tinta-sussurro">
                <p>Nenhuma ferramenta com esse nome para “{consulta.trim()}”.</p>
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
        ) : (
          <>
            {favoritosCards.length > 0 && (
              <section className="mb-[26px]">
                <h2 className="rotulo mb-2.5 flex items-center gap-1.5 font-semibold text-tinta-sussurro uppercase">
                  <Star className="size-[13px] fill-marca text-marca" aria-hidden />
                  Favoritos
                </h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(258px,1fr))] gap-3.5">
                  {favoritosCards.map((f) => <Atalho key={f.chave} f={f} vezes={usos[f.chave] ?? 0} favorito />)}
                </div>
              </section>
            )}
            {maisUsados.length >= 2 && (
              <section className="mb-[26px]">
                <h2 className="rotulo mb-2.5 flex items-center gap-1.5 font-semibold text-tinta-sussurro uppercase">
                  <History className="size-[13px]" aria-hidden />
                  Mais usados por você
                </h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(258px,1fr))] gap-3.5">
                  {maisUsados.map((f) => <Atalho key={f.chave} f={f} vezes={usos[f.chave] ?? 0} />)}
                </div>
              </section>
            )}
            <section>
              <TituloSecao>Seções clínicas</TituloSecao>
              {/* Celular e tablet: grade de blocos na cor da seção. */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:hidden">
                {secoes.map((s) => {
                  const c = coresDaSecao(s.slug)
                  const m = contagemModo(s)
                  const inerte = faltaPaciente || m.n === 0
                  const Icone = s.icon
                  return (
                    <button
                      key={s.slug}
                      type="button"
                      disabled={inerte}
                      onClick={() => navigate(`/plantonista/${s.slug}`)}
                      className={cn(
                        'flex min-h-24 w-full flex-col items-start gap-2 rounded-cartao border px-[15px] py-3.5 text-left transition-[filter]',
                        inerte ? 'cursor-not-allowed border-fio bg-trilha opacity-70' : cn(c.bloco, 'hover:brightness-[0.97] active:brightness-[0.94]'),
                      )}
                    >
                      <span className={cn('grid size-9 place-items-center rounded-bloco', inerte ? 'bg-fio text-tinta-sussurro' : c.icone)}>
                        <Icone className="size-[19px]" aria-hidden />
                      </span>
                      <span className={cn('text-corpo leading-[1.25] font-semibold tracking-[-0.01em]', inerte ? 'text-tinta-sussurro' : c.texto)}>{s.label}</span>
                      <span className="mt-auto text-apoio text-tinta-apoio">
                        {!paciente.modo ? 'Escolha adulto ou pediátrico' : !paciente.leitura.completo ? 'Aguardando os dados do paciente' : m.texto}
                      </span>
                    </button>
                  )
                })}
              </div>
              {/* Largo: canais, a marca de cada seção na sua matiz; a lista não trava. */}
              <div className="hidden lg:block">
                <Canais rotulo="Seções clínicas">
                  {secoes.map((s) => (
                    <Canal
                      key={s.slug}
                      icone={s.icon}
                      nome={s.label}
                      exemplos={paciente.modo ? contagemModo(s).texto : s.tools.map((t) => t.label).join(' · ')}
                      contagem={s.tools.length}
                      unidade="ferr."
                      corIcone={coresDaSecao(s.slug).texto}
                      onClick={() => navigate(`/plantonista/${s.slug}`)}
                    />
                  ))}
                </Canais>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
