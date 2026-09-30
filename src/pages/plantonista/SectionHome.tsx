import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FolderSearch } from 'lucide-react'

import { acharSecao, CHAVES_FERRAMENTAS, type ToolDef } from '@/content/registry'
import { GRUPOS_SECAO, idGrupo } from '@/content/gruposSecoes'
import { chaveFerramenta, useFavoritos } from '@/lib/useFavoritos'
import { publicoDaFerramenta, valeEmAdulto, valeEmCrianca } from '@/content/publicoFerramentas'
import { usePacienteCentral } from '@/lib/pacienteCentral'
import { ToolCard } from '@/components/plantonista/cards'
import { TituloPagina, Trilha, Vazio } from '@/components/monitor/Pagina'
import { Input } from '@/components/ui/input'

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function SectionHome() {
  const { section } = useParams()
  const secao = acharSecao(section ?? '')
  const { favoritos, alternarFavorito } = useFavoritos(CHAVES_FERRAMENTAS)
  const [filtro, setFiltro] = useState('')
  const { modo } = usePacienteCentral()

  // Seções grandes vêm em grupos por especialidade; as demais, em lista única.
  const grupos = useMemo(() => {
    if (!secao) return []
    const def = GRUPOS_SECAO[secao.slug]
    const porSlug = new Map(secao.tools.map((t) => [t.slug, t]))
    const base = def
      ? def.map((g) => ({ rotulo: g.rotulo, tools: g.slugs.map((s) => porSlug.get(s)).filter((t): t is ToolDef => !!t) }))
      : [{ rotulo: '', tools: secao.tools }]
    const q = semAcento(filtro.trim())
    if (!q) return base
    const casa = (t: ToolDef) => semAcento([t.label, t.description, ...(t.tags ?? [])].join(' ')).includes(q)
    return base.map((g) => ({ ...g, tools: g.tools.filter(casa) })).filter((g) => g.tools.length > 0)
  }, [secao, filtro])

  if (!secao) {
    return <Vazio icone={FolderSearch} titulo="Seção não encontrada" texto="O endereço não corresponde a nenhuma seção clínica." />
  }

  const agrupada = !!GRUPOS_SECAO[secao.slug]
  // No modo do paciente, cada cartão diz se a ferramenta calcula para ele.
  const aviso = (tool: ToolDef) => {
    const p = publicoDaFerramenta(secao.slug, tool.slug, tool.publico)
    if (modo === 'pediatrico' && !valeEmCrianca(p)) return 'Sem referência pediátrica'
    if (modo === 'adulto' && !valeEmAdulto(p)) return 'Só pediátrica'
    return undefined
  }
  const cartao = (tool: ToolDef) => (
    <ToolCard
      key={tool.slug}
      badge={aviso(tool)}
      to={`/plantonista/${secao.slug}/${tool.slug}`}
      label={tool.label}
      description={tool.description}
      favorito={favoritos.includes(chaveFerramenta(secao.slug, tool.slug))}
      onFavoritar={() => alternarFavorito(chaveFerramenta(secao.slug, tool.slug))}
    />
  )

  return (
    <>
      <Trilha niveis={[{ rotulo: 'Central do Plantonista', to: '/plantonista' }, { rotulo: secao.label }]} />
      <TituloPagina icone={secao.icon} titulo={secao.label} descricao={secao.description} />
      {secao.tools.length === 0 ? (
        <Vazio icone={FolderSearch} titulo="Seção em preparo" texto="Nenhuma ferramenta desta seção tem fonte declarada ainda." />
      ) : (
        <>
          {agrupada && (
            <div className="mb-4 flex flex-col gap-3">
              <Input
                aria-label="Filtrar ferramentas desta seção"
                placeholder={`Filtrar em ${secao.label} (${secao.tools.length} ferramentas)`}
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="max-w-md"
              />
              {!filtro && (
                <nav aria-label="Grupos da seção" className="flex flex-wrap gap-2">
                  {grupos.map((g) => (
                    <a key={g.rotulo} href={`#${idGrupo(g.rotulo)}`} className="rounded-full border px-3 py-1 text-apoio text-tinta-apoio hover:bg-trilha/50">
                      {g.rotulo} <span className="tabular-nums text-tinta-sussurro">{g.tools.length}</span>
                    </a>
                  ))}
                </nav>
              )}
            </div>
          )}
          {grupos.length === 0 && <Vazio icone={FolderSearch} titulo="Nada encontrado" texto="Nenhuma ferramenta desta seção corresponde ao filtro." />}
          {grupos.map((g) => (
            <section key={g.rotulo || 'todas'} id={g.rotulo ? idGrupo(g.rotulo) : undefined} className="mb-6 scroll-mt-20">
              {g.rotulo && <h2 className="rotulo mb-2 text-tinta-apoio">{g.rotulo}</h2>}
              <div className="grid gap-3 sm:grid-cols-2">{g.tools.map(cartao)}</div>
            </section>
          ))}
        </>
      )}
    </>
  )
}
