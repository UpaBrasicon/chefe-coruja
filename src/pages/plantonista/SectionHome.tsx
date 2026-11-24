import { Fragment, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FolderSearch, Star } from 'lucide-react'

import { acharSecao, CHAVES_FERRAMENTAS, naCentral, secaoExibida, type ToolExibida } from '@/content/registry'
import { blocosComTemas, GRUPOS_SECAO, idGrupo, ROTULO_TIPO, tipoDaFerramenta, type TipoFerramenta } from '@/content/gruposSecoes'
import { chaveFerramenta, useFavoritos } from '@/lib/useFavoritos'
import { publicoDaFerramenta, valeEmAdulto, valeEmCrianca } from '@/content/publicoFerramentas'
import { usePacienteCentral } from '@/lib/pacienteCentral'
import { useRegistrarUsoApp } from '@/lib/usoApp'
import { Chip, TituloPagina, Trilha, Vazio } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Ferramenta de outra seção que entra num tema (F2): abre no endereço e com a chave de sempre. */
function ferramentaDeOutraSecao(chave: string): ToolExibida | undefined {
  const [secao, slug] = chave.split('/')
  if (!naCentral(secao, slug)) return undefined
  const t = acharSecao(secao)?.tools.find((x) => x.slug === slug)
  return t ? { ...t, secao } : undefined
}

