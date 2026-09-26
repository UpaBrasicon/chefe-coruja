import { useParams } from 'react-router-dom'
import { FolderSearch } from 'lucide-react'

import { acharSecao, CHAVES_FERRAMENTAS } from '@/content/registry'
import { chaveFerramenta, useFavoritos } from '@/lib/useFavoritos'
import { ToolCard } from '@/components/plantonista/cards'
import { TituloPagina, Trilha, Vazio } from '@/components/monitor/Pagina'

export default function SectionHome() {
  const { section } = useParams()
  const secao = acharSecao(section ?? '')
  const { favoritos, alternarFavorito } = useFavoritos(CHAVES_FERRAMENTAS)

  if (!secao) {
    return <Vazio icone={FolderSearch} titulo="Seção não encontrada" texto="O endereço não corresponde a nenhuma seção clínica." />
  }

  return (
    <>
      <Trilha niveis={[{ rotulo: 'Central do Plantonista', to: '/plantonista' }, { rotulo: secao.label }]} />
      <TituloPagina icone={secao.icon} titulo={secao.label} descricao={secao.description} />
      {secao.tools.length === 0 ? (
        <Vazio icone={FolderSearch} titulo="Seção em preparo" texto="Nenhuma ferramenta desta seção tem fonte declarada ainda." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {secao.tools.map((tool) => (
            <ToolCard
              key={tool.slug}
              to={`/plantonista/${secao.slug}/${tool.slug}`}
              label={tool.label}
              description={tool.description}
              favorito={favoritos.includes(chaveFerramenta(secao.slug, tool.slug))}
              onFavoritar={() => alternarFavorito(chaveFerramenta(secao.slug, tool.slug))}
            />
          ))}
        </div>
      )}
    </>
  )
}
