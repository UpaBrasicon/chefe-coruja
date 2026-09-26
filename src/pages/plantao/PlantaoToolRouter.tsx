import { Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { FolderSearch } from 'lucide-react'

import { acharSecaoPlantao } from '@/content/plantaoRegistry'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { TituloPagina, Trilha, Vazio } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'

/**
 * Resolve `/plantao/:secao/:tool` no registry do Plantão e injeta
 * `unidadeId` / `perfilId` — as ferramentas de documento dependem dos dois.
 */
export default function PlantaoToolRouter() {
  const { secao: slugSecao, tool } = useParams()
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()

  const secao = acharSecaoPlantao(slugSecao ?? '')
  const def = secao?.tools.find((t) => t.slug === tool)

  if (!secao || !def) {
    return <Vazio icone={FolderSearch} titulo="Ferramenta não encontrada" texto="O endereço não corresponde a nenhuma ferramenta do Plantão." />
  }

  const Ferramenta = def.component

  return (
    <>
      <Trilha niveis={[{ rotulo: 'Plantão', to: '/plantao' }, { rotulo: secao.label, to: `/plantao/${secao.slug}` }, { rotulo: def.label }]} />
      <TituloPagina icone={secao.icon} titulo={def.label} descricao={def.description} />
      <Suspense fallback={<div className="flex h-40 items-center justify-center"><Spinner /></div>}>
        <Ferramenta key={`${secao.slug}/${def.slug}`} unidadeId={unidadeAtiva?.unidade_id} perfilId={perfil?.id} />
      </Suspense>
    </>
  )
}
