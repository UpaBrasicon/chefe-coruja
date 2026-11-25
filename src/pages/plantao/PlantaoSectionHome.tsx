import { Suspense } from 'react'
import { useParams } from 'react-router-dom'
import { FolderSearch } from 'lucide-react'

import { acharSecaoPlantao, ehSecaoDireta } from '@/content/plantaoRegistry'
import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { ToolCard } from '@/components/plantonista/cards'
import { TituloPagina, Trilha, Vazio } from '@/components/monitor/Pagina'
import { Spinner } from '@/components/ui/spinner'

/**
 * Página de uma seção do Plantão. Com várias ferramentas, lista; com uma só,
 * renderiza a ferramenta aqui mesmo — sem obrigar um clique numa lista de um item.
 */
export default function PlantaoSectionHome() {
  const { secao: slugSecao } = useParams()
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const secao = acharSecaoPlantao(slugSecao ?? '')

  if (!secao) {
    return <Vazio icone={FolderSearch} titulo="Seção não encontrada" texto="O endereço não corresponde a nenhuma seção do Plantão." />
  }

  // As abas do Plantão (Meu turno, Minha agenda, Prontuários) não incluem as seções;
  // Internação e Observação moram na Internação do médico (RT, 24/11/2026).
  const trilha = <Trilha niveis={[{ rotulo: 'Plantão', to: '/plantao' }, { rotulo: secao.label }]} />

  if (ehSecaoDireta(secao)) {
    const Ferramenta = secao.tools[0].component
    return (
      <>
        {trilha}
        <TituloPagina icone={secao.icon} titulo={secao.label} descricao={secao.description} />
        <Suspense fallback={<div className="flex h-40 items-center justify-center"><Spinner /></div>}>
          <Ferramenta unidadeId={unidadeAtiva?.unidade_id} perfilId={perfil?.id} />
        </Suspense>
      </>
    )
  }

  return (
    <>
      {trilha}
      <TituloPagina icone={secao.icon} titulo={secao.label} descricao={secao.description} />
      <div className="grid gap-3 sm:grid-cols-2">
        {secao.tools.map((tool) => (
          <ToolCard key={tool.slug} to={`/plantao/${secao.slug}/${tool.slug}`} label={tool.label} description={tool.description} />
        ))}
      </div>
    </>
  )
}