export default function SectionHome() {
  const { section } = useParams()
  const secao = secaoExibida(section ?? '')
  const { favoritos, alternarFavorito } = useFavoritos(CHAVES_FERRAMENTAS)
  const [filtro, setFiltro] = useState('')
  const { modo } = usePacienteCentral()
  // Fase 1, item 14: troca de aba na Central, contada por dia, unidade e papel
  useRegistrarUsoApp('central_aba', secao ? secao.slug : null)

  // F2 (RT, 24/11/2026): filtro por tipo (conduta, escore, cálculo)
  const [tipo, setTipo] = useState<TipoFerramenta | null>(null)

  // Seções grandes vêm em grupos por especialidade; as demais, em lista única.
  // Dentro dos grupos, os temas juntam a conduta com os escores e cálculos do
  // mesmo assunto, inclusive de outra seção (F2, RT em 24/11/2026).
  const grupos = useMemo(() => {
    if (!secao) return []
    const def = GRUPOS_SECAO[secao.slug]
    const porSlug = new Map(secao.tools.map((t) => [t.slug, t]))
    const base = def
      ? def.map((g) => ({ rotulo: g.rotulo, tools: g.slugs.map((s) => porSlug.get(s)).filter((t): t is ToolExibida => !!t) }))
      : [{ rotulo: '', tools: secao.tools }]
    const comTemas = blocosComTemas(base, (t) => chaveFerramenta(t.secao, t.slug), ferramentaDeOutraSecao)
    const q = semAcento(filtro.trim())
    const casa = (t: ToolExibida) =>
      (!tipo || tipoDaFerramenta(t.secao, t.slug) === tipo) &&
      (!q || semAcento([t.label, t.description, ...(t.tags ?? [])].join(' ')).includes(q))
    return comTemas
      .map((g) => ({
        ...g,
        blocos: g.blocos.map((b) => ({ ...b, linhas: b.linhas.filter((l) => casa(l.tool)) })).filter((b) => b.linhas.length > 0),
      }))
      .filter((g) => g.blocos.length > 0)
  }, [secao, filtro, tipo])

  // Quantas de cada tipo a seção tem (o filtro só aparece com dois tipos ou mais).
  const porTipo = useMemo(() => {
    const n: Record<TipoFerramenta, number> = { conduta: 0, escore: 0, calculo: 0 }
    for (const t of secao?.tools ?? []) n[tipoDaFerramenta(t.secao, t.slug)]++
    return n
  }, [secao])

  if (!secao) {
    return <Vazio icone={FolderSearch} titulo="Seção não encontrada" texto="O endereço não corresponde a nenhuma seção clínica." />
  }

  const agrupada = !!GRUPOS_SECAO[secao.slug]
  // No modo do paciente, cada cartão diz se a ferramenta calcula para ele.
  const aviso = (tool: ToolExibida) => {
    const p = publicoDaFerramenta(tool.secao, tool.slug, tool.publico)
    if (modo === 'pediatrico' && !valeEmCrianca(p)) return 'Sem referência pediátrica'
    if (modo === 'adulto' && !valeEmAdulto(p)) return 'Só pediátrica'
    return undefined
  }
  // Índice de manual (revisão visual 3.8, opção C): uma linha por ferramenta,
  // nome e para que serve, no lugar da grade de cartões iguais.
  const linha = (tool: ToolExibida, externa = false) => {
    const chave = chaveFerramenta(tool.secao, tool.slug)
    const fav = favoritos.includes(chave)
    const a = aviso(tool)
    return (
      <div key={tool.slug} className="flex items-baseline gap-x-4 border-b border-trilha px-5 py-2.5 last:border-0">
        <div className="grid min-w-0 flex-1 gap-x-6 gap-y-0.5 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          {/* nome escuro e descrição apagada (revisão de 24/11/2026: o nome em cinza parecia desligado) */}
          <Link to={`/plantonista/${tool.secao}/${tool.slug}`} className="text-controle font-medium text-tinta underline-offset-4 hover:text-acao hover:underline">{tool.label}</Link>
          <span className="text-apoio text-tinta-sussurro">
            {tool.description}
            {a && <span className="text-atencao"> · {a}</span>}
          </span>
        </div>
        {/* F2: tipo da ferramenta e, se ela vem de outra seção, de onde (abre no endereço de sempre) */}
        <span className="max-w-36 shrink-0 text-right text-rotulo text-tinta-sussurro">
          {ROTULO_TIPO[tipoDaFerramenta(tool.secao, tool.slug)]}
          {externa && <> · em {secaoExibida(tool.secao)?.label ?? tool.secao}</>}
        </span>
        <Button variant="ghost" size="icon-sm" aria-pressed={fav} aria-label={fav ? `Tirar ${tool.label} dos favoritos` : `Favoritar ${tool.label}`} onClick={() => alternarFavorito(chave)}>
          <Star className={cn(fav && 'fill-acao text-acao')} />
        </Button>
      </div>
    )
  }

  return (
    <>
      <Trilha niveis={[{ rotulo: 'Central do Médico', to: '/plantonista' }, { rotulo: secao.label }]} />
      <TituloPagina icone={secao.icon} titulo={secao.label} descricao={secao.description} />
      {secao.tools.length === 0 ? (
        <Vazio icone={FolderSearch} titulo="Seção em preparo" texto="Nenhuma ferramenta desta seção tem fonte declarada ainda." />
      ) : (
        <>
          {/* filtro nas seções grandes (agrupadas ou com mais de 12 ferramentas, como os 39 escores) */}
          {(agrupada || secao.tools.length > 12) && (
            <div className="mb-4 flex flex-col gap-3">
              <Input
                aria-label="Filtrar ferramentas desta seção"
                placeholder={`Filtrar em ${secao.label} (${secao.tools.length} ferramentas)`}
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="max-w-md"
              />
              {/* F2: filtro por tipo, quando a seção tem mais de um */}
              {Object.values(porTipo).filter((n) => n > 0).length > 1 && (
                <div role="radiogroup" aria-label="Tipo de ferramenta" className="flex flex-wrap gap-2">
                  <Chip variante="opcao" radio ativo={tipo === null} onClick={() => setTipo(null)} contagem={secao.tools.length}>Todas</Chip>
                  {(['conduta', 'escore', 'calculo'] as const).filter((t) => porTipo[t] > 0).map((t) => (
                    <Chip key={t} variante="opcao" radio ativo={tipo === t} onClick={() => setTipo(tipo === t ? null : t)} contagem={porTipo[t]}>
                      {t === 'conduta' ? 'Condutas' : t === 'escore' ? 'Escores' : 'Cálculos'}
                    </Chip>
                  ))}
                </div>
              )}
              {agrupada && !filtro && !tipo && (
                <nav aria-label="Grupos da seção" className="flex flex-wrap gap-x-1 text-apoio text-tinta-sussurro">
                  <span>Ir para:</span>
                  {grupos.map((g, i) => (
                    <span key={g.rotulo}>
                      <a href={`#${idGrupo(g.rotulo)}`} className="text-acao underline-offset-4 hover:underline">{g.rotulo}</a>
                      {i < grupos.length - 1 && ' ·'}
                    </span>
                  ))}
                </nav>
              )}
            </div>
          )}
          {grupos.length === 0 && <Vazio icone={FolderSearch} titulo="Nada encontrado" texto="Nenhuma ferramenta desta seção corresponde ao filtro." />}
          {grupos.length > 0 && (
            <div className="overflow-hidden rounded-cartao border border-fio bg-superficie">
              {grupos.map((g) => (
                <section key={g.rotulo || 'todas'} id={g.rotulo ? idGrupo(g.rotulo) : undefined} aria-label={g.rotulo || secao.label} className="scroll-mt-20">
                  {g.rotulo && (
                    <div className="flex items-baseline gap-2 border-b border-trilha bg-campo px-5 py-2">
                      <span className="text-controle font-semibold text-tinta">{g.rotulo}</span>
                      <span className="text-controle text-tinta-sussurro tabular-nums">{g.blocos.reduce((n, b) => n + b.linhas.length, 0)}</span>
                    </div>
                  )}
                  {g.blocos.map((b) =>
                    b.tema ? (
                      // tema: a conduta e os escores e cálculos do mesmo assunto juntos (F2)
                      <div key={`tema:${b.tema}`} role="group" aria-label={b.tema} className="border-b border-trilha last:border-0">
                        <div className="px-5 pt-2.5 pb-0.5 text-rotulo font-semibold text-tinta-apoio">{b.tema}</div>
                        <div className="ml-5 border-l-2 border-trilha">
                          {b.linhas.map((l) => <Fragment key={chaveFerramenta(l.tool.secao, l.tool.slug)}>{linha(l.tool, l.externa)}</Fragment>)}
                        </div>
                      </div>
                    ) : (
                      <Fragment key={chaveFerramenta(b.linhas[0].tool.secao, b.linhas[0].tool.slug)}>{linha(b.linhas[0].tool)}</Fragment>
                    ),
                  )}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
