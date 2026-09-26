import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BedDouble, Clock, Hourglass, Pill, Search, Star, Stethoscope } from 'lucide-react'

import { CHAVES_FERRAMENTAS, SECOES } from '@/content/registry'
import { useUnidade } from '@/contexts/UnidadeContext'
import { useFaixaPlantonista } from '@/hooks/useFaixaPlantonista'
import { formatarDuracao, nivelDaObservacao, nivelDoTurno, tempoDaJanela, tempoDeTurno, JANELA_OBSERVACAO_MIN } from '@/domain/plantao'
import { fuzzyMatch, normalizar } from '@/lib/search'
import { chaveFerramenta, useFavoritos, useRecentes } from '@/lib/useFavoritos'
import { cn } from '@/lib/utils'
import { Canal, Canais } from '@/components/monitor/Canais'
import { TituloPagina, TituloSecao } from '@/components/monitor/Pagina'
import { FaixaParametros, Parametro, type Nivel } from '@/components/monitor/Parametros'
import { DaUnidade } from '@/components/plantonista/DaUnidade'

// Central do Plantonista (design_handoff/telas/01): a página inicial do papel
// e a única tela do plantonista com a faixa de parâmetros. As seções clínicas
// são canais — linhas rotuladas —, não uma grade de cards.

type Ferramenta = { chave: string; secao: string; secaoLabel: string; slug: string; label: string; description: string; termos: string }

const TODAS: Ferramenta[] = SECOES.flatMap((s) =>
  s.tools.map((t) => ({
    chave: chaveFerramenta(s.slug, t.slug),
    secao: s.slug,
    secaoLabel: s.label,
    slug: t.slug,
    label: t.label,
    description: t.description,
    termos: [t.label, t.description, s.label, ...(t.tags ?? [])].join(' '),
  })),
)

function CartaoFerramenta({ f, favorito, onFavoritar }: { f: Ferramenta; favorito: boolean; onFavoritar: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="group relative rounded-container border border-fio bg-superficie shadow-repouso transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-halo">
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

  const resultados = useMemo(() => {
    const q = consulta.trim()
    if (!q) return []
    const n = normalizar(q)
    return TODAS
      .map((f) => ({ f, p: normalizar(f.label).includes(n) ? 3 : normalizar(f.termos).includes(n) ? 2 : fuzzyMatch(f.label, q) ? 1 : 0 }))
      .filter((r) => r.p > 0)
      .sort((a, b) => b.p - a.p)
      .map((r) => r.f)
  }, [consulta])

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

      <div className="grid gap-6 min-[1024px]:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <TituloPagina
            icone={Stethoscope}
            titulo="Central do Plantonista"
            descricao={unidadeAtiva ? `${unidadeAtiva.unidade.nome} · ${TODAS.length} ferramentas clínicas` : undefined}
          />

          <div className="relative mb-[22px]">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-tinta-sussurro" aria-hidden />
            <input
              type="search"
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              placeholder="Buscar por droga, escore ou conduta…"
              aria-label="Buscar ferramenta"
              className="h-11 w-full rounded-container border border-fio bg-superficie pr-3 pl-10 text-corpo text-tinta shadow-repouso outline-none placeholder:text-tinta-sussurro focus-visible:border-marca"
            />
          </div>

          {consulta.trim() ? (
            <section aria-live="polite">
              <TituloSecao extra={`${resultados.length} ${resultados.length === 1 ? 'ferramenta' : 'ferramentas'}`}>
                Resultados para “{consulta.trim()}”
              </TituloSecao>
              {resultados.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {resultados.map((f) => (
                    <CartaoFerramenta key={f.chave} f={f} favorito={favoritos.includes(f.chave)} onFavoritar={() => alternarFavorito(f.chave)} />
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-apoio text-tinta-sussurro">Nenhuma ferramenta encontrada para “{consulta.trim()}”.</p>
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

        <aside className="hidden min-[1024px]:block">
          <DaUnidade unidadeId={unidadeAtiva?.unidade_id} />
        </aside>
      </div>
    </>
  )
}
