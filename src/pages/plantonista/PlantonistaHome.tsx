import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Fuse from 'fuse.js'
import { BedDouble, Clock, Hourglass, Pill, Search, Sparkles, Star, Stethoscope } from 'lucide-react'

import { CHAVES_FERRAMENTAS, SECOES } from '@/content/registry'
import { GRUPOS_SECAO } from '@/content/gruposSecoes'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useFaixaPlantonista } from '@/hooks/useFaixaPlantonista'
import { formatarDuracao, nivelDaObservacao, nivelDoTurno, tempoDaJanela, tempoDeTurno, JANELA_OBSERVACAO_MIN } from '@/domain/plantao'
import { normalizar } from '@/lib/search'
import { expandirSiglas } from '@/lib/siglas'
import { buscarSemantico, useClinicalAsk, type ToolHit } from '@/lib/useClinicalAsk'
import { chaveFerramenta, useFavoritos, useRecentes } from '@/lib/useFavoritos'
import { cn } from '@/lib/utils'
import { Canal, Canais } from '@/components/monitor/Canais'
import { TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { FaixaParametros, Parametro, type Nivel } from '@/components/monitor/Parametros'
import { RespostaIa } from '@/components/plantonista/RespostaIa'

// Central do Plantonista (design_handoff/telas/01): a página inicial do papel
// e a única tela do plantonista com a faixa de parâmetros. As seções clínicas
// são canais — linhas rotuladas —, não uma grade de cards.
//
// Busca (guia produto/docs/pesquisa/busca-ia-guia-implementacao.md, §9): a
// busca local (Fuse.js sobre nome, sinônimos e categoria) não usa rede e
// funciona com a biblioteca fora do ar; "Perguntar à IA" e as sugestões por
// significado passam pela Edge Function clinical-search.

type Ferramenta = { chave: string; secao: string; secaoLabel: string; slug: string; label: string; description: string; tags: string[]; categoria: string }

const CATEGORIA: Record<string, string> = {}
for (const [secao, grupos] of Object.entries(GRUPOS_SECAO)) for (const g of grupos) for (const s of g.slugs) CATEGORIA[`${secao}/${s}`] = g.rotulo

const TODAS: Ferramenta[] = SECOES.flatMap((s) =>
  s.tools.map((t) => ({
    chave: chaveFerramenta(s.slug, t.slug),
    secao: s.slug,
    secaoLabel: s.label,
    slug: t.slug,
    label: t.label,
    description: t.description,
    tags: t.tags ?? [],
    categoria: CATEGORIA[`${s.slug}/${t.slug}`] ?? s.label,
  })),
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

function CartaoFerramenta({ f, favorito, onFavoritar, destacado }: { f: Ferramenta; favorito: boolean; onFavoritar: () => void; destacado?: boolean }) {
  const navigate = useNavigate()
  return (
    <div className={cn('group relative rounded-container border border-fio bg-superficie shadow-repouso transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-halo', destacado && 'border-marca ring-2 ring-marca/30')}>
      <button type="button" onClick={() => navigate(`/plantonista/${f.secao}/${f.slug}`)} className="block w-full px-4 py-3 pr-10 text-left">
        <span className="rotulo block text-tinta-sussurro">{f.secaoLabel}</span>
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

export default function PlantonistaHome() {
  const navigate = useNavigate()
  const { unidadeAtiva } = useUnidade()
  const [consulta, setConsulta] = useState('')
  const { favoritos, alternarFavorito } = useFavoritos(CHAVES_FERRAMENTAS)
  const { recentes } = useRecentes(CHAVES_FERRAMENTAS)
  const faixa = useFaixaPlantonista(unidadeAtiva?.unidade_id)
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

  const favoritosCards = favoritos.map((c) => TODAS.find((f) => f.chave === c)).filter((f): f is Ferramenta => !!f)
  const recentesCards = recentes
    .map((c) => TODAS.find((f) => f.chave === c))
    .filter((f): f is Ferramenta => !!f && !favoritos.includes(f.chave))
    .slice(0, 3)

  // ── Faixa: as quatro grandezas do plantonista ──────────────────────────────
  const d = faixa.data
  const ocupacao = d && d.leitos > 0 ? d.pacientes / d.leitos : undefined
  const nivelLeitos: Nivel = ocupacao === undefined ? 'ok' : ocupacao >= 0.95 ? 'critico' : ocupacao >= 0.85 ? 'atencao' : 'ok'
  // A janela da escala manda; o rótulo do relógio é só o recurso sem plantão.
  const turno = d?.janela ? tempoDaJanela(d.janela.inicio, d.janela.fim, d.agoraServidor) : d?.turno ? tempoDeTurno(d.turno, d.agoraServidor) : null
  const obsMin = d?.maiorObservacaoMin ?? null

  return (
    <>
      <FaixaParametros>
        <Parametro
          grandeza="leitos"
          icone={BedDouble}
          rotulo="Pacientes sob cuidado"
          valor={d ? d.pacientes : '—'}
          unidade={d && d.leitos ? `de ${d.leitos} leitos` : undefined}
          estado={!d ? 'Carregando' : d.setores.length === 0 ? 'Sem setor na escala agora' : nivelLeitos === 'ok' ? 'Dentro da capacidade' : nivelLeitos === 'atencao' ? 'Perto do limite' : 'Acima do limite'}
          nivel={nivelLeitos}
          pct={ocupacao}
          limite={ocupacao === undefined ? undefined : 0.85}
          limiteTexto={ocupacao === undefined ? undefined : 'limite 85%'}
          onClick={() => navigate('/plantao/internacao/pacientes')}
        />
        <Parametro
          grandeza="observacao"
          icone={Hourglass}
          rotulo="Maior permanência em observação"
          valor={obsMin === null ? '—' : formatarDuracao(obsMin)}
          estado={obsMin === null ? 'Ninguém em observação no seu acesso' : nivelDaObservacao(obsMin) === 'critico' ? 'Janela de 6 h estourada' : nivelDaObservacao(obsMin) === 'atencao' ? 'Última hora da janela' : 'Dentro da janela'}
          nivel={obsMin === null ? 'ok' : nivelDaObservacao(obsMin)}
          pct={obsMin === null ? undefined : Math.min(1, obsMin / (JANELA_OBSERVACAO_MIN * 1.25))}
          limite={obsMin === null ? undefined : 0.8}
          limiteTexto={obsMin === null ? undefined : 'limite 6 h'}
          onClick={() => navigate('/plantao/observacao')}
        />
        <Parametro
          grandeza="turno"
          icone={Clock}
          rotulo="Tempo restante do turno"
          valor={turno ? formatarDuracao(turno.restante) : '—'}
          estado={turno ? `Relógio do servidor · plantão de ${formatarDuracao(turno.duracao)}` : 'Turno não identificado'}
          nivel={turno ? nivelDoTurno(turno.restante) : 'ok'}
          pct={turno ? 1 - turno.restante / turno.duracao : undefined}
        />
        {/* Sem integração com a farmácia ainda: a tela diz que não quantifica. */}
        <Parametro
          grandeza="suprimento"
          icone={Pill}
          rotulo="Avisos da farmácia"
          valor="—"
          estado="Sem integração com a farmácia ainda"
          nivel="ok"
        />
      </FaixaParametros>

      {/* "Da unidade" mora na lateral da casca (P/index.html 915), não aqui. */}
      <div className="grid gap-6">
        <div className="min-w-0">
          <TituloPagina
            icone={Stethoscope}
            titulo="Central do Plantonista"
            descricao={unidadeAtiva ? `${unidadeAtiva.unidade.nome} · ${TODAS.length} ferramentas clínicas` : undefined}
          />

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
                    <CartaoFerramenta key={f.chave} f={f} favorito={favoritos.includes(f.chave)} onFavoritar={() => alternarFavorito(f.chave)} destacado={i === destacado} />
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
                          return f ? <CartaoFerramenta key={f.chave} f={f} favorito={favoritos.includes(f.chave)} onFavoritar={() => alternarFavorito(f.chave)} /> : null
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
                <section className="mb-[22px]">
                  <TituloSecao>Favoritos</TituloSecao>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {favoritosCards.map((f) => (
                      <CartaoFerramenta key={f.chave} f={f} favorito onFavoritar={() => alternarFavorito(f.chave)} />
                    ))}
                  </div>
                </section>
              )}
              {recentesCards.length > 0 && (
                <section className="mb-[22px]">
                  <TituloSecao>Usadas recentemente</TituloSecao>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {recentesCards.map((f) => (
                      <CartaoFerramenta key={f.chave} f={f} favorito={false} onFavoritar={() => alternarFavorito(f.chave)} />
                    ))}
                  </div>
                </section>
              )}
              <section>
                <TituloSecao>Seções clínicas</TituloSecao>
                <Canais rotulo="Seções clínicas">
                  {SECOES.filter((s) => s.tools.length).map((s) => (
                    <Canal
                      key={s.slug}
                      icone={s.icon}
                      nome={s.label}
                      exemplos={s.tools.map((t) => t.label).join(' · ')}
                      contagem={s.tools.length}
                      unidade="ferr."
                      corIcone="text-acao"
                      onClick={() => navigate(`/plantonista/${s.slug}`)}
                    />
                  ))}
                </Canais>
              </section>
            </>
          )}
        </div>

      </div>
    </>
  )
}
