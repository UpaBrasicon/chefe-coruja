import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { FolderSearch, Star } from 'lucide-react'

import { CHAVES_FERRAMENTAS, secaoExibida, type ToolExibida } from '@/content/registry'
import { GRUPOS_SECAO, idGrupo } from '@/content/gruposSecoes'
import { chaveFerramenta, useFavoritos } from '@/lib/useFavoritos'
import { publicoDaFerramenta, valeEmAdulto, valeEmCrianca } from '@/content/publicoFerramentas'
import { usePacienteCentral } from '@/lib/pacienteCentral'
import { TituloPagina, Trilha, Vazio } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function SectionHome() {
  const { section } = useParams()
  const secao = secaoExibida(section ?? '')
  const { favoritos, alternarFavorito } = useFavoritos(CHAVES_FERRAMENTAS)
  const [filtro, setFiltro] = useState('')
  const { modo } = usePacienteCentral()

  // Seções grandes vêm em grupos por especialidade; as demais, em lista única.
  const grupos = useMemo(() => {
    if (!secao) return []
    const def = GRUPOS_SECAO[secao.slug]
    const porSlug = new Map(secao.tools.map((t) => [t.slug, t]))
    const base = def
      ? def.map((g) => ({ rotulo: g.rotulo, tools: g.slugs.map((s) => porSlug.get(s)).filter((t): t is ToolExibida => !!t) }))
      : [{ rotulo: '', tools: secao.tools }]
    const q = semAcento(filtro.trim())
    if (!q) return base
    const casa = (t: ToolExibida) => semAcento([t.label, t.description, ...(t.tags ?? [])].join(' ')).includes(q)
    return base.map((g) => ({ ...g, tools: g.tools.filter(casa) })).filter((g) => g.tools.length > 0)
  }, [secao, filtro])

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
  const linha = (tool: ToolExibida) => {
    const chave = chaveFerramenta(tool.secao, tool.slug)
    const fav = favoritos.includes(chave)
    const a = aviso(tool)
    return (
      <div key={tool.slug} className="flex items-baseline gap-x-4 border-b border-trilha px-5 py-2.5 last:border-0">
        <div className="grid min-w-0 flex-1 gap-x-6 gap-y-0.5 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <Link to={`/plantonista/${tool.secao}/${tool.slug}`} className="text-controle font-medium text-acao hover:underline">{tool.label}</Link>
          <span className="text-apoio text-tinta-apoio">
            {tool.description}
            {a && <span className="text-atencao"> · {a}</span>}
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" aria-pressed={fav} aria-label={fav ? `Tirar ${tool.label} dos favoritos` : `Favoritar ${tool.label}`} onClick={() => alternarFavorito(chave)}>
          <Star className={cn(fav && 'fill-acao text-acao')} />
        </Button>
      </div>
    )
  }

  return (
    <>
      <Trilha niveis={[{ rotulo: 'Central do Plantonista', to: '/plantonista' }, { rotulo: secao.label }]} />
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
              {agrupada && !filtro && (
                <nav aria-label="Grupos da seção" className="flex flex-wrap gap-x-1 text-apoio text-tinta-sussurro">
                  <span>Ir para:</span>
                  {grupos.map((g, i) => (
                    <span key={g.rotulo}>
                      <a href={`#${idGrupo(g.rotulo)}`} className="text-tinta-apoio hover:text-acao">{g.rotulo}</a>
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
                      <span className="text-controle text-tinta-sussurro tabular-nums">{g.tools.length}</span>
                    </div>
                  )}
                  {g.tools.map(linha)}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
